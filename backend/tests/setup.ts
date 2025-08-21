// Jest Test Setup
// Global test configuration and utilities

import { db } from '../src/config/database';
import { redis } from '../src/config/redis';
import logger from '../src/utils/logger';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Test database configuration
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/waves_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';

// JWT test secrets
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-only';

// Global test timeout
jest.setTimeout(30000);

/**
 * Global test utilities
 */
export class TestHelper {
  
  /**
   * Setup test database
   */
  static async setupTestDatabase(): Promise<void> {
    try {
      // Ensure test database is clean
      await this.cleanDatabase();
      
      // Run migrations
      // This would typically run migration files
      logger.info('Test database setup completed');
    } catch (error) {
      logger.error('Test database setup failed:', error);
      throw error;
    }
  }

  /**
   * Clean test database
   */
  static async cleanDatabase(): Promise<void> {
    try {
      // Get all tables
      const tables = await db.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
        AND tablename != 'information_schema'
      `);

      // Truncate all tables
      for (const table of tables) {
        await db.query(`TRUNCATE TABLE ${table.tablename} RESTART IDENTITY CASCADE`);
      }

    } catch (error) {
      // Ignore errors if tables don't exist
      logger.debug('Database clean error (likely tables do not exist):', error);
    }
  }

  /**
   * Create test user
   */
  static async createTestUser(overrides: any = {}): Promise<any> {
    const defaultUser = {
      email: 'test@example.com',
      password_hash: '$2a$10$rBV2HQ/xAUJzGfGiOm7mD.5L4SqV5rJH9HLqQyIGvO8N7vJOoZBei', // test123
      first_name: 'Test',
      last_name: 'User',
      role: 'user',
      is_verified: true,
      is_active: true
    };

    const userData = { ...defaultUser, ...overrides };

    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, first_name as "firstName", last_name as "lastName", role, is_verified as "isVerified"
    `;

    return await db.queryOne(query, [
      userData.email,
      userData.password_hash,
      userData.first_name,
      userData.last_name,
      userData.role,
      userData.is_verified,
      userData.is_active
    ]);
  }

  /**
   * Create test vessel
   */
  static async createTestVessel(ownerId: string, overrides: any = {}): Promise<any> {
    const defaultVessel = {
      name: 'Test Vessel',
      vessel_type: 'sailboat',
      draft_meters: 1.5,
      length_meters: 10.0,
      beam_meters: 3.0
    };

    const vesselData = { ...defaultVessel, ...overrides };

    const query = `
      INSERT INTO vessels (owner_id, name, vessel_type, draft_meters, length_meters, beam_meters)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, vessel_type as "vesselType", draft_meters as "draftMeters"
    `;

    return await db.queryOne(query, [
      ownerId,
      vesselData.name,
      vesselData.vessel_type,
      vesselData.draft_meters,
      vesselData.length_meters,
      vesselData.beam_meters
    ]);
  }

  /**
   * Create test depth reading
   */
  static async createTestDepthReading(userId: string, vesselId: string, overrides: any = {}): Promise<any> {
    const defaultReading = {
      latitude: 37.8199,
      longitude: -122.4783,
      depth_meters: 15.5,
      vessel_draft: 1.5,
      confidence_score: 'high'
    };

    const readingData = { ...defaultReading, ...overrides };

    const query = `
      INSERT INTO depth_readings (user_id, vessel_id, location, timestamp, depth_meters, vessel_draft, confidence_score)
      VALUES ($1, $2, ST_GeogFromText('POINT($4 $3)'), NOW(), $5, $6, $7)
      RETURNING id, depth_meters as "depthMeters", confidence_score as "confidenceScore"
    `;

    return await db.queryOne(query, [
      userId,
      vesselId,
      readingData.latitude,
      readingData.longitude,
      readingData.depth_meters,
      readingData.vessel_draft,
      readingData.confidence_score
    ]);
  }

  /**
   * Generate test JWT token
   */
  static generateTestToken(userId: string, sessionId: string = 'test-session'): string {
    // This is a mock implementation - in real tests you'd use the actual JWT service
    return Buffer.from(JSON.stringify({
      userId,
      sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    })).toString('base64');
  }

  /**
   * Create test route
   */
  static async createTestRoute(userId: string, vesselId: string, overrides: any = {}): Promise<any> {
    const defaultRoute = {
      name: 'Test Route',
      start_lat: 37.8199,
      start_lng: -122.4783,
      end_lat: 37.7749,
      end_lng: -122.4194,
      total_distance_nm: 5.2,
      is_public: false
    };

    const routeData = { ...defaultRoute, ...overrides };

    const query = `
      INSERT INTO routes (user_id, vessel_id, name, start_point, end_point, total_distance_nm, is_public)
      VALUES ($1, $2, $3, ST_GeogFromText('POINT($5 $4)'), ST_GeogFromText('POINT($7 $6)'), $8, $9)
      RETURNING id, name, total_distance_nm as "totalDistanceNm", is_public as "isPublic"
    `;

    return await db.queryOne(query, [
      userId,
      vesselId,
      routeData.name,
      routeData.start_lat,
      routeData.start_lng,
      routeData.end_lat,
      routeData.end_lng,
      routeData.total_distance_nm,
      routeData.is_public
    ]);
  }

  /**
   * Wait for condition with timeout
   */
  static async waitFor(condition: () => Promise<boolean>, timeoutMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }

  /**
   * Generate random coordinates
   */
  static generateRandomCoordinates(centerLat: number = 37.8, centerLng: number = -122.4, radiusDegrees: number = 0.1): { latitude: number; longitude: number } {
    return {
      latitude: centerLat + (Math.random() - 0.5) * radiusDegrees * 2,
      longitude: centerLng + (Math.random() - 0.5) * radiusDegrees * 2
    };
  }
}

// Global setup
beforeAll(async () => {
  // Connect to test database
  try {
    const dbHealth = await db.healthCheck();
    if (!dbHealth.healthy) {
      throw new Error('Test database not available');
    }
  } catch (error) {
    logger.error('Test database connection failed:', error);
    throw error;
  }

  // Connect to test Redis
  try {
    await redis.connect();
    const redisHealth = await redis.healthCheck();
    if (!redisHealth.healthy) {
      throw new Error('Test Redis not available');
    }
  } catch (error) {
    logger.error('Test Redis connection failed:', error);
    throw error;
  }

  // Setup test database
  await TestHelper.setupTestDatabase();
});

// Global teardown
afterAll(async () => {
  // Clean up test data
  await TestHelper.cleanDatabase();
  
  // Close connections
  await db.close();
  await redis.disconnect();
});

// Clean database before each test
beforeEach(async () => {
  await TestHelper.cleanDatabase();
});

// Export test helper for use in tests
export { TestHelper as testHelper };