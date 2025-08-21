/**
 * Real API Client for Waves Marine Navigation
 * Connects to AWS Lambda functions via API Gateway
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth } from '@aws-amplify/auth';

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export interface DepthReading {
  id: string;
  latitude: number;
  longitude: number;
  depth: number;
  confidence: number;
  vesselDraft?: number;
  timestamp: string;
  userId: string;
  distanceMeters?: number;
}

export interface MarineWeatherData {
  location: {
    latitude: number;
    longitude: number;
  };
  current: {
    temperature: number;
    windSpeed: number;
    windDirection: number;
    pressure: number;
    humidity: number;
    visibility: number;
    conditions: string;
  };
  marine: {
    waveHeight?: number;
    wavePeriod?: number;
    waveDirection?: number;
    seaTemperature?: number;
    tide?: {
      height: number;
      type: 'high' | 'low';
      nextChange: string;
    };
  };
  forecast?: Array<{
    datetime: string;
    temperature: number;
    windSpeed: number;
    windDirection: number;
    waveHeight?: number;
    conditions: string;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

class ApiClient {
  private config: ApiConfig;
  private authToken: string | null = null;
  
  constructor(config: ApiConfig) {
    this.config = config;
  }

  /**
   * Get authentication token from AWS Cognito
   */
  private async getAuthToken(): Promise<string> {
    try {
      const session = await Auth.currentSession();
      return session.getIdToken().getJwtToken();
    } catch (error) {
      console.error('Failed to get auth token:', error);
      throw new Error('Authentication required');
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // Get fresh auth token
    const token = await this.getAuthToken();
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      timeout: this.config.timeout,
    };

    let lastError: Error;
    
    // Retry logic
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`API Request (attempt ${attempt}): ${options.method || 'GET'} ${url}`);
        
        const response = await fetch(url, requestOptions);
        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(`API Error ${response.status}: ${responseData.error || response.statusText}`);
        }

        console.log(`API Response: ${response.status} ${url}`);
        return responseData;

      } catch (error) {
        lastError = error as Error;
        console.error(`API Request failed (attempt ${attempt}):`, error);
        
        if (attempt === this.config.retryAttempts) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw lastError!;
  }

  /**
   * Get depth readings for a location
   */
  async getDepthReadings(
    latitude: number,
    longitude: number,
    radius: number = 1000,
    vesselDraft?: number,
    maxAge: number = 30
  ): Promise<DepthReading[]> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius: radius.toString(),
      maxAge: maxAge.toString(),
    });

    if (vesselDraft !== undefined) {
      params.append('vesselDraft', vesselDraft.toString());
    }

    const response = await this.makeRequest<{
      readings: DepthReading[];
      count: number;
      safety_notice: string;
    }>(`/api/depth/readings?${params.toString()}`);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch depth readings');
    }

    return response.data.readings;
  }

  /**
   * Submit new depth reading
   */
  async submitDepthReading(depthReading: {
    latitude: number;
    longitude: number;
    depth: number;
    confidence: number;
    vesselDraft?: number;
    timestamp?: string;
  }): Promise<{ id: string; submittedAt: string }> {
    // Get current user ID from Cognito
    const user = await Auth.currentUserInfo();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const data = {
      ...depthReading,
      userId: user.id,
      timestamp: depthReading.timestamp || new Date().toISOString(),
    };

    const response = await this.makeRequest<{
      id: string;
      submittedAt: string;
      safety_notice: string;
    }>('/api/depth/readings', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to submit depth reading');
    }

    return {
      id: response.data.id,
      submittedAt: response.data.submittedAt,
    };
  }

  /**
   * Get depth statistics for an area
   */
  async getDepthStatistics(
    latitude: number,
    longitude: number,
    radius: number = 1000,
    maxAge: number = 30
  ): Promise<{
    totalReadings: number;
    averageDepth: number;
    minDepth: number;
    maxDepth: number;
    averageConfidence: number;
    uniqueContributors: number;
  }> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius: radius.toString(),
      maxAge: maxAge.toString(),
    });

    const response = await this.makeRequest<{
      statistics: {
        totalReadings: number;
        averageDepth: number;
        minDepth: number;
        maxDepth: number;
        averageConfidence: number;
        uniqueContributors: number;
      };
      safety_notice: string;
    }>(`/api/depth/statistics?${params.toString()}`);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch depth statistics');
    }

    return response.data.statistics;
  }

  /**
   * Get marine weather data
   */
  async getMarineWeather(
    latitude: number,
    longitude: number,
    includeWaves: boolean = true,
    includeTides: boolean = true,
    forecast: boolean = false
  ): Promise<MarineWeatherData> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      includeWaves: includeWaves.toString(),
      includeTides: includeTides.toString(),
      forecast: forecast.toString(),
    });

    const response = await this.makeRequest<{
      weather: MarineWeatherData;
      dataSources: string[];
      lastUpdated: string;
      safety_notice: string;
    }>(`/api/weather/marine?${params.toString()}`);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch marine weather');
    }

    return response.data.weather;
  }

  /**
   * Get marine weather alerts
   */
  async getMarineAlerts(
    latitude: number,
    longitude: number
  ): Promise<Array<{
    id: string;
    type: string;
    severity: string;
    urgency: string;
    description: string;
    headline: string;
    start: string;
    end: string;
    areas: string;
  }>> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
    });

    const response = await this.makeRequest<{
      alerts: Array<{
        id: string;
        type: string;
        severity: string;
        urgency: string;
        description: string;
        headline: string;
        start: string;
        end: string;
        areas: string;
      }>;
      alertCount: number;
      safety_notice: string;
    }>(`/api/weather/alerts?${params.toString()}`);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch marine alerts');
    }

    return response.data.alerts;
  }

  /**
   * Test API connectivity and authentication
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple depth statistics call
      await this.getDepthStatistics(37.7749, -122.4194, 1000);
      return true;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }

  /**
   * Update API configuration
   */
  updateConfig(newConfig: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Default API client instance
const defaultConfig: ApiConfig = {
  baseUrl: process.env.REACT_APP_API_URL || 'https://api-dev.seawater.io',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
};

export const apiClient = new ApiClient(defaultConfig);

// Export for custom configurations
export { ApiClient };