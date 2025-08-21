// Authentication Routes
// User registration, login, logout, and token management

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Joi from 'joi';
import { 
  AuthService, 
  SessionManager, 
  TokenManager,
  AuthenticatedRequest 
} from '../middleware/auth';
import { ValidationError, ConflictError } from '../middleware/errorHandler';
import { User, AuthTokens } from '../types';

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'any.required': 'Password is required'
  }),
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
  sessionId: Joi.string().uuid().required()
});

interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
  sessionId: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
  
  /**
   * User Registration
   * POST /api/auth/register
   */
  fastify.post<{ Body: RegisterRequest }>(
    '/register',
    {
      schema: {
        body: registerSchema,
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      firstName: { type: 'string' },
                      lastName: { type: 'string' },
                      role: { type: 'string' },
                      isVerified: { type: 'boolean' }
                    }
                  },
                  tokens: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                      expiresIn: { type: 'number' }
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
    async (request: FastifyRequest<{ Body: RegisterRequest }>, reply: FastifyReply) => {
      try {
        const { email, password, firstName, lastName, phone } = request.body;

        // Validate input
        const { error } = registerSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Check if user already exists
        const existingUser = await AuthService.emailExists(email);
        if (existingUser) {
          throw new ConflictError('An account with this email already exists');
        }

        // Create new user
        const user = await AuthService.createUser({
          email,
          password,
          firstName,
          lastName,
          phone
        });

        // Create session and tokens
        const deviceInfo = {
          userAgent: request.headers['user-agent'],
          platform: 'web'
        };

        const { sessionId, refreshToken } = await SessionManager.createSession(
          user.id,
          deviceInfo,
          request.ip,
          request.headers['user-agent']
        );

        const tokens = await TokenManager.generateTokens(fastify, user.id, sessionId);

        // Remove sensitive data from user object
        const { privacySettings, ...safeUser } = user;

        reply.status(201).send({
          success: true,
          data: {
            user: safeUser,
            tokens: {
              accessToken: tokens.accessToken,
              refreshToken,
              expiresIn: tokens.expiresIn
            }
          },
          message: 'Account created successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * User Login
   * POST /api/auth/login
   */
  fastify.post<{ Body: LoginRequest }>(
    '/login',
    {
      schema: {
        body: loginSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  user: { type: 'object' },
                  tokens: { type: 'object' }
                }
              },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
      try {
        const { email, password } = request.body;

        // Validate input
        const { error } = loginSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Authenticate user
        const user = await AuthService.authenticateUser(email, password);
        if (!user) {
          throw new ValidationError('Invalid email or password');
        }

        if (!user.isVerified) {
          throw new ValidationError('Please verify your email address before logging in');
        }

        // Create session and tokens
        const deviceInfo = {
          userAgent: request.headers['user-agent'],
          platform: 'web'
        };

        const { sessionId, refreshToken } = await SessionManager.createSession(
          user.id,
          deviceInfo,
          request.ip,
          request.headers['user-agent']
        );

        const tokens = await TokenManager.generateTokens(fastify, user.id, sessionId);

        // Remove sensitive data from user object
        const { privacySettings, ...safeUser } = user;

        reply.send({
          success: true,
          data: {
            user: safeUser,
            tokens: {
              accessToken: tokens.accessToken,
              refreshToken,
              expiresIn: tokens.expiresIn
            }
          },
          message: 'Login successful'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Refresh Access Token
   * POST /api/auth/refresh
   */
  fastify.post<{ Body: RefreshTokenRequest }>(
    '/refresh',
    {
      schema: {
        body: refreshTokenSchema
      }
    },
    async (request: FastifyRequest<{ Body: RefreshTokenRequest }>, reply: FastifyReply) => {
      try {
        const { refreshToken, sessionId } = request.body;

        // Validate input
        const { error } = refreshTokenSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Extract user ID from token header (if present)
        const authHeader = request.headers.authorization;
        let userId: string | null = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.slice(7);
          const decoded = TokenManager.decodeToken(token);
          userId = decoded?.userId;
        }

        if (!userId) {
          throw new ValidationError('User identification required for token refresh');
        }

        // Refresh session
        const refreshResult = await SessionManager.refreshSession(userId, sessionId, refreshToken);
        
        if (!refreshResult.valid) {
          throw new ValidationError('Invalid or expired refresh token');
        }

        // Generate new access token
        const tokens = await TokenManager.generateTokens(
          fastify, 
          userId, 
          refreshResult.newSessionId!
        );

        reply.send({
          success: true,
          data: {
            tokens: {
              accessToken: tokens.accessToken,
              refreshToken: refreshResult.newRefreshToken,
              expiresIn: tokens.expiresIn
            }
          },
          message: 'Token refreshed successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * User Logout
   * POST /api/auth/logout
   */
  fastify.post(
    '/logout',
    {
      preHandler: fastify.authenticate
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const token = request.headers.authorization?.slice(7);
        if (token) {
          const decoded = TokenManager.decodeToken(token);
          if (decoded?.sessionId) {
            await SessionManager.invalidateSession(decoded.sessionId);
          }
        }

        reply.send({
          success: true,
          message: 'Logout successful'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Logout from all devices
   * POST /api/auth/logout-all
   */
  fastify.post(
    '/logout-all',
    {
      preHandler: fastify.authenticate
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        await SessionManager.invalidateAllUserSessions(request.user.id);

        reply.send({
          success: true,
          message: 'Logged out from all devices successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  fastify.get(
    '/me',
    {
      preHandler: fastify.authenticate
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const { privacySettings, ...safeUser } = request.user;

        reply.send({
          success: true,
          data: {
            user: safeUser
          }
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Verify token validity
   * GET /api/auth/verify
   */
  fastify.get(
    '/verify',
    {
      preHandler: fastify.authenticate
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const token = request.headers.authorization?.slice(7);
        const decoded = token ? TokenManager.decodeToken(token) : null;

        reply.send({
          success: true,
          data: {
            valid: true,
            user: {
              id: request.user.id,
              email: request.user.email,
              role: request.user.role
            },
            session: {
              sessionId: decoded?.sessionId,
              issuedAt: decoded?.iat ? new Date(decoded.iat * 1000) : null
            }
          },
          message: 'Token is valid'
        });

      } catch (error) {
        throw error;
      }
    }
  );
}