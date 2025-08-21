// Weather Service Integration
// OpenWeatherMap and Stormglass API integration for marine weather

import axios, { AxiosInstance } from 'axios';
import { redis } from '../config/redis';
import { db } from '../config/database';
import { WeatherData, WeatherAlert, Point } from '../types';
import logger from '../utils/logger';
import config from '../config';

export class WeatherService {
  private openWeatherClient: AxiosInstance | null = null;
  private stormglassClient: AxiosInstance | null = null;

  constructor() {
    // Initialize OpenWeatherMap client
    if (config.weatherApi.openWeatherApiKey) {
      this.openWeatherClient = axios.create({
        baseURL: 'https://api.openweathermap.org/data/2.5',
        timeout: 10000,
        params: {
          appid: config.weatherApi.openWeatherApiKey,
          units: 'metric'
        }
      });
    }

    // Initialize Stormglass client
    if (config.weatherApi.stormglassApiKey) {
      this.stormglassClient = axios.create({
        baseURL: 'https://api.stormglass.io/v2',
        timeout: 15000,
        headers: {
          'Authorization': config.weatherApi.stormglassApiKey
        }
      });
    }

    this.setupInterceptors();
  }

  /**
   * Get current weather conditions for a location
   */
  async getCurrentWeather(location: Point): Promise<WeatherData | null> {
    try {
      const cacheKey = `weather_current_${location.latitude.toFixed(3)}_${location.longitude.toFixed(3)}`;
      
      // Check cache first (cache for 15 minutes)
      const cachedData = await redis.getCachedWeatherData(cacheKey);
      if (cachedData) {
        logger.debug('Returning cached current weather data', { location, cacheKey });
        return cachedData;
      }

      let weatherData: WeatherData | null = null;

      // Try Stormglass first for marine-specific data
      if (this.stormglassClient) {
        weatherData = await this.getCurrentWeatherFromStormglass(location);
      }

      // Fallback to OpenWeatherMap if Stormglass fails
      if (!weatherData && this.openWeatherClient) {
        weatherData = await this.getCurrentWeatherFromOpenWeather(location);
      }

      if (weatherData) {
        // Cache for 15 minutes
        await redis.cacheWeatherData(cacheKey, weatherData, 900);
        
        // Store in database
        await this.storeWeatherDataInDB(weatherData);
      }

      return weatherData;

    } catch (error) {
      logger.error('Error fetching current weather:', error);
      return null;
    }
  }

  /**
   * Get weather forecast for a location
   */
  async getWeatherForecast(location: Point, hours: number = 48): Promise<WeatherData[]> {
    try {
      const cacheKey = `weather_forecast_${location.latitude.toFixed(3)}_${location.longitude.toFixed(3)}_${hours}h`;
      
      // Check cache first (cache for 1 hour)
      const cachedData = await redis.getCachedWeatherData(cacheKey);
      if (cachedData) {
        logger.debug('Returning cached weather forecast', { location, hours, cacheKey });
        return cachedData;
      }

      let forecastData: WeatherData[] = [];

      // Try Stormglass first for detailed marine forecast
      if (this.stormglassClient) {
        forecastData = await this.getForecastFromStormglass(location, hours);
      }

      // Fallback to OpenWeatherMap if Stormglass fails
      if (forecastData.length === 0 && this.openWeatherClient) {
        forecastData = await this.getForecastFromOpenWeather(location, hours);
      }

      if (forecastData.length > 0) {
        // Cache for 1 hour
        await redis.cacheWeatherData(cacheKey, forecastData, 3600);
        
        // Store in database
        for (const data of forecastData) {
          await this.storeWeatherDataInDB(data);
        }
      }

      return forecastData;

    } catch (error) {
      logger.error('Error fetching weather forecast:', error);
      return [];
    }
  }

