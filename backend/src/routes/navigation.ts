// Navigation Routes
// Route planning and navigation session management

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Joi from 'joi';
import { AuthenticatedRequest } from '../middleware/auth';
import { ValidationError, NotFoundError, GeospatialError } from '../middleware/errorHandler';
import { db } from '../config/database';
import { Route, NavigationSession, Point, RouteRequest, RouteResponse } from '../types';
import logger from '../utils/logger';

// Validation schemas
const locationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

const routePlanSchema = Joi.object({
  startPoint: locationSchema.required(),
  endPoint: locationSchema.required(),
  vesselId: Joi.string().uuid().required(),
  vesselDraft: Joi.number().min(0.1).max(50).required(),
  maxWaypoints: Joi.number().min(2).max(20).default(10),
  preferDeepWater: Joi.boolean().default(true),
  avoidWeather: Joi.boolean().default(true)
});

const createRouteSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(500).optional(),
  startPoint: locationSchema.required(),
  endPoint: locationSchema.required(),
  vesselId: Joi.string().uuid().required(),
  waypoints: Joi.array().items(locationSchema).max(20).optional(),
  isPublic: Joi.boolean().default(false),
  difficultyLevel: Joi.number().min(1).max(5).optional()
});

const startSessionSchema = Joi.object({
  vesselId: Joi.string().uuid().required(),
  routeId: Joi.string().uuid().optional(),
  startLocation: locationSchema.required()
});

const endSessionSchema = Joi.object({
  endLocation: locationSchema.required(),
  fuelConsumedLiters: Joi.number().min(0).optional(),
  notes: Joi.string().max(1000).optional()
});

interface RoutePlanRequest extends RouteRequest {
  vesselId: string;
  maxWaypoints: number;
  preferDeepWater: boolean;
  avoidWeather: boolean;
}

interface CreateRouteRequest {
  name: string;
  description?: string;
  startPoint: Point;
  endPoint: Point;
  vesselId: string;
  waypoints?: Point[];
  isPublic: boolean;
  difficultyLevel?: number;
}

interface StartSessionRequest {
  vesselId: string;
  routeId?: string;
  startLocation: Point;
}

interface EndSessionRequest {
  endLocation: Point;
  fuelConsumedLiters?: number;
  notes?: string;
}

