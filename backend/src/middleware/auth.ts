// Authentication Middleware
// JWT and session management for Waves backend

import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { User, AuthTokens, UserSession } from '../types';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import logger from '../utils/logger';
import config from '../config';

export interface AuthenticatedRequest extends FastifyRequest {
  user: User;
  session?: UserSession;
}

/**
 * Authentication middleware for protected routes
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const token = extractToken(request);
    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    // Verify JWT token
    const decoded = request.server.jwt.verify(token) as any;
    
    // Get user from database
    const user = await getUserById(decoded.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid user or account deactivated');
    }

    // Check if session is still valid in Redis
    if (decoded.sessionId) {
      const sessionValid = await redis.getSession(decoded.sessionId);
      if (!sessionValid) {
        throw new AuthenticationError('Session expired or invalid');
      }
    }

    // Attach user to request
    (request as AuthenticatedRequest).user = user;
    
  } catch (error) {
    if (error.message?.includes('jwt expired')) {
      throw new AuthenticationError('Token has expired');
    }
    if (error.message?.includes('jwt malformed')) {
      throw new AuthenticationError('Invalid token format');
    }
    if (error instanceof AuthenticationError) {
      throw error;
    }
    
    logger.error('Authentication middleware error:', error);
    throw new AuthenticationError('Authentication failed');
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authenticatedRequest = request as AuthenticatedRequest;
    
    if (!authenticatedRequest.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!allowedRoles.includes(authenticatedRequest.user.role)) {
      throw new AuthorizationError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`
      );
    }
  };
}

/**
 * Extract JWT token from request headers
 */
function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Get user by ID from database
 */
async function getUserById(userId: string): Promise<User | null> {
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
      last_login as "lastLogin",
      is_active as "isActive"
    FROM users 
    WHERE id = $1 AND is_active = true
  `;

  return await db.queryOne<User>(query, [userId]);
}

/**
 * Password hashing utilities
 */
export class PasswordManager {
  static async hash(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  static async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

/**
 * Session management utilities
 */
export class SessionManager {
  /**
   * Create new user session
   */
  static async createSession(
    userId: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ sessionId: string; refreshToken: string }> {
    const sessionId = uuidv4();
    const refreshToken = uuidv4();
    
    // Calculate expiration times
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + this.parseExpiration(config.jwt.refreshExpiresIn));

    // Store session in database
    const query = `
      INSERT INTO user_sessions (
        id, user_id, refresh_token_hash, device_info, 
        ip_address, user_agent, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const refreshTokenHash = await PasswordManager.hash(refreshToken);
    
    await db.query(query, [
      sessionId,
      userId,
      refreshTokenHash,
      deviceInfo ? JSON.stringify(deviceInfo) : null,
      ipAddress,
      userAgent,
      expiresAt
    ]);

    // Store session in Redis for fast access
    const sessionData = {
      userId,
      sessionId,
      createdAt: new Date(),
      deviceInfo,
      ipAddress,
      userAgent
    };

    const expirationSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    await redis.setSession(sessionId, sessionData, expirationSeconds);

    // Store refresh token in Redis
    await redis.setRefreshToken(userId, sessionId, expirationSeconds);

    return { sessionId, refreshToken };
  }

  /**
   * Validate and refresh session
   */
  static async refreshSession(
    userId: string,
    sessionId: string,
    refreshToken: string
  ): Promise<{ valid: boolean; newSessionId?: string; newRefreshToken?: string }> {
    try {
      // Get session from database
      const sessionQuery = `
        SELECT * FROM user_sessions 
        WHERE id = $1 AND user_id = $2 AND is_active = true AND expires_at > NOW()
      `;
      
      const session = await db.queryOne(sessionQuery, [sessionId, userId]);
      
      if (!session) {
        return { valid: false };
      }

      // Verify refresh token
      const tokenValid = await PasswordManager.verify(refreshToken, session.refresh_token_hash);
      if (!tokenValid) {
        return { valid: false };
      }

      // Check Redis token validity
      const redisTokenValid = await redis.isRefreshTokenValid(userId, sessionId);
      if (!redisTokenValid) {
        return { valid: false };
      }

      // Create new session (refresh token rotation)
      const newSession = await this.createSession(
        userId,
        session.device_info,
        session.ip_address,
        session.user_agent
      );

      // Invalidate old session
      await this.invalidateSession(sessionId);

      return {
        valid: true,
        newSessionId: newSession.sessionId,
        newRefreshToken: newSession.refreshToken
      };

    } catch (error) {
      logger.error('Session refresh error:', error);
      return { valid: false };
    }
  }

  /**
   * Invalidate specific session
   */
  static async invalidateSession(sessionId: string): Promise<void> {
    // Update database
    const query = `UPDATE user_sessions SET is_active = false WHERE id = $1`;
    await db.query(query, [sessionId]);

    // Remove from Redis
    await redis.deleteSession(sessionId);
  }

  /**
   * Invalidate all user sessions
   */
  static async invalidateAllUserSessions(userId: string): Promise<void> {
    // Update database
    const query = `UPDATE user_sessions SET is_active = false WHERE user_id = $1`;
    await db.query(query, [userId]);

    // Remove all refresh tokens from Redis
    await redis.invalidateAllRefreshTokens(userId);
  }

  /**
   * Parse JWT expiration string to milliseconds
   */
  private static parseExpiration(expiration: string): number {
    const units: { [key: string]: number } = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiration format: ${expiration}`);
    }

    const [, amount, unit] = match;
    return parseInt(amount, 10) * units[unit];
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<void> {
    const query = `
      UPDATE user_sessions 
      SET is_active = false 
      WHERE expires_at < NOW() AND is_active = true
    `;
    
    await db.query(query);
    logger.info('Cleaned up expired sessions');
  }
}

/**
 * Token generation utilities
 */
export class TokenManager {
  /**
   * Generate access and refresh tokens
   */
  static async generateTokens(
    app: any,
    userId: string,
    sessionId: string
  ): Promise<AuthTokens> {
    const payload = {
      userId,
      sessionId,
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = app.jwt.sign(payload, { expiresIn: config.jwt.expiresIn });
    
    // Calculate expiration time in seconds
    const expiresIn = SessionManager['parseExpiration'](config.jwt.expiresIn) / 1000;

    return {
      accessToken,
      refreshToken: sessionId, // Session ID acts as refresh token identifier
      expiresIn
    };
  }

  /**
   * Decode token without verification (for logging/debugging)
   */
  static decodeToken(token: string): any {
    try {
      return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    } catch {
      return null;
    }
  }
}

/**
 * User authentication utilities
 */
export class AuthService {
  /**
   * Authenticate user with email and password
   */
  static async authenticateUser(
    email: string,
    password: string
  ): Promise<User | null> {
    const query = `
      SELECT 
        id,
        email,
        password_hash,
        first_name as "firstName",
        last_name as "lastName",
        phone,
        role,
        is_verified as "isVerified",
        privacy_settings as "privacySettings",
        created_at as "createdAt",
        updated_at as "updatedAt",
        last_login as "lastLogin",
        is_active as "isActive"
      FROM users 
      WHERE email = $1 AND is_active = true
    `;

    const user = await db.queryOne<User & { password_hash: string }>(query, [email.toLowerCase()]);
    
    if (!user) {
      return null;
    }

    const passwordValid = await PasswordManager.verify(password, user.password_hash);
    if (!passwordValid) {
      return null;
    }

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Remove password hash from returned user object
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Check if email already exists
   */
  static async emailExists(email: string): Promise<boolean> {
    const query = 'SELECT id FROM users WHERE email = $1';
    const result = await db.queryOne(query, [email.toLowerCase()]);
    return !!result;
  }

  /**
   * Create new user account
   */
  static async createUser(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<User> {
    const { email, password, firstName, lastName, phone } = userData;

    // Check if email already exists
    if (await this.emailExists(email)) {
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = await PasswordManager.hash(password);

    // Insert user
    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING 
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
        is_active as "isActive"
    `;

    return await db.queryOne<User>(query, [
      email.toLowerCase(),
      passwordHash,
      firstName || null,
      lastName || null,
      phone || null
    ]);
  }
}