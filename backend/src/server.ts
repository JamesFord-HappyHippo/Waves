/**
 * Waves Marine Navigation Backend Server
 * High-performance Fastify server with PostGIS geospatial processing
 */

import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import redis from '@fastify/redis';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';

import { config } from './config/database';
import { connectDatabase } from './config/database';
import { setupLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Route imports
import depthRoutes from './routes/depth';
import weatherRoutes from './routes/weather';
import tideRoutes from './routes/tides';
import userRoutes from './routes/users';
import emergencyRoutes from './routes/emergency';
import syncRoutes from './routes/sync';

const logger = setupLogger();

const buildServer = () => {
  const server = fastify({
    logger,
    bodyLimit: 1048576, // 1MB
    keepAliveTimeout: 30000,
    connectionTimeout: 30000,
  });

  // Register plugins
  const registerPlugins = async () => {
    // Security
    await server.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    });

    // CORS
    await server.register(cors, {
      origin: (origin, callback) => {
        const hostname = new URL(origin).hostname;
        // Allow localhost for development and production domains
        if (hostname === 'localhost' || hostname === 'wavesapp.com' || hostname.endsWith('.wavesapp.com')) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed'), false);
      },
      credentials: true,
    });

    // Rate limiting
    await server.register(rateLimit, {
      max: 1000, // 1000 requests
      timeWindow: '15 minutes',
      redis: server.redis,
    });

    // JWT authentication
    await server.register(jwt, {
      secret: process.env.JWT_SECRET || 'supersecret-change-in-production',
      sign: {
        expiresIn: '7d',
      },
    });

    // Redis connection
    await server.register(redis, {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      connectTimeout: 10000,
      lazyConnect: true,
    });

    // WebSocket support
    await server.register(websocket);

    // Static file serving
    await server.register(staticFiles, {
      root: path.join(__dirname, '../public'),
      prefix: '/public/',
    });
  };

  // Register middleware
  const registerMiddleware = async () => {
    // Error handling
    server.setErrorHandler(errorHandler);

    // Authentication middleware
    server.register(async (fastify) => {
      await fastify.register(authMiddleware);
    });
  };

  // Register routes
  const registerRoutes = async () => {
    // Health check
    server.get('/health', async (request, reply) => {
      const healthcheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
      };
      
      try {
        // Check database connection
        await server.pg.query('SELECT 1');
        healthcheck.database = 'connected';
      } catch (error) {
        healthcheck.database = 'disconnected';
        return reply.status(503).send(healthcheck);
      }

      try {
        // Check Redis connection
        await server.redis.ping();
        healthcheck.redis = 'connected';
      } catch (error) {
        healthcheck.redis = 'disconnected';
      }

      return reply.status(200).send(healthcheck);
    });

    // API routes
    await server.register(depthRoutes, { prefix: '/api/v1/depth' });
    await server.register(weatherRoutes, { prefix: '/api/v1/weather' });
    await server.register(tideRoutes, { prefix: '/api/v1/tides' });
    await server.register(userRoutes, { prefix: '/api/v1/users' });
    await server.register(emergencyRoutes, { prefix: '/api/v1/emergency' });
    await server.register(syncRoutes, { prefix: '/api/v1/sync' });

    // WebSocket routes
    server.register(async function (fastify) {
      fastify.get('/ws/live-depth', { websocket: true }, (connection, request) => {
        connection.socket.on('message', (message) => {
          // Handle real-time depth data streaming
          const data = JSON.parse(message.toString());
          
          if (data.type === 'subscribe_location') {
            // Subscribe to depth updates for a specific location
            const { latitude, longitude, radius } = data;
            
            // Store subscription in Redis for this connection
            server.redis.set(
              `subscription:${connection.socket.id}`,
              JSON.stringify({ latitude, longitude, radius }),
              'EX',
              3600 // 1 hour expiration
            );
          }
        });

        connection.socket.on('close', () => {
          // Clean up subscription
          server.redis.del(`subscription:${connection.socket.id}`);
        });
      });
    });
  };

  // Initialize server
  const initializeServer = async () => {
    try {
      await registerPlugins();
      await connectDatabase(server);
      await registerMiddleware();
      await registerRoutes();

      logger.info('Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      throw error;
    }
  };

  return { server, initializeServer };
};

const startServer = async () => {
  const { server, initializeServer } = buildServer();

  try {
    await initializeServer();

    const port = parseInt(process.env.PORT || '8080');
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({
      port,
      host,
    });

    logger.info(`🌊 Waves API Server running on http://${host}:${port}`);
    logger.info(`🏥 Health check available at http://${host}:${port}/health`);
    logger.info(`📚 API docs available at http://${host}:${port}/docs`);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, closing server...`);
        await server.close();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
};

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

export { buildServer, startServer };