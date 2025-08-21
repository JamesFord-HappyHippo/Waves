/**
 * Common types for Waves Marine Navigation App
 */

export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  altitude?: number;
  timestamp: number;
}

export interface DepthReading {
  id: string;
  latitude: number;
  longitude: number;
  depth: number;
  timestamp: number;
  vesselDraft: number;
  tideCorrection?: number;
  confidenceScore: number;
  source: 'crowdsource' | 'official' | 'predicted';
  userId?: string;
}

export interface MarineWeather {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  waveHeight: number;
  visibility: number;
  conditions: string;
  seaState: number;
  barometricPressure: number;
}

export interface TideInfo {
  currentLevel: number;
  trend: 'rising' | 'falling' | 'slack';
  nextHigh: {time: number; level: number};
  nextLow: {time: number; level: number};
  station: string;
}

export interface NavigationAlert {
  id: string;
  type: 'depth' | 'weather' | 'navigation' | 'safety';
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  location?: Location;
  acknowledged: boolean;
}

export interface VesselProfile {
  name: string;
  type: 'sailboat' | 'powerboat' | 'kayak' | 'other';
  length: number;
  draft: number;
  beam?: number;
  displacement?: number;
}

export interface UserPreferences {
  units: 'metric' | 'imperial' | 'nautical';
  theme: 'light' | 'dark' | 'auto';
  mapStyle: 'marine' | 'satellite' | 'hybrid';
  safetyMargin: number;
  depthAlerts: boolean;
  weatherAlerts: boolean;
  batteryOptimization: boolean;
}

export type MarineUnit = 'meters' | 'feet' | 'fathoms' | 'knots' | 'mph' | 'km/h';