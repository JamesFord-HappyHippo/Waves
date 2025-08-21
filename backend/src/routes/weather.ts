// Weather API Routes
// Marine weather and environmental conditions endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Joi from 'joi';
import { AuthenticatedRequest } from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';
import { weatherService } from '../services/weatherService';
import { noaaService } from '../services/noaaService';
import { Point } from '../types';
import logger from '../utils/logger';

// Validation schemas
const locationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

const weatherQuerySchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  hours: Joi.number().min(1).max(168).default(48), // Max 7 days
  marine: Joi.boolean().default(false)
});

const tideQuerySchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  stationId: Joi.string().optional(),
  days: Joi.number().min(1).max(30).default(1),
  interval: Joi.string().valid('hilo', '6', '60').default('hilo')
});

const alertsQuerySchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radiusKm: Joi.number().min(1).max(200).default(50)
});

interface WeatherQuery {
  latitude: number;
  longitude: number;
  hours: number;
  marine: boolean;
}

interface TideQuery {
  latitude: number;
  longitude: number;
  stationId?: string;
  days: number;
  interval: 'hilo' | '6' | '60';
}

interface AlertsQuery {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export default async function weatherRoutes(fastify: FastifyInstance) {

  /**
   * Get Current Weather
   * GET /api/weather/current
   */
  fastify.get<{ Querystring: Omit<WeatherQuery, 'hours'> }>(
    '/current',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: Joi.object({
          latitude: Joi.number().min(-90).max(90).required(),
          longitude: Joi.number().min(-180).max(180).required(),
          marine: Joi.boolean().default(false)
        })
      }
    },
    async (request: AuthenticatedRequest & { Querystring: Omit<WeatherQuery, 'hours'> }, reply: FastifyReply) => {
      try {
        const { latitude, longitude, marine } = request.query;

        const location: Point = { latitude, longitude };

        // Get current weather data
        const weatherData = marine 
          ? await weatherService.getMarineWeather(location)
          : await weatherService.getCurrentWeather(location);

        if (!weatherData) {
          reply.status(503).send({
            success: false,
            message: 'Weather data temporarily unavailable',
            code: 'WEATHER_UNAVAILABLE'
          });
          return;
        }

        // Get weather alerts
        const alerts = await weatherService.getWeatherAlerts(location, 25);

        reply.send({
          success: true,
          data: {
            current: weatherData,
            alerts: alerts.filter(alert => 
              new Date(alert.validUntil) > new Date()
            ),
            location,
            dataSource: weatherData.source,
            lastUpdated: weatherData.timestamp
          },
          message: 'Current weather data retrieved successfully',
          safetyNotice: marine 
            ? 'Marine weather conditions can change rapidly. Monitor conditions continuously while at sea.'
            : 'Weather conditions are subject to change. Check current conditions before departure.'
        });

      } catch (error) {
        logger.error('Error fetching current weather:', error);
        throw error;
      }
    }
  );

  /**
   * Get Weather Forecast
   * GET /api/weather/forecast
   */
  fastify.get<{ Querystring: WeatherQuery }>(
    '/forecast',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: weatherQuerySchema
      }
    },
    async (request: AuthenticatedRequest & { Querystring: WeatherQuery }, reply: FastifyReply) => {
      try {
        const { latitude, longitude, hours, marine } = request.query;

        const location: Point = { latitude, longitude };

        // Get forecast data
        const forecastData = await weatherService.getWeatherForecast(location, hours);

        if (forecastData.length === 0) {
          reply.status(503).send({
            success: false,
            message: 'Weather forecast temporarily unavailable',
            code: 'FORECAST_UNAVAILABLE'
          });
          return;
        }

        // Get current conditions for comparison
        const currentWeather = marine 
          ? await weatherService.getMarineWeather(location)
          : await weatherService.getCurrentWeather(location);

        // Get extended alerts for forecast period
        const alerts = await weatherService.getWeatherAlerts(location, 50);

        // Calculate forecast summary
        const summary = this.calculateForecastSummary(forecastData);

        reply.send({
          success: true,
          data: {
            current: currentWeather,
            forecast: forecastData,
            alerts: alerts.filter(alert => 
              new Date(alert.validUntil) > new Date()
            ),
            summary,
            location,
            forecastPeriod: {
              hours,
              dataPoints: forecastData.length,
              coverage: `${Math.round(forecastData.length * 100 / hours)}%`
            }
          },
          message: 'Weather forecast retrieved successfully',
          safetyNotice: 'Weather forecasts are predictions and actual conditions may vary. Always monitor current conditions.'
        });

      } catch (error) {
        logger.error('Error fetching weather forecast:', error);
        throw error;
      }
    }
  );

  /**
   * Get Marine Weather Conditions
   * GET /api/weather/marine
   */
  fastify.get<{ Querystring: Omit<WeatherQuery, 'marine'> }>(
    '/marine',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: Joi.object({
          latitude: Joi.number().min(-90).max(90).required(),
          longitude: Joi.number().min(-180).max(180).required(),
          hours: Joi.number().min(1).max(72).default(24)
        })
      }
    },
    async (request: AuthenticatedRequest & { Querystring: Omit<WeatherQuery, 'marine'> }, reply: FastifyReply) => {
      try {
        const { latitude, longitude, hours } = request.query;

        const location: Point = { latitude, longitude };

        // Get current marine conditions
        const currentMarine = await weatherService.getMarineWeather(location);
        
        // Get marine forecast
        const marineForecast = await weatherService.getWeatherForecast(location, hours);

        // Get NOAA marine forecast if available
        let noaaForecast: any[] = [];
        try {
          noaaForecast = await noaaService.getMarineWeatherForecast(location);
        } catch (error) {
          logger.warn('NOAA marine forecast unavailable:', error);
        }

        // Get marine-specific alerts
        const marineAlerts = await weatherService.getWeatherAlerts(location, 30);
        const relevantAlerts = marineAlerts.filter(alert => 
          ['wind', 'wave', 'fog', 'small_craft_advisory'].includes(alert.type) &&
          new Date(alert.validUntil) > new Date()
        );

        // Calculate marine conditions assessment
        const conditions = this.assessMarineConditions(currentMarine, marineForecast);

        reply.send({
          success: true,
          data: {
            current: currentMarine,
            forecast: marineForecast,
            noaaForecast: noaaForecast.slice(0, Math.ceil(hours / 6)), // NOAA typically 6-hour periods
            alerts: relevantAlerts,
            conditions,
            location,
            dataAvailability: {
              currentConditions: !!currentMarine,
              forecast: marineForecast.length > 0,
              noaaData: noaaForecast.length > 0,
              alerts: relevantAlerts.length > 0
            }
          },
          message: 'Marine weather conditions retrieved successfully',
          safetyNotice: 'Marine conditions can change rapidly and may vary significantly from forecasts. Always maintain weather watch while at sea and have contingency plans.'
        });

      } catch (error) {
        logger.error('Error fetching marine weather:', error);
        throw error;
      }
    }
  );

  /**
   * Get Tide Information
   * GET /api/weather/tides
   */
  fastify.get<{ Querystring: TideQuery }>(
    '/tides',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: tideQuerySchema
      }
    },
    async (request: AuthenticatedRequest & { Querystring: TideQuery }, reply: FastifyReply) => {
      try {
        const { latitude, longitude, stationId, days, interval } = request.query;

        const location: Point = { latitude, longitude };

        let tideData: any[] = [];
        let stationInfo: any = null;

        if (stationId) {
          // Get tide data for specific station
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + days);
          
          tideData = await noaaService.getTideData(stationId, new Date(), endDate, interval);
          stationInfo = { id: stationId, name: `Station ${stationId}` };
          
        } else {
          // Find nearest stations and get data
          const nearestStations = await noaaService.findNearestStations(location, 100);
          
          if (nearestStations.length > 0) {
            const closestStation = nearestStations[0];
            stationInfo = closestStation;
            
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + days);
            
            tideData = await noaaService.getTideData(closestStation.id, new Date(), endDate, interval);
          }
        }

        // Get current conditions from nearest station
        let currentConditions = null;
        if (stationInfo) {
          currentConditions = await noaaService.getCurrentConditions(stationInfo.id);
        }

        reply.send({
          success: true,
          data: {
            station: stationInfo,
            currentConditions,
            tideData,
            location,
            period: {
              days,
              interval,
              dataPoints: tideData.length
            },
            nearestStations: stationId ? null : await noaaService.findNearestStations(location, 50)
          },
          message: 'Tide information retrieved successfully',
          safetyNotice: 'Tide predictions are based on harmonic analysis. Actual water levels may vary due to weather conditions, seasonal variations, and other factors.'
        });

      } catch (error) {
        logger.error('Error fetching tide information:', error);
        
        // Provide graceful degradation
        reply.send({
          success: false,
          message: 'Tide data temporarily unavailable. Please check NOAA configuration or try again later.',
          code: 'TIDE_DATA_UNAVAILABLE',
          data: {
            location,
            nearestStations: []
          }
        });
      }
    }
  );

  /**
   * Get Weather Alerts
   * GET /api/weather/alerts
   */
  fastify.get<{ Querystring: AlertsQuery }>(
    '/alerts',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: alertsQuerySchema
      }
    },
    async (request: AuthenticatedRequest & { Querystring: AlertsQuery }, reply: FastifyReply) => {
      try {
        const { latitude, longitude, radiusKm } = request.query;

        const location: Point = { latitude, longitude };

        // Get weather alerts
        const alerts = await weatherService.getWeatherAlerts(location, radiusKm);

        // Filter to active alerts only
        const activeAlerts = alerts.filter(alert => 
          new Date(alert.validUntil) > new Date()
        );

        // Categorize alerts by type and severity
        const alertSummary = {
          total: activeAlerts.length,
          critical: activeAlerts.filter(a => a.severity >= 4).length,
          warning: activeAlerts.filter(a => a.severity === 3).length,
          advisory: activeAlerts.filter(a => a.severity <= 2).length,
          types: [...new Set(activeAlerts.map(a => a.type))]
        };

        reply.send({
          success: true,
          data: {
            alerts: activeAlerts,
            summary: alertSummary,
            location,
            searchRadius: radiusKm,
            lastUpdated: new Date()
          },
          message: `${activeAlerts.length} active weather alerts found`,
          safetyNotice: activeAlerts.length > 0 
            ? 'Active weather alerts in your area. Review all alerts carefully and adjust plans accordingly.'
            : 'No active weather alerts for your area. Continue to monitor conditions.'
        });

      } catch (error) {
        logger.error('Error fetching weather alerts:', error);
        throw error;
      }
    }
  );

  /**
   * Get Weather History
   * GET /api/weather/history
   */
  fastify.get(
    '/history',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            days: { type: 'integer', minimum: 1, maximum: 30, default: 7 },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
          },
          required: ['latitude', 'longitude']
        }
      }
    },
    async (request: AuthenticatedRequest & { 
      Querystring: { latitude: number; longitude: number; days: number; page: number; limit: number }
    }, reply: FastifyReply) => {
      try {
        const { latitude, longitude, days, page, limit } = request.query;
        const offset = (page - 1) * limit;

        const location: Point = { latitude, longitude };

        // Query historical weather data from database
        const query = `
          SELECT 
            timestamp,
            source,
            wind_speed_knots as "windSpeedKnots",
            wind_direction as "windDirection",
            wave_height_meters as "waveHeightMeters",
            visibility_km as "visibilityKm",
            temperature_celsius as "temperatureCelsius",
            pressure_mb as "pressureMb",
            humidity_percent as "humidityPercent"
          FROM weather_data
          WHERE ST_DWithin(location, $1, 10000)  -- 10km radius
          AND timestamp >= NOW() - INTERVAL '${days} days'
          ORDER BY timestamp DESC
          LIMIT $2 OFFSET $3
        `;

        const weatherHistory = await fastify.db.query(query, [
          fastify.db.createPoint(latitude, longitude),
          limit,
          offset
        ]);

        // Get total count
        const countQuery = `
          SELECT COUNT(*) as total
          FROM weather_data
          WHERE ST_DWithin(location, $1, 10000)
          AND timestamp >= NOW() - INTERVAL '${days} days'
        `;

        const { total } = await fastify.db.queryOne(countQuery, [
          fastify.db.createPoint(latitude, longitude)
        ]);

        reply.send({
          success: true,
          data: {
            history: weatherHistory,
            location,
            period: {
              days,
              totalRecords: parseInt(total)
            },
            pagination: {
              page,
              limit,
              total: parseInt(total),
              totalPages: Math.ceil(total / limit),
              hasNext: page < Math.ceil(total / limit),
              hasPrev: page > 1
            }
          },
          message: 'Weather history retrieved successfully'
        });

      } catch (error) {
        logger.error('Error fetching weather history:', error);
        throw error;
      }
    }
  );

  // Helper method to calculate forecast summary
  function calculateForecastSummary(forecastData: any[]): any {
    if (forecastData.length === 0) return null;

    const winds = forecastData.map(d => d.windSpeedKnots).filter(w => w !== undefined);
    const waves = forecastData.map(d => d.waveHeightMeters).filter(w => w !== undefined);
    const temps = forecastData.map(d => d.temperatureCelsius).filter(t => t !== undefined);

    return {
      windSpeed: {
        min: winds.length > 0 ? Math.min(...winds) : null,
        max: winds.length > 0 ? Math.max(...winds) : null,
        avg: winds.length > 0 ? winds.reduce((a, b) => a + b, 0) / winds.length : null
      },
      waveHeight: {
        min: waves.length > 0 ? Math.min(...waves) : null,
        max: waves.length > 0 ? Math.max(...waves) : null,
        avg: waves.length > 0 ? waves.reduce((a, b) => a + b, 0) / waves.length : null
      },
      temperature: {
        min: temps.length > 0 ? Math.min(...temps) : null,
        max: temps.length > 0 ? Math.max(...temps) : null,
        avg: temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null
      }
    };
  }

  // Helper method to assess marine conditions
  function assessMarineConditions(current: any, forecast: any[]): any {
    const conditions = {
      overall: 'unknown',
      windConditions: 'unknown',
      seaState: 'unknown',
      visibility: 'good',
      recommendation: 'Monitor conditions'
    };

    if (!current) return conditions;

    // Assess wind conditions
    if (current.windSpeedKnots) {
      if (current.windSpeedKnots < 10) conditions.windConditions = 'light';
      else if (current.windSpeedKnots < 18) conditions.windConditions = 'moderate';
      else if (current.windSpeedKnots < 25) conditions.windConditions = 'strong';
      else conditions.windConditions = 'gale';
    }

    // Assess sea state
    if (current.waveHeightMeters) {
      if (current.waveHeightMeters < 0.5) conditions.seaState = 'calm';
      else if (current.waveHeightMeters < 1.5) conditions.seaState = 'moderate';
      else if (current.waveHeightMeters < 3) conditions.seaState = 'rough';
      else conditions.seaState = 'very_rough';
    }

    // Assess visibility
    if (current.visibilityKm) {
      if (current.visibilityKm < 1) conditions.visibility = 'poor';
      else if (current.visibilityKm < 5) conditions.visibility = 'moderate';
      else conditions.visibility = 'good';
    }

    // Overall assessment
    if (conditions.windConditions === 'gale' || conditions.seaState === 'very_rough' || conditions.visibility === 'poor') {
      conditions.overall = 'dangerous';
      conditions.recommendation = 'Avoid going out - dangerous conditions';
    } else if (conditions.windConditions === 'strong' || conditions.seaState === 'rough') {
      conditions.overall = 'rough';
      conditions.recommendation = 'Small craft advisory - experienced mariners only';
    } else if (conditions.windConditions === 'moderate') {
      conditions.overall = 'moderate';
      conditions.recommendation = 'Suitable for experienced boaters';
    } else {
      conditions.overall = 'good';
      conditions.recommendation = 'Good conditions for boating';
    }

    return conditions;
  }
}