  /**
   * Get marine-specific weather conditions
   */
  async getMarineWeather(location: Point): Promise<WeatherData | null> {
    try {
      if (!this.stormglassClient) {
        logger.warn('Stormglass API key not configured, falling back to general weather');
        return this.getCurrentWeather(location);
      }

      const cacheKey = `weather_marine_${location.latitude.toFixed(3)}_${location.longitude.toFixed(3)}`;
      
      const cachedData = await redis.getCachedWeatherData(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      const params = {
        lat: location.latitude,
        lng: location.longitude,
        params: 'waveHeight,wavePeriod,waveDirection,windSpeed,windDirection,visibility,airTemperature,waterTemperature,pressure'
      };

      const response = await this.stormglassClient.get('/weather/point', { params });

      if (!response.data?.hours || response.data.hours.length === 0) {
        return null;
      }

      const currentHour = response.data.hours[0];
      
      const marineWeather: WeatherData = {
        id: `stormglass_marine_${location.latitude}_${location.longitude}_${Date.now()}`,
        location,
        timestamp: new Date(currentHour.time),
        source: 'Stormglass',
        windSpeedKnots: this.getFirstValidValue(currentHour.windSpeed),
        windDirection: this.getFirstValidValue(currentHour.windDirection),
        waveHeightMeters: this.getFirstValidValue(currentHour.waveHeight),
        wavePeriodSeconds: this.getFirstValidValue(currentHour.wavePeriod),
        waveDirection: this.getFirstValidValue(currentHour.waveDirection),
        visibilityKm: this.getFirstValidValue(currentHour.visibility),
        temperatureCelsius: this.getFirstValidValue(currentHour.airTemperature),
        pressureMb: this.getFirstValidValue(currentHour.pressure),
        forecastData: {
          waterTemperature: this.getFirstValidValue(currentHour.waterTemperature),
          marineConditions: this.assessMarineConditions(currentHour),
          sources: this.extractSources(currentHour)
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      };

      // Cache for 30 minutes
      await redis.cacheWeatherData(cacheKey, marineWeather, 1800);

      return marineWeather;

    } catch (error) {
      logger.error('Error fetching marine weather from Stormglass:', error);
      return this.getCurrentWeather(location);
    }
  }

  /**
   * Get weather alerts for a location
   */
  async getWeatherAlerts(location: Point, radiusKm: number = 50): Promise<WeatherAlert[]> {
    try {
      if (!this.openWeatherClient) {
        logger.warn('OpenWeatherMap API key not configured, cannot fetch weather alerts');
        return [];
      }

      const cacheKey = `weather_alerts_${location.latitude.toFixed(2)}_${location.longitude.toFixed(2)}_${radiusKm}`;
      
      const cachedAlerts = await redis.getCachedWeatherData(cacheKey);
      if (cachedAlerts) {
        return cachedAlerts;
      }

      const params = {
        lat: location.latitude,
        lon: location.longitude
      };

      const response = await this.openWeatherClient.get('/onecall', { params });

      const alerts: WeatherAlert[] = [];

      if (response.data?.alerts) {
        for (const alert of response.data.alerts) {
          alerts.push({
            type: this.categorizeAlert(alert.event),
            severity: this.calculateAlertSeverity(alert.event, alert.description),
            message: alert.description,
            validUntil: new Date(alert.end * 1000),
            affectedArea: {
              northEast: {
                latitude: location.latitude + 0.5,
                longitude: location.longitude + 0.5
              },
              southWest: {
                latitude: location.latitude - 0.5,
                longitude: location.longitude - 0.5
              }
            }
          });
        }
      }

      // Add marine-specific alerts based on current conditions
      const currentWeather = await this.getCurrentWeather(location);
      if (currentWeather) {
        const marineAlerts = this.generateMarineAlerts(currentWeather);
        alerts.push(...marineAlerts);
      }

      // Cache for 1 hour
      await redis.cacheWeatherData(cacheKey, alerts, 3600);

      logger.info('Weather alerts retrieved', {
        location,
        alertCount: alerts.length,
        types: alerts.map(a => a.type)
      });

      return alerts;

    } catch (error) {
      logger.error('Error fetching weather alerts:', error);
      return [];
    }
  }

  /**
   * Get current weather from Stormglass
   */
  private async getCurrentWeatherFromStormglass(location: Point): Promise<WeatherData | null> {
    try {
      const params = {
        lat: location.latitude,
        lng: location.longitude,
        params: 'windSpeed,windDirection,waveHeight,visibility,airTemperature,pressure'
      };

      const response = await this.stormglassClient!.get('/weather/point', { params });

      if (!response.data?.hours || response.data.hours.length === 0) {
        return null;
      }

      const currentHour = response.data.hours[0];

      return {
        id: `stormglass_${location.latitude}_${location.longitude}_${Date.now()}`,
        location,
        timestamp: new Date(currentHour.time),
        source: 'Stormglass',
        windSpeedKnots: this.getFirstValidValue(currentHour.windSpeed),
        windDirection: this.getFirstValidValue(currentHour.windDirection),
        waveHeightMeters: this.getFirstValidValue(currentHour.waveHeight),
        visibilityKm: this.getFirstValidValue(currentHour.visibility),
        temperatureCelsius: this.getFirstValidValue(currentHour.airTemperature),
        pressureMb: this.getFirstValidValue(currentHour.pressure),
        forecastData: {
          sources: this.extractSources(currentHour)
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };

    } catch (error) {
      logger.error('Error fetching current weather from Stormglass:', error);
      return null;
    }
  }

  /**
   * Get current weather from OpenWeatherMap
   */
  private async getCurrentWeatherFromOpenWeather(location: Point): Promise<WeatherData | null> {
    try {
      const params = {
        lat: location.latitude,
        lon: location.longitude
      };

      const response = await this.openWeatherClient!.get('/weather', { params });

      if (!response.data) {
        return null;
      }

      const data = response.data;

      return {
        id: `openweather_${location.latitude}_${location.longitude}_${Date.now()}`,
        location,
        timestamp: new Date(data.dt * 1000),
        source: 'OpenWeatherMap',
        windSpeedKnots: data.wind?.speed ? data.wind.speed * 1.943844 : undefined, // m/s to knots
        windDirection: data.wind?.deg,
        visibilityKm: data.visibility ? data.visibility / 1000 : undefined,
        temperatureCelsius: data.main?.temp,
        pressureMb: data.main?.pressure,
        humidityPercent: data.main?.humidity,
        forecastData: {
          description: data.weather?.[0]?.description,
          icon: data.weather?.[0]?.icon,
          clouds: data.clouds?.all,
          uvIndex: data.uvi
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };

    } catch (error) {
      logger.error('Error fetching current weather from OpenWeatherMap:', error);
      return null;
    }
  }

  /**
   * Get forecast from Stormglass
   */
  private async getForecastFromStormglass(location: Point, hours: number): Promise<WeatherData[]> {
    try {
      const endTime = new Date(Date.now() + hours * 60 * 60 * 1000);
      
      const params = {
        lat: location.latitude,
        lng: location.longitude,
        params: 'windSpeed,windDirection,waveHeight,waveDirection,visibility,airTemperature,pressure',
        end: endTime.toISOString()
      };

      const response = await this.stormglassClient!.get('/weather/point', { params });

      if (!response.data?.hours) {
        return [];
      }

      return response.data.hours.map((hour: any, index: number) => ({
        id: `stormglass_forecast_${location.latitude}_${location.longitude}_${index}`,
        location,
        timestamp: new Date(hour.time),
        source: 'Stormglass',
        windSpeedKnots: this.getFirstValidValue(hour.windSpeed),
        windDirection: this.getFirstValidValue(hour.windDirection),
        waveHeightMeters: this.getFirstValidValue(hour.waveHeight),
        waveDirection: this.getFirstValidValue(hour.waveDirection),
        visibilityKm: this.getFirstValidValue(hour.visibility),
        temperatureCelsius: this.getFirstValidValue(hour.airTemperature),
        pressureMb: this.getFirstValidValue(hour.pressure),
        forecastData: {
          sources: this.extractSources(hour)
        },
        createdAt: new Date(),
        expiresAt: new Date(hour.time)
      }));

    } catch (error) {
      logger.error('Error fetching forecast from Stormglass:', error);
      return [];
    }
  }

  /**
   * Get forecast from OpenWeatherMap
   */
  private async getForecastFromOpenWeather(location: Point, hours: number): Promise<WeatherData[]> {
    try {
      const params = {
        lat: location.latitude,
        lon: location.longitude,
        cnt: Math.min(Math.ceil(hours / 3), 40) // 3-hour intervals, max 5 days
      };

      const response = await this.openWeatherClient!.get('/forecast', { params });

      if (!response.data?.list) {
        return [];
      }

      return response.data.list.map((item: any, index: number) => ({
        id: `openweather_forecast_${location.latitude}_${location.longitude}_${index}`,
        location,
        timestamp: new Date(item.dt * 1000),
        source: 'OpenWeatherMap',
        windSpeedKnots: item.wind?.speed ? item.wind.speed * 1.943844 : undefined,
        windDirection: item.wind?.deg,
        visibilityKm: item.visibility ? item.visibility / 1000 : undefined,
        temperatureCelsius: item.main?.temp,
        pressureMb: item.main?.pressure,
        humidityPercent: item.main?.humidity,
        precipitationMm: item.rain?.['3h'] || item.snow?.['3h'] || 0,
        forecastData: {
          description: item.weather?.[0]?.description,
          icon: item.weather?.[0]?.icon,
          clouds: item.clouds?.all,
          pop: item.pop // Probability of precipitation
        },
        createdAt: new Date(),
        expiresAt: new Date(item.dt * 1000)
      }));

    } catch (error) {
      logger.error('Error fetching forecast from OpenWeatherMap:', error);
      return [];
    }
  }

  /**
   * Setup API client interceptors
   */
  private setupInterceptors(): void {
    // OpenWeatherMap interceptors
    if (this.openWeatherClient) {
      this.openWeatherClient.interceptors.response.use(
        (response) => response,
        (error) => {
          logger.error('OpenWeatherMap API error:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            message: error.response?.data?.message
          });
          throw error;
        }
      );
    }

    // Stormglass interceptors
    if (this.stormglassClient) {
      this.stormglassClient.interceptors.response.use(
        (response) => response,
        (error) => {
          logger.error('Stormglass API error:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            message: error.response?.data?.errors?.[0]?.message
          });
          throw error;
        }
      );
    }
  }

  /**
   * Store weather data in database
   */
  private async storeWeatherDataInDB(weatherData: WeatherData): Promise<void> {
    try {
      const query = `
        INSERT INTO weather_data (
          id, location, timestamp, source, wind_speed_knots, wind_direction,
          wave_height_meters, wave_period_seconds, wave_direction, visibility_km,
          precipitation_mm, temperature_celsius, pressure_mb, humidity_percent,
          forecast_data, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          wind_speed_knots = EXCLUDED.wind_speed_knots,
          wind_direction = EXCLUDED.wind_direction,
          wave_height_meters = EXCLUDED.wave_height_meters,
          forecast_data = EXCLUDED.forecast_data
      `;

      await db.query(query, [
        weatherData.id,
        db.createPoint(weatherData.location.latitude, weatherData.location.longitude),
        weatherData.timestamp,
        weatherData.source,
        weatherData.windSpeedKnots || null,
        weatherData.windDirection || null,
        weatherData.waveHeightMeters || null,
        weatherData.wavePeriodSeconds || null,
        weatherData.waveDirection || null,
        weatherData.visibilityKm || null,
        weatherData.precipitationMm || null,
        weatherData.temperatureCelsius || null,
        weatherData.pressureMb || null,
        weatherData.humidityPercent || null,
        JSON.stringify(weatherData.forecastData),
        weatherData.expiresAt
      ]);

    } catch (error) {
      logger.error('Error storing weather data in database:', error);
      // Don't throw - this is not critical for the API response
    }
  }

  /**
   * Get first valid value from Stormglass multi-source data
   */
  private getFirstValidValue(dataObject: any): number | undefined {
    if (!dataObject || typeof dataObject !== 'object') {
      return undefined;
    }

    // Stormglass returns data in format: { source1: value1, source2: value2, ... }
    const values = Object.values(dataObject) as number[];
    return values.find(val => val !== null && val !== undefined && !isNaN(val));
  }

  /**
   * Extract data sources from Stormglass response
   */
  private extractSources(hourData: any): string[] {
    const sources = new Set<string>();
    
    Object.values(hourData).forEach((param: any) => {
      if (typeof param === 'object' && param !== null) {
        Object.keys(param).forEach(source => sources.add(source));
      }
    });

    return Array.from(sources);
  }

  /**
   * Assess marine conditions based on weather data
   */
  private assessMarineConditions(hourData: any): string {
    const windSpeed = this.getFirstValidValue(hourData.windSpeed);
    const waveHeight = this.getFirstValidValue(hourData.waveHeight);
    const visibility = this.getFirstValidValue(hourData.visibility);

    if (!windSpeed && !waveHeight) return 'unknown';

    if (windSpeed && windSpeed > 25) return 'rough';
    if (waveHeight && waveHeight > 3) return 'rough';
    if (visibility && visibility < 1) return 'poor_visibility';
    if (windSpeed && windSpeed > 15) return 'moderate';
    if (waveHeight && waveHeight > 1.5) return 'moderate';
    
    return 'calm';
  }

  /**
   * Categorize weather alert types
   */
  private categorizeAlert(event: string): 'wind' | 'wave' | 'fog' | 'storm' | 'small_craft_advisory' {
    const eventLower = event.toLowerCase();
    
    if (eventLower.includes('wind') || eventLower.includes('gale')) return 'wind';
    if (eventLower.includes('wave') || eventLower.includes('surf')) return 'wave';
    if (eventLower.includes('fog') || eventLower.includes('visibility')) return 'fog';
    if (eventLower.includes('storm') || eventLower.includes('hurricane') || eventLower.includes('tornado')) return 'storm';
    if (eventLower.includes('small craft') || eventLower.includes('marine')) return 'small_craft_advisory';
    
    return 'storm'; // Default for unrecognized alerts
  }

  /**
   * Calculate alert severity
   */
  private calculateAlertSeverity(event: string, description: string): number {
    const eventLower = event.toLowerCase();
    const descLower = description.toLowerCase();

    if (eventLower.includes('hurricane') || eventLower.includes('tornado')) return 5;
    if (eventLower.includes('storm') || eventLower.includes('severe')) return 4;
    if (eventLower.includes('gale') || eventLower.includes('warning')) return 3;
    if (eventLower.includes('advisory') || descLower.includes('small craft')) return 2;
    
    return 1;
  }

  /**
   * Generate marine-specific alerts based on current conditions
   */
  private generateMarineAlerts(weatherData: WeatherData): WeatherAlert[] {
    const alerts: WeatherAlert[] = [];

    // Small craft advisory for high winds
    if (weatherData.windSpeedKnots && weatherData.windSpeedKnots > 18) {
      alerts.push({
        type: 'small_craft_advisory',
        severity: weatherData.windSpeedKnots > 25 ? 3 : 2,
        message: `Small Craft Advisory: Winds ${Math.round(weatherData.windSpeedKnots)} knots. Exercise caution.`,
        validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours
      });
    }

    // Wave height warning
    if (weatherData.waveHeightMeters && weatherData.waveHeightMeters > 2) {
      alerts.push({
        type: 'wave',
        severity: weatherData.waveHeightMeters > 4 ? 4 : 3,
        message: `High Waves: Wave heights ${weatherData.waveHeightMeters.toFixed(1)}m. Dangerous conditions for small vessels.`,
        validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000)
      });
    }

    // Visibility warning
    if (weatherData.visibilityKm && weatherData.visibilityKm < 2) {
      alerts.push({
        type: 'fog',
        severity: weatherData.visibilityKm < 0.5 ? 4 : 3,
        message: `Reduced Visibility: Visibility ${weatherData.visibilityKm.toFixed(1)}km. Navigation may be hazardous.`,
        validUntil: new Date(Date.now() + 3 * 60 * 60 * 1000)
      });
    }

    return alerts;
  }
}

// Create singleton instance
export const weatherService = new WeatherService();