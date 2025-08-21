// NOAA API Integration Service
// Tides, currents, and marine weather data integration

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { redis } from '../config/redis';
import { db } from '../config/database';
import { TideData, WeatherData, Point } from '../types';
import logger from '../utils/logger';
import config from '../config';

export class NOAAService {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.noaa.baseUrl;
    this.apiKey = config.noaa.apiKey;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'User-Agent': 'Waves-Marine-Navigation/1.0'
      }
    });

    // Add request interceptor for API key
    this.client.interceptors.request.use((config) => {
      if (this.apiKey) {
        config.headers['X-API-Key'] = this.apiKey;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('NOAA API error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url
        });
        throw error;
      }
    );
  }

  /**
   * Get tide data for a specific station
   */
  async getTideData(
    stationId: string,
    startDate?: Date,
    endDate?: Date,
    interval: 'hilo' | '6' | '60' = 'hilo'
  ): Promise<TideData[]> {
    try {
      const cacheKey = `noaa_tide_${stationId}_${interval}_${startDate?.getTime()}_${endDate?.getTime()}`;
      
      // Check cache first
      const cachedData = await redis.getCachedTideData(cacheKey);
      if (cachedData) {
        logger.debug('Returning cached NOAA tide data', { stationId, cacheKey });
        return cachedData;
      }

      // Prepare date parameters
      const beginDate = startDate ? this.formatDate(startDate) : this.formatDate(new Date());
      const endDate2 = endDate ? this.formatDate(endDate) : this.formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

      const params = {
        product: 'predictions',
        application: 'Waves_Marine_Navigation',
        format: 'json',
        station: stationId,
        begin_date: beginDate,
        end_date: endDate2,
        datum: 'MLLW',
        time_zone: 'gmt',
        units: 'metric',
        interval: interval
      };

      logger.info('Fetching NOAA tide data', { stationId, params });

      const response = await this.client.get('/', { params });

      if (!response.data?.predictions) {
        throw new Error('Invalid NOAA tide data response');
      }

      // Get station metadata
      const stationInfo = await this.getStationInfo(stationId);

      // Transform NOAA data to our format
      const tideData: TideData[] = response.data.predictions.map((prediction: any) => ({
        id: `${stationId}_${prediction.t}`,
        stationId,
        location: {
          latitude: stationInfo.lat,
          longitude: stationInfo.lng
        },
        timestamp: new Date(prediction.t),
        heightMeters: parseFloat(prediction.v),
        tideType: this.determineTideType(prediction.type),
        predictionData: {
          original: prediction,
          datum: 'MLLW',
          units: 'metric'
        },
        createdAt: new Date()
      }));

      // Cache for 1 hour
      await redis.cacheTideData(cacheKey, tideData, 3600);

      // Store in database for historical reference
      await this.storeTideDataInDB(tideData);

      logger.info('NOAA tide data retrieved successfully', {
        stationId,
        recordCount: tideData.length,
        timeRange: `${beginDate} to ${endDate2}`
      });

      return tideData;

    } catch (error) {
      logger.error('Error fetching NOAA tide data:', error);
      throw new Error(`Failed to fetch tide data from NOAA: ${error.message}`);
    }
  }

  /**
   * Get current conditions for a station
   */
  async getCurrentConditions(stationId: string): Promise<WeatherData | null> {
    try {
      const cacheKey = `noaa_current_${stationId}`;
      
      // Check cache first (cache for 10 minutes)
      const cachedData = await redis.getCachedWeatherData(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const params = {
        product: 'water_level',
        application: 'Waves_Marine_Navigation',
        format: 'json',
        station: stationId,
        date: 'latest',
        datum: 'MLLW',
        time_zone: 'gmt',
        units: 'metric'
      };

      const response = await this.client.get('/', { params });

      if (!response.data?.data || response.data.data.length === 0) {
        return null;
      }

      const latestReading = response.data.data[0];
      const stationInfo = await this.getStationInfo(stationId);

      const weatherData: WeatherData = {
        id: `noaa_current_${stationId}_${latestReading.t}`,
        location: {
          latitude: stationInfo.lat,
          longitude: stationInfo.lng
        },
        timestamp: new Date(latestReading.t),
        source: 'NOAA',
        // Water level data - not full weather, but useful for marine conditions
        forecastData: {
          waterLevel: parseFloat(latestReading.v),
          datum: 'MLLW',
          quality: latestReading.q,
          sigma: latestReading.s,
          flags: latestReading.f
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      };

      // Cache for 10 minutes
      await redis.cacheWeatherData(cacheKey, weatherData, 600);

      return weatherData;

    } catch (error) {
      logger.error('Error fetching NOAA current conditions:', error);
      return null;
    }
  }

  /**
   * Find nearest tide stations to a location
   */
  async findNearestStations(location: Point, radiusKm: number = 50): Promise<any[]> {
    try {
      const cacheKey = `noaa_stations_${location.latitude}_${location.longitude}_${radiusKm}`;
      
      const cachedStations = await redis.getCachedWeatherData(cacheKey);
      if (cachedStations) {
        return cachedStations;
      }

      // NOAA doesn't have a direct API for finding stations by location
      // We'll use a predefined list of major stations and calculate distances
      const majorStations = await this.getMajorTideStations();
      
      const nearbyStations = majorStations
        .map(station => ({
          ...station,
          distance: this.calculateDistance(location, {
            latitude: station.lat,
            longitude: station.lng
          })
        }))
        .filter(station => station.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10); // Limit to 10 nearest stations

      // Cache for 24 hours
      await redis.cacheWeatherData(cacheKey, nearbyStations, 86400);

      return nearbyStations;

    } catch (error) {
      logger.error('Error finding nearest NOAA stations:', error);
      return [];
    }
  }

  /**
   * Get marine weather forecast from NOAA
   */
  async getMarineWeatherForecast(location: Point): Promise<WeatherData[]> {
    try {
      // Use NOAA's National Weather Service API for marine forecasts
      const nwsClient = axios.create({
        baseURL: 'https://api.weather.gov',
        timeout: 10000,
        headers: {
          'User-Agent': 'Waves-Marine-Navigation/1.0'
        }
      });

      // Get the nearest weather grid point
      const pointResponse = await nwsClient.get(`/points/${location.latitude},${location.longitude}`);
      
      if (!pointResponse.data?.properties?.forecastZone) {
        throw new Error('No weather forecast zone found for location');
      }

      const forecastZone = pointResponse.data.properties.forecastZone;
      const gridId = pointResponse.data.properties.gridId;
      const gridX = pointResponse.data.properties.gridX;
      const gridY = pointResponse.data.properties.gridY;

      // Get marine forecast
      const marineResponse = await nwsClient.get(`/gridpoints/${gridId}/${gridX},${gridY}/forecast`);

      if (!marineResponse.data?.properties?.periods) {
        throw new Error('No forecast periods found');
      }

      const forecastPeriods = marineResponse.data.properties.periods;

      const weatherData: WeatherData[] = forecastPeriods.map((period: any, index: number) => ({
        id: `nws_marine_${gridId}_${gridX}_${gridY}_${index}`,
        location,
        timestamp: new Date(period.startTime),
        source: 'NOAA_NWS',
        windSpeedKnots: this.parseWindSpeed(period.detailedForecast),
        windDirection: this.parseWindDirection(period.detailedForecast),
        temperatureCelsius: this.fahrenheitToCelsius(period.temperature),
        forecastData: {
          name: period.name,
          temperature: period.temperature,
          temperatureUnit: period.temperatureUnit,
          windSpeed: period.windSpeed,
          windDirection: period.windDirection,
          shortForecast: period.shortForecast,
          detailedForecast: period.detailedForecast,
          icon: period.icon,
          isDaytime: period.isDaytime
        },
        createdAt: new Date(),
        expiresAt: new Date(period.endTime)
      }));

      logger.info('NOAA marine weather forecast retrieved', {
        location,
        forecastPeriods: weatherData.length,
        gridPoint: `${gridId}/${gridX},${gridY}`
      });

      return weatherData;

    } catch (error) {
      logger.error('Error fetching NOAA marine weather forecast:', error);
      throw new Error(`Failed to fetch marine weather forecast: ${error.message}`);
    }
  }

  /**
   * Get station information
   */
  private async getStationInfo(stationId: string): Promise<{ lat: number; lng: number; name: string }> {
    try {
      const params = {
        application: 'Waves_Marine_Navigation',
        format: 'json',
        station: stationId
      };

      const response = await this.client.get('/mdapi/prod/webapi/stations.json', { params });

      if (!response.data?.stations || response.data.stations.length === 0) {
        throw new Error(`Station ${stationId} not found`);
      }

      const station = response.data.stations[0];
      
      return {
        lat: parseFloat(station.lat),
        lng: parseFloat(station.lng),
        name: station.name
      };

    } catch (error) {
      logger.error('Error fetching NOAA station info:', error);
      // Return default coordinates if station info fails
      return {
        lat: 37.7749,
        lng: -122.4194,
        name: `Station ${stationId}`
      };
    }
  }

  /**
   * Store tide data in database for historical reference
   */
  private async storeTideDataInDB(tideData: TideData[]): Promise<void> {
    try {
      for (const tide of tideData) {
        const query = `
          INSERT INTO tide_data (
            id, station_id, location, timestamp, height_meters, tide_type, prediction_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            height_meters = EXCLUDED.height_meters,
            tide_type = EXCLUDED.tide_type,
            prediction_data = EXCLUDED.prediction_data
        `;

        await db.query(query, [
          tide.id,
          tide.stationId,
          db.createPoint(tide.location.latitude, tide.location.longitude),
          tide.timestamp,
          tide.heightMeters,
          tide.tideType,
          JSON.stringify(tide.predictionData)
        ]);
      }

      logger.debug('Tide data stored in database', { count: tideData.length });

    } catch (error) {
      logger.error('Error storing tide data in database:', error);
      // Don't throw - this is not critical for the API response
    }
  }

  /**
   * Get list of major tide stations
   */
  private async getMajorTideStations(): Promise<any[]> {
    // Major NOAA tide stations - this would ideally be loaded from a comprehensive database
    return [
      { id: '9414290', name: 'San Francisco, CA', lat: 37.8063, lng: -122.4651 },
      { id: '9410170', name: 'Los Angeles, CA', lat: 33.719, lng: -118.2684 },
      { id: '9447130', name: 'Seattle, WA', lat: 47.6062, lng: -122.3321 },
      { id: '8518750', name: 'The Battery, NY', lat: 40.7, lng: -74.0167 },
      { id: '8571421', name: 'Chesapeake Bay Bridge Tunnel, VA', lat: 36.9667, lng: -76.0133 },
      { id: '8761724', name: 'Grand Isle, LA', lat: 29.2633, lng: -89.9567 },
      { id: '8729840', name: 'Key West, FL', lat: 24.5550, lng: -81.8082 },
      { id: '8665530', name: 'Charleston, SC', lat: 32.7817, lng: -79.9250 }
    ];
  }

  /**
   * Format date for NOAA API
   */
  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }

  /**
   * Determine tide type from NOAA prediction type
   */
  private determineTideType(type?: string): 'high' | 'low' | 'rising' | 'falling' | undefined {
    if (!type) return undefined;
    
    switch (type.toLowerCase()) {
      case 'h':
      case 'high':
        return 'high';
      case 'l':
      case 'low':
        return 'low';
      default:
        return undefined;
    }
  }

  /**
   * Parse wind speed from forecast text
   */
  private parseWindSpeed(forecastText: string): number | undefined {
    const windMatch = forecastText.match(/wind[s]?\s+(\d+)\s*(?:to\s+(\d+))?\s*mph/i);
    if (windMatch) {
      const speed = parseInt(windMatch[2] || windMatch[1]);
      return speed * 0.868976; // Convert mph to knots
    }
    return undefined;
  }

  /**
   * Parse wind direction from forecast text
   */
  private parseWindDirection(forecastText: string): number | undefined {
    const directionMap: { [key: string]: number } = {
      'n': 0, 'north': 0,
      'ne': 45, 'northeast': 45,
      'e': 90, 'east': 90,
      'se': 135, 'southeast': 135,
      's': 180, 'south': 180,
      'sw': 225, 'southwest': 225,
      'w': 270, 'west': 270,
      'nw': 315, 'northwest': 315
    };

    const dirMatch = forecastText.match(/wind[s]?\s+([a-z]+)/i);
    if (dirMatch) {
      const direction = dirMatch[1].toLowerCase();
      return directionMap[direction];
    }
    return undefined;
  }

  /**
   * Convert Fahrenheit to Celsius
   */
  private fahrenheitToCelsius(fahrenheit: number): number {
    return (fahrenheit - 32) * 5 / 9;
  }

  /**
   * Calculate distance between two points in kilometers
   */
  private calculateDistance(point1: Point, point2: Point): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.degreesToRadians(point2.latitude - point1.latitude);
    const dLon = this.degreesToRadians(point2.longitude - point1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.degreesToRadians(point1.latitude)) * Math.cos(this.degreesToRadians(point2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// Create singleton instance
export const noaaService = new NOAAService();