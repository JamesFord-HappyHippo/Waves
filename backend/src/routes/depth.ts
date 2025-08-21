// Depth Data API Routes
// Marine depth reading submission and retrieval endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Joi from 'joi';
import { DepthService } from '../services/depthService';
import { AuthenticatedRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { DepthDataRequest, Point, BoundingBox } from '../types';
import logger from '../utils/logger';

// Validation schemas
const locationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

const depthReportSchema = Joi.object({
  location: locationSchema.required(),
  depthMeters: Joi.number().min(0.1).max(11000).required(),
  vesselId: Joi.string().uuid().required(),
  tideHeightMeters: Joi.number().min(-5).max(15).optional(),
  waterTemperatureCelsius: Joi.number().min(-5).max(50).optional(),
  bottomType: Joi.string().max(50).optional(),
  notes: Joi.string().max(500).optional()
});

const depthAreaSchema = Joi.object({
  northEast: locationSchema.required(),
  southWest: locationSchema.required(),
  vesselDraft: Joi.number().min(0.1).max(50).optional(),
  confidenceLevel: Joi.string().valid('low', 'medium', 'high', 'verified').optional(),
  maxAge: Joi.number().min(1).max(720).optional() // Max 30 days
});

const nearestDepthSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radiusMeters: Joi.number().min(100).max(10000).default(1000),
  maxResults: Joi.number().min(1).max(50).default(10)
});

interface DepthReportRequest {
  location: Point;
  depthMeters: number;
  vesselId: string;
  tideHeightMeters?: number;
  waterTemperatureCelsius?: number;
  bottomType?: string;
  notes?: string;
}

interface DepthAreaRequest {
  northEast: Point;
  southWest: Point;
  vesselDraft?: number;
  confidenceLevel?: 'low' | 'medium' | 'high' | 'verified';
  maxAge?: number;
}

interface NearestDepthRequest {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxResults: number;
}

interface VerifyDepthRequest {
  isVerified: boolean;
}

