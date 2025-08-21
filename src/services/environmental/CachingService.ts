/**
 * Environmental Data Caching Service
 * Redis caching and offline data storage for environmental data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteDatabase, openDatabase } from 'react-native-sqlite-storage';
import NetInfo from '@react-native-community/netinfo';
import { Location } from '../../types';
import { NoaaStation, TidePrediction, WaterLevel, MeteorologicalData } from './NoaaApiClient';
import { MarineWeatherExtended, WeatherForecast, MarineAlert } from './WeatherApiClient';
import { ProcessedDepthReading } from './DataProcessingService';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  source: string;
  version: string;
}

export interface OfflineArea {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  priority: 'high' | 'medium' | 'low';
  lastSync: number;
  dataTypes: Array<'tides' | 'weather' | 'alerts' | 'stations'>;
  sizeEstimate: number; // bytes
}

export interface SyncStatus {
  isOnline: boolean;
  lastSync: number;
  pendingUploads: number;
  cacheSize: number;
  offlineAreas: OfflineArea[];
  syncInProgress: boolean;
}

export class CachingService {
  private db: SQLiteDatabase | null = null;
  private isInitialized = false;
  private syncQueue: Array<{ type: string; data: any; timestamp: number }> = [];
  private isOnline = true;
  private readonly CACHE_VERSION = '1.0.0';
  private readonly DB_NAME = 'waves_environmental.db';
  private readonly DB_VERSION = '1.0';

  constructor() {
    this.initializeDatabase();
    this.setupNetworkListener();
  }

  /**
   * Initialize SQLite database for offline storage
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await openDatabase({
        name: this.DB_NAME,
        version: this.DB_VERSION,
        location: 'default'
      });

      await this.createTables();
      this.isInitialized = true;
      console.log('Environmental data cache database initialized');
    } catch (error) {
      console.error('Failed to initialize cache database:', error);
      throw error;
    }
  }

  /**
   * Create database tables for offline storage
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = [
      // NOAA stations cache
      `CREATE TABLE IF NOT EXISTS noaa_stations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        state TEXT,
        region TEXT,
        timezone TEXT,
        tide_type TEXT,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,

      // Tide predictions cache
      `CREATE TABLE IF NOT EXISTS tide_predictions (
        id TEXT PRIMARY KEY,
        station_id TEXT NOT NULL,
        prediction_time TEXT NOT NULL,
        value REAL NOT NULL,
        type TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (station_id) REFERENCES noaa_stations (id)
      )`,

      // Water levels cache
      `CREATE TABLE IF NOT EXISTS water_levels (
        id TEXT PRIMARY KEY,
        station_id TEXT NOT NULL,
        measurement_time TEXT NOT NULL,
        value REAL NOT NULL,
        sigma REAL,
        flags TEXT,
        quality TEXT,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (station_id) REFERENCES noaa_stations (id)
      )`,

      // Weather data cache
      `CREATE TABLE IF NOT EXISTS weather_data (
        id TEXT PRIMARY KEY,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        data TEXT NOT NULL, -- JSON string
        source TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,

      // Weather forecasts cache
      `CREATE TABLE IF NOT EXISTS weather_forecasts (
        id TEXT PRIMARY KEY,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        forecast_time INTEGER NOT NULL,
        data TEXT NOT NULL, -- JSON string
        source TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,

      // Marine alerts cache
      `CREATE TABLE IF NOT EXISTS marine_alerts (
        id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        areas TEXT, -- JSON array
        valid_from INTEGER NOT NULL,
        valid_to INTEGER NOT NULL,
        source TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,

      // Processed depth readings cache
      `CREATE TABLE IF NOT EXISTS processed_depth_readings (
        id TEXT PRIMARY KEY,
        original_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        depth REAL NOT NULL,
        processed_data TEXT NOT NULL, -- JSON string
        quality_score REAL NOT NULL,
        reliability TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,

      // Offline areas configuration
      `CREATE TABLE IF NOT EXISTS offline_areas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        north REAL NOT NULL,
        south REAL NOT NULL,
        east REAL NOT NULL,
        west REAL NOT NULL,
        priority TEXT NOT NULL,
        data_types TEXT NOT NULL, -- JSON array
        last_sync INTEGER NOT NULL,
        size_estimate INTEGER NOT NULL
      )`,

      // Sync queue for offline changes
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        data TEXT NOT NULL, -- JSON string
        timestamp INTEGER NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_attempt INTEGER DEFAULT 0
      )`
    ];

    for (const tableSQL of tables) {
      await this.executeQuery(tableSQL);
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_stations_location ON noaa_stations (latitude, longitude)',
      'CREATE INDEX IF NOT EXISTS idx_tide_predictions_station_time ON tide_predictions (station_id, prediction_time)',
      'CREATE INDEX IF NOT EXISTS idx_water_levels_station_time ON water_levels (station_id, measurement_time)',
      'CREATE INDEX IF NOT EXISTS idx_weather_location ON weather_data (latitude, longitude)',
      'CREATE INDEX IF NOT EXISTS idx_weather_forecasts_location_time ON weather_forecasts (latitude, longitude, forecast_time)',
      'CREATE INDEX IF NOT EXISTS idx_alerts_valid_time ON marine_alerts (valid_from, valid_to)',
      'CREATE INDEX IF NOT EXISTS idx_depth_readings_location ON processed_depth_readings (latitude, longitude)',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_timestamp ON sync_queue (timestamp)'
    ];

    for (const indexSQL of indexes) {
      await this.executeQuery(indexSQL);
    }
  }

  /**
   * Execute SQL query with error handling
   */
  private async executeQuery(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.transaction(tx => {
        tx.executeSql(
          sql,
          params,
          (_, result) => resolve(result),
          (_, error) => {
            console.error('SQL Error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Setup network connectivity listener
   */
  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOffline && this.isOnline) {
        // Coming back online - sync pending data
        this.syncPendingData();
      }
    });
  }

  /**
   * Cache NOAA stations with spatial indexing
   */
  async cacheStations(stations: NoaaStation[], ttlHours: number = 24): Promise<void> {
    if (!this.isInitialized) await this.initializeDatabase();

    const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
    const cachedAt = Date.now();

    for (const station of stations) {
      await this.executeQuery(
        `INSERT OR REPLACE INTO noaa_stations 
         (id, name, latitude, longitude, state, region, timezone, tide_type, cached_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          station.id, station.name, station.latitude, station.longitude,
          station.state, station.region, station.timezone, station.tideType,
          cachedAt, expiresAt
        ]
      );
    }
  }

  /**
   * Get cached stations near a location
   */
  async getCachedStations(location: Location, radiusKm: number = 50): Promise<NoaaStation[]> {
    if (!this.isInitialized) await this.initializeDatabase();

    const now = Date.now();
    
    // Simple bounding box query (in production, use proper spatial indexing)
    const latDelta = radiusKm / 111.0; // Rough km to degrees conversion
    const lonDelta = radiusKm / (111.0 * Math.cos(location.latitude * Math.PI / 180));

    const result = await this.executeQuery(
      `SELECT * FROM noaa_stations 
       WHERE expires_at > ? 
       AND latitude BETWEEN ? AND ?
       AND longitude BETWEEN ? AND ?`,
      [
        now,
        location.latitude - latDelta,
        location.latitude + latDelta,
        location.longitude - lonDelta,
        location.longitude + lonDelta
      ]
    );

    return result.rows._array.map((row: any) => ({
      id: row.id,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      state: row.state,
      region: row.region,
      timezone: row.timezone,
      tideType: row.tide_type
    }));
  }

  /**
   * Cache tide predictions
   */
  async cacheTidePredictions(
    stationId: string,
    predictions: TidePrediction[],
    ttlHours: number = 6
  ): Promise<void> {
    if (!this.isInitialized) await this.initializeDatabase();

    const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
    const cachedAt = Date.now();

    // Clear existing predictions for this station
    await this.executeQuery(
      'DELETE FROM tide_predictions WHERE station_id = ?',
      [stationId]
    );

    for (const prediction of predictions) {
      const id = `${stationId}_${prediction.time}`;
      await this.executeQuery(
        `INSERT OR REPLACE INTO tide_predictions 
         (id, station_id, prediction_time, value, type, cached_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id, stationId, prediction.time, prediction.value, prediction.type,
          cachedAt, expiresAt
        ]
      );
    }
  }

  /**
   * Get cached tide predictions
   */
  async getCachedTidePredictions(stationId: string): Promise<TidePrediction[]> {
    if (!this.isInitialized) await this.initializeDatabase();

    const now = Date.now();
    const result = await this.executeQuery(
      `SELECT * FROM tide_predictions 
       WHERE station_id = ? AND expires_at > ?
       ORDER BY prediction_time`,
      [stationId, now]
    );

    return result.rows._array.map((row: any) => ({
      time: row.prediction_time,
      value: row.value,
      type: row.type
    }));
  }

  /**
   * Cache weather data
   */
  async cacheWeatherData(
    location: Location,
    weather: MarineWeatherExtended,
    source: string,
    ttlMinutes: number = 30
  ): Promise<void> {
    if (!this.isInitialized) await this.initializeDatabase();

    const id = `${location.latitude}_${location.longitude}_${source}`;
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    const cachedAt = Date.now();

    await this.executeQuery(
      `INSERT OR REPLACE INTO weather_data 
       (id, latitude, longitude, data, source, cached_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id, location.latitude, location.longitude,
        JSON.stringify(weather), source, cachedAt, expiresAt
      ]
    );
  }

  /**
   * Get cached weather data
   */
  async getCachedWeatherData(location: Location): Promise<MarineWeatherExtended | null> {
    if (!this.isInitialized) await this.initializeDatabase();

    const now = Date.now();
    const latTolerance = 0.01; // ~1km tolerance
    const lonTolerance = 0.01;

    const result = await this.executeQuery(
      `SELECT * FROM weather_data 
       WHERE expires_at > ?
       AND latitude BETWEEN ? AND ?
       AND longitude BETWEEN ? AND ?
       ORDER BY cached_at DESC
       LIMIT 1`,
      [
        now,
        location.latitude - latTolerance,
        location.latitude + latTolerance,
        location.longitude - lonTolerance,
        location.longitude + lonTolerance
      ]
    );

    if (result.rows.length > 0) {
      return JSON.parse(result.rows.item(0).data);
    }

    return null;
  }

  /**
   * Cache weather forecast
   */
  async cacheWeatherForecast(
    location: Location,
    forecast: WeatherForecast[],
    source: string,
    ttlHours: number = 2
  ): Promise<void> {
    if (!this.isInitialized) await this.initializeDatabase();

    const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
    const cachedAt = Date.now();

    // Clear existing forecasts for this location
    await this.executeQuery(
      `DELETE FROM weather_forecasts 
       WHERE latitude BETWEEN ? AND ? 
       AND longitude BETWEEN ? AND ?`,
      [
        location.latitude - 0.01,
        location.latitude + 0.01,
        location.longitude - 0.01,
        location.longitude + 0.01
      ]
    );

    for (const item of forecast) {
      const id = `${location.latitude}_${location.longitude}_${item.timestamp}_${source}`;
      await this.executeQuery(
        `INSERT OR REPLACE INTO weather_forecasts 
         (id, latitude, longitude, forecast_time, data, source, cached_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, location.latitude, location.longitude, item.timestamp,
          JSON.stringify(item), source, cachedAt, expiresAt
        ]
      );
    }
  }

  /**
   * Cache marine alerts
   */
  async cacheMarineAlerts(alerts: MarineAlert[], ttlMinutes: number = 60): Promise<void> {
    if (!this.isInitialized) await this.initializeDatabase();

    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    const cachedAt = Date.now();

    for (const alert of alerts) {
      await this.executeQuery(
        `INSERT OR REPLACE INTO marine_alerts 
         (id, alert_id, type, severity, title, description, areas, valid_from, valid_to, source, cached_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `alert_${alert.id}`, alert.id, alert.type, alert.severity,
          alert.title, alert.description, JSON.stringify(alert.areas),
          alert.validFrom, alert.validTo, alert.source, cachedAt, expiresAt
        ]
      );
    }
  }

  /**
   * Get active marine alerts
   */
  async getCachedMarineAlerts(): Promise<MarineAlert[]> {
    if (!this.isInitialized) await this.initializeDatabase();

    const now = Date.now();
    const result = await this.executeQuery(
      `SELECT * FROM marine_alerts 
       WHERE expires_at > ? AND valid_to > ?
       ORDER BY severity DESC, valid_from DESC`,
      [now, now]
    );

    return result.rows._array.map((row: any) => ({
      id: row.alert_id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      areas: JSON.parse(row.areas),
      validFrom: row.valid_from,
      validTo: row.valid_to,
      source: row.source
    }));
  }

  /**
   * Configure offline area for data preloading
   */
  async configureOfflineArea(area: OfflineArea): Promise<void> {
    if (!this.isInitialized) await this.initializeDatabase();

    await this.executeQuery(
      `INSERT OR REPLACE INTO offline_areas 
       (id, name, north, south, east, west, priority, data_types, last_sync, size_estimate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        area.id, area.name, area.bounds.north, area.bounds.south,
        area.bounds.east, area.bounds.west, area.priority,
        JSON.stringify(area.dataTypes), area.lastSync, area.sizeEstimate
      ]
    );
  }

  /**
   * Add item to sync queue for offline uploads
   */
  async addToSyncQueue(type: string, data: any): Promise<void> {
    if (!this.isInitialized) await this.initializeDatabase();

    await this.executeQuery(
      'INSERT INTO sync_queue (type, data, timestamp) VALUES (?, ?, ?)',
      [type, JSON.stringify(data), Date.now()]
    );

    // Try immediate sync if online
    if (this.isOnline) {
      await this.syncPendingData();
    }
  }

  /**
   * Sync pending data when coming back online
   */
  private async syncPendingData(): Promise<void> {
    if (!this.isInitialized || !this.isOnline) return;

    try {
      const result = await this.executeQuery(
        'SELECT * FROM sync_queue ORDER BY timestamp ASC LIMIT 50'
      );

      for (const row of result.rows._array) {
        try {
          const data = JSON.parse(row.data);
          
          // Attempt to sync data based on type
          await this.syncDataItem(row.type, data);
          
          // Remove from queue on success
          await this.executeQuery(
            'DELETE FROM sync_queue WHERE id = ?',
            [row.id]
          );
        } catch (error) {
          console.error(`Failed to sync item ${row.id}:`, error);
          
          // Update attempt count
          await this.executeQuery(
            'UPDATE sync_queue SET attempts = attempts + 1, last_attempt = ? WHERE id = ?',
            [Date.now(), row.id]
          );
        }
      }
    } catch (error) {
      console.error('Error syncing pending data:', error);
    }
  }

  /**
   * Sync individual data item based on type
   */
  private async syncDataItem(type: string, data: any): Promise<void> {
    // Implementation would depend on your API endpoints
    // This is a placeholder for the actual sync logic
    console.log(`Syncing ${type} data:`, data);
    
    // Example API calls would go here
    // await apiClient.submitDepthReading(data);
    // await apiClient.submitWeatherObservation(data);
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    if (!this.isInitialized) await this.initializeDatabase();

    const pendingResult = await this.executeQuery(
      'SELECT COUNT(*) as count FROM sync_queue'
    );

    const offlineAreasResult = await this.executeQuery(
      'SELECT * FROM offline_areas'
    );

    const cacheSize = await this.calculateCacheSize();

    const offlineAreas: OfflineArea[] = offlineAreasResult.rows._array.map((row: any) => ({
      id: row.id,
      name: row.name,
      bounds: {
        north: row.north,
        south: row.south,
        east: row.east,
        west: row.west
      },
      priority: row.priority,
      dataTypes: JSON.parse(row.data_types),
      lastSync: row.last_sync,
      sizeEstimate: row.size_estimate
    }));

    return {
      isOnline: this.isOnline,
      lastSync: Math.max(...offlineAreas.map(area => area.lastSync), 0),
      pendingUploads: pendingResult.rows.item(0).count,
      cacheSize,
      offlineAreas,
      syncInProgress: false // You'd track this with a class property
    };
  }

  /**
   * Calculate total cache size
   */
  private async calculateCacheSize(): Promise<number> {
    // This is a simplified calculation
    // In production, you'd want more accurate size tracking
    const tables = [
      'noaa_stations', 'tide_predictions', 'water_levels',
      'weather_data', 'weather_forecasts', 'marine_alerts',
      'processed_depth_readings'
    ];

    let totalSize = 0;
    for (const table of tables) {
      const result = await this.executeQuery(`SELECT COUNT(*) as count FROM ${table}`);
      totalSize += result.rows.item(0).count * 1000; // Rough estimate
    }

    return totalSize;
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache(): Promise<void> {
    if (!this.isInitialized) await this.initializeDatabase();

    const now = Date.now();
    const tables = [
      'noaa_stations', 'tide_predictions', 'water_levels',
      'weather_data', 'weather_forecasts', 'marine_alerts',
      'processed_depth_readings'
    ];

    for (const table of tables) {
      await this.executeQuery(
        `DELETE FROM ${table} WHERE expires_at < ?`,
        [now]
      );
    }

    // Clean old sync queue items (older than 7 days)
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    await this.executeQuery(
      'DELETE FROM sync_queue WHERE timestamp < ? AND attempts > 3',
      [weekAgo]
    );
  }

  /**
   * Clear all cached data
   */
  async clearAllCache(): Promise<void> {
    if (!this.isInitialized) await this.initializeDatabase();

    const tables = [
      'noaa_stations', 'tide_predictions', 'water_levels',
      'weather_data', 'weather_forecasts', 'marine_alerts',
      'processed_depth_readings', 'sync_queue'
    ];

    for (const table of tables) {
      await this.executeQuery(`DELETE FROM ${table}`);
    }
  }
}

export const cachingService = new CachingService();