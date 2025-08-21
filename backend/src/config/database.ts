/**
 * Database Configuration for Waves Marine Navigation
 * PostGIS-enabled PostgreSQL with optimized marine data support
 */

import { FastifyInstance } from 'fastify';
import fastifyPostgres from '@fastify/postgres';
import { Pool, PoolConfig } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export const config: DatabaseConfig = {
  host: process.env.RDS_HOSTNAME || process.env.DB_HOST || 'waves-production.cluster-xyz.us-east-1.rds.amazonaws.com',
  port: parseInt(process.env.RDS_PORT || process.env.DB_PORT || '5432'),
  database: process.env.RDS_DB_NAME || process.env.DB_NAME || 'waves_production',
  username: process.env.RDS_USERNAME || process.env.DB_USER || 'waves_admin',
  password: process.env.RDS_PASSWORD || process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true',
  max: parseInt(process.env.DB_POOL_SIZE || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
};

/**
 * Connect to PostgreSQL database with PostGIS extensions
 */
export const connectDatabase = async (fastify: FastifyInstance): Promise<void> => {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
  };

  if (config.ssl) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }

  await fastify.register(fastifyPostgres, {
    connectionString: buildConnectionString(),
    pool: poolConfig,
  });

  // Verify PostGIS extension
  try {
    const result = await fastify.pg.query('SELECT PostGIS_Version()');
    fastify.log.info(`Connected to PostgreSQL with PostGIS version: ${result.rows[0].postgis_version}`);
  } catch (error) {
    fastify.log.error('PostGIS extension not available:', error);
    throw new Error('PostGIS extension is required for marine navigation features');
  }

  // Setup connection pool monitoring
  const pool = new Pool(poolConfig);
  
  pool.on('connect', (client) => {
    fastify.log.debug('New database client connected');
  });

  pool.on('error', (err, client) => {
    fastify.log.error('Database pool error:', err);
  });

  pool.on('remove', (client) => {
    fastify.log.debug('Database client removed from pool');
  });
};

/**
 * Build connection string from config
 */
const buildConnectionString = (): string => {
  const ssl = config.ssl ? '?sslmode=require' : '';
  return `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}${ssl}`;
};

/**
 * Execute raw SQL query with proper error handling
 */
export const executeQuery = async (
  fastify: FastifyInstance,
  query: string,
  params?: any[]
): Promise<any> => {
  try {
    const client = await fastify.pg.connect();
    const result = await client.query(query, params);
    client.release();
    return result;
  } catch (error) {
    fastify.log.error('Database query error:', error);
    throw error;
  }
};

/**
 * Execute spatial query with PostGIS functions
 */
export const executeSpatialQuery = async (
  fastify: FastifyInstance,
  query: string,
  params?: any[]
): Promise<any> => {
  try {
    const client = await fastify.pg.connect();
    
    // Set spatial reference system context
    await client.query('SET search_path TO public, postgis;');
    
    const result = await client.query(query, params);
    client.release();
    
    return result;
  } catch (error) {
    fastify.log.error('Spatial query error:', error);
    throw error;
  }
};

/**
 * Begin database transaction
 */
export const beginTransaction = async (fastify: FastifyInstance) => {
  const client = await fastify.pg.connect();
  await client.query('BEGIN');
  return client;
};

/**
 * Commit database transaction
 */
export const commitTransaction = async (client: any) => {
  await client.query('COMMIT');
  client.release();
};

/**
 * Rollback database transaction
 */
export const rollbackTransaction = async (client: any) => {
  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
};

/**
 * Health check for database connection
 */
export const checkDatabaseHealth = async (fastify: FastifyInstance): Promise<{
  status: 'healthy' | 'unhealthy';
  details: any;
}> => {
  try {
    const startTime = Date.now();
    
    // Test basic connectivity
    const basicResult = await fastify.pg.query('SELECT NOW() as server_time');
    
    // Test PostGIS functionality
    const spatialResult = await fastify.pg.query(
      'SELECT ST_AsText(ST_Point(-122.4194, 37.7749)) as test_point'
    );
    
    // Check connection pool status
    const poolStatus = {
      totalCount: fastify.pg.pool?.totalCount || 0,
      idleCount: fastify.pg.pool?.idleCount || 0,
      waitingCount: fastify.pg.pool?.waitingCount || 0,
    };
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      details: {
        serverTime: basicResult.rows[0].server_time,
        spatialTest: spatialResult.rows[0].test_point,
        responseTime: `${responseTime}ms`,
        poolStatus,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/**
 * Initialize database schema and extensions
 */
export const initializeDatabase = async (fastify: FastifyInstance): Promise<void> => {
  const client = await fastify.pg.connect();
  
  try {
    await client.query('BEGIN');
    
    // Enable PostGIS extension
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis_topology;');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // Set up spatial reference systems commonly used in marine navigation
    await client.query(`
      INSERT INTO spatial_ref_sys (srid, auth_name, auth_srid, proj4text, srtext)
      VALUES (
        3857,
        'EPSG',
        3857,
        '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs',
        'PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["X",EAST],AXIS["Y",NORTH],EXTENSION["PROJ4","+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs"],AUTHORITY["EPSG","3857"]]'
      )
      ON CONFLICT (srid) DO NOTHING;
    `);
    
    await client.query('COMMIT');
    fastify.log.info('Database initialization completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    fastify.log.error('Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
};