export default async function depthRoutes(fastify: FastifyInstance) {

  /**
   * Submit Depth Reading
   * POST /api/depth/report
   */
  fastify.post<{ Body: DepthReportRequest }>(
    '/report',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: depthReportSchema,
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  reading: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      location: {
                        type: 'object',
                        properties: {
                          latitude: { type: 'number' },
                          longitude: { type: 'number' }
                        }
                      },
                      depthMeters: { type: 'number' },
                      confidenceScore: { type: 'string' },
                      timestamp: { type: 'string' }
                    }
                  }
                }
              },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: AuthenticatedRequest & { Body: DepthReportRequest }, reply: FastifyReply) => {
      try {
        const { location, depthMeters, vesselId, tideHeightMeters, waterTemperatureCelsius, bottomType, notes } = request.body;

        // Validate input
        const { error } = depthReportSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Verify vessel belongs to user
        const vesselQuery = `SELECT id FROM vessels WHERE id = $1 AND owner_id = $2 AND is_active = true`;
        const vessel = await fastify.db.queryOne(vesselQuery, [vesselId, request.user.id]);
        
        if (!vessel) {
          throw new ValidationError('Invalid vessel ID or vessel does not belong to user');
        }

        // Submit depth reading
        const reading = await DepthService.submitDepthReading(
          request.user.id,
          vesselId,
          {
            location,
            depthMeters,
            vesselDraft: 0, // Will be updated to get actual vessel draft
            tideHeightMeters,
            waterTemperatureCelsius,
            bottomType,
            notes
          }
        );

        // Log the submission
        logger.info('Depth reading submitted', {
          userId: request.user.id,
          vesselId,
          readingId: reading.id,
          location,
          depth: depthMeters
        });

        reply.status(201).send({
          success: true,
          data: {
            reading: {
              id: reading.id,
              location: reading.location,
              depthMeters: reading.depthMeters,
              confidenceScore: reading.confidenceScore,
              timestamp: reading.timestamp,
              verificationCount: reading.verificationCount,
              isVerified: reading.isVerified
            }
          },
          message: 'Depth reading submitted successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get Depth Data for Area
   * GET /api/depth/area
   */
  fastify.get<{ Querystring: DepthAreaRequest }>(
    '/area',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: depthAreaSchema
      }
    },
    async (request: AuthenticatedRequest & { Querystring: DepthAreaRequest }, reply: FastifyReply) => {
      try {
        const { northEast, southWest, vesselDraft, confidenceLevel, maxAge } = request.query;

        // Validate bounds
        if (northEast.latitude <= southWest.latitude || northEast.longitude <= southWest.longitude) {
          throw new ValidationError('Invalid bounding box: northEast must be greater than southWest');
        }

        // Check area size (prevent overly large requests)
        const latDiff = northEast.latitude - southWest.latitude;
        const lonDiff = northEast.longitude - southWest.longitude;
        if (latDiff > 1.0 || lonDiff > 1.0) {
          throw new ValidationError('Search area too large. Maximum area is 1° x 1°');
        }

        const depthRequest: DepthDataRequest = {
          bounds: { northEast, southWest },
          vesselDraft,
          confidenceLevel,
          maxAge
        };

        const depthData = await DepthService.getDepthDataForArea(depthRequest);

        // Add safety disclaimer
        const safetyNotice = "This data is crowdsourced and may not be accurate. Always verify with official marine charts and follow maritime safety regulations.";

        reply.send({
          success: true,
          data: {
            readings: depthData.readings,
            aggregatedData: depthData.aggregatedData,
            safetyWarnings: depthData.safetyWarnings,
            dataQualityScore: depthData.dataQualityScore,
            searchArea: {
              northEast,
              southWest,
              areaKm2: Math.round(latDiff * lonDiff * 12365), // Rough conversion to km²
            },
            metadata: {
              totalReadings: depthData.readings.length,
              aggregationPoints: depthData.aggregatedData.length,
              safetyAlerts: depthData.safetyWarnings.length,
              maxAge: maxAge || 24,
              confidenceFilter: confidenceLevel || 'all'
            }
          },
          safetyNotice,
          message: 'Depth data retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get Nearest Depth Readings
   * GET /api/depth/nearest
   */
  fastify.get<{ Querystring: NearestDepthRequest }>(
    '/nearest',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: nearestDepthSchema
      }
    },
    async (request: AuthenticatedRequest & { Querystring: NearestDepthRequest }, reply: FastifyReply) => {
      try {
        const { latitude, longitude, radiusMeters, maxResults } = request.query;

        const location: Point = { latitude, longitude };
        const readings = await DepthService.getNearestDepthReadings(location, radiusMeters, maxResults);

        reply.send({
          success: true,
          data: {
            readings,
            searchCenter: location,
            searchRadius: radiusMeters,
            maxResults,
            found: readings.length
          },
          message: 'Nearest depth readings retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get Specific Depth Reading
   * GET /api/depth/readings/:id
   */
  fastify.get<{ Params: { id: string } }>(
    '/readings/:id',
    {
      preHandler: fastify.authenticate
    },
    async (request: AuthenticatedRequest & { Params: { id: string } }, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          throw new ValidationError('Invalid depth reading ID format');
        }

        const query = `
          SELECT 
            id,
            user_id as "userId",
            vessel_id as "vesselId",
            ST_Y(location::geometry) as latitude,
            ST_X(location::geometry) as longitude,
            timestamp,
            depth_meters as "depthMeters",
            vessel_draft as "vesselDraft",
            tide_height_meters as "tideHeightMeters",
            water_temperature_celsius as "waterTemperatureCelsius",
            bottom_type as "bottomType",
            notes,
            confidence_score as "confidenceScore",
            verification_count as "verificationCount",
            is_verified as "isVerified",
            verified_by as "verifiedBy",
            verified_at as "verifiedAt",
            created_at as "createdAt"
          FROM depth_readings
          WHERE id = $1
        `;

        const reading = await fastify.db.queryOne(query, [id]);

        if (!reading) {
          throw new NotFoundError('Depth reading');
        }

        // Convert lat/lng to Point object
        const formattedReading = {
          ...reading,
          location: {
            latitude: reading.latitude,
            longitude: reading.longitude
          }
        };

        reply.send({
          success: true,
          data: {
            reading: formattedReading
          },
          message: 'Depth reading retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Verify Depth Reading (Captain/Admin only)
   * POST /api/depth/readings/:id/verify
   */
  fastify.post<{ Params: { id: string }; Body: VerifyDepthRequest }>(
    '/readings/:id/verify',
    {
      preHandler: [
        fastify.authenticate,
        async (request: AuthenticatedRequest, reply: FastifyReply) => {
          if (!['captain', 'admin'].includes(request.user.role)) {
            reply.status(403).send({
              success: false,
              message: 'Only captains and administrators can verify depth readings',
              code: 'INSUFFICIENT_PERMISSIONS'
            });
          }
        }
      ]
    },
    async (request: AuthenticatedRequest & { Params: { id: string }; Body: VerifyDepthRequest }, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const { isVerified } = request.body;

        // Validate depth reading exists
        const existingReading = await fastify.db.queryOne(
          'SELECT id FROM depth_readings WHERE id = $1',
          [id]
        );

        if (!existingReading) {
          throw new NotFoundError('Depth reading');
        }

        await DepthService.verifyDepthReading(id, request.user.id, isVerified);

        logger.info('Depth reading verification updated', {
          readingId: id,
          verifierId: request.user.id,
          verifierRole: request.user.role,
          isVerified
        });

        reply.send({
          success: true,
          data: {
            readingId: id,
            isVerified,
            verifiedBy: request.user.id,
            verifiedAt: new Date()
          },
          message: `Depth reading ${isVerified ? 'verified' : 'unverified'} successfully`
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get User's Depth Reading History
   * GET /api/depth/history
   */
  fastify.get(
    '/history',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            vesselId: { type: 'string' }
          }
        }
      }
    },
    async (request: AuthenticatedRequest & { 
      Querystring: { page: number; limit: number; vesselId?: string } 
    }, reply: FastifyReply) => {
      try {
        const { page, limit, vesselId } = request.query;
        const offset = (page - 1) * limit;

        let vesselFilter = '';
        let params = [request.user.id, limit, offset];

        if (vesselId) {
          vesselFilter = 'AND vessel_id = $4';
          params.push(vesselId);
        }

        const query = `
          SELECT 
            id,
            vessel_id as "vesselId",
            ST_Y(location::geometry) as latitude,
            ST_X(location::geometry) as longitude,
            timestamp,
            depth_meters as "depthMeters",
            confidence_score as "confidenceScore",
            verification_count as "verificationCount",
            is_verified as "isVerified"
          FROM depth_readings
          WHERE user_id = $1 ${vesselFilter}
          ORDER BY timestamp DESC
          LIMIT $2 OFFSET $3
        `;

        const readings = await fastify.db.query(query, params);

        // Get total count for pagination
        const countQuery = `
          SELECT COUNT(*) as total
          FROM depth_readings
          WHERE user_id = $1 ${vesselFilter}
        `;
        const countParams = vesselFilter ? [request.user.id, vesselId] : [request.user.id];
        const { total } = await fastify.db.queryOne(countQuery, countParams);

        const formattedReadings = readings.map(r => ({
          ...r,
          location: { latitude: r.latitude, longitude: r.longitude }
        }));

        reply.send({
          success: true,
          data: {
            readings: formattedReadings,
            pagination: {
              page,
              limit,
              total: parseInt(total),
              totalPages: Math.ceil(total / limit),
              hasNext: page < Math.ceil(total / limit),
              hasPrev: page > 1
            }
          },
          message: 'Depth reading history retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );
}