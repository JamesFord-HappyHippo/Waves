/**
 * AWS Lambda Handler for Depth Data Processing
 * Uses RDS PostgreSQL with PostGIS for marine depth data
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Pool } from 'pg';
import { z } from 'zod';

// Database connection pool (reused across invocations)
let dbPool: Pool | null = null;

const getDbPool = (): Pool => {
  if (!dbPool) {
    dbPool = new Pool({
      host: process.env.RDS_HOSTNAME,
      port: parseInt(process.env.RDS_PORT || '5432'),
      database: process.env.RDS_DB_NAME,
      user: process.env.RDS_USERNAME,
      password: process.env.RDS_PASSWORD,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return dbPool;
};

// Validation schemas
const DepthQuerySchema = z.object({
  latitude: z.string().transform(Number),
  longitude: z.string().transform(Number),
  radius: z.string().transform(Number).optional().default(1000),
  vesselDraft: z.string().transform(Number).optional(),
  maxAge: z.string().transform(Number).optional().default(30), // days
});

const DepthSubmissionSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  depth: z.number(),
  confidence: z.number().min(0).max(1),
  vesselDraft: z.number().optional(),
  timestamp: z.string().datetime().optional(),
  userId: z.string().uuid(),
});

interface DepthReading {
  id: string;
  latitude: number;
  longitude: number;
  depth: number;
  confidence: number;
  vessel_draft?: number;
  timestamp: string;
  user_id: string;
  distance_meters?: number;
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
 * Get depth readings for a specific location
 */
export const getDepthReadings = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse and validate query parameters
    const queryParams = DepthQuerySchema.parse(event.queryStringParameters || {});
    
    const pool = getDbPool();
    const client = await pool.connect();
    
    try {
      // PostGIS query to find depth readings within radius
      const query = `
        SELECT 
          id,
          latitude,
          longitude,
          depth,
          confidence,
          vessel_draft,
          timestamp,
          user_id,
          ST_Distance(
            ST_Point(longitude, latitude)::geography,
            ST_Point($2, $1)::geography
          ) as distance_meters
        FROM depth_readings 
        WHERE 
          ST_DWithin(
            ST_Point(longitude, latitude)::geography,
            ST_Point($2, $1)::geography,
            $3
          )
          AND timestamp > NOW() - INTERVAL '${queryParams.maxAge} days'
          ${queryParams.vesselDraft ? 'AND (vessel_draft IS NULL OR vessel_draft >= $4)' : ''}
          AND confidence > 0.5
        ORDER BY distance_meters ASC, confidence DESC
        LIMIT 100
      `;
      
      const params = [
        queryParams.latitude,
        queryParams.longitude,
        queryParams.radius,
        ...(queryParams.vesselDraft ? [queryParams.vesselDraft] : [])
      ];
      
      const result = await client.query(query, params);
      const depthReadings: DepthReading[] = result.rows;
      
      return createSuccessResponse({
        readings: depthReadings,
        query: {
          location: { latitude: queryParams.latitude, longitude: queryParams.longitude },
          radius: queryParams.radius,
          vesselDraft: queryParams.vesselDraft,
          maxAge: queryParams.maxAge,
        },
        safety_notice: "Always verify depth readings with your depth sounder. Crowdsourced data may be inaccurate.",
        count: depthReadings.length,
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error getting depth readings:', error);
    
    if (error instanceof z.ZodError) {
      return createErrorResponse(400, 'Invalid query parameters', error.errors);
    }
    
    return createErrorResponse(500, 'Internal server error', {
      message: error.message,
      requestId: context.awsRequestId,
    });
  }
};

/**
 * Submit new depth reading
 */
export const submitDepthReading = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required');
    }
    
    // Parse and validate request body
    const data = DepthSubmissionSchema.parse(JSON.parse(event.body));
    
    const pool = getDbPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert depth reading with PostGIS point
      const insertQuery = `
        INSERT INTO depth_readings (
          id,
          latitude,
          longitude,
          location,
          depth,
          confidence,
          vessel_draft,
          timestamp,
          user_id,
          created_at
        ) VALUES (
          gen_random_uuid(),
          $1,
          $2,
          ST_Point($2, $1),
          $3,
          $4,
          $5,
          $6,
          $7,
          NOW()
        )
        RETURNING id, timestamp, created_at
      `;
      
      const params = [
        data.latitude,
        data.longitude,
        data.depth,
        data.confidence,
        data.vesselDraft,
        data.timestamp ? new Date(data.timestamp) : new Date(),
        data.userId,
      ];
      
      const result = await client.query(insertQuery, params);
      const inserted = result.rows[0];
      
      // Update user contribution stats
      await client.query(`
        INSERT INTO user_contributions (user_id, depth_readings_count, last_contribution)
        VALUES ($1, 1, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          depth_readings_count = user_contributions.depth_readings_count + 1,
          last_contribution = NOW()
      `, [data.userId]);
      
      await client.query('COMMIT');
      
      return createSuccessResponse({
        id: inserted.id,
        submittedAt: inserted.created_at,
        location: { latitude: data.latitude, longitude: data.longitude },
        depth: data.depth,
        confidence: data.confidence,
        safety_notice: "Thank you for contributing to marine safety. Your data will be validated before publication.",
      }, 'Depth reading submitted successfully');
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error submitting depth reading:', error);
    
    if (error instanceof z.ZodError) {
      return createErrorResponse(400, 'Invalid depth reading data', error.errors);
    }
    
    return createErrorResponse(500, 'Internal server error', {
      message: error.message,
      requestId: context.awsRequestId,
    });
  }
};

/**
 * Get depth statistics for an area
 */
export const getDepthStatistics = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const queryParams = DepthQuerySchema.parse(event.queryStringParameters || {});
    
    const pool = getDbPool();
    const client = await pool.connect();
    
    try {
      // PostGIS aggregation query for depth statistics
      const query = `
        SELECT 
          COUNT(*) as total_readings,
          AVG(depth) as average_depth,
          MIN(depth) as min_depth,
          MAX(depth) as max_depth,
          AVG(confidence) as average_confidence,
          COUNT(DISTINCT user_id) as unique_contributors,
          ST_AsGeoJSON(ST_Centroid(ST_Collect(location))) as center_point
        FROM depth_readings 
        WHERE 
          ST_DWithin(
            location::geography,
            ST_Point($2, $1)::geography,
            $3
          )
          AND timestamp > NOW() - INTERVAL '${queryParams.maxAge} days'
          AND confidence > 0.5
      `;
      
      const params = [
        queryParams.latitude,
        queryParams.longitude,
        queryParams.radius,
      ];
      
      const result = await client.query(query, params);
      const stats = result.rows[0];
      
      return createSuccessResponse({
        statistics: {
          totalReadings: parseInt(stats.total_readings),
          averageDepth: parseFloat(stats.average_depth),
          minDepth: parseFloat(stats.min_depth),
          maxDepth: parseFloat(stats.max_depth),
          averageConfidence: parseFloat(stats.average_confidence),
          uniqueContributors: parseInt(stats.unique_contributors),
          centerPoint: stats.center_point ? JSON.parse(stats.center_point) : null,
        },
        query: {
          location: { latitude: queryParams.latitude, longitude: queryParams.longitude },
          radius: queryParams.radius,
          maxAge: queryParams.maxAge,
        },
        safety_notice: "Statistics are based on crowdsourced data and should not be used as the sole source for navigation decisions.",
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error getting depth statistics:', error);
    
    if (error instanceof z.ZodError) {
      return createErrorResponse(400, 'Invalid query parameters', error.errors);
    }
    
    return createErrorResponse(500, 'Internal server error', {
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