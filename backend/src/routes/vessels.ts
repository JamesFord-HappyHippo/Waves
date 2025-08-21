// Vessel Management Routes
// Vessel registration and management endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Joi from 'joi';
import { AuthenticatedRequest } from '../middleware/auth';
import { ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler';
import { db } from '../config/database';
import { Vessel } from '../types';
import logger from '../utils/logger';

// Validation schemas
const vesselSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  vesselType: Joi.string().valid('sailboat', 'powerboat', 'catamaran', 'trawler', 'yacht', 'dinghy', 'pwc', 'other').required(),
  lengthMeters: Joi.number().min(1).max(200).optional(),
  beamMeters: Joi.number().min(0.5).max(50).optional(),
  draftMeters: Joi.number().min(0.1).max(20).required(),
  displacementKg: Joi.number().min(100).max(1000000).optional(),
  maxSpeedKnots: Joi.number().min(1).max(100).optional(),
  fuelCapacityLiters: Joi.number().min(10).max(100000).optional(),
  registrationNumber: Joi.string().max(50).optional(),
  mmsi: Joi.string().pattern(/^\d{9}$/).optional()
});

const updateVesselSchema = vesselSchema.fork(['name', 'vesselType', 'draftMeters'], (schema) => schema.optional());

interface VesselRequest {
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
}

export default async function vesselRoutes(fastify: FastifyInstance) {

  /**
   * Get User's Vessels
   * GET /api/vessels
   */
  fastify.get(
    '/',
    {
      preHandler: fastify.authenticate
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const query = `
          SELECT 
            id,
            name,
            vessel_type as "vesselType",
            length_meters as "lengthMeters",
            beam_meters as "beamMeters",
            draft_meters as "draftMeters",
            displacement_kg as "displacementKg",
            max_speed_knots as "maxSpeedKnots",
            fuel_capacity_liters as "fuelCapacityLiters",
            registration_number as "registrationNumber",
            mmsi,
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM vessels 
          WHERE owner_id = $1 AND is_active = true
          ORDER BY created_at DESC
        `;

        const vessels = await db.query<Vessel>(query, [request.user.id]);

        // Get usage statistics for each vessel
        const vesselsWithStats = await Promise.all(
          vessels.map(async (vessel) => {
            const statsQuery = `
              SELECT 
                (SELECT COUNT(*) FROM depth_readings WHERE vessel_id = $1) as depth_readings_count,
                (SELECT COUNT(*) FROM navigation_sessions WHERE vessel_id = $1) as navigation_sessions_count,
                (SELECT MAX(timestamp) FROM gps_tracks WHERE vessel_id = $1) as last_used
            `;
            
            const stats = await db.queryOne(statsQuery, [vessel.id]);
            
            return {
              ...vessel,
              statistics: {
                depthReadings: parseInt(stats.depth_readings_count || '0'),
                navigationSessions: parseInt(stats.navigation_sessions_count || '0'),
                lastUsed: stats.last_used
              }
            };
          })
        );

        reply.send({
          success: true,
          data: {
            vessels: vesselsWithStats,
            total: vessels.length
          },
          message: 'Vessels retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get Specific Vessel
   * GET /api/vessels/:id
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id',
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
            vessel_type as "vesselType",
            length_meters as "lengthMeters",
            beam_meters as "beamMeters",
            draft_meters as "draftMeters",
            displacement_kg as "displacementKg",
            max_speed_knots as "maxSpeedKnots",
            fuel_capacity_liters as "fuelCapacityLiters",
            registration_number as "registrationNumber",
            mmsi,
            insurance_policy as "insurancePolicy",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM vessels 
          WHERE id = $1 AND owner_id = $2 AND is_active = true
        `;

        const vessel = await db.queryOne<Vessel>(query, [id, request.user.id]);

        if (!vessel) {
          throw new NotFoundError('Vessel');
        }

        // Get detailed usage statistics
        const statsQuery = `
          SELECT 
            (SELECT COUNT(*) FROM depth_readings WHERE vessel_id = $1) as depth_readings_count,
            (SELECT COUNT(*) FROM navigation_sessions WHERE vessel_id = $1) as navigation_sessions_count,
            (SELECT COALESCE(SUM(total_distance_nm), 0) FROM navigation_sessions WHERE vessel_id = $1) as total_distance_nm,
            (SELECT MAX(timestamp) FROM gps_tracks WHERE vessel_id = $1) as last_used,
            (SELECT COUNT(*) FROM gps_tracks WHERE vessel_id = $1) as gps_points_count
        `;

        const stats = await db.queryOne(statsQuery, [id]);

        reply.send({
          success: true,
          data: {
            vessel: {
              ...vessel,
              statistics: {
                depthReadings: parseInt(stats.depth_readings_count || '0'),
                navigationSessions: parseInt(stats.navigation_sessions_count || '0'),
                totalDistanceNm: parseFloat(stats.total_distance_nm || '0'),
                gpsPoints: parseInt(stats.gps_points_count || '0'),
                lastUsed: stats.last_used
              }
            }
          },
          message: 'Vessel retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Add New Vessel
   * POST /api/vessels
   */
  fastify.post<{ Body: VesselRequest }>(
    '/',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: vesselSchema,
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  vessel: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      vesselType: { type: 'string' },
                      draftMeters: { type: 'number' }
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
    async (request: AuthenticatedRequest & { Body: VesselRequest }, reply: FastifyReply) => {
      try {
        const {
          name,
          vesselType,
          lengthMeters,
          beamMeters,
          draftMeters,
          displacementKg,
          maxSpeedKnots,
          fuelCapacityLiters,
          registrationNumber,
          mmsi
        } = request.body;

        // Validate input
        const { error } = vesselSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Check if registration number already exists (if provided)
        if (registrationNumber) {
          const existingQuery = `
            SELECT id FROM vessels 
            WHERE registration_number = $1 AND is_active = true
          `;
          const existing = await db.queryOne(existingQuery, [registrationNumber]);
          
          if (existing) {
            throw new ConflictError('A vessel with this registration number already exists');
          }
        }

        // Check if MMSI already exists (if provided)
        if (mmsi) {
          const existingMMSIQuery = `
            SELECT id FROM vessels 
            WHERE mmsi = $1 AND is_active = true
          `;
          const existingMMSI = await db.queryOne(existingMMSIQuery, [mmsi]);
          
          if (existingMMSI) {
            throw new ConflictError('A vessel with this MMSI already exists');
          }
        }

        const insertQuery = `
          INSERT INTO vessels (
            owner_id, name, vessel_type, length_meters, beam_meters, draft_meters,
            displacement_kg, max_speed_knots, fuel_capacity_liters, 
            registration_number, mmsi
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING 
            id,
            name,
            vessel_type as "vesselType",
            length_meters as "lengthMeters",
            beam_meters as "beamMeters",
            draft_meters as "draftMeters",
            displacement_kg as "displacementKg",
            max_speed_knots as "maxSpeedKnots",
            fuel_capacity_liters as "fuelCapacityLiters",
            registration_number as "registrationNumber",
            mmsi,
            created_at as "createdAt"
        `;

        const vessel = await db.queryOne<Vessel>(insertQuery, [
          request.user.id,
          name,
          vesselType,
          lengthMeters || null,
          beamMeters || null,
          draftMeters,
          displacementKg || null,
          maxSpeedKnots || null,
          fuelCapacityLiters || null,
          registrationNumber || null,
          mmsi || null
        ]);

        logger.info('New vessel registered', {
          userId: request.user.id,
          vesselId: vessel.id,
          vesselName: name,
          vesselType,
          draftMeters
        });

        reply.status(201).send({
          success: true,
          data: {
            vessel
          },
          message: 'Vessel registered successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Update Vessel
   * PUT /api/vessels/:id
   */
  fastify.put<{ Params: { id: string }; Body: Partial<VesselRequest> }>(
    '/:id',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: updateVesselSchema
      }
    },
    async (request: AuthenticatedRequest & { Params: { id: string }; Body: Partial<VesselRequest> }, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const updateData = request.body;

        // Validate input
        const { error } = updateVesselSchema.validate(updateData);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Check if vessel exists and belongs to user
        const existingQuery = `
          SELECT id FROM vessels 
          WHERE id = $1 AND owner_id = $2 AND is_active = true
        `;
        const existing = await db.queryOne(existingQuery, [id, request.user.id]);

        if (!existing) {
          throw new NotFoundError('Vessel');
        }

        // Check for registration number conflicts (if being updated)
        if (updateData.registrationNumber) {
          const conflictQuery = `
            SELECT id FROM vessels 
            WHERE registration_number = $1 AND id != $2 AND is_active = true
          `;
          const conflict = await db.queryOne(conflictQuery, [updateData.registrationNumber, id]);
          
          if (conflict) {
            throw new ConflictError('A vessel with this registration number already exists');
          }
        }

        // Check for MMSI conflicts (if being updated)
        if (updateData.mmsi) {
          const mmsiConflictQuery = `
            SELECT id FROM vessels 
            WHERE mmsi = $1 AND id != $2 AND is_active = true
          `;
          const mmsiConflict = await db.queryOne(mmsiConflictQuery, [updateData.mmsi, id]);
          
          if (mmsiConflict) {
            throw new ConflictError('A vessel with this MMSI already exists');
          }
        }

        // Build dynamic update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 2;

        const fieldMappings = {
          name: 'name',
          vesselType: 'vessel_type',
          lengthMeters: 'length_meters',
          beamMeters: 'beam_meters',
          draftMeters: 'draft_meters',
          displacementKg: 'displacement_kg',
          maxSpeedKnots: 'max_speed_knots',
          fuelCapacityLiters: 'fuel_capacity_liters',
          registrationNumber: 'registration_number',
          mmsi: 'mmsi'
        };

        for (const [jsField, dbField] of Object.entries(fieldMappings)) {
          if (updateData[jsField as keyof VesselRequest] !== undefined) {
            updates.push(`${dbField} = $${paramIndex}`);
            values.push(updateData[jsField as keyof VesselRequest]);
            paramIndex++;
          }
        }

        if (updates.length === 0) {
          throw new ValidationError('No valid fields provided for update');
        }

        updates.push(`updated_at = NOW()`);

        const updateQuery = `
          UPDATE vessels 
          SET ${updates.join(', ')}
          WHERE id = $1
          RETURNING 
            id,
            name,
            vessel_type as "vesselType",
            length_meters as "lengthMeters",
            beam_meters as "beamMeters",
            draft_meters as "draftMeters",
            displacement_kg as "displacementKg",
            max_speed_knots as "maxSpeedKnots",
            fuel_capacity_liters as "fuelCapacityLiters",
            registration_number as "registrationNumber",
            mmsi,
            updated_at as "updatedAt"
        `;

        const updatedVessel = await db.queryOne<Vessel>(updateQuery, [id, ...values]);

        logger.info('Vessel updated', {
          userId: request.user.id,
          vesselId: id,
          updatedFields: Object.keys(updateData)
        });

        reply.send({
          success: true,
          data: {
            vessel: updatedVessel
          },
          message: 'Vessel updated successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Delete Vessel
   * DELETE /api/vessels/:id
   */
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: fastify.authenticate
    },
    async (request: AuthenticatedRequest & { Params: { id: string } }, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Check if vessel exists and belongs to user
        const existingQuery = `
          SELECT id, name FROM vessels 
          WHERE id = $1 AND owner_id = $2 AND is_active = true
        `;
        const existing = await db.queryOne<{ id: string; name: string }>(existingQuery, [id, request.user.id]);

        if (!existing) {
          throw new NotFoundError('Vessel');
        }

        // Soft delete - mark as inactive
        const deleteQuery = `
          UPDATE vessels 
          SET is_active = false, updated_at = NOW()
          WHERE id = $1
        `;

        await db.query(deleteQuery, [id]);

        logger.info('Vessel deleted', {
          userId: request.user.id,
          vesselId: id,
          vesselName: existing.name
        });

        reply.send({
          success: true,
          message: 'Vessel deleted successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get Vessel Usage History
   * GET /api/vessels/:id/history
   */
  fastify.get<{ 
    Params: { id: string };
    Querystring: { days?: number; page?: number; limit?: number }
  }>(
    '/:id/history',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          }
        }
      }
    },
    async (request: AuthenticatedRequest & { 
      Params: { id: string };
      Querystring: { days: number; page: number; limit: number }
    }, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const { days, page, limit } = request.query;
        const offset = (page - 1) * limit;

        // Verify vessel ownership
        const vesselQuery = `
          SELECT id FROM vessels 
          WHERE id = $1 AND owner_id = $2 AND is_active = true
        `;
        const vessel = await db.queryOne(vesselQuery, [id, request.user.id]);

        if (!vessel) {
          throw new NotFoundError('Vessel');
        }

        // Get navigation sessions
        const sessionsQuery = `
          SELECT 
            id,
            start_time as "startTime",
            end_time as "endTime",
            total_distance_nm as "totalDistanceNm",
            max_speed_knots as "maxSpeedKnots",
            avg_speed_knots as "avgSpeedKnots",
            fuel_consumed_liters as "fuelConsumedLiters"
          FROM navigation_sessions
          WHERE vessel_id = $1 
          AND start_time >= NOW() - INTERVAL '${days} days'
          ORDER BY start_time DESC
          LIMIT $2 OFFSET $3
        `;

        const sessions = await db.query(sessionsQuery, [id, limit, offset]);

        // Get total count
        const countQuery = `
          SELECT COUNT(*) as total
          FROM navigation_sessions
          WHERE vessel_id = $1 
          AND start_time >= NOW() - INTERVAL '${days} days'
        `;
        const { total } = await db.queryOne(countQuery, [id]);

        // Get depth readings count
        const depthQuery = `
          SELECT COUNT(*) as depth_readings_count
          FROM depth_readings
          WHERE vessel_id = $1 
          AND created_at >= NOW() - INTERVAL '${days} days'
        `;
        const depthStats = await db.queryOne(depthQuery, [id]);

        reply.send({
          success: true,
          data: {
            sessions,
            summary: {
              totalSessions: parseInt(total),
              depthReadings: parseInt(depthStats.depth_readings_count || '0'),
              periodDays: days
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
          message: 'Vessel history retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );
}