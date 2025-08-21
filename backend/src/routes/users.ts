// User Management Routes
// User profile and account management endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Joi from 'joi';
import { AuthenticatedRequest, PasswordManager } from '../middleware/auth';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/errorHandler';
import { db } from '../config/database';
import { User, PrivacySettings } from '../types';
import logger from '../utils/logger';

// Validation schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional().allow(null, ''),
});

const updatePrivacySchema = Joi.object({
  shareTracks: Joi.boolean().optional(),
  shareDepth: Joi.boolean().optional(),
  publicProfile: Joi.boolean().optional()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
});

interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface UpdatePrivacyRequest {
  shareTracks?: boolean;
  shareDepth?: boolean;
  publicProfile?: boolean;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export default async function userRoutes(fastify: FastifyInstance) {

  /**
   * Get User Profile
   * GET /api/users/profile
   */
  fastify.get(
    '/profile',
    {
      preHandler: fastify.authenticate
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const query = `
          SELECT 
            id,
            email,
            first_name as "firstName",
            last_name as "lastName",
            phone,
            role,
            is_verified as "isVerified",
            privacy_settings as "privacySettings",
            created_at as "createdAt",
            updated_at as "updatedAt",
            last_login as "lastLogin"
          FROM users 
          WHERE id = $1 AND is_active = true
        `;

        const user = await db.queryOne<User>(query, [request.user.id]);

        if (!user) {
          throw new NotFoundError('User profile');
        }

        // Get user statistics
        const statsQuery = `
          SELECT 
            (SELECT COUNT(*) FROM depth_readings WHERE user_id = $1) as depth_readings_count,
            (SELECT COUNT(*) FROM navigation_sessions WHERE user_id = $1) as navigation_sessions_count,
            (SELECT COUNT(*) FROM vessels WHERE owner_id = $1 AND is_active = true) as vessels_count,
            (SELECT MAX(timestamp) FROM gps_tracks WHERE user_id = $1) as last_activity
        `;

        const stats = await db.queryOne(statsQuery, [request.user.id]);

        reply.send({
          success: true,
          data: {
            user,
            statistics: {
              depthReadingsSubmitted: parseInt(stats.depth_readings_count || '0'),
              navigationSessions: parseInt(stats.navigation_sessions_count || '0'),
              vesselsRegistered: parseInt(stats.vessels_count || '0'),
              lastActivity: stats.last_activity
            }
          },
          message: 'User profile retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Update User Profile
   * PUT /api/users/profile
   */
  fastify.put<{ Body: UpdateProfileRequest }>(
    '/profile',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: updateProfileSchema
      }
    },
    async (request: AuthenticatedRequest & { Body: UpdateProfileRequest }, reply: FastifyReply) => {
      try {
        const { firstName, lastName, phone } = request.body;

        // Validate input
        const { error } = updateProfileSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 2;

        if (firstName !== undefined) {
          updates.push(`first_name = $${paramIndex}`);
          values.push(firstName);
          paramIndex++;
        }

        if (lastName !== undefined) {
          updates.push(`last_name = $${paramIndex}`);
          values.push(lastName);
          paramIndex++;
        }

        if (phone !== undefined) {
          updates.push(`phone = $${paramIndex}`);
          values.push(phone || null);
          paramIndex++;
        }

        if (updates.length === 0) {
          throw new ValidationError('No valid fields provided for update');
        }

        updates.push(`updated_at = NOW()`);

        const query = `
          UPDATE users 
          SET ${updates.join(', ')}
          WHERE id = $1 AND is_active = true
          RETURNING 
            id,
            email,
            first_name as "firstName",
            last_name as "lastName",
            phone,
            role,
            is_verified as "isVerified",
            updated_at as "updatedAt"
        `;

        const updatedUser = await db.queryOne<User>(query, [request.user.id, ...values]);

        if (!updatedUser) {
          throw new NotFoundError('User');
        }

        logger.info('User profile updated', {
          userId: request.user.id,
          updatedFields: Object.keys(request.body)
        });

        reply.send({
          success: true,
          data: {
            user: updatedUser
          },
          message: 'Profile updated successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Update Privacy Settings
   * PUT /api/users/privacy
   */
  fastify.put<{ Body: UpdatePrivacyRequest }>(
    '/privacy',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: updatePrivacySchema
      }
    },
    async (request: AuthenticatedRequest & { Body: UpdatePrivacyRequest }, reply: FastifyReply) => {
      try {
        const { shareTracks, shareDepth, publicProfile } = request.body;

        // Validate input
        const { error } = updatePrivacySchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Get current privacy settings
        const currentQuery = `SELECT privacy_settings FROM users WHERE id = $1`;
        const currentUser = await db.queryOne<{ privacy_settings: PrivacySettings }>(currentQuery, [request.user.id]);

        if (!currentUser) {
          throw new NotFoundError('User');
        }

        // Merge with new settings
        const updatedSettings: PrivacySettings = {
          shareTracks: shareTracks !== undefined ? shareTracks : currentUser.privacy_settings.shareTracks,
          shareDepth: shareDepth !== undefined ? shareDepth : currentUser.privacy_settings.shareDepth,
          publicProfile: publicProfile !== undefined ? publicProfile : currentUser.privacy_settings.publicProfile
        };

        // Update privacy settings
        const updateQuery = `
          UPDATE users 
          SET privacy_settings = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING privacy_settings as "privacySettings"
        `;

        const result = await db.queryOne<{ privacySettings: PrivacySettings }>(
          updateQuery, 
          [JSON.stringify(updatedSettings), request.user.id]
        );

        logger.info('User privacy settings updated', {
          userId: request.user.id,
          previousSettings: currentUser.privacy_settings,
          newSettings: updatedSettings
        });

        reply.send({
          success: true,
          data: {
            privacySettings: result.privacySettings
          },
          message: 'Privacy settings updated successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Change Password
   * POST /api/users/change-password
   */
  fastify.post<{ Body: ChangePasswordRequest }>(
    '/change-password',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: changePasswordSchema
      }
    },
    async (request: AuthenticatedRequest & { Body: ChangePasswordRequest }, reply: FastifyReply) => {
      try {
        const { currentPassword, newPassword } = request.body;

        // Validate input
        const { error } = changePasswordSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Get current password hash
        const userQuery = `SELECT password_hash FROM users WHERE id = $1`;
        const user = await db.queryOne<{ password_hash: string }>(userQuery, [request.user.id]);

        if (!user) {
          throw new NotFoundError('User');
        }

        // Verify current password
        const isCurrentPasswordValid = await PasswordManager.verify(currentPassword, user.password_hash);
        if (!isCurrentPasswordValid) {
          throw new ValidationError('Current password is incorrect');
        }

        // Hash new password
        const newPasswordHash = await PasswordManager.hash(newPassword);

        // Update password
        const updateQuery = `
          UPDATE users 
          SET password_hash = $1, updated_at = NOW()
          WHERE id = $2
        `;

        await db.query(updateQuery, [newPasswordHash, request.user.id]);

        logger.info('User password changed', {
          userId: request.user.id,
          timestamp: new Date()
        });

        reply.send({
          success: true,
          message: 'Password changed successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Delete Account
   * DELETE /api/users/account
   */
  fastify.delete(
    '/account',
    {
      preHandler: fastify.authenticate
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        // Soft delete - mark as inactive
        const deleteQuery = `
          UPDATE users 
          SET is_active = false, updated_at = NOW()
          WHERE id = $1
        `;

        await db.query(deleteQuery, [request.user.id]);

        // Also deactivate user's vessels
        const deactivateVesselsQuery = `
          UPDATE vessels 
          SET is_active = false, updated_at = NOW()
          WHERE owner_id = $1
        `;

        await db.query(deactivateVesselsQuery, [request.user.id]);

        logger.info('User account deactivated', {
          userId: request.user.id,
          email: request.user.email,
          timestamp: new Date()
        });

        reply.send({
          success: true,
          message: 'Account deleted successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get User Activity Summary
   * GET /api/users/activity
   */
  fastify.get(
    '/activity',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 365, default: 30 }
          }
        }
      }
    },
    async (request: AuthenticatedRequest & { Querystring: { days: number } }, reply: FastifyReply) => {
      try {
        const { days } = request.query;

        const activityQuery = `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as depth_readings
          FROM depth_readings 
          WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '${days} days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `;

        const depthActivity = await db.query(activityQuery, [request.user.id]);

        const sessionQuery = `
          SELECT 
            DATE(start_time) as date,
            COUNT(*) as navigation_sessions,
            COALESCE(SUM(total_distance_nm), 0) as total_distance_nm,
            COALESCE(AVG(avg_speed_knots), 0) as avg_speed_knots
          FROM navigation_sessions 
          WHERE user_id = $1 
          AND start_time >= NOW() - INTERVAL '${days} days'
          GROUP BY DATE(start_time)
          ORDER BY date DESC
        `;

        const sessionActivity = await db.query(sessionQuery, [request.user.id]);

        reply.send({
          success: true,
          data: {
            depthActivity,
            navigationActivity: sessionActivity,
            summary: {
              totalDepthReadings: depthActivity.reduce((sum: number, day: any) => sum + parseInt(day.depth_readings), 0),
              totalNavigationSessions: sessionActivity.reduce((sum: number, day: any) => sum + parseInt(day.navigation_sessions), 0),
              totalDistanceNm: sessionActivity.reduce((sum: number, day: any) => sum + parseFloat(day.total_distance_nm || '0'), 0),
              periodDays: days
            }
          },
          message: 'User activity retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get Public User Profile (for sharing)
   * GET /api/users/:id/public
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/public',
    async (request: FastifyRequest & { Params: { id: string } }, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const query = `
          SELECT 
            id,
            first_name as "firstName",
            last_name as "lastName",
            role,
            created_at as "createdAt",
            privacy_settings as "privacySettings"
          FROM users 
          WHERE id = $1 AND is_active = true
        `;

        const user = await db.queryOne<User>(query, [id]);

        if (!user) {
          throw new NotFoundError('User');
        }

        // Check if profile is public
        if (!user.privacySettings.publicProfile) {
          throw new AuthorizationError('User profile is private');
        }

        // Get public statistics if sharing is enabled
        let statistics = null;
        if (user.privacySettings.shareDepth) {
          const statsQuery = `
            SELECT 
              COUNT(*) as depth_readings_count,
              COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_readings_count
            FROM depth_readings 
            WHERE user_id = $1
          `;

          const stats = await db.queryOne(statsQuery, [id]);
          statistics = {
            depthReadingsSubmitted: parseInt(stats.depth_readings_count || '0'),
            verifiedReadings: parseInt(stats.verified_readings_count || '0')
          };
        }

        reply.send({
          success: true,
          data: {
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              memberSince: user.createdAt
            },
            statistics
          },
          message: 'Public profile retrieved successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );
}