export default async function navigationRoutes(fastify: FastifyInstance) {

  /**
   * Plan Navigation Route
   * POST /api/navigation/route
   */
  fastify.post<{ Body: RoutePlanRequest }>(
    '/route',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: routePlanSchema
      }
    },
    async (request: AuthenticatedRequest & { Body: RoutePlanRequest }, reply: FastifyReply) => {
      try {
        const { startPoint, endPoint, vesselId, vesselDraft, maxWaypoints, preferDeepWater, avoidWeather } = request.body;

        // Validate input
        const { error } = routePlanSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Verify vessel belongs to user
        const vesselQuery = `
          SELECT id, name, draft_meters 
          FROM vessels 
          WHERE id = $1 AND owner_id = $2 AND is_active = true
        `;
        const vessel = await db.queryOne(vesselQuery, [vesselId, request.user.id]);

        if (!vessel) {
          throw new ValidationError('Invalid vessel ID or vessel does not belong to user');
        }

        // Calculate direct distance
        const directDistance = await calculateDistance(startPoint, endPoint);
        
        // Generate safe waypoints based on depth data
        const waypoints = await generateSafeWaypoints(
          startPoint, 
          endPoint, 
          vesselDraft, 
          maxWaypoints,
          preferDeepWater
        );

        // Calculate route distance with waypoints
        const routeDistance = await calculateRouteDistance([startPoint, ...waypoints, endPoint]);

        // Estimate travel time (assuming average speed)
        const estimatedSpeed = 6; // knots
        const estimatedTime = routeDistance / estimatedSpeed;

        // Get weather alerts if enabled
        const weatherAlerts = avoidWeather ? await getWeatherAlerts(startPoint, endPoint) : [];

        // Check for depth warnings along route
        const depthWarnings = await getDepthWarnings(waypoints, vesselDraft);

        // Calculate safety score
        const safetyScore = calculateSafetyScore(waypoints, depthWarnings, weatherAlerts);

        const routeResponse: RouteResponse = {
          route: {
            id: '', // Temporary route, not saved
            userId: request.user.id,
            vesselId,
            name: `Route from ${formatCoordinate(startPoint)} to ${formatCoordinate(endPoint)}`,
            startPoint,
            endPoint,
            totalDistanceNm: routeDistance,
            estimatedDurationHours: estimatedTime,
            minDepthRequired: vesselDraft,
            isPublic: false,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          waypoints,
          totalDistance: routeDistance,
          estimatedTime,
          safetyScore,
          weatherAlerts,
          depthWarnings
        };

        reply.send({
          success: true,
          data: {
            route: routeResponse,
            metadata: {
              directDistance,
              routeDistance,
              waypointCount: waypoints.length,
              safetyScore,
              vesselName: vessel.name,
              vesselDraft
            }
          },
          message: 'Route planned successfully',
          safetyNotice: 'This route is based on crowdsourced data. Always verify with official marine charts and current conditions.'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Save Route
   * POST /api/navigation/routes
   */
  fastify.post<{ Body: CreateRouteRequest }>(
    '/routes',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: createRouteSchema
      }
    },
    async (request: AuthenticatedRequest & { Body: CreateRouteRequest }, reply: FastifyReply) => {
      try {
        const { name, description, startPoint, endPoint, vesselId, waypoints, isPublic, difficultyLevel } = request.body;

        // Verify vessel belongs to user
        const vesselQuery = `SELECT draft_meters FROM vessels WHERE id = $1 AND owner_id = $2 AND is_active = true`;
        const vessel = await db.queryOne(vesselQuery, [vesselId, request.user.id]);

        if (!vessel) {
          throw new ValidationError('Invalid vessel ID or vessel does not belong to user');
        }

        // Calculate route metrics
        const routePoints = [startPoint, ...(waypoints || []), endPoint];
        const totalDistance = await calculateRouteDistance(routePoints);
        const estimatedDuration = totalDistance / 6; // Assuming 6 knots average

        // Create waypoints geometry
        const waypointsGeometry = waypoints && waypoints.length > 0 
          ? `ST_GeogFromText('LINESTRING(${routePoints.map(p => `${p.longitude} ${p.latitude}`).join(', ')})')`
          : null;

        const insertQuery = `
          INSERT INTO routes (
            user_id, vessel_id, name, description, start_point, end_point, 
            waypoints, total_distance_nm, estimated_duration_hours, 
            min_depth_required, is_public, difficulty_level
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING 
            id,
            name,
            description,
            ${db.extractCoordinates('start_point')},
            ${db.extractCoordinates('end_point')},
            total_distance_nm as "totalDistanceNm",
            estimated_duration_hours as "estimatedDurationHours",
            min_depth_required as "minDepthRequired",
            is_public as "isPublic",
            difficulty_level as "difficultyLevel",
            created_at as "createdAt"
        `;

        const route = await db.queryOne(insertQuery, [
          request.user.id,
          vesselId,
          name,
          description || null,
          db.createPoint(startPoint.latitude, startPoint.longitude),
          db.createPoint(endPoint.latitude, endPoint.longitude),
          waypointsGeometry,
          totalDistance,
          estimatedDuration,
          vessel.draft_meters,
          isPublic,
          difficultyLevel || null
        ]);

        logger.info('Route created', {
          userId: request.user.id,
          routeId: route.id,
          routeName: name,
          distance: totalDistance,
          isPublic
        });

        reply.status(201).send({
          success: true,
          data: {
            route: {
              ...route,
              startPoint,
              endPoint,
              waypoints: waypoints || []
            }
          },
          message: 'Route saved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get User Routes
   * GET /api/navigation/routes
   */
  fastify.get(
    '/routes',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            vesselId: { type: 'string' },
            isPublic: { type: 'boolean' }
          }
        }
      }
    },
    async (request: AuthenticatedRequest & { 
      Querystring: { page: number; limit: number; vesselId?: string; isPublic?: boolean }
    }, reply: FastifyReply) => {
      try {
        const { page, limit, vesselId, isPublic } = request.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE user_id = $1';
        let params: any[] = [request.user.id, limit, offset];
        let paramIndex = 4;

        if (vesselId) {
          whereClause += ` AND vessel_id = $${paramIndex}`;
          params.splice(-2, 0, vesselId);
          paramIndex++;
        }

        if (isPublic !== undefined) {
          whereClause += ` AND is_public = $${paramIndex}`;
          params.splice(-2, 0, isPublic);
          paramIndex++;
        }

        const query = `
          SELECT 
            r.id,
            r.name,
            r.description,
            ${db.extractCoordinates('r.start_point')},
            ${db.extractCoordinates('r.end_point')},
            r.total_distance_nm as "totalDistanceNm",
            r.estimated_duration_hours as "estimatedDurationHours",
            r.is_public as "isPublic",
            r.difficulty_level as "difficultyLevel",
            r.created_at as "createdAt",
            v.name as "vesselName"
          FROM routes r
          JOIN vessels v ON r.vessel_id = v.id
          ${whereClause}
          ORDER BY r.created_at DESC
          LIMIT $2 OFFSET $3
        `;

        const routes = await db.query(query, params);

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM routes ${whereClause}`;
        const countParams = params.slice(0, -2); // Remove limit and offset
        const { total } = await db.queryOne(countQuery, countParams);

        const formattedRoutes = routes.map(r => ({
          ...r,
          startPoint: { latitude: r.latitude, longitude: r.longitude },
          endPoint: { latitude: r.latitude_1, longitude: r.longitude_1 }
        }));

        reply.send({
          success: true,
          data: {
            routes: formattedRoutes,
            pagination: {
              page,
              limit,
              total: parseInt(total),
              totalPages: Math.ceil(total / limit),
              hasNext: page < Math.ceil(total / limit),
              hasPrev: page > 1
            }
          },
          message: 'Routes retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Start Navigation Session
   * POST /api/navigation/session/start
   */
  fastify.post<{ Body: StartSessionRequest }>(
    '/session/start',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: startSessionSchema
      }
    },
    async (request: AuthenticatedRequest & { Body: StartSessionRequest }, reply: FastifyReply) => {
      try {
        const { vesselId, routeId, startLocation } = request.body;

        // Verify vessel belongs to user
        const vesselQuery = `SELECT id, name FROM vessels WHERE id = $1 AND owner_id = $2 AND is_active = true`;
        const vessel = await db.queryOne(vesselQuery, [vesselId, request.user.id]);

        if (!vessel) {
          throw new ValidationError('Invalid vessel ID or vessel does not belong to user');
        }

        // Verify route exists if provided
        if (routeId) {
          const routeQuery = `SELECT id FROM routes WHERE id = $1 AND user_id = $2`;
          const route = await db.queryOne(routeQuery, [routeId, request.user.id]);

          if (!route) {
            throw new ValidationError('Invalid route ID or route does not belong to user');
          }
        }

        const insertQuery = `
          INSERT INTO navigation_sessions (
            user_id, vessel_id, route_id, start_time, start_location
          ) VALUES ($1, $2, $3, NOW(), $4)
          RETURNING 
            id,
            start_time as "startTime",
            ${db.extractCoordinates('start_location')}
        `;

        const session = await db.queryOne(insertQuery, [
          request.user.id,
          vesselId,
          routeId || null,
          db.createPoint(startLocation.latitude, startLocation.longitude)
        ]);

        logger.info('Navigation session started', {
          userId: request.user.id,
          sessionId: session.id,
          vesselId,
          routeId,
          startLocation
        });

        reply.status(201).send({
          success: true,
          data: {
            session: {
              ...session,
              startLocation
            }
          },
          message: 'Navigation session started successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * End Navigation Session
   * POST /api/navigation/session/:id/end
   */
  fastify.post<{ Params: { id: string }; Body: EndSessionRequest }>(
    '/session/:id/end',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: endSessionSchema
      }
    },
    async (request: AuthenticatedRequest & { Params: { id: string }; Body: EndSessionRequest }, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const { endLocation, fuelConsumedLiters, notes } = request.body;

        // Verify session belongs to user and is still active
        const sessionQuery = `
          SELECT id, start_time, start_location, vessel_id
          FROM navigation_sessions 
          WHERE id = $1 AND user_id = $2 AND end_time IS NULL
        `;
        const session = await db.queryOne(sessionQuery, [id, request.user.id]);

        if (!session) {
          throw new NotFoundError('Active navigation session');
        }

        // Calculate session statistics
        const startCoords = await db.queryOne(`
          SELECT ${db.extractCoordinates('start_location')} 
          FROM navigation_sessions 
          WHERE id = $1
        `, [id]);

        const totalDistance = await calculateDistance(
          { latitude: startCoords.latitude, longitude: startCoords.longitude },
          endLocation
        );

        const sessionDuration = (new Date().getTime() - new Date(session.start_time).getTime()) / (1000 * 60 * 60); // hours
        const avgSpeed = sessionDuration > 0 ? totalDistance / sessionDuration : 0;

        // Get max speed from GPS tracks during this session
        const maxSpeedQuery = `
          SELECT MAX(speed_knots) as max_speed
          FROM gps_tracks
          WHERE vessel_id = $1 AND timestamp >= $2
        `;
        const speedData = await db.queryOne(maxSpeedQuery, [session.vessel_id, session.start_time]);

        const updateQuery = `
          UPDATE navigation_sessions 
          SET 
            end_time = NOW(),
            end_location = $1,
            total_distance_nm = $2,
            max_speed_knots = $3,
            avg_speed_knots = $4,
            fuel_consumed_liters = $5,
            notes = $6
          WHERE id = $7
          RETURNING 
            end_time as "endTime",
            total_distance_nm as "totalDistanceNm",
            max_speed_knots as "maxSpeedKnots",
            avg_speed_knots as "avgSpeedKnots"
        `;

        const updatedSession = await db.queryOne(updateQuery, [
          db.createPoint(endLocation.latitude, endLocation.longitude),
          totalDistance,
          speedData?.max_speed || null,
          avgSpeed,
          fuelConsumedLiters || null,
          notes || null,
          id
        ]);

        logger.info('Navigation session ended', {
          userId: request.user.id,
          sessionId: id,
          duration: sessionDuration,
          distance: totalDistance,
          avgSpeed
        });

        reply.send({
          success: true,
          data: {
            session: {
              id,
              endLocation,
              ...updatedSession,
              duration: sessionDuration
            }
          },
          message: 'Navigation session ended successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get Navigation Sessions
   * GET /api/navigation/sessions
   */
  fastify.get(
    '/sessions',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            vesselId: { type: 'string' },
            active: { type: 'boolean' }
          }
        }
      }
    },
    async (request: AuthenticatedRequest & { 
      Querystring: { page: number; limit: number; vesselId?: string; active?: boolean }
    }, reply: FastifyReply) => {
      try {
        const { page, limit, vesselId, active } = request.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE ns.user_id = $1';
        let params: any[] = [request.user.id, limit, offset];
        let paramIndex = 4;

        if (vesselId) {
          whereClause += ` AND ns.vessel_id = $${paramIndex}`;
          params.splice(-2, 0, vesselId);
          paramIndex++;
        }

        if (active !== undefined) {
          if (active) {
            whereClause += ' AND ns.end_time IS NULL';
          } else {
            whereClause += ' AND ns.end_time IS NOT NULL';
          }
        }

        const query = `
          SELECT 
            ns.id,
            ns.start_time as "startTime",
            ns.end_time as "endTime",
            ns.total_distance_nm as "totalDistanceNm",
            ns.max_speed_knots as "maxSpeedKnots",
            ns.avg_speed_knots as "avgSpeedKnots",
            ns.fuel_consumed_liters as "fuelConsumedLiters",
            ns.notes,
            v.name as "vesselName",
            r.name as "routeName"
          FROM navigation_sessions ns
          JOIN vessels v ON ns.vessel_id = v.id
          LEFT JOIN routes r ON ns.route_id = r.id
          ${whereClause}
          ORDER BY ns.start_time DESC
          LIMIT $2 OFFSET $3
        `;

        const sessions = await db.query(query, params);

        // Get total count
        const countQuery = `
          SELECT COUNT(*) as total 
          FROM navigation_sessions ns 
          ${whereClause}
        `;
        const countParams = params.slice(0, -2);
        const { total } = await db.queryOne(countQuery, countParams);

        reply.send({
          success: true,
          data: {
            sessions,
            pagination: {
              page,
              limit,
              total: parseInt(total),
              totalPages: Math.ceil(total / limit),
              hasNext: page < Math.ceil(total / limit),
              hasPrev: page > 1
            }
          },
          message: 'Navigation sessions retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );
}

// Helper Functions

async function calculateDistance(point1: Point, point2: Point): Promise<number> {
  const query = `SELECT ${db.calculateDistanceNM(point1, point2)} as distance`;
  const result = await db.queryOne<{ distance: number }>(query);
  return result.distance;
}

async function calculateRouteDistance(points: Point[]): Promise<number> {
  let totalDistance = 0;
  
  for (let i = 0; i < points.length - 1; i++) {
    const distance = await calculateDistance(points[i], points[i + 1]);
    totalDistance += distance;
  }
  
  return totalDistance;
}

async function generateSafeWaypoints(
  start: Point, 
  end: Point, 
  vesselDraft: number, 
  maxWaypoints: number,
  preferDeepWater: boolean
): Promise<Point[]> {
  // Simplified waypoint generation - in production this would use more sophisticated routing
  const waypoints: Point[] = [];
  
  // For now, just create intermediate points along the direct route
  // In a real implementation, this would check depth data and avoid shallow areas
  
  const steps = Math.min(maxWaypoints, 5); // Limit intermediate points
  
  for (let i = 1; i < steps; i++) {
    const ratio = i / steps;
    const lat = start.latitude + (end.latitude - start.latitude) * ratio;
    const lng = start.longitude + (end.longitude - start.longitude) * ratio;
    
    waypoints.push({ latitude: lat, longitude: lng });
  }
  
  return waypoints;
}

async function getWeatherAlerts(start: Point, end: Point): Promise<any[]> {
  // Placeholder for weather alert integration
  // Would integrate with NOAA/weather APIs
  return [];
}

async function getDepthWarnings(waypoints: Point[], vesselDraft: number): Promise<any[]> {
  const warnings: any[] = [];
  
  for (const point of waypoints) {
    const depthQuery = `
      SELECT MIN(depth_meters) as min_depth
      FROM depth_readings
      WHERE ST_DWithin(location, $1, 200)
      AND confidence_score IN ('high', 'verified')
      AND timestamp > NOW() - INTERVAL '30 days'
    `;
    
    const result = await db.queryOne(depthQuery, [
      db.createPoint(point.latitude, point.longitude)
    ]);
    
    if (result?.min_depth && result.min_depth < vesselDraft + 1.0) {
      warnings.push({
        location: point,
        minDepth: result.min_depth,
        vesselDraft,
        clearance: result.min_depth - vesselDraft,
        severity: result.min_depth < vesselDraft ? 'critical' : 'warning'
      });
    }
  }
  
  return warnings;
}

function calculateSafetyScore(waypoints: Point[], depthWarnings: any[], weatherAlerts: any[]): number {
  let score = 100;
  
  // Reduce score for depth warnings
  score -= depthWarnings.length * 15;
  
  // Reduce score for weather alerts
  score -= weatherAlerts.length * 10;
  
  // Reduce score for critical warnings
  const criticalWarnings = depthWarnings.filter(w => w.severity === 'critical');
  score -= criticalWarnings.length * 30;
  
  return Math.max(0, score);
}

function formatCoordinate(point: Point): string {
  const lat = point.latitude.toFixed(4);
  const lng = point.longitude.toFixed(4);
  return `${lat}, ${lng}`;
}