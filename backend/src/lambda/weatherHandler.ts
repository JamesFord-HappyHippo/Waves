/**
 * AWS Lambda Handler for Weather Data Processing
 * Integrates with NOAA and marine weather APIs
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { z } from 'zod';
import fetch from 'node-fetch';

// Validation schemas
const WeatherQuerySchema = z.object({
  latitude: z.string().transform(Number),
  longitude: z.string().transform(Number),
  includeWaves: z.string().optional().transform(v => v === 'true'),
  includeTides: z.string().optional().transform(v => v === 'true'),
  forecast: z.string().optional().transform(v => v === 'true'),
});

interface MarineWeatherData {
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
  alerts?: Array<{
    type: string;
    severity: string;
    description: string;
    start: string;
    end: string;
  }>;
}

const createSuccessResponse = (data: any, message?: string): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  },
  body: JSON.stringify({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  }),
});

const createErrorResponse = (statusCode: number, message: string, details?: any): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  },
  body: JSON.stringify({
    success: false,
    error: message,
    details,
    timestamp: new Date().toISOString(),
  }),
});

/**
 * Fetch current weather from NOAA
 */
async function fetchNoaaWeather(latitude: number, longitude: number): Promise<any> {
  try {
    // Get nearest weather station
    const stationsResponse = await fetch(
      `https://api.weather.gov/points/${latitude},${longitude}`
    );
    
    if (!stationsResponse.ok) {
      throw new Error(`NOAA API error: ${stationsResponse.status}`);
    }
    
    const stationsData = await stationsResponse.json();
    const forecastUrl = stationsData.properties.forecast;
    const observationStations = stationsData.properties.observationStations;
    
    // Get current observations
    let currentWeather = null;
    if (observationStations) {
      try {
        const obsResponse = await fetch(observationStations);
        const obsData = await obsResponse.json();
        
        if (obsData.features && obsData.features.length > 0) {
          const stationUrl = obsData.features[0].id + '/observations/latest';
          const currentResponse = await fetch(stationUrl);
          const currentData = await currentResponse.json();
          
          if (currentData.properties) {
            const props = currentData.properties;
            currentWeather = {
              temperature: props.temperature?.value ? props.temperature.value : null,
              windSpeed: props.windSpeed?.value ? props.windSpeed.value * 3.6 : null, // Convert m/s to km/h
              windDirection: props.windDirection?.value ? props.windDirection.value : null,
              pressure: props.barometricPressure?.value ? props.barometricPressure.value / 100 : null, // Convert Pa to hPa
              humidity: props.relativeHumidity?.value ? props.relativeHumidity.value : null,
              visibility: props.visibility?.value ? props.visibility.value / 1000 : null, // Convert m to km
              conditions: props.textDescription || 'Unknown',
            };
          }
        }
      } catch (obsError) {
        console.warn('Could not fetch current observations:', obsError);
      }
    }
    
    // Get forecast
    let forecast = null;
    if (forecastUrl) {
      try {
        const forecastResponse = await fetch(forecastUrl);
        const forecastData = await forecastResponse.json();
        
        if (forecastData.properties && forecastData.properties.periods) {
          forecast = forecastData.properties.periods.slice(0, 7).map((period: any) => ({
            datetime: period.startTime,
            temperature: period.temperature,
            windSpeed: period.windSpeed ? parseFloat(period.windSpeed.replace(/\D/g, '')) : null,
            windDirection: period.windDirection || null,
            conditions: period.shortForecast || period.detailedForecast,
          }));
        }
      } catch (forecastError) {
        console.warn('Could not fetch forecast:', forecastError);
      }
    }
    
    return { current: currentWeather, forecast };
    
  } catch (error) {
    console.error('NOAA weather fetch error:', error);
    throw error;
  }
}

/**
 * Fetch marine data from alternative source
 */
async function fetchMarineData(latitude: number, longitude: number): Promise<any> {
  try {
    // Use OpenWeatherMap Marine API as fallback
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenWeatherMap API key not configured');
    }
    
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`
    );
    
    if (!response.ok) {
      throw new Error(`OpenWeatherMap API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      current: {
        temperature: data.main?.temp || null,
        windSpeed: data.wind?.speed ? data.wind.speed * 3.6 : null, // Convert m/s to km/h
        windDirection: data.wind?.deg || null,
        pressure: data.main?.pressure || null,
        humidity: data.main?.humidity || null,
        visibility: data.visibility ? data.visibility / 1000 : null, // Convert m to km
        conditions: data.weather?.[0]?.description || 'Unknown',
      },
      marine: {
        seaTemperature: data.main?.temp || null, // Approximate for marine areas
      },
    };
    
  } catch (error) {
    console.error('Marine data fetch error:', error);
    throw error;
  }
}

/**
 * Fetch tide data from NOAA
 */
async function fetchTideData(latitude: number, longitude: number): Promise<any> {
  try {
    // Find nearest tide station
    const stationsResponse = await fetch(
      `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions&radius=50&lat=${latitude}&lon=${longitude}`
    );
    
    if (!stationsResponse.ok) {
      throw new Error(`NOAA Tides API error: ${stationsResponse.status}`);
    }
    
    const stationsData = await stationsResponse.json();
    
    if (!stationsData.stations || stationsData.stations.length === 0) {
      return null; // No tide data available for this location
    }
    
    const nearestStation = stationsData.stations[0];
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    // Get current tide predictions
    const tideResponse = await fetch(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=today&station=${nearestStation.id}&product=predictions&datum=MLLW&time_zone=lst_ldt&units=english&format=json`
    );
    
    if (!tideResponse.ok) {
      throw new Error(`NOAA Tide predictions error: ${tideResponse.status}`);
    }
    
    const tideData = await tideResponse.json();
    
    if (tideData.predictions && tideData.predictions.length > 0) {
      const now = new Date();
      const currentPrediction = tideData.predictions.find((p: any) => {
        const predTime = new Date(p.t);
        return Math.abs(predTime.getTime() - now.getTime()) < 30 * 60 * 1000; // Within 30 minutes
      }) || tideData.predictions[0];
      
      return {
        height: parseFloat(currentPrediction.v),
        type: currentPrediction.type || 'unknown',
        station: nearestStation.name,
        stationId: nearestStation.id,
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('Tide data fetch error:', error);
    return null; // Tide data is optional
  }
}

/**
 * Get marine weather data
 */
export const getMarineWeather = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse and validate query parameters
    const queryParams = WeatherQuerySchema.parse(event.queryStringParameters || {});
    
    const weatherData: MarineWeatherData = {
      location: {
        latitude: queryParams.latitude,
        longitude: queryParams.longitude,
      },
      current: {
        temperature: 0,
        windSpeed: 0,
        windDirection: 0,
        pressure: 0,
        humidity: 0,
        visibility: 0,
        conditions: '',
      },
      marine: {},
    };
    
    try {
      // Try NOAA first (primary source)
      const noaaData = await fetchNoaaWeather(queryParams.latitude, queryParams.longitude);
      
      if (noaaData.current) {
        weatherData.current = { ...weatherData.current, ...noaaData.current };
      }
      
      if (noaaData.forecast && queryParams.forecast) {
        weatherData.forecast = noaaData.forecast;
      }
      
    } catch (noaaError) {
      console.warn('NOAA data unavailable, using fallback:', noaaError);
      
      // Use OpenWeatherMap as fallback
      const fallbackData = await fetchMarineData(queryParams.latitude, queryParams.longitude);
      weatherData.current = { ...weatherData.current, ...fallbackData.current };
      
      if (fallbackData.marine) {
        weatherData.marine = { ...weatherData.marine, ...fallbackData.marine };
      }
    }
    
    // Get tide data if requested
    if (queryParams.includeTides) {
      const tideData = await fetchTideData(queryParams.latitude, queryParams.longitude);
      if (tideData) {
        weatherData.marine.tide = {
          height: tideData.height,
          type: tideData.type,
          nextChange: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // Approximate
        };
      }
    }
    
    return createSuccessResponse({
      weather: weatherData,
      dataSources: ['NOAA', 'OpenWeatherMap'],
      lastUpdated: new Date().toISOString(),
      safety_notice: "Weather data is for informational purposes. Always check official marine forecasts before departing.",
    }, 'Marine weather data retrieved successfully');
    
  } catch (error) {
    console.error('Error getting marine weather:', error);
    
    if (error instanceof z.ZodError) {
      return createErrorResponse(400, 'Invalid query parameters', error.errors);
    }
    
    return createErrorResponse(500, 'Weather service unavailable', {
      message: error.message,
      requestId: context.awsRequestId,
    });
  }
};

/**
 * Get marine weather alerts
 */
export const getMarineAlerts = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const queryParams = WeatherQuerySchema.parse(event.queryStringParameters || {});
    
    // Get NOAA marine weather alerts
    const alertsResponse = await fetch(
      `https://api.weather.gov/alerts/active?point=${queryParams.latitude},${queryParams.longitude}&event=Marine`
    );
    
    if (!alertsResponse.ok) {
      throw new Error(`NOAA Alerts API error: ${alertsResponse.status}`);
    }
    
    const alertsData = await alertsResponse.json();
    
    const alerts = alertsData.features?.map((alert: any) => ({
      id: alert.id,
      type: alert.properties.event,
      severity: alert.properties.severity,
      urgency: alert.properties.urgency,
      description: alert.properties.description,
      headline: alert.properties.headline,
      start: alert.properties.onset,
      end: alert.properties.ends,
      areas: alert.properties.areaDesc,
    })) || [];
    
    return createSuccessResponse({
      alerts,
      location: {
        latitude: queryParams.latitude,
        longitude: queryParams.longitude,
      },
      alertCount: alerts.length,
      lastUpdated: new Date().toISOString(),
      safety_notice: "Marine weather alerts are official NOAA warnings. Take immediate action if required.",
    }, 'Marine weather alerts retrieved successfully');
    
  } catch (error) {
    console.error('Error getting marine alerts:', error);
    
    if (error instanceof z.ZodError) {
      return createErrorResponse(400, 'Invalid query parameters', error.errors);
    }
    
    return createErrorResponse(500, 'Weather alerts service unavailable', {
      message: error.message,
      requestId: context.awsRequestId,
    });
  }
};

/**
 * Handle CORS preflight requests
 */
export const handleOptions = async (): Promise<APIGatewayProxyResult> => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  },
  body: '',
});