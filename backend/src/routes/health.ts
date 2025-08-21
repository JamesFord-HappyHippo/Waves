// Health Check Routes
// System status and monitoring endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../config/database';
import { redis } from '../config/redis';
import config from '../config';

export default async function healthRoutes(fastify: FastifyInstance) {
  
  /**
   * Basic Health Check
   * GET /api/health
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      success: true,
      status: 'healthy',
      timestamp: new Date(),
      service: 'waves-backend',
      version: '1.0.0',
      environment: config.server.environment
    });
  });

  /**
   * Detailed Health Check
   * GET /api/health/detailed
   */
  fastify.get('/detailed', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const startTime = Date.now();

      // Check database health
      const dbHealth = await db.healthCheck();
      
      // Check Redis health
      const redisHealth = await redis.healthCheck();

      const responseTime = Date.now() - startTime;
      const overall = dbHealth.healthy && redisHealth.healthy;

      const healthCheck = {
        success: true,
        status: overall ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        responseTime: `${responseTime}ms`,
        service: 'waves-backend',
        version: '1.0.0',
        environment: config.server.environment,
        checks: {
          database: {
            status: dbHealth.healthy ? 'healthy' : 'unhealthy',
            details: dbHealth.details
          },
          redis: {
            status: redisHealth.healthy ? 'healthy' : 'unhealthy',
            details: redisHealth.details
          }
        }
      };

      reply.status(overall ? 200 : 503).send(healthCheck);

    } catch (error) {
      reply.status(503).send({
        success: false,
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      });
    }
  });

  /**
   * Database Health Check
   * GET /api/health/database
   */
  fastify.get('/database', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dbHealth = await db.healthCheck();
      
      reply.status(dbHealth.healthy ? 200 : 503).send({
        success: dbHealth.healthy,
        status: dbHealth.healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        details: dbHealth.details
      });

    } catch (error) {
      reply.status(503).send({
        success: false,
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      });
    }
  });

  /**
   * Redis Health Check
   * GET /api/health/redis
   */
  fastify.get('/redis', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const redisHealth = await redis.healthCheck();
      
      reply.status(redisHealth.healthy ? 200 : 503).send({
        success: redisHealth.healthy,
        status: redisHealth.healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        details: redisHealth.details
      });

    } catch (error) {
      reply.status(503).send({
        success: false,
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      });
    }
  });

  /**
   * System Information
   * GET /api/health/info
   */
  fastify.get('/info', async (request: FastifyRequest, reply: FastifyReply) => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    reply.send({
      success: true,
      timestamp: new Date(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: `${Math.floor(uptime)}s`,
        memory: {
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
        }
      },
      service: {
        name: 'waves-backend',
        version: '1.0.0',
        environment: config.server.environment,
        port: config.server.port,
        host: config.server.host
      }
    });
  });
}