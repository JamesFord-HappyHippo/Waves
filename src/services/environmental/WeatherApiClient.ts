/**
 * Weather Service Integration with Multiple Provider Fallbacks
 * Marine weather data for enhanced navigation safety
 */

import { Location, MarineWeather } from '../../types';

export interface WeatherProvider {
  name: string;
  priority: number;
  rateLimit: number; // requests per minute
  apiKey?: string;
  baseUrl: string;
  enabled: boolean;
}

export interface MarineWeatherExtended extends MarineWeather {
  uvIndex?: number;
  dewPoint?: number;
  humidity?: number;
  cloudCover?: number;
  precipitation?: number;
  precipitationType?: 'rain' | 'snow' | 'sleet' | 'none';
  swellHeight?: number;
  swellDirection?: number;
  swellPeriod?: number;
  tideHeight?: number;
  currentSpeed?: number;
  currentDirection?: number;
  sunrise?: number;
  sunset?: number;
  moonPhase?: number;
  iceAccretion?: boolean;
  marineWarnings?: string[];
}

export interface WeatherForecast {
  timestamp: number;
  weather: MarineWeatherExtended;
  confidence: number;
  source: string;
}

export interface MarineAlert {
  id: string;
  type: 'gale' | 'storm' | 'hurricane' | 'smallcraft' | 'marine' | 'fog' | 'ice';
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  title: string;
  description: string;
  areas: string[];
  validFrom: number;
  validTo: number;
  source: string;
}

export interface WeatherApiResponse<T> {
  data: T;
  source: string;
  timestamp: number;
  expiresAt: number;
}

export class WeatherApiClient {
  private providers: Map<string, WeatherProvider> = new Map();
  private cache = new Map<string, WeatherApiResponse<any>>();
  private requestCounts = new Map<string, { count: number; resetTime: number }>();
  private fallbackOrder: string[] = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Primary provider: Stormglass (specialized marine weather)
    this.providers.set('stormglass', {
      name: 'Stormglass',
      priority: 1,
      rateLimit: 50, // per hour for free tier
      baseUrl: 'https://api.stormglass.io/v2',
      enabled: true
    });

    // Secondary provider: OpenWeatherMap Marine
    this.providers.set('openweather', {
      name: 'OpenWeatherMap',
      priority: 2,
      rateLimit: 60, // per minute for free tier
      baseUrl: 'https://api.openweathermap.org/data/2.5',
      enabled: true
    });

    // Tertiary provider: WeatherAPI
    this.providers.set('weatherapi', {
      name: 'WeatherAPI',
      priority: 3,
      rateLimit: 100, // per hour for free tier
      baseUrl: 'https://api.weatherapi.com/v1',
      enabled: true
    });

    // NOAA National Weather Service (free, government data)
    this.providers.set('nws', {
      name: 'National Weather Service',
      priority: 4,
      rateLimit: 300, // per hour, generous limit
      baseUrl: 'https://api.weather.gov',
      enabled: true
    });

    this.fallbackOrder = Array.from(this.providers.keys())
      .filter(key => this.providers.get(key)?.enabled)
      .sort((a, b) => this.providers.get(a)!.priority - this.providers.get(b)!.priority);
  }

  /**
   * Configure API keys for providers
   */
  configureProvider(providerId: string, apiKey: string): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.apiKey = apiKey;
    }
  }

  /**
   * Check rate limits for a provider
   */
  private canMakeRequest(providerId: string): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) return false;

    const now = Date.now();
    const rateLimitInfo = this.requestCounts.get(providerId);

    if (!rateLimitInfo || now > rateLimitInfo.resetTime) {
      // Reset rate limit window
      this.requestCounts.set(providerId, {
        count: 0,
        resetTime: now + 60 * 60 * 1000 // 1 hour window
      });
      return true;
    }

    return rateLimitInfo.count < provider.rateLimit;
  }

  /**
   * Increment request count for rate limiting
   */
  private incrementRequestCount(providerId: string): void {
    const rateLimitInfo = this.requestCounts.get(providerId);
    if (rateLimitInfo) {
      rateLimitInfo.count++;
    }
  }

  /**
   * Get cached data if available and not expired
   */
  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Cache data with expiration
   */
  private setCachedData<T>(key: string, data: T, source: string, ttlMinutes: number): void {
    this.cache.set(key, {
      data,
      source,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMinutes * 60 * 1000
    });
  }

  /**
   * Fetch current marine weather from Stormglass API
   */
  private async fetchStormglassWeather(location: Location): Promise<MarineWeatherExtended> {
    const provider = this.providers.get('stormglass')!;
    if (!provider.apiKey) {
      throw new Error('Stormglass API key not configured');
    }

    const params = new URLSearchParams({
      lat: location.latitude.toString(),
      lng: location.longitude.toString(),
      params: 'airTemperature,waterTemperature,windSpeed,windDirection,waveHeight,visibility,pressure,humidity,cloudCover,precipitation,swellHeight,swellDirection,swellPeriod,currentSpeed,currentDirection'
    });

    const response = await fetch(`${provider.baseUrl}/weather/point?${params}`, {
      headers: {
        'Authorization': provider.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Stormglass API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const current = data.hours[0]; // Most recent data point

    return {
      temperature: current.airTemperature?.noaa || current.airTemperature?.sg || 0,
      windSpeed: current.windSpeed?.noaa || current.windSpeed?.sg || 0,
      windDirection: current.windDirection?.noaa || current.windDirection?.sg || 0,
      waveHeight: current.waveHeight?.noaa || current.waveHeight?.sg || 0,
      visibility: current.visibility?.noaa || current.visibility?.sg || 0,
      conditions: this.categorizeConditions(current),
      seaState: this.calculateSeaState(current.waveHeight?.noaa || current.waveHeight?.sg || 0),
      barometricPressure: current.pressure?.noaa || current.pressure?.sg || 0,
      humidity: current.humidity?.noaa || current.humidity?.sg,
      cloudCover: current.cloudCover?.noaa || current.cloudCover?.sg,
      precipitation: current.precipitation?.noaa || current.precipitation?.sg,
      swellHeight: current.swellHeight?.noaa || current.swellHeight?.sg,
      swellDirection: current.swellDirection?.noaa || current.swellDirection?.sg,
      swellPeriod: current.swellPeriod?.noaa || current.swellPeriod?.sg,
      currentSpeed: current.currentSpeed?.noaa || current.currentSpeed?.sg,
      currentDirection: current.currentDirection?.noaa || current.currentDirection?.sg,
      marineWarnings: []
    };
  }

  /**
   * Fetch current weather from OpenWeatherMap
   */
  private async fetchOpenWeatherData(location: Location): Promise<MarineWeatherExtended> {
    const provider = this.providers.get('openweather')!;
    if (!provider.apiKey) {
      throw new Error('OpenWeatherMap API key not configured');
    }

    const response = await fetch(
      `${provider.baseUrl}/weather?lat=${location.latitude}&lon=${location.longitude}&appid=${provider.apiKey}&units=metric`
    );

    if (!response.ok) {
      throw new Error(`OpenWeatherMap API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      temperature: data.main.temp,
      windSpeed: data.wind.speed,
      windDirection: data.wind.deg || 0,
      waveHeight: 0, // OpenWeatherMap doesn't provide wave data in basic plan
      visibility: data.visibility ? data.visibility / 1000 : 0, // Convert m to km
      conditions: data.weather[0].description,
      seaState: 0,
      barometricPressure: data.main.pressure,
      humidity: data.main.humidity,
      cloudCover: data.clouds.all,
      precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
      precipitationType: data.rain ? 'rain' : data.snow ? 'snow' : 'none',
      dewPoint: data.main.feels_like,
      uvIndex: 0, // Requires separate UV API call
      marineWarnings: []
    };
  }

  /**
   * Fetch weather from National Weather Service
   */
  private async fetchNWSWeather(location: Location): Promise<MarineWeatherExtended> {
    const provider = this.providers.get('nws')!;

    // First get the forecast office and grid coordinates
    const pointResponse = await fetch(
      `${provider.baseUrl}/points/${location.latitude},${location.longitude}`
    );

    if (!pointResponse.ok) {
      throw new Error(`NWS Points API error: ${pointResponse.status}`);
    }

    const pointData = await pointResponse.json();
    const forecastUrl = pointData.properties.forecast;

    // Get current conditions
    const forecastResponse = await fetch(forecastUrl);
    if (!forecastResponse.ok) {
      throw new Error(`NWS Forecast API error: ${forecastResponse.status}`);
    }

    const forecastData = await forecastResponse.json();
    const current = forecastData.properties.periods[0];

    // Parse temperature and wind from detailed forecast
    const tempMatch = current.detailedForecast.match(/(\d+)°?F?/);
    const windMatch = current.detailedForecast.match(/(\d+)\s*mph/i);

    return {
      temperature: tempMatch ? this.fahrenheitToCelsius(parseInt(tempMatch[1])) : 0,
      windSpeed: windMatch ? this.mphToMetersPerSecond(parseInt(windMatch[1])) : 0,
      windDirection: this.parseWindDirection(current.windDirection) || 0,
      waveHeight: 0, // NWS doesn't provide wave data in basic forecast
      visibility: 0, // Not available in basic forecast
      conditions: current.shortForecast,
      seaState: 0,
      barometricPressure: 0, // Not available in basic forecast
      marineWarnings: []
    };
  }

  /**
   * Get current marine weather with provider fallback
   */
  async getCurrentWeather(location: Location): Promise<MarineWeatherExtended> {
    const cacheKey = `weather_${location.latitude}_${location.longitude}`;
    const cached = this.getCachedData<MarineWeatherExtended>(cacheKey);
    if (cached) {
      return cached;
    }

    const errors: string[] = [];

    for (const providerId of this.fallbackOrder) {
      if (!this.canMakeRequest(providerId)) {
        errors.push(`${providerId}: Rate limit exceeded`);
        continue;
      }

      try {
        this.incrementRequestCount(providerId);
        let weather: MarineWeatherExtended;

        switch (providerId) {
          case 'stormglass':
            weather = await this.fetchStormglassWeather(location);
            break;
          case 'openweather':
            weather = await this.fetchOpenWeatherData(location);
            break;
          case 'nws':
            weather = await this.fetchNWSWeather(location);
            break;
          default:
            throw new Error(`Unknown provider: ${providerId}`);
        }

        // Cache successful response for 15 minutes
        this.setCachedData(cacheKey, weather, providerId, 15);
        return weather;

      } catch (error) {
        errors.push(`${providerId}: ${error}`);
        console.warn(`Weather provider ${providerId} failed:`, error);
      }
    }

    throw new Error(`All weather providers failed: ${errors.join(', ')}`);
  }

  /**
   * Get weather forecast for the next 24-48 hours
   */
  async getWeatherForecast(location: Location, hours: number = 24): Promise<WeatherForecast[]> {
    const cacheKey = `forecast_${location.latitude}_${location.longitude}_${hours}`;
    const cached = this.getCachedData<WeatherForecast[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Try Stormglass first for detailed marine forecasts
    if (this.canMakeRequest('stormglass')) {
      try {
        const provider = this.providers.get('stormglass')!;
        if (provider.apiKey) {
          this.incrementRequestCount('stormglass');
          const forecast = await this.fetchStormglassForecast(location, hours);
          this.setCachedData(cacheKey, forecast, 'stormglass', 60); // Cache for 1 hour
          return forecast;
        }
      } catch (error) {
        console.warn('Stormglass forecast failed:', error);
      }
    }

    // Fallback to OpenWeatherMap
    if (this.canMakeRequest('openweather')) {
      try {
        const provider = this.providers.get('openweather')!;
        if (provider.apiKey) {
          this.incrementRequestCount('openweather');
          const forecast = await this.fetchOpenWeatherForecast(location, hours);
          this.setCachedData(cacheKey, forecast, 'openweather', 60);
          return forecast;
        }
      } catch (error) {
        console.warn('OpenWeatherMap forecast failed:', error);
      }
    }

    throw new Error('Unable to fetch weather forecast from any provider');
  }

  /**
   * Get marine weather alerts and warnings
   */
  async getMarineAlerts(location: Location): Promise<MarineAlert[]> {
    const cacheKey = `alerts_${location.latitude}_${location.longitude}`;
    const cached = this.getCachedData<MarineAlert[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Use NWS for US coastal alerts
      const alerts = await this.fetchNWSAlerts(location);
      this.setCachedData(cacheKey, alerts, 'nws', 30); // Cache for 30 minutes
      return alerts;
    } catch (error) {
      console.warn('Failed to fetch marine alerts:', error);
      return [];
    }
  }

  private async fetchStormglassForecast(location: Location, hours: number): Promise<WeatherForecast[]> {
    const provider = this.providers.get('stormglass')!;
    const end = new Date(Date.now() + hours * 60 * 60 * 1000);
    
    const params = new URLSearchParams({
      lat: location.latitude.toString(),
      lng: location.longitude.toString(),
      start: new Date().toISOString(),
      end: end.toISOString(),
      params: 'airTemperature,waterTemperature,windSpeed,windDirection,waveHeight,visibility,pressure'
    });

    const response = await fetch(`${provider.baseUrl}/weather/point?${params}`, {
      headers: {
        'Authorization': provider.apiKey!,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Stormglass forecast API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.hours.map((hour: any) => ({
      timestamp: new Date(hour.time).getTime(),
      weather: {
        temperature: hour.airTemperature?.noaa || hour.airTemperature?.sg || 0,
        windSpeed: hour.windSpeed?.noaa || hour.windSpeed?.sg || 0,
        windDirection: hour.windDirection?.noaa || hour.windDirection?.sg || 0,
        waveHeight: hour.waveHeight?.noaa || hour.waveHeight?.sg || 0,
        visibility: hour.visibility?.noaa || hour.visibility?.sg || 0,
        conditions: this.categorizeConditions(hour),
        seaState: this.calculateSeaState(hour.waveHeight?.noaa || hour.waveHeight?.sg || 0),
        barometricPressure: hour.pressure?.noaa || hour.pressure?.sg || 0,
        marineWarnings: []
      },
      confidence: 0.9, // Stormglass typically has high accuracy
      source: 'stormglass'
    }));
  }

  private async fetchOpenWeatherForecast(location: Location, hours: number): Promise<WeatherForecast[]> {
    const provider = this.providers.get('openweather')!;
    
    const response = await fetch(
      `${provider.baseUrl}/forecast?lat=${location.latitude}&lon=${location.longitude}&appid=${provider.apiKey}&units=metric&cnt=${Math.ceil(hours / 3)}`
    );

    if (!response.ok) {
      throw new Error(`OpenWeatherMap forecast API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.list.slice(0, Math.ceil(hours / 3)).map((item: any) => ({
      timestamp: item.dt * 1000,
      weather: {
        temperature: item.main.temp,
        windSpeed: item.wind.speed,
        windDirection: item.wind.deg || 0,
        waveHeight: 0,
        visibility: item.visibility ? item.visibility / 1000 : 0,
        conditions: item.weather[0].description,
        seaState: 0,
        barometricPressure: item.main.pressure,
        humidity: item.main.humidity,
        cloudCover: item.clouds.all,
        precipitation: item.rain?.['3h'] || item.snow?.['3h'] || 0,
        marineWarnings: []
      },
      confidence: 0.8,
      source: 'openweather'
    }));
  }

  private async fetchNWSAlerts(location: Location): Promise<MarineAlert[]> {
    const provider = this.providers.get('nws')!;
    
    const response = await fetch(
      `${provider.baseUrl}/alerts/active?point=${location.latitude},${location.longitude}`
    );

    if (!response.ok) {
      throw new Error(`NWS alerts API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.features
      .filter((alert: any) => 
        alert.properties.event.toLowerCase().includes('marine') ||
        alert.properties.event.toLowerCase().includes('coastal') ||
        alert.properties.event.toLowerCase().includes('gale') ||
        alert.properties.event.toLowerCase().includes('storm')
      )
      .map((alert: any) => ({
        id: alert.id,
        type: this.classifyAlertType(alert.properties.event),
        severity: this.classifyAlertSeverity(alert.properties.severity),
        title: alert.properties.event,
        description: alert.properties.description,
        areas: alert.properties.areaDesc.split('; '),
        validFrom: new Date(alert.properties.onset).getTime(),
        validTo: new Date(alert.properties.expires).getTime(),
        source: 'nws'
      }));
  }

  // Helper methods
  private categorizeConditions(data: any): string {
    const windSpeed = data.windSpeed?.noaa || data.windSpeed?.sg || 0;
    const visibility = data.visibility?.noaa || data.visibility?.sg || 0;
    const precipitation = data.precipitation?.noaa || data.precipitation?.sg || 0;

    if (precipitation > 2.5) return 'Heavy Rain';
    if (precipitation > 0.5) return 'Light Rain';
    if (visibility < 1) return 'Fog';
    if (windSpeed > 15) return 'Strong Winds';
    if (windSpeed > 8) return 'Moderate Winds';
    return 'Clear';
  }

  private calculateSeaState(waveHeight: number): number {
    if (waveHeight < 0.1) return 0; // Calm
    if (waveHeight < 0.5) return 1; // Smooth
    if (waveHeight < 1.25) return 2; // Slight
    if (waveHeight < 2.5) return 3; // Moderate
    if (waveHeight < 4) return 4; // Rough
    if (waveHeight < 6) return 5; // Very Rough
    if (waveHeight < 9) return 6; // High
    if (waveHeight < 14) return 7; // Very High
    return 8; // Phenomenal
  }

  private classifyAlertType(event: string): MarineAlert['type'] {
    const eventLower = event.toLowerCase();
    if (eventLower.includes('gale')) return 'gale';
    if (eventLower.includes('storm')) return 'storm';
    if (eventLower.includes('hurricane')) return 'hurricane';
    if (eventLower.includes('small craft')) return 'smallcraft';
    if (eventLower.includes('fog')) return 'fog';
    if (eventLower.includes('ice')) return 'ice';
    return 'marine';
  }

  private classifyAlertSeverity(severity: string): MarineAlert['severity'] {
    switch (severity?.toLowerCase()) {
      case 'extreme': return 'extreme';
      case 'severe': return 'severe';
      case 'moderate': return 'moderate';
      default: return 'minor';
    }
  }

  private parseWindDirection(direction: string): number {
    const directions: { [key: string]: number } = {
      'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
      'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
      'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
      'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
    };
    return directions[direction] || 0;
  }

  private fahrenheitToCelsius(f: number): number {
    return (f - 32) * 5 / 9;
  }

  private mphToMetersPerSecond(mph: number): number {
    return mph * 0.44704;
  }

  /**
   * Get provider status and rate limit information
   */
  getProviderStatus(): Array<{
    id: string;
    name: string;
    enabled: boolean;
    hasApiKey: boolean;
    requestsRemaining: number;
    resetTime: number;
  }> {
    return Array.from(this.providers.entries()).map(([id, provider]) => {
      const rateLimitInfo = this.requestCounts.get(id);
      const requestsUsed = rateLimitInfo?.count || 0;
      
      return {
        id,
        name: provider.name,
        enabled: provider.enabled,
        hasApiKey: !!provider.apiKey,
        requestsRemaining: Math.max(0, provider.rateLimit - requestsUsed),
        resetTime: rateLimitInfo?.resetTime || 0
      };
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const weatherClient = new WeatherApiClient();