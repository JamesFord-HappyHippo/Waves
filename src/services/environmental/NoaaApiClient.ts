/**
 * NOAA Tides & Currents API Client
 * Real-time tide data with station optimization for marine navigation
 */

import { Location } from '../../types';

export interface NoaaStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  state: string;
  region: string;
  timezone: string;
  tideType: 'harmonic' | 'subordinate';
  distance?: number; // Distance from query location in meters
}

export interface TidePrediction {
  time: string;
  value: number;
  type: 'H' | 'L'; // High or Low tide
}

export interface WaterLevel {
  time: string;
  value: number;
  sigma?: number;
  flags?: string[];
  quality?: 'verified' | 'preliminary';
}

export interface CurrentData {
  time: string;
  speed: number;
  direction: number;
  bin?: number;
}

export interface MeteorologicalData {
  time: string;
  airTemperature?: number;
  waterTemperature?: number;
  windSpeed?: number;
  windDirection?: number;
  windGusts?: number;
  barometricPressure?: number;
  visibility?: number;
}

export interface NoaaApiResponse<T> {
  metadata: {
    id: string;
    name: string;
    lat: string;
    lon: string;
  };
  data: T[];
}

export interface StationSearchParams {
  latitude: number;
  longitude: number;
  maxDistance?: number; // km, default 50
  maxStations?: number; // default 10
  product?: 'water_level' | 'predictions' | 'currents' | 'met';
}

export interface DataQueryParams {
  stationId: string;
  product: 'water_level' | 'predictions' | 'currents' | 'air_temperature' | 
           'water_temperature' | 'wind' | 'air_pressure' | 'visibility';
  beginDate?: string; // YYYYMMDD or YYYYMMDD HH:mm
  endDate?: string;
  datum?: 'MLLW' | 'MSL' | 'STND' | 'NAVD';
  units?: 'metric' | 'english';
  timeZone?: 'gmt' | 'lst_ldt';
  format?: 'json' | 'xml' | 'csv';
  interval?: 'h' | 'hilo' | '6' | '60'; // hourly, high/low only, 6min, hourly
}

export class NoaaApiClient {
  private baseUrl = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
  private stationCache = new Map<string, NoaaStation[]>();
  private dataCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private requestQueue: Promise<any>[] = [];
  private maxConcurrentRequests = 5;

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Rate limiting and request queuing
   */
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    while (this.requestQueue.length >= this.maxConcurrentRequests) {
      await Promise.race(this.requestQueue);
    }

    const promise = requestFn().finally(() => {
      const index = this.requestQueue.indexOf(promise);
      if (index > -1) {
        this.requestQueue.splice(index, 1);
      }
    });

    this.requestQueue.push(promise);
    return promise;
  }

  /**
   * Cache management with TTL
   */
  private getCached<T>(key: string): T | null {
    const cached = this.dataCache.get(key);
    if (cached && Date.now() < cached.timestamp + cached.ttl) {
      return cached.data as T;
    }
    this.dataCache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttlMinutes: number): void {
    this.dataCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    });
  }

  /**
   * Find nearest NOAA stations for a given location
   */
  async findNearestStations(params: StationSearchParams): Promise<NoaaStation[]> {
    const { latitude, longitude, maxDistance = 50, maxStations = 10, product = 'water_level' } = params;
    const cacheKey = `stations_${latitude}_${longitude}_${maxDistance}_${product}`;
    
    // Check cache first (cache stations for 24 hours)
    const cached = this.getCached<NoaaStation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    return this.queueRequest(async () => {
      try {
        // NOAA doesn't have a direct spatial search API, so we'll use known station endpoints
        // In production, you'd maintain a local database of stations with spatial indexing
        const stationsUrl = `${this.baseUrl}?product=${product}&application=WavesApp&format=json&units=metric&time_zone=gmt&datum=MLLW`;
        
        // For now, we'll implement a simplified version that queries known regions
        const stations = await this.fetchStationsInRegion(latitude, longitude, maxDistance);
        
        // Calculate distances and sort
        const stationsWithDistance = stations.map(station => ({
          ...station,
          distance: this.calculateDistance(latitude, longitude, station.latitude, station.longitude)
        })).filter(station => station.distance <= maxDistance * 1000) // Convert km to meters
          .sort((a, b) => a.distance! - b.distance!)
          .slice(0, maxStations);

        this.setCache(cacheKey, stationsWithDistance, 24 * 60); // Cache for 24 hours
        return stationsWithDistance;
      } catch (error) {
        console.error('Error finding nearest stations:', error);
        throw new Error(`Failed to find stations: ${error}`);
      }
    });
  }

  /**
   * Fetch stations in a geographic region (simplified implementation)
   * In production, this would query a spatial database of NOAA stations
   */
  private async fetchStationsInRegion(lat: number, lon: number, radiusKm: number): Promise<NoaaStation[]> {
    // This is a simplified implementation. In production, you'd have a complete
    // database of NOAA stations with spatial indexing
    const knownStations: NoaaStation[] = [
      // Atlantic Coast samples
      { id: '8518750', name: 'The Battery, NY', latitude: 40.7, longitude: -74.015, state: 'NY', region: 'Atlantic', timezone: 'EST', tideType: 'harmonic' },
      { id: '8557380', name: 'Lewes, DE', latitude: 38.782, longitude: -75.12, state: 'DE', region: 'Atlantic', timezone: 'EST', tideType: 'harmonic' },
      { id: '8594900', name: 'Annapolis, MD', latitude: 38.983, longitude: -76.481, state: 'MD', region: 'Atlantic', timezone: 'EST', tideType: 'harmonic' },
      
      // Pacific Coast samples  
      { id: '9414290', name: 'San Francisco, CA', latitude: 37.807, longitude: -122.465, state: 'CA', region: 'Pacific', timezone: 'PST', tideType: 'harmonic' },
      { id: '9447130', name: 'Seattle, WA', latitude: 47.602, longitude: -122.339, state: 'WA', region: 'Pacific', timezone: 'PST', tideType: 'harmonic' },
      { id: '9410170', name: 'San Diego, CA', latitude: 32.714, longitude: -117.173, state: 'CA', region: 'Pacific', timezone: 'PST', tideType: 'harmonic' },
      
      // Gulf Coast samples
      { id: '8760922', name: 'Corpus Christi, TX', latitude: 27.581, longitude: -97.216, state: 'TX', region: 'Gulf', timezone: 'CST', tideType: 'harmonic' },
      { id: '8729840', name: 'Naples, FL', latitude: 26.132, longitude: -81.807, state: 'FL', region: 'Gulf', timezone: 'EST', tideType: 'harmonic' },
      
      // Great Lakes samples
      { id: '9087031', name: 'Cleveland, OH', latitude: 41.54, longitude: -81.633, state: 'OH', region: 'Great Lakes', timezone: 'EST', tideType: 'harmonic' },
    ];

    return knownStations.filter(station => {
      const distance = this.calculateDistance(lat, lon, station.latitude, station.longitude);
      return distance <= radiusKm * 1000; // Convert km to meters
    });
  }

  /**
   * Get tide predictions for a station
   */
  async getTidePredictions(params: DataQueryParams): Promise<TidePrediction[]> {
    const cacheKey = `predictions_${params.stationId}_${params.beginDate}_${params.endDate}`;
    const cached = this.getCached<TidePrediction[]>(cacheKey);
    if (cached) {
      return cached;
    }

    return this.queueRequest(async () => {
      try {
        const queryParams = new URLSearchParams({
          product: 'predictions',
          application: 'WavesApp',
          format: 'json',
          station: params.stationId,
          datum: params.datum || 'MLLW',
          units: params.units || 'metric',
          time_zone: params.timeZone || 'gmt',
          interval: 'hilo' // High/Low only for tide predictions
        });

        if (params.beginDate) queryParams.append('begin_date', params.beginDate);
        if (params.endDate) queryParams.append('end_date', params.endDate);

        const response = await fetch(`${this.baseUrl}?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error(`NOAA API request failed: ${response.status} ${response.statusText}`);
        }

        const data: NoaaApiResponse<{ t: string; v: string; type: string }> = await response.json();
        
        const predictions: TidePrediction[] = data.data.map(item => ({
          time: item.t,
          value: parseFloat(item.v),
          type: item.type as 'H' | 'L'
        }));

        this.setCache(cacheKey, predictions, 60); // Cache for 1 hour
        return predictions;
      } catch (error) {
        console.error('Error fetching tide predictions:', error);
        throw new Error(`Failed to fetch tide predictions: ${error}`);
      }
    });
  }

  /**
   * Get current water levels for a station
   */
  async getWaterLevels(params: DataQueryParams): Promise<WaterLevel[]> {
    const cacheKey = `waterlevels_${params.stationId}_${params.beginDate}_${params.endDate}`;
    const cached = this.getCached<WaterLevel[]>(cacheKey);
    if (cached) {
      return cached;
    }

    return this.queueRequest(async () => {
      try {
        const queryParams = new URLSearchParams({
          product: 'water_level',
          application: 'WavesApp',
          format: 'json',
          station: params.stationId,
          datum: params.datum || 'MLLW',
          units: params.units || 'metric',
          time_zone: params.timeZone || 'gmt'
        });

        if (params.beginDate) queryParams.append('begin_date', params.beginDate);
        if (params.endDate) queryParams.append('end_date', params.endDate);

        const response = await fetch(`${this.baseUrl}?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error(`NOAA API request failed: ${response.status} ${response.statusText}`);
        }

        const data: NoaaApiResponse<{ t: string; v: string; s?: string; f?: string; q?: string }> = await response.json();
        
        const waterLevels: WaterLevel[] = data.data.map(item => ({
          time: item.t,
          value: parseFloat(item.v),
          sigma: item.s ? parseFloat(item.s) : undefined,
          flags: item.f ? item.f.split(',') : undefined,
          quality: item.q as 'verified' | 'preliminary' | undefined
        }));

        this.setCache(cacheKey, waterLevels, 15); // Cache for 15 minutes (real-time data)
        return waterLevels;
      } catch (error) {
        console.error('Error fetching water levels:', error);
        throw new Error(`Failed to fetch water levels: ${error}`);
      }
    });
  }

  /**
   * Get meteorological data for a station
   */
  async getMeteorologicalData(params: DataQueryParams): Promise<MeteorologicalData[]> {
    const cacheKey = `met_${params.stationId}_${params.product}_${params.beginDate}_${params.endDate}`;
    const cached = this.getCached<MeteorologicalData[]>(cacheKey);
    if (cached) {
      return cached;
    }

    return this.queueRequest(async () => {
      try {
        const queryParams = new URLSearchParams({
          product: params.product,
          application: 'WavesApp',
          format: 'json',
          station: params.stationId,
          units: params.units || 'metric',
          time_zone: params.timeZone || 'gmt'
        });

        if (params.beginDate) queryParams.append('begin_date', params.beginDate);
        if (params.endDate) queryParams.append('end_date', params.endDate);

        const response = await fetch(`${this.baseUrl}?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error(`NOAA API request failed: ${response.status} ${response.statusText}`);
        }

        const data: NoaaApiResponse<{ t: string; v: string }> = await response.json();
        
        const metData: MeteorologicalData[] = data.data.map(item => {
          const baseData: MeteorologicalData = { time: item.t };
          
          // Map product type to appropriate field
          switch (params.product) {
            case 'air_temperature':
              baseData.airTemperature = parseFloat(item.v);
              break;
            case 'water_temperature':
              baseData.waterTemperature = parseFloat(item.v);
              break;
            case 'wind':
              // Wind data format: "speed,direction,gusts"
              const windParts = item.v.split(',');
              baseData.windSpeed = parseFloat(windParts[0]);
              baseData.windDirection = parseFloat(windParts[1]);
              if (windParts[2]) baseData.windGusts = parseFloat(windParts[2]);
              break;
            case 'air_pressure':
              baseData.barometricPressure = parseFloat(item.v);
              break;
            case 'visibility':
              baseData.visibility = parseFloat(item.v);
              break;
          }
          
          return baseData;
        });

        this.setCache(cacheKey, metData, 30); // Cache for 30 minutes
        return metData;
      } catch (error) {
        console.error('Error fetching meteorological data:', error);
        throw new Error(`Failed to fetch meteorological data: ${error}`);
      }
    });
  }

  /**
   * Get comprehensive data for a location (nearest station with all available data)
   */
  async getLocationEnvironmentalData(location: Location): Promise<{
    station: NoaaStation;
    tidePredictions: TidePrediction[];
    currentWaterLevel: WaterLevel | null;
    meteorological: {
      wind?: MeteorologicalData[];
      airTemperature?: MeteorologicalData[];
      waterTemperature?: MeteorologicalData[];
      pressure?: MeteorologicalData[];
    };
  }> {
    try {
      // Find nearest stations
      const stations = await this.findNearestStations({
        latitude: location.latitude,
        longitude: location.longitude,
        maxStations: 3
      });

      if (stations.length === 0) {
        throw new Error('No NOAA stations found in the area');
      }

      const primaryStation = stations[0];
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const beginDate = now.toISOString().slice(0, 10).replace(/-/g, '');
      const endDate = tomorrow.toISOString().slice(0, 10).replace(/-/g, '');

      // Fetch all data in parallel
      const [tidePredictions, waterLevels, windData, airTempData, waterTempData, pressureData] = await Promise.allSettled([
        this.getTidePredictions({
          stationId: primaryStation.id,
          product: 'predictions',
          beginDate,
          endDate
        }),
        this.getWaterLevels({
          stationId: primaryStation.id,
          product: 'water_level',
          beginDate: now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', ' '),
          endDate: new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', ' ')
        }),
        this.getMeteorologicalData({
          stationId: primaryStation.id,
          product: 'wind',
          beginDate: now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', ' ')
        }),
        this.getMeteorologicalData({
          stationId: primaryStation.id,
          product: 'air_temperature',
          beginDate: now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', ' ')
        }),
        this.getMeteorologicalData({
          stationId: primaryStation.id,
          product: 'water_temperature',
          beginDate: now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', ' ')
        }),
        this.getMeteorologicalData({
          stationId: primaryStation.id,
          product: 'air_pressure',
          beginDate: now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', ' ')
        })
      ]);

      return {
        station: primaryStation,
        tidePredictions: tidePredictions.status === 'fulfilled' ? tidePredictions.value : [],
        currentWaterLevel: waterLevels.status === 'fulfilled' && waterLevels.value.length > 0 
          ? waterLevels.value[waterLevels.value.length - 1] : null,
        meteorological: {
          wind: windData.status === 'fulfilled' ? windData.value : undefined,
          airTemperature: airTempData.status === 'fulfilled' ? airTempData.value : undefined,
          waterTemperature: waterTempData.status === 'fulfilled' ? waterTempData.value : undefined,
          pressure: pressureData.status === 'fulfilled' ? pressureData.value : undefined
        }
      };
    } catch (error) {
      console.error('Error fetching location environmental data:', error);
      throw new Error(`Failed to fetch environmental data: ${error}`);
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.dataCache.clear();
    this.stationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: Array<{ key: string; age: number }> } {
    const now = Date.now();
    const entries = Array.from(this.dataCache.entries()).map(([key, value]) => ({
      key,
      age: now - value.timestamp
    }));

    return {
      size: this.dataCache.size,
      entries
    };
  }
}

export const noaaClient = new NoaaApiClient();