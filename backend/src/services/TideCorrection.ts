/**
 * Tide Correction Service
 * Provides accurate tide data and corrections for marine depth readings
 */

import axios from 'axios';
import { FastifyInstance } from 'fastify';
import { executeSpatialQuery } from '../config/database';

export interface TideStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  chartDatum: number;
  timeZone: string;
  distance: number;
}

export interface TideLevel {
  timestamp: number;
  level: number;
  type: 'high' | 'low' | 'predicted';
  station: string;
}

export interface TidePrediction {
  currentLevel: number;
  nextHigh: { time: number; level: number };
  nextLow: { time: number; level: number };
  station: string;
  confidence: number;
  predictions: TideLevel[];
}

export interface TideCorrection {
  correction: number;
  correctedDepth: number;
  confidence: number;
  notes: string;
  station: TideStation;
  originalDepth: number;
}

export class TideCorrection {
  private static readonly NOAA_API_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
  private static readonly MAX_STATION_DISTANCE = 50000; // 50km max distance to tide station
  private static readonly CACHE_DURATION = 900000; // 15 minutes cache
  
  private static cache = new Map<string, { data: any; timestamp: number }>();
  
  /**
   * Calculate tide correction for a depth reading
   */
  static async calculateTideCorrection(
    latitude: number,
    longitude: number,
    depth: number,
    timestamp: number,
    fastify?: FastifyInstance
  ): Promise<TideCorrection> {
    try {
      // Find nearest tide station
      const nearestStation = await this.findNearestTideStation(
        latitude,
        longitude,
        fastify
      );
      
      if (!nearestStation) {
        return {
          correction: 0,
          correctedDepth: depth,
          confidence: 0,
          notes: 'No tide station available within range',
          station: null,
          originalDepth: depth,
        };
      }

      // Get tide level at the time of the reading
      const tideLevel = await this.getTideLevelAtTime(
        nearestStation.id,
        timestamp
      );
      
      if (tideLevel === null) {
        return {
          correction: 0,
          correctedDepth: depth,
          confidence: 0.3,
          notes: 'Tide data unavailable for this time',
          station: nearestStation,
          originalDepth: depth,
        };
      }

      // Calculate correction relative to chart datum
      const correction = tideLevel - nearestStation.chartDatum;
      const correctedDepth = Math.max(0, depth - correction);
      
      // Calculate confidence based on station distance and data quality
      const confidence = this.calculateTideConfidence(
        nearestStation.distance,
        Math.abs(correction),
        tideLevel
      );

      let notes = `Tide correction: ${correction > 0 ? '+' : ''}${correction.toFixed(2)}m`;
      if (nearestStation.distance > 10000) {
        notes += ` (station ${(nearestStation.distance / 1000).toFixed(1)}km away)`;
      }

      return {
        correction,
        correctedDepth,
        confidence,
        notes,
        station: nearestStation,
        originalDepth: depth,
      };

    } catch (error) {
      console.error('Error calculating tide correction:', error);
      return {
        correction: 0,
        correctedDepth: depth,
        confidence: 0,
        notes: 'Tide correction unavailable due to error',
        station: null,
        originalDepth: depth,
      };
    }
  }

  /**
   * Get current tide level for a location
   */
  static async getCurrentTideLevel(
    latitude: number,
    longitude: number,
    fastify?: FastifyInstance
  ): Promise<TidePrediction | null> {
    try {
      const nearestStation = await this.findNearestTideStation(
        latitude,
        longitude,
        fastify
      );
      
      if (!nearestStation) {
        return null;
      }

      const now = Date.now();
      const predictions = await this.getTidePredictions(
        nearestStation.id,
        now - 3600000, // 1 hour ago
        now + 43200000  // 12 hours ahead
      );

      if (!predictions || predictions.length === 0) {
        return null;
      }

      // Find current tide level (interpolate if necessary)
      const currentLevel = this.interpolateTideLevel(predictions, now);
      
      // Find next high and low tides
      const nextHigh = predictions.find(p => p.type === 'high' && p.timestamp > now);
      const nextLow = predictions.find(p => p.type === 'low' && p.timestamp > now);

      return {
        currentLevel,
        nextHigh: nextHigh ? { time: nextHigh.timestamp, level: nextHigh.level } : null,
        nextLow: nextLow ? { time: nextLow.timestamp, level: nextLow.level } : null,
        station: nearestStation.name,
        confidence: this.calculateTideConfidence(nearestStation.distance, 0, currentLevel),
        predictions,
      };

    } catch (error) {
      console.error('Error getting current tide level:', error);
      return null;
    }
  }

  /**
   * Find the nearest tide station to a location
   */
  private static async findNearestTideStation(
    latitude: number,
    longitude: number,
    fastify?: FastifyInstance
  ): Promise<TideStation | null> {
    try {
      if (!fastify) {
        // Fallback to hardcoded stations if no database connection
        return this.getFallbackTideStation(latitude, longitude);
      }

      const query = `
        SELECT 
          station_id as id,
          station_name as name,
          ST_Y(location::geometry) as latitude,
          ST_X(location::geometry) as longitude,
          chart_datum,
          time_zone,
          ST_Distance(location::geography, ST_MakePoint($2, $1)::geography) as distance_meters
        FROM tide_stations
        WHERE is_active = true
        AND ST_DWithin(location::geography, ST_MakePoint($2, $1)::geography, $3)
        ORDER BY distance_meters ASC
        LIMIT 1
      `;

      const result = await executeSpatialQuery(fastify, query, [
        latitude,
        longitude,
        this.MAX_STATION_DISTANCE
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      const station = result.rows[0];
      return {
        id: station.id,
        name: station.name,
        latitude: parseFloat(station.latitude),
        longitude: parseFloat(station.longitude),
        chartDatum: parseFloat(station.chart_datum),
        timeZone: station.time_zone,
        distance: parseFloat(station.distance_meters),
      };

    } catch (error) {
      console.error('Error finding nearest tide station:', error);
      return this.getFallbackTideStation(latitude, longitude);
    }
  }

  /**
   * Get tide level at specific time from NOAA API
   */
  private static async getTideLevelAtTime(
    stationId: string,
    timestamp: number
  ): Promise<number | null> {
    try {
      const cacheKey = `tide_${stationId}_${Math.floor(timestamp / 900000)}`;
      
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      const date = new Date(timestamp);
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
      
      const response = await axios.get(this.NOAA_API_BASE, {
        params: {
          product: 'water_level',
          application: 'WavesApp',
          station: stationId,
          begin_date: dateStr,
          end_date: dateStr,
          datum: 'MLLW',
          units: 'metric',
          time_zone: 'gmt',
          format: 'json',
        },
        timeout: 10000,
      });

      if (!response.data?.data) {
        return null;
      }

      // Find the closest time match
      const targetTime = timestamp / 1000;
      let closestReading = null;
      let smallestDiff = Infinity;

      for (const reading of response.data.data) {
        const readingTime = new Date(reading.t).getTime() / 1000;
        const diff = Math.abs(readingTime - targetTime);
        
        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestReading = reading;
        }
      }

      if (!closestReading || smallestDiff > 1800) { // More than 30 minutes difference
        return null;
      }

      const level = parseFloat(closestReading.v);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: level,
        timestamp: Date.now(),
      });

      return level;

    } catch (error) {
      console.error('Error getting tide level from NOAA:', error);
      return null;
    }
  }

  /**
   * Get tide predictions for a time range
   */
  private static async getTidePredictions(
    stationId: string,
    startTime: number,
    endTime: number
  ): Promise<TideLevel[]> {
    try {
      const cacheKey = `predictions_${stationId}_${Math.floor(startTime / 3600000)}`;
      
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      const startDate = new Date(startTime).toISOString().split('T')[0].replace(/-/g, '');
      const endDate = new Date(endTime).toISOString().split('T')[0].replace(/-/g, '');
      
      // Get high/low tide predictions
      const predictionResponse = await axios.get(this.NOAA_API_BASE, {
        params: {
          product: 'predictions',
          application: 'WavesApp',
          station: stationId,
          begin_date: startDate,
          end_date: endDate,
          datum: 'MLLW',
          units: 'metric',
          time_zone: 'gmt',
          format: 'json',
          interval: 'hilo',
        },
        timeout: 10000,
      });

      const predictions: TideLevel[] = [];

      if (predictionResponse.data?.predictions) {
        for (const pred of predictionResponse.data.predictions) {
          predictions.push({
            timestamp: new Date(pred.t).getTime(),
            level: parseFloat(pred.v),
            type: pred.type === 'H' ? 'high' : 'low',
            station: stationId,
          });
        }
      }

      // Get hourly predictions for interpolation
      const hourlyResponse = await axios.get(this.NOAA_API_BASE, {
        params: {
          product: 'predictions',
          application: 'WavesApp',
          station: stationId,
          begin_date: startDate,
          end_date: endDate,
          datum: 'MLLW',
          units: 'metric',
          time_zone: 'gmt',
          format: 'json',
          interval: '60',
        },
        timeout: 10000,
      });

      if (hourlyResponse.data?.predictions) {
        for (const pred of hourlyResponse.data.predictions) {
          predictions.push({
            timestamp: new Date(pred.t).getTime(),
            level: parseFloat(pred.v),
            type: 'predicted',
            station: stationId,
          });
        }
      }

      // Sort by timestamp
      predictions.sort((a, b) => a.timestamp - b.timestamp);

      // Cache the result
      this.cache.set(cacheKey, {
        data: predictions,
        timestamp: Date.now(),
      });

      return predictions;

    } catch (error) {
      console.error('Error getting tide predictions from NOAA:', error);
      return [];
    }
  }

  /**
   * Interpolate tide level for a specific time
   */
  private static interpolateTideLevel(
    predictions: TideLevel[],
    timestamp: number
  ): number {
    if (predictions.length === 0) return 0;

    // Find the two closest predictions
    let before: TideLevel | null = null;
    let after: TideLevel | null = null;

    for (const pred of predictions) {
      if (pred.timestamp <= timestamp) {
        before = pred;
      } else if (pred.timestamp > timestamp && !after) {
        after = pred;
        break;
      }
    }

    if (!before && !after) {
      return 0;
    }

    if (!before) {
      return after.level;
    }

    if (!after) {
      return before.level;
    }

    // Linear interpolation between the two points
    const timeDiff = after.timestamp - before.timestamp;
    const levelDiff = after.level - before.level;
    const ratio = (timestamp - before.timestamp) / timeDiff;

    return before.level + (levelDiff * ratio);
  }

  /**
   * Calculate confidence score for tide correction
   */
  private static calculateTideConfidence(
    stationDistance: number,
    correctionMagnitude: number,
    tideLevel: number
  ): number {
    let confidence = 1.0;

    // Reduce confidence based on station distance
    if (stationDistance > 50000) {
      confidence *= 0.3; // Very far station
    } else if (stationDistance > 25000) {
      confidence *= 0.6; // Far station
    } else if (stationDistance > 10000) {
      confidence *= 0.8; // Moderate distance
    }

    // Reduce confidence for large corrections
    if (correctionMagnitude > 3) {
      confidence *= 0.5; // Large tide correction
    } else if (correctionMagnitude > 1.5) {
      confidence *= 0.7; // Moderate tide correction
    }

    // Reduce confidence for extreme tide levels
    if (Math.abs(tideLevel) > 4) {
      confidence *= 0.6; // Extreme tide levels
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Fallback tide station data when database is unavailable
   */
  private static getFallbackTideStation(
    latitude: number,
    longitude: number
  ): TideStation | null {
    const fallbackStations: TideStation[] = [
      {
        id: '9414290',
        name: 'San Francisco Bay',
        latitude: 37.7749,
        longitude: -122.4194,
        chartDatum: 0.0,
        timeZone: 'PST8PDT',
        distance: 0,
      },
      {
        id: '8518750',
        name: 'New York Harbor',
        latitude: 40.7067,
        longitude: -74.0141,
        chartDatum: 0.0,
        timeZone: 'EST5EDT',
        distance: 0,
      },
      {
        id: '9447130',
        name: 'Seattle',
        latitude: 47.6024,
        longitude: -122.3394,
        chartDatum: 0.0,
        timeZone: 'PST8PDT',
        distance: 0,
      },
    ];

    // Find closest station
    let closest: TideStation | null = null;
    let minDistance = Infinity;

    for (const station of fallbackStations) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        station.latitude,
        station.longitude
      );

      if (distance < minDistance && distance < this.MAX_STATION_DISTANCE) {
        minDistance = distance;
        closest = { ...station, distance };
      }
    }

    return closest;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Clean up old cache entries
   */
  static cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; oldEntries: number } {
    const now = Date.now();
    let oldEntries = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        oldEntries++;
      }
    }

    return {
      size: this.cache.size,
      oldEntries,
    };
  }
}