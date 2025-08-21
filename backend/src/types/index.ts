// Waves Backend Type Definitions
// Marine navigation and geospatial data types

export interface Point {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  northEast: Point;
  southWest: Point;
}

// User and Authentication Types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: 'user' | 'premium' | 'captain' | 'admin';
  isVerified: boolean;
  privacySettings: PrivacySettings;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface PrivacySettings {
  shareTracks: boolean;
  shareDepth: boolean;
  publicProfile: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceInfo?: object;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

// Vessel Types
export interface Vessel {
  id: string;
  ownerId: string;
  name: string;
  vesselType: 'sailboat' | 'powerboat' | 'catamaran' | 'trawler' | 'yacht' | 'dinghy' | 'pwc' | 'other';
  lengthMeters?: number;
  beamMeters?: number;
  draftMeters: number;
  displacementKg?: number;
  maxSpeedKnots?: number;
  fuelCapacityLiters?: number;
  registrationNumber?: string;
  mmsi?: string;
  insurancePolicy?: object;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// GPS and Location Types
export interface GPSTrack {
  id: string;
  userId: string;
  vesselId: string;
  location: Point;
  timestamp: Date;
  speedKnots?: number;
  headingDegrees?: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
  satellites?: number;
  hdop?: number;
  sessionId?: string;
  weatherCondition?: WeatherCondition;
  seaState?: number;
  visibilityKm?: number;
  createdAt: Date;
}

export interface NavigationSession {
  id: string;
  userId: string;
  vesselId: string;
  routeId?: string;
  startTime: Date;
  endTime?: Date;
  startLocation: Point;
  endLocation?: Point;
  totalDistanceNm?: number;
  maxSpeedKnots?: number;
  avgSpeedKnots?: number;
  fuelConsumedLiters?: number;
  trackGeometry?: object;
  weatherSummary?: object;
  notes?: string;
  createdAt: Date;
}

// Depth and Marine Data Types
export interface DepthReading {
  id: string;
  userId: string;
  vesselId: string;
  location: Point;
  timestamp: Date;
  depthMeters: number;
  vesselDraft: number;
  tideHeightMeters?: number;
  confidenceScore: 'low' | 'medium' | 'high' | 'verified';
  verificationCount: number;
  sonarFrequencyKhz?: number;
  waterTemperatureCelsius?: number;
  bottomType?: string;
  notes?: string;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt: Date;
}

export interface DepthDataRequest {
  bounds: BoundingBox;
  vesselDraft?: number;
  confidenceLevel?: 'low' | 'medium' | 'high' | 'verified';
  maxAge?: number; // hours
}

export interface DepthDataResponse {
  readings: DepthReading[];
  aggregatedData: DepthAggregation[];
  safetyWarnings: SafetyAlert[];
  dataQualityScore: number;
}

export interface DepthAggregation {
  centerPoint: Point;
  avgDepth: number;
  minDepth: number;
  maxDepth: number;
  readingCount: number;
  confidenceAvg: number;
  gridSize: number;
}

// Route and Navigation Types
export interface Route {
  id: string;
  userId: string;
  vesselId: string;
  name: string;
  description?: string;
  startPoint: Point;
  endPoint: Point;
  waypoints?: Point[];
  totalDistanceNm?: number;
  estimatedDurationHours?: number;
  minDepthRequired?: number;
  weatherConstraints?: object;
  isPublic: boolean;
  difficultyLevel?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteRequest {
  startPoint: Point;
  endPoint: Point;
  vesselDraft: number;
  maxWaypoints?: number;
  preferDeepWater?: boolean;
  avoidWeather?: boolean;
}

export interface RouteResponse {
  route: Route;
  waypoints: Point[];
  totalDistance: number;
  estimatedTime: number;
  safetyScore: number;
  weatherAlerts: WeatherAlert[];
  depthWarnings: SafetyAlert[];
}

// Weather and Environmental Types
export type WeatherCondition = 'calm' | 'light_wind' | 'moderate_wind' | 'strong_wind' | 'storm' | 'fog' | 'rain';

export interface WeatherData {
  id: string;
  location: Point;
  timestamp: Date;
  source: string;
  windSpeedKnots?: number;
  windDirection?: number;
  waveHeightMeters?: number;
  wavePeriodSeconds?: number;
  waveDirection?: number;
  visibilityKm?: number;
  precipitationMm?: number;
  temperatureCelsius?: number;
  pressureMb?: number;
  humidityPercent?: number;
  forecastData?: object;
  createdAt: Date;
  expiresAt: Date;
}

export interface WeatherAlert {
  type: 'wind' | 'wave' | 'fog' | 'storm' | 'small_craft_advisory';
  severity: number;
  message: string;
  validUntil: Date;
  affectedArea?: BoundingBox;
}

export interface TideData {
  id: string;
  stationId: string;
  location: Point;
  timestamp: Date;
  heightMeters: number;
  tideType?: 'high' | 'low' | 'rising' | 'falling';
  predictionData?: object;
  createdAt: Date;
}

// Safety and Alert Types
export interface SafetyAlert {
  id: string;
  userId: string;
  vesselId?: string;
  alertType: 'shallow_water' | 'weather_warning' | 'restricted_area' | 'navigation_hazard';
  severity: number;
  location: Point;
  message: string;
  recommendedAction?: string;
  isAcknowledged: boolean;
  acknowledgedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface MarineArea {
  id: string;
  name: string;
  description?: string;
  areaType: 'harbor' | 'anchorage' | 'channel' | 'reef' | 'restricted' | 'sanctuary';
  geometry: object;
  minDepthMeters?: number;
  maxDepthMeters?: number;
  restrictions?: object;
  contactInfo?: object;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  metadata?: {
    timestamp: Date;
    requestId: string;
    version: string;
    [key: string]: any;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Request Types
export interface AuthenticatedRequest {
  user: User;
  vessel?: Vessel;
}

export interface DepthReportRequest {
  location: Point;
  depthMeters: number;
  vesselDraft: number;
  tideHeightMeters?: number;
  waterTemperatureCelsius?: number;
  bottomType?: string;
  notes?: string;
}

export interface LocationUpdateRequest {
  location: Point;
  speedKnots?: number;
  headingDegrees?: number;
  accuracyMeters?: number;
  timestamp?: Date;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'location_update' | 'depth_alert' | 'weather_update' | 'safety_alert' | 'navigation_update';
  data: any;
  timestamp: Date;
  sessionId?: string;
}

export interface LocationUpdateMessage extends WebSocketMessage {
  type: 'location_update';
  data: {
    userId: string;
    vesselId: string;
    location: Point;
    speedKnots?: number;
    headingDegrees?: number;
    timestamp: Date;
  };
}

export interface DepthAlertMessage extends WebSocketMessage {
  type: 'depth_alert';
  data: {
    location: Point;
    currentDepth: number;
    vesselDraft: number;
    safetyMargin: number;
    severity: 'warning' | 'critical';
  };
}

// Configuration Types
export interface DatabaseConfig {
  url: string;
  ssl: boolean;
  maxConnections: number;
}

export interface RedisConfig {
  url: string;
  password?: string;
  db: number;
}

export interface JWTConfig {
  secret: string;
  refreshSecret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  environment: 'development' | 'production' | 'test';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// External API Types
export interface NOAAConfig {
  apiKey: string;
  baseUrl: string;
}

export interface WeatherAPIConfig {
  openWeatherApiKey?: string;
  stormglassApiKey?: string;
}

export interface MapboxConfig {
  accessToken: string;
  styleUrl: string;
}

// Error Types
export interface WavesError extends Error {
  statusCode: number;
  code: string;
  details?: any;
}

export interface ValidationError extends WavesError {
  field: string;
  value: any;
  constraint: string;
}