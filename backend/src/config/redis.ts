// Redis Configuration and Connection Management
// Session management and caching for Waves backend

import { createClient, RedisClientType } from 'redis';
import { RedisConfig } from '../types';

export class RedisManager {
  private client: RedisClientType;
  private config: RedisConfig;
  private isConnected: boolean = false;

  constructor(config: RedisConfig) {
    this.config = config;
    this.client = createClient({
      url: config.url,
      password: config.password,
      database: config.db,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
      }
    });

    // Handle Redis events
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log('Redis Client Ready');
    });

    this.client.on('end', () => {
      console.log('Redis Client Disconnected');
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  // Session Management Methods

  /**
   * Store user session
   */
  async setSession(sessionId: string, sessionData: any, expirationSeconds: number): Promise<void> {
    await this.client.setEx(
      `session:${sessionId}`,
      expirationSeconds,
      JSON.stringify(sessionData)
    );
  }

  /**
   * Get user session
   */
  async getSession(sessionId: string): Promise<any | null> {
    const sessionData = await this.client.get(`session:${sessionId}`);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  /**
   * Delete user session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.client.del(`session:${sessionId}`);
  }

  /**
   * Store refresh token with expiration
   */
  async setRefreshToken(userId: string, tokenId: string, expirationSeconds: number): Promise<void> {
    await this.client.setEx(`refresh_token:${userId}:${tokenId}`, expirationSeconds, 'valid');
  }

  /**
   * Check if refresh token is valid
   */
  async isRefreshTokenValid(userId: string, tokenId: string): Promise<boolean> {
    const result = await this.client.get(`refresh_token:${userId}:${tokenId}`);
    return result === 'valid';
  }

  /**
   * Invalidate refresh token
   */
  async invalidateRefreshToken(userId: string, tokenId: string): Promise<void> {
    await this.client.del(`refresh_token:${userId}:${tokenId}`);
  }

  /**
   * Invalidate all refresh tokens for a user
   */
  async invalidateAllRefreshTokens(userId: string): Promise<void> {
    const keys = await this.client.keys(`refresh_token:${userId}:*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  // Caching Methods

  /**
   * Cache weather data
   */
  async cacheWeatherData(locationKey: string, weatherData: any, expirationSeconds: number): Promise<void> {
    await this.client.setEx(
      `weather:${locationKey}`,
      expirationSeconds,
      JSON.stringify(weatherData)
    );
  }

  /**
   * Get cached weather data
   */
  async getCachedWeatherData(locationKey: string): Promise<any | null> {
    const cachedData = await this.client.get(`weather:${locationKey}`);
    return cachedData ? JSON.parse(cachedData) : null;
  }

  /**
   * Cache tide data
   */
  async cacheTideData(stationId: string, tideData: any, expirationSeconds: number): Promise<void> {
    await this.client.setEx(
      `tide:${stationId}`,
      expirationSeconds,
      JSON.stringify(tideData)
    );
  }

  /**
   * Get cached tide data
   */
  async getCachedTideData(stationId: string): Promise<any | null> {
    const cachedData = await this.client.get(`tide:${stationId}`);
    return cachedData ? JSON.parse(cachedData) : null;
  }

  /**
   * Cache depth aggregation data
   */
  async cacheDepthAggregation(boundsKey: string, aggregationData: any, expirationSeconds: number): Promise<void> {
    await this.client.setEx(
      `depth_agg:${boundsKey}`,
      expirationSeconds,
      JSON.stringify(aggregationData)
    );
  }

  /**
   * Get cached depth aggregation data
   */
  async getCachedDepthAggregation(boundsKey: string): Promise<any | null> {
    const cachedData = await this.client.get(`depth_agg:${boundsKey}`);
    return cachedData ? JSON.parse(cachedData) : null;
  }

  // Rate Limiting Methods

  /**
   * Check and update rate limit
   */
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const current = await this.client.incr(`rate_limit:${key}`);
    
    if (current === 1) {
      await this.client.expire(`rate_limit:${key}`, windowSeconds);
    }

    const ttl = await this.client.ttl(`rate_limit:${key}`);
    const resetTime = Date.now() + (ttl * 1000);

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetTime
    };
  }

  // Real-time Location Tracking

  /**
   * Store active vessel location
   */
  async setVesselLocation(vesselId: string, locationData: any, expirationSeconds: number = 300): Promise<void> {
    await this.client.setEx(
      `vessel_location:${vesselId}`,
      expirationSeconds,
      JSON.stringify({
        ...locationData,
        timestamp: Date.now()
      })
    );
  }

  /**
   * Get vessel location
   */
  async getVesselLocation(vesselId: string): Promise<any | null> {
    const locationData = await this.client.get(`vessel_location:${vesselId}`);
    return locationData ? JSON.parse(locationData) : null;
  }

  /**
   * Get all active vessel locations in area (using Redis geospatial commands)
   */
  async setVesselGeoLocation(vesselId: string, longitude: number, latitude: number): Promise<void> {
    await this.client.geoAdd('active_vessels', {
      longitude,
      latitude,
      member: vesselId
    });
  }

  /**
   * Get nearby vessels
   */
  async getNearbyVessels(longitude: number, latitude: number, radiusKm: number): Promise<any[]> {
    const results = await this.client.geoRadius('active_vessels', {
      longitude,
      latitude
    }, radiusKm, 'km', {
      WITHCOORD: true,
      WITHDIST: true
    });

    return results.map(result => ({
      vesselId: result.member,
      distance: parseFloat(result.distance),
      coordinates: result.coordinates
    }));
  }

  // Pub/Sub for Real-time Updates

  /**
   * Publish location update
   */
  async publishLocationUpdate(vesselId: string, locationData: any): Promise<void> {
    await this.client.publish(`location:${vesselId}`, JSON.stringify(locationData));
  }

  /**
   * Publish safety alert
   */
  async publishSafetyAlert(alertData: any): Promise<void> {
    await this.client.publish('safety_alerts', JSON.stringify(alertData));
  }

  /**
   * Subscribe to vessel locations
   */
  async subscribeToVesselLocations(vesselIds: string[], callback: (vesselId: string, data: any) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();

    const channels = vesselIds.map(id => `location:${id}`);
    
    await subscriber.subscribe(channels, (message, channel) => {
      const vesselId = channel.replace('location:', '');
      const data = JSON.parse(message);
      callback(vesselId, data);
    });
  }

  // Health Check

  /**
   * Redis health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const start = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - start;

      const info = await this.client.info();
      
      return {
        healthy: true,
        details: {
          connected: this.isConnected,
          responseTime,
          info: this.parseRedisInfo(info)
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const result: any = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }
    
    return result;
  }
}

// Redis configuration from environment
export const createRedisConfig = (): RedisConfig => ({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10)
});

// Create singleton Redis instance
export const redis = new RedisManager(createRedisConfig());