// Waves Backend Configuration
// Central configuration management for all services

import dotenv from 'dotenv';
import {
  ServerConfig,
  DatabaseConfig,
  RedisConfig,
  JWTConfig,
  NOAAConfig,
  WeatherAPIConfig,
  MapboxConfig
} from '../types';

// Load environment variables
dotenv.config();

export const serverConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '8080', 10),
  host: process.env.HOST || '0.0.0.0',
  environment: (process.env.NODE_ENV as any) || 'development',
  logLevel: (process.env.LOG_LEVEL as any) || 'info'
};

export const databaseConfig: DatabaseConfig = {
  url: process.env.DATABASE_URL || 'postgresql://localhost:5432/waves_dev',
  ssl: process.env.DATABASE_SSL === 'true',
  maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10)
};

export const redisConfig: RedisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10)
};

export const jwtConfig: JWTConfig = {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

export const noaaConfig: NOAAConfig = {
  apiKey: process.env.NOAA_API_KEY || '',
  baseUrl: process.env.NOAA_BASE_URL || 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
};

export const weatherApiConfig: WeatherAPIConfig = {
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY,
  stormglassApiKey: process.env.STORMGLASS_API_KEY
};

export const mapboxConfig: MapboxConfig = {
  accessToken: process.env.MAPBOX_ACCESS_TOKEN || '',
  styleUrl: process.env.MAPBOX_STYLE_URL || 'mapbox://styles/mapbox/satellite-v9'
};

// Safety and navigation configuration
export const safetyConfig = {
  minDepthThreshold: parseFloat(process.env.MIN_DEPTH_THRESHOLD || '1.0'),
  safetyMarginMeters: parseFloat(process.env.SAFETY_MARGIN_METERS || '0.5'),
  maxTrackAgeHours: parseInt(process.env.MAX_TRACK_AGE_HOURS || '24', 10)
};

// Rate limiting configuration
export const rateLimitConfig = {
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  window: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10) // 15 minutes in ms
};

// CORS configuration
export const corsConfig = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:8081'],
  credentials: process.env.CORS_CREDENTIALS === 'true'
};

// File upload configuration
export const uploadConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  uploadPath: process.env.UPLOAD_PATH || './uploads'
};

// Monitoring configuration
export const monitoringConfig = {
  sentryDsn: process.env.SENTRY_DSN,
  analyticsKey: process.env.ANALYTICS_KEY
};

// Validation function to ensure required configuration is present
export function validateConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required database configuration
  if (!databaseConfig.url) {
    errors.push('DATABASE_URL is required');
  }

  // Check JWT secrets in production
  if (serverConfig.environment === 'production') {
    if (jwtConfig.secret === 'your-super-secret-jwt-key-change-in-production') {
      errors.push('JWT_SECRET must be changed in production');
    }
    if (jwtConfig.refreshSecret === 'your-super-secret-refresh-key-change-in-production') {
      errors.push('JWT_REFRESH_SECRET must be changed in production');
    }
  }

  // Check external API keys if features are enabled
  if (!mapboxConfig.accessToken) {
    errors.push('MAPBOX_ACCESS_TOKEN is required for map functionality');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Development mode check
export const isDevelopment = serverConfig.environment === 'development';
export const isProduction = serverConfig.environment === 'production';
export const isTest = serverConfig.environment === 'test';

// Export all configurations
export default {
  server: serverConfig,
  database: databaseConfig,
  redis: redisConfig,
  jwt: jwtConfig,
  noaa: noaaConfig,
  weatherApi: weatherApiConfig,
  mapbox: mapboxConfig,
  safety: safetyConfig,
  rateLimit: rateLimitConfig,
  cors: corsConfig,
  upload: uploadConfig,
  monitoring: monitoringConfig,
  isDevelopment,
  isProduction,
  isTest,
  validateConfiguration
};