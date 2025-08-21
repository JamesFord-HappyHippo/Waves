// Marine Areas and Safety Routes
// Marine areas of interest, safety alerts, and maritime information

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Joi from 'joi';
import { AuthenticatedRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { MarineArea, SafetyAlert, Point, BoundingBox } from '../types';
import { noaaService } from '../services/noaaService';
import { weatherService } from '../services/weatherService';
import logger from '../utils/logger';

// Validation schemas
const locationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

const boundsSchema = Joi.object({
  northEast: locationSchema.required(),
  southWest: locationSchema.required()
});

const marineAreasQuerySchema = Joi.object({
  northEast: locationSchema.optional(),
  southWest: locationSchema.optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  radiusKm: Joi.number().min(1).max(100).default(25),
  areaType: Joi.string().valid('harbor', 'anchorage', 'channel', 'reef', 'restricted', 'sanctuary').optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20)
});

const safetyAlertsQuerySchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radiusKm: Joi.number().min(1).max(50).default(10),
  alertType: Joi.string().valid('shallow_water', 'weather_warning', 'restricted_area', 'navigation_hazard').optional(),
  severity: Joi.number().min(1).max(5).optional(),
  active: Joi.boolean().default(true)
});

const createAlertSchema = Joi.object({
  alertType: Joi.string().valid('shallow_water', 'weather_warning', 'restricted_area', 'navigation_hazard').required(),
  severity: Joi.number().min(1).max(5).required(),
  location: locationSchema.required(),
  message: Joi.string().min(10).max(1000).required(),
  recommendedAction: Joi.string().max(500).optional(),
  expiresAt: Joi.date().greater('now').optional()
});

interface MarineAreasQuery {
  northEast?: Point;
  southWest?: Point;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
  areaType?: string;
  page: number;
  limit: number;
}

interface SafetyAlertsQuery {
  latitude: number;
  longitude: number;
  radiusKm: number;
  alertType?: string;
  severity?: number;
  active: boolean;
}

interface CreateAlertRequest {
  alertType: 'shallow_water' | 'weather_warning' | 'restricted_area' | 'navigation_hazard';
  severity: number;
  location: Point;
  message: string;
  recommendedAction?: string;
  expiresAt?: Date;
}

export default async function marineRoutes(fastify: FastifyInstance) {

  /**
   * Get Marine Areas
   * GET /api/marine/areas
   */
  fastify.get<{ Querystring: MarineAreasQuery }>(
    '/areas',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: marineAreasQuerySchema
      }
    },
    async (request: AuthenticatedRequest & { Querystring: MarineAreasQuery }, reply: FastifyReply) => {
      try {
        const { 
          northEast, 
          southWest, 
          latitude, 
          longitude, 
          radiusKm, 
          areaType, 
          page, 
          limit 
        } = request.query;

        const offset = (page - 1) * limit;

        let whereClause = '';
        let params: any[] = [limit, offset];
        let paramIndex = 3;

        // Build spatial query
        if (northEast && southWest) {
          // Bounding box query
          whereClause = `WHERE ${db.createBoundsCondition('geometry', northEast, southWest)}`;
        } else if (latitude && longitude) {
          // Radius query
          const location = { latitude, longitude };
          whereClause = `WHERE ${db.createDistanceCondition('ST_Centroid(geometry)', location, radiusKm * 1000)}`;
        }

        // Add area type filter
        if (areaType) {
          const connector = whereClause ? 'AND' : 'WHERE';
          whereClause += ` ${connector} area_type = $${paramIndex}`;
          params.splice(-2, 0, areaType);
          paramIndex++;
        }

        const query = `
          SELECT 
            id,
            name,
            description,
            area_type as "areaType",
            ST_AsGeoJSON(geometry) as geometry,
            min_depth_meters as "minDepthMeters",
            max_depth_meters as "maxDepthMeters",
            restrictions,
            contact_info as "contactInfo",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM marine_areas
          ${whereClause}
          ORDER BY name
          LIMIT $1 OFFSET $2
        `;

        const areas = await db.query<MarineArea & { geometry: string }>(query, params);

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM marine_areas ${whereClause}`;
        const countParams = params.slice(0, -2); // Remove limit and offset
        const { total } = await db.queryOne(countQuery, countParams);

        // Parse geometry for each area
        const formattedAreas = areas.map(area => ({
          ...area,
          geometry: JSON.parse(area.geometry)
        }));

        reply.send({
          success: true,
          data: {
            areas: formattedAreas,
            searchArea: northEast && southWest ? { northEast, southWest } : 
                       latitude && longitude ? { center: { latitude, longitude }, radiusKm } : null,
            pagination: {
              page,
              limit,
              total: parseInt(total),
              totalPages: Math.ceil(total / limit),
              hasNext: page < Math.ceil(total / limit),
              hasPrev: page > 1
            }
          },
          message: 'Marine areas retrieved successfully'
        });

      } catch (error) {
        logger.error('Error fetching marine areas:', error);
        throw error;
      }
    }
  );

  /**
   * Get Specific Marine Area
   * GET /api/marine/areas/:id
   */
  fastify.get<{ Params: { id: string } }>(
    '/areas/:id',
    {
      preHandler: fastify.authenticate
    },
    async (request: AuthenticatedRequest & { Params: { id: string } }, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const query = `
          SELECT 
            id,
            name,
            description,
            area_type as "areaType",
            ST_AsGeoJSON(geometry) as geometry,
            min_depth_meters as "minDepthMeters",
            max_depth_meters as "maxDepthMeters",
            restrictions,
            contact_info as "contactInfo",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM marine_areas
          WHERE id = $1
        `;

        const area = await db.queryOne<MarineArea & { geometry: string }>(query, [id]);

        if (!area) {
          throw new NotFoundError('Marine area');
        }

        // Get recent depth readings in this area
        const depthQuery = `
          SELECT 
            COUNT(*) as reading_count,
            AVG(depth_meters) as avg_depth,
            MIN(depth_meters) as min_depth,
            MAX(depth_meters) as max_depth
          FROM depth_readings
          WHERE ST_Within(location::geometry, ST_GeomFromGeoJSON($1))
          AND timestamp > NOW() - INTERVAL '30 days'
        `;

        const depthStats = await db.queryOne(depthQuery, [area.geometry]);

        // Get any active safety alerts in this area
        const alertsQuery = `
          SELECT 
            id,
            alert_type as "alertType",
            severity,
            message,
            recommended_action as "recommendedAction",
            created_at as "createdAt",
            expires_at as "expiresAt"
          FROM safety_alerts
          WHERE ST_Within(location::geometry, ST_GeomFromGeoJSON($1))
          AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY severity DESC, created_at DESC
          LIMIT 10
        `;

        const alerts = await db.query(alertsQuery, [area.geometry]);

        reply.send({
          success: true,
          data: {
            area: {
              ...area,
              geometry: JSON.parse(area.geometry)
            },
            statistics: {
              depthReadings: {
                count: parseInt(depthStats?.reading_count || '0'),
                avgDepth: depthStats?.avg_depth ? parseFloat(depthStats.avg_depth) : null,
                minDepth: depthStats?.min_depth ? parseFloat(depthStats.min_depth) : null,
                maxDepth: depthStats?.max_depth ? parseFloat(depthStats.max_depth) : null
              }
            },
            activeAlerts: alerts
          },
          message: 'Marine area details retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get Safety Alerts
   * GET /api/marine/alerts
   */
  fastify.get<{ Querystring: SafetyAlertsQuery }>(
    '/alerts',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: safetyAlertsQuerySchema
      }
    },
    async (request: AuthenticatedRequest & { Querystring: SafetyAlertsQuery }, reply: FastifyReply) => {
      try {
        const { latitude, longitude, radiusKm, alertType, severity, active } = request.query;

        const location: Point = { latitude, longitude };

        let whereClause = `WHERE ${db.createDistanceCondition('location', location, radiusKm * 1000)}`;
        let params: any[] = [];
        let paramIndex = 1;

        if (alertType) {
          whereClause += ` AND alert_type = $${paramIndex}`;
          params.push(alertType);
          paramIndex++;
        }

        if (severity) {
          whereClause += ` AND severity = $${paramIndex}`;
          params.push(severity);
          paramIndex++;
        }

        if (active) {
          whereClause += ` AND (expires_at IS NULL OR expires_at > NOW())`;
        }

        const query = `
          SELECT 
            sa.id,
            sa.alert_type as "alertType",
            sa.severity,
            ${db.extractCoordinates('sa.location')},
            sa.message,
            sa.recommended_action as "recommendedAction",
            sa.is_acknowledged as "isAcknowledged",
            sa.acknowledged_at as "acknowledgedAt",
            sa.expires_at as "expiresAt",
            sa.created_at as "createdAt",
            u.first_name as "reporterFirstName",
            u.last_name as "reporterLastName",
            ST_Distance(sa.location, ${db.createPoint(latitude, longitude)}) as distance_meters
          FROM safety_alerts sa
          LEFT JOIN users u ON sa.user_id = u.id
          ${whereClause}
          ORDER BY sa.severity DESC, distance_meters ASC
          LIMIT 50
        `;

        const alerts = await db.query(query, params);

        // Format alerts with location objects
        const formattedAlerts = alerts.map(alert => ({
          ...alert,
          location: {
            latitude: alert.latitude,
            longitude: alert.longitude
          },
          distance: Math.round(alert.distance_meters),
          reporter: alert.reporterFirstName ? {
            firstName: alert.reporterFirstName,
            lastName: alert.reporterLastName
          } : null
        }));

        // Get weather-related alerts from weather service
        const weatherAlerts = await weatherService.getWeatherAlerts(location, radiusKm);

        // Combine and categorize all alerts
        const allAlerts = [
          ...formattedAlerts,
          ...weatherAlerts.map(wa => ({
            id: `weather_${Date.now()}_${Math.random()}`,
            alertType: 'weather_warning',
            severity: wa.severity,
            location,
            message: wa.message,
            expiresAt: wa.validUntil,
            createdAt: new Date(),
            distance: 0,
            source: 'weather_service'
          }))
        ].sort((a, b) => b.severity - a.severity);

        const alertSummary = {
          total: allAlerts.length,
          critical: allAlerts.filter(a => a.severity >= 4).length,
          warning: allAlerts.filter(a => a.severity === 3).length,
          advisory: allAlerts.filter(a => a.severity <= 2).length,
          types: [...new Set(allAlerts.map(a => a.alertType))]
        };

        reply.send({
          success: true,
          data: {
            alerts: allAlerts,
            summary: alertSummary,
            searchArea: {
              center: location,
              radiusKm
            }
          },
          message: `${allAlerts.length} safety alerts found in area`,
          safetyNotice: allAlerts.length > 0 
            ? 'Active safety alerts in your area. Review all alerts before proceeding.'
            : 'No active safety alerts for your search area.'
        });

      } catch (error) {
        logger.error('Error fetching safety alerts:', error);
        throw error;
      }
    }
  );

  /**
   * Create Safety Alert (Captain/Admin only)
   * POST /api/marine/alerts
   */
  fastify.post<{ Body: CreateAlertRequest }>(
    '/alerts',
    {
      preHandler: [
        fastify.authenticate,
        async (request: AuthenticatedRequest, reply: FastifyReply) => {
          if (!['captain', 'admin'].includes(request.user.role)) {
            reply.status(403).send({
              success: false,
              message: 'Only captains and administrators can create safety alerts',
              code: 'INSUFFICIENT_PERMISSIONS'
            });
          }
        }
      ],
      schema: {
        body: createAlertSchema
      }
    },
    async (request: AuthenticatedRequest & { Body: CreateAlertRequest }, reply: FastifyReply) => {
      try {
        const { alertType, severity, location, message, recommendedAction, expiresAt } = request.body;

        // Validate input
        const { error } = createAlertSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        const insertQuery = `
          INSERT INTO safety_alerts (
            user_id, alert_type, severity, location, message, 
            recommended_action, expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING 
            id,
            alert_type as "alertType",
            severity,
            ${db.extractCoordinates('location')},
            message,
            recommended_action as "recommendedAction",
            expires_at as "expiresAt",
            created_at as "createdAt"
        `;

        const alert = await db.queryOne(insertQuery, [
          request.user.id,
          alertType,
          severity,
          db.createPoint(location.latitude, location.longitude),
          message,
          recommendedAction || null,
          expiresAt || null
        ]);

        // Broadcast alert to nearby vessels via WebSocket
        // This would integrate with the WebSocket service
        await redis.publishSafetyAlert({
          ...alert,
          location
        });

        logger.info('Safety alert created', {
          alertId: alert.id,
          createdBy: request.user.id,
          alertType,
          severity,
          location
        });

        reply.status(201).send({
          success: true,
          data: {
            alert: {
              ...alert,
              location
            }
          },
          message: 'Safety alert created successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Acknowledge Safety Alert
   * POST /api/marine/alerts/:id/acknowledge
   */
  fastify.post<{ Params: { id: string } }>(
    '/alerts/:id/acknowledge',
    {
      preHandler: fastify.authenticate
    },
    async (request: AuthenticatedRequest & { Params: { id: string } }, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Check if alert exists
        const existingAlert = await db.queryOne(
          'SELECT id FROM safety_alerts WHERE id = $1',
          [id]
        );

        if (!existingAlert) {
          throw new NotFoundError('Safety alert');
        }

        // Update alert as acknowledged
        const updateQuery = `
          UPDATE safety_alerts 
          SET is_acknowledged = true, acknowledged_at = NOW()
          WHERE id = $1
          RETURNING acknowledged_at as "acknowledgedAt"
        `;

        const result = await db.queryOne(updateQuery, [id]);

        logger.info('Safety alert acknowledged', {
          alertId: id,
          acknowledgedBy: request.user.id,
          acknowledgedAt: result.acknowledgedAt
        });

        reply.send({
          success: true,
          data: {
            alertId: id,
            acknowledgedAt: result.acknowledgedAt
          },
          message: 'Safety alert acknowledged successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get Tide Stations
   * GET /api/marine/tides/stations
   */
  fastify.get(
    '/tides/stations',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            radiusKm: { type: 'number', minimum: 1, maximum: 500, default: 100 }
          },
          required: ['latitude', 'longitude']
        }
      }
    },
    async (request: AuthenticatedRequest & { 
      Querystring: { latitude: number; longitude: number; radiusKm: number }
    }, reply: FastifyReply) => {
      try {
        const { latitude, longitude, radiusKm } = request.query;

        const location: Point = { latitude, longitude };

        // Get nearest tide stations from NOAA
        const stations = await noaaService.findNearestStations(location, radiusKm);

        reply.send({
          success: true,
          data: {
            stations,
            searchArea: {
              center: location,
              radiusKm
            },
            count: stations.length
          },
          message: 'Tide stations retrieved successfully'
        });

      } catch (error) {
        logger.error('Error fetching tide stations:', error);
        reply.send({
          success: false,
          message: 'Tide station data temporarily unavailable',
          code: 'TIDE_STATIONS_UNAVAILABLE',
          data: {
            stations: [],
            searchArea: { center: { latitude, longitude }, radiusKm }
          }
        });
      }
    }
  );

  /**
   * Get Navigation Recommendations
   * GET /api/marine/recommendations
   */
  fastify.get(
    '/recommendations',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            vesselDraft: { type: 'number', minimum: 0.1, maximum: 50 },
            radiusKm: { type: 'number', minimum: 1, maximum: 25, default: 10 }
          },
          required: ['latitude', 'longitude', 'vesselDraft']
        }
      }
    },
    async (request: AuthenticatedRequest & { 
      Querystring: { latitude: number; longitude: number; vesselDraft: number; radiusKm: number }
    }, reply: FastifyReply) => {
      try {
        const { latitude, longitude, vesselDraft, radiusKm } = request.query;

        const location: Point = { latitude, longitude };

        // Get safety recommendations based on current conditions
        const recommendations = await generateNavigationRecommendations(
          location, 
          vesselDraft, 
          radiusKm
        );

        reply.send({
          success: true,
          data: {
            recommendations,
            location,
            vesselDraft,
            analysisRadius: radiusKm,
            generatedAt: new Date()
          },
          message: 'Navigation recommendations generated successfully',
          safetyNotice: 'Recommendations are based on available data and current conditions. Always use official charts and exercise good seamanship.'
        });

      } catch (error) {
        logger.error('Error generating navigation recommendations:', error);
        throw error;
      }
    }
  );
}

// Helper function to generate navigation recommendations
async function generateNavigationRecommendations(
  location: Point, 
  vesselDraft: number, 
  radiusKm: number
): Promise<any> {
  const recommendations = {
    overall: 'caution',
    depthClearance: 'unknown',
    weatherConditions: 'unknown',
    marineTraffic: 'unknown',
    suggestions: [] as string[],
    warnings: [] as string[]
  };

  try {
    // Check depth clearance in area
    const depthQuery = `
      SELECT 
        MIN(depth_meters) as min_depth,
        AVG(depth_meters) as avg_depth,
        COUNT(*) as reading_count
      FROM depth_readings
      WHERE ST_DWithin(location, $1, $2)
      AND confidence_score IN ('high', 'verified')
      AND timestamp > NOW() - INTERVAL '30 days'
    `;

    const depthData = await db.queryOne(depthQuery, [
      db.createPoint(location.latitude, location.longitude),
      radiusKm * 1000
    ]);

    if (depthData && depthData.min_depth) {
      const clearance = depthData.min_depth - vesselDraft;
      
      if (clearance < 0.5) {
        recommendations.depthClearance = 'critical';
        recommendations.warnings.push(`Critical: Minimum depth ${depthData.min_depth}m may be insufficient for vessel draft ${vesselDraft}m`);
      } else if (clearance < 1.0) {
        recommendations.depthClearance = 'caution';
        recommendations.warnings.push(`Caution: Limited depth clearance in area`);
      } else {
        recommendations.depthClearance = 'good';
        recommendations.suggestions.push(`Good depth clearance available`);
      }
    }

    // Check weather conditions
    const currentWeather = await weatherService.getCurrentWeather(location);
    if (currentWeather) {
      if (currentWeather.windSpeedKnots && currentWeather.windSpeedKnots > 20) {
        recommendations.weatherConditions = 'rough';
        recommendations.warnings.push(`Strong winds: ${Math.round(currentWeather.windSpeedKnots)} knots`);
      } else if (currentWeather.windSpeedKnots && currentWeather.windSpeedKnots > 12) {
        recommendations.weatherConditions = 'moderate';
        recommendations.suggestions.push(`Moderate wind conditions`);
      } else {
        recommendations.weatherConditions = 'good';
        recommendations.suggestions.push(`Favorable wind conditions`);
      }

      if (currentWeather.visibilityKm && currentWeather.visibilityKm < 2) {
        recommendations.warnings.push(`Reduced visibility: ${currentWeather.visibilityKm}km`);
      }
    }

    // Check for marine areas and restrictions
    const marineAreasQuery = `
      SELECT name, area_type, restrictions
      FROM marine_areas
      WHERE ST_DWithin(ST_Centroid(geometry), $1, $2)
    `;

    const nearbyAreas = await db.query(marineAreasQuery, [
      db.createPoint(location.latitude, location.longitude),
      radiusKm * 1000
    ]);

    for (const area of nearbyAreas) {
      if (area.area_type === 'restricted') {
        recommendations.warnings.push(`Restricted area nearby: ${area.name}`);
      } else if (area.area_type === 'sanctuary') {
        recommendations.suggestions.push(`Marine sanctuary nearby: ${area.name} - observe regulations`);
      }
    }

    // Overall assessment
    if (recommendations.warnings.length > 0) {
      recommendations.overall = recommendations.warnings.some(w => w.includes('Critical')) ? 'dangerous' : 'caution';
    } else {
      recommendations.overall = 'good';
    }

    // Add general suggestions
    recommendations.suggestions.push('Monitor weather conditions continuously');
    recommendations.suggestions.push('Verify depths with official charts');
    if (vesselDraft > 2) {
      recommendations.suggestions.push('Consider tide levels for deep draft vessels');
    }

  } catch (error) {
    logger.error('Error generating recommendations:', error);
    recommendations.suggestions.push('Unable to analyze all conditions - exercise extra caution');
  }

  return recommendations;
}