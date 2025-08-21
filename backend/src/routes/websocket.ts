// WebSocket Handlers
// Real-time navigation updates and live tracking

import { FastifyInstance, FastifyRequest } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { redis } from '../config/redis';
import { db } from '../config/database';
import { 
  WebSocketMessage, 
  LocationUpdateMessage, 
  DepthAlertMessage, 
  User, 
  Point 
} from '../types';
import { TokenManager } from '../middleware/auth';
import logger from '../utils/logger';
import config from '../config';

interface AuthenticatedSocketRequest extends FastifyRequest {
  user?: User;
  vesselId?: string;
}

interface ConnectedClient {
  userId: string;
  vesselId?: string;
  socket: SocketStream;
  subscriptions: Set<string>;
  lastActivity: Date;
}

// Active WebSocket connections
const activeConnections = new Map<string, ConnectedClient>();

export default async function websocketHandler(fastify: FastifyInstance) {

  /**
   * Real-time Navigation Updates
   * WS /ws/navigation
   */
  fastify.register(async function (fastify) {
    fastify.get('/navigation', { websocket: true }, async (connection: SocketStream, request: AuthenticatedSocketRequest) => {
      try {
        // Authenticate WebSocket connection
        const user = await authenticateWebSocket(request);
        if (!user) {
          connection.socket.close(1008, 'Authentication required');
          return;
        }

        const clientId = `${user.id}_${Date.now()}`;
        const client: ConnectedClient = {
          userId: user.id,
          socket: connection,
          subscriptions: new Set(),
          lastActivity: new Date()
        };

        activeConnections.set(clientId, client);

        logger.info('WebSocket navigation connection established', {
          userId: user.id,
          clientId,
          totalConnections: activeConnections.size
        });

        // Send welcome message
        sendMessage(connection, {
          type: 'navigation_update',
          data: {
            connected: true,
            userId: user.id,
            features: ['location_tracking', 'depth_alerts', 'weather_updates', 'safety_alerts']
          },
          timestamp: new Date()
        });

        // Handle incoming messages
        connection.socket.on('message', async (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());
            await handleNavigationMessage(client, data, request);
          } catch (error) {
            logger.error('Error handling navigation message:', error);
            sendError(connection, 'Invalid message format');
          }
        });

        // Handle connection close
        connection.socket.on('close', () => {
          activeConnections.delete(clientId);
          logger.info('WebSocket navigation connection closed', {
            userId: user.id,
            clientId,
            totalConnections: activeConnections.size
          });
        });

        // Handle errors
        connection.socket.on('error', (error) => {
          logger.error('WebSocket navigation error:', error);
          activeConnections.delete(clientId);
        });

      } catch (error) {
        logger.error('WebSocket navigation setup error:', error);
        connection.socket.close(1011, 'Server error');
      }
    });
  });

  /**
   * Live Location Tracking
   * WS /ws/location
   */
  fastify.register(async function (fastify) {
    fastify.get('/location', { websocket: true }, async (connection: SocketStream, request: AuthenticatedSocketRequest) => {
      try {
        const user = await authenticateWebSocket(request);
        if (!user) {
          connection.socket.close(1008, 'Authentication required');
          return;
        }

        const clientId = `loc_${user.id}_${Date.now()}`;
        const client: ConnectedClient = {
          userId: user.id,
          socket: connection,
          subscriptions: new Set(),
          lastActivity: new Date()
        };

        activeConnections.set(clientId, client);

        logger.info('WebSocket location connection established', {
          userId: user.id,
          clientId
        });

        // Handle location updates
        connection.socket.on('message', async (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());
            await handleLocationUpdate(client, data);
          } catch (error) {
            logger.error('Error handling location update:', error);
            sendError(connection, 'Invalid location data');
          }
        });

        connection.socket.on('close', () => {
          activeConnections.delete(clientId);
          // Remove vessel from active tracking
          if (client.vesselId) {
            redis.client.geoRem('active_vessels', client.vesselId);
          }
        });

      } catch (error) {
        logger.error('WebSocket location setup error:', error);
        connection.socket.close(1011, 'Server error');
      }
    });
  });

  /**
   * Safety Alerts Channel
   * WS /ws/alerts
   */
  fastify.register(async function (fastify) {
    fastify.get('/alerts', { websocket: true }, async (connection: SocketStream, request: AuthenticatedSocketRequest) => {
      try {
        const user = await authenticateWebSocket(request);
        if (!user) {
          connection.socket.close(1008, 'Authentication required');
          return;
        }

        const clientId = `alert_${user.id}_${Date.now()}`;
        const client: ConnectedClient = {
          userId: user.id,
          socket: connection,
          subscriptions: new Set(['safety_alerts']),
          lastActivity: new Date()
        };

        activeConnections.set(clientId, client);

        // Subscribe to safety alerts
        await subscribeToSafetyAlerts(client);

        connection.socket.on('close', () => {
          activeConnections.delete(clientId);
        });

      } catch (error) {
        logger.error('WebSocket alerts setup error:', error);
        connection.socket.close(1011, 'Server error');
      }
    });
  });
}

// Helper Functions

/**
 * Authenticate WebSocket connection using token
 */
async function authenticateWebSocket(request: AuthenticatedSocketRequest): Promise<User | null> {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '') || 
                  request.query?.token as string;

    if (!token) {
      return null;
    }

    // Verify JWT token
    const decoded = request.server.jwt.verify(token) as any;
    
    // Get user from database
    const userQuery = `
      SELECT 
        id, email, first_name as "firstName", last_name as "lastName",
        role, is_verified as "isVerified", is_active as "isActive"
      FROM users 
      WHERE id = $1 AND is_active = true
    `;

    const user = await db.queryOne<User>(userQuery, [decoded.userId]);
    return user;

  } catch (error) {
    logger.warn('WebSocket authentication failed:', error);
    return null;
  }
}

/**
 * Handle navigation-related messages
 */
async function handleNavigationMessage(
  client: ConnectedClient, 
  message: any, 
  request: AuthenticatedSocketRequest
): Promise<void> {
  const { type, data } = message;

  switch (type) {
    case 'subscribe_vessel':
      await handleVesselSubscription(client, data.vesselId);
      break;

    case 'location_update':
      await handleLocationUpdate(client, data);
      break;

    case 'request_nearby_vessels':
      await handleNearbyVesselsRequest(client, data);
      break;

    case 'depth_reading':
      await handleDepthReading(client, data);
      break;

    case 'ping':
      client.lastActivity = new Date();
      sendMessage(client.socket, {
        type: 'pong',
        data: { timestamp: new Date() },
        timestamp: new Date()
      });
      break;

    default:
      logger.warn('Unknown navigation message type:', type);
      sendError(client.socket, 'Unknown message type');
  }
}

/**
 * Handle vessel subscription for tracking
 */
async function handleVesselSubscription(client: ConnectedClient, vesselId: string): Promise<void> {
  try {
    // Verify vessel belongs to user
    const vesselQuery = `
      SELECT id, name, draft_meters FROM vessels 
      WHERE id = $1 AND owner_id = $2 AND is_active = true
    `;
    
    const vessel = await db.queryOne(vesselQuery, [vesselId, client.userId]);

    if (!vessel) {
      sendError(client.socket, 'Invalid vessel or access denied');
      return;
    }

    client.vesselId = vesselId;
    client.subscriptions.add(`vessel_${vesselId}`);

    sendMessage(client.socket, {
      type: 'navigation_update',
      data: {
        subscribed: true,
        vesselId,
        vesselName: vessel.name,
        vesselDraft: vessel.draft_meters
      },
      timestamp: new Date()
    });

    logger.info('Vessel subscription established', {
      userId: client.userId,
      vesselId,
      vesselName: vessel.name
    });

  } catch (error) {
    logger.error('Error handling vessel subscription:', error);
    sendError(client.socket, 'Failed to subscribe to vessel');
  }
}

/**
 * Handle real-time location updates
 */
async function handleLocationUpdate(client: ConnectedClient, locationData: any): Promise<void> {
  try {
    if (!client.vesselId) {
      sendError(client.socket, 'No vessel selected for location tracking');
      return;
    }

    const { latitude, longitude, speedKnots, headingDegrees, timestamp } = locationData;

    // Validate location data
    if (!latitude || !longitude || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      sendError(client.socket, 'Invalid location coordinates');
      return;
    }

    // Store location in Redis for real-time tracking
    await redis.setVesselLocation(client.vesselId, {
      latitude,
      longitude,
      speedKnots: speedKnots || 0,
      headingDegrees: headingDegrees || 0,
      userId: client.userId,
      timestamp: timestamp || new Date()
    });

    // Update Redis geospatial index for nearby vessel queries
    await redis.setVesselGeoLocation(client.vesselId, longitude, latitude);

    // Store in database for historical tracking
    const gpsQuery = `
      INSERT INTO gps_tracks (
        user_id, vessel_id, location, timestamp, speed_knots, heading_degrees
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await db.query(gpsQuery, [
      client.userId,
      client.vesselId,
      db.createPoint(latitude, longitude),
      timestamp || new Date(),
      speedKnots || null,
      headingDegrees || null
    ]);

    // Check for shallow water alerts
    await checkShallowWaterAlert(client, { latitude, longitude });

    // Broadcast location to subscribers (if sharing enabled)
    await broadcastLocationUpdate(client, locationData);

    client.lastActivity = new Date();

  } catch (error) {
    logger.error('Error handling location update:', error);
    sendError(client.socket, 'Failed to process location update');
  }
}

/**
 * Handle nearby vessels request
 */
async function handleNearbyVesselsRequest(client: ConnectedClient, data: any): Promise<void> {
  try {
    const { latitude, longitude, radiusKm = 5 } = data;

    if (!latitude || !longitude) {
      sendError(client.socket, 'Location required for nearby vessels query');
      return;
    }

    // Get nearby vessels from Redis
    const nearbyVessels = await redis.getNearbyVessels(longitude, latitude, radiusKm);

    // Filter out vessels with private sharing settings
    const publicVessels = [];
    for (const vessel of nearbyVessels) {
      const privacyQuery = `
        SELECT u.privacy_settings 
        FROM users u 
        JOIN vessels v ON u.id = v.owner_id 
        WHERE v.id = $1
      `;
      
      const user = await db.queryOne(privacyQuery, [vessel.vesselId]);
      
      if (user?.privacy_settings?.shareTracks) {
        publicVessels.push({
          vesselId: vessel.vesselId,
          distance: vessel.distance,
          coordinates: vessel.coordinates
        });
      }
    }

    sendMessage(client.socket, {
      type: 'nearby_vessels',
      data: {
        vessels: publicVessels,
        searchLocation: { latitude, longitude },
        radiusKm,
        timestamp: new Date()
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error handling nearby vessels request:', error);
    sendError(client.socket, 'Failed to get nearby vessels');
  }
}

/**
 * Handle real-time depth reading
 */
async function handleDepthReading(client: ConnectedClient, depthData: any): Promise<void> {
  try {
    if (!client.vesselId) {
      sendError(client.socket, 'No vessel selected for depth reading');
      return;
    }

    const { latitude, longitude, depthMeters } = depthData;

    // Basic validation
    if (!latitude || !longitude || !depthMeters || depthMeters <= 0) {
      sendError(client.socket, 'Invalid depth reading data');
      return;
    }

    // Get vessel draft for safety calculations
    const vesselQuery = `SELECT draft_meters FROM vessels WHERE id = $1`;
    const vessel = await db.queryOne(vesselQuery, [client.vesselId]);

    if (!vessel) {
      sendError(client.socket, 'Vessel not found');
      return;
    }

    // Check for safety concerns
    const clearance = depthMeters - vessel.draft_meters;
    const safetyMargin = config.safety.safetyMarginMeters;

    if (clearance < safetyMargin) {
      const severity = clearance <= 0 ? 'critical' : 'warning';
      
      sendMessage(client.socket, {
        type: 'depth_alert',
        data: {
          location: { latitude, longitude },
          currentDepth: depthMeters,
          vesselDraft: vessel.draft_meters,
          clearance,
          safetyMargin,
          severity,
          message: severity === 'critical' 
            ? 'CRITICAL: Grounding risk detected!' 
            : 'WARNING: Shallow water detected'
        },
        timestamp: new Date()
      } as DepthAlertMessage);

      // Broadcast safety alert to nearby vessels
      await broadcastSafetyAlert({
        type: 'shallow_water',
        location: { latitude, longitude },
        depthMeters,
        severity,
        timestamp: new Date()
      });
    }

    sendMessage(client.socket, {
      type: 'depth_reading_processed',
      data: {
        location: { latitude, longitude },
        depthMeters,
        clearance,
        status: clearance >= safetyMargin ? 'safe' : 'caution'
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error handling depth reading:', error);
    sendError(client.socket, 'Failed to process depth reading');
  }
}

/**
 * Check for shallow water alerts
 */
async function checkShallowWaterAlert(client: ConnectedClient, location: Point): Promise<void> {
  try {
    // Get nearby depth readings
    const depthQuery = `
      SELECT depth_meters, confidence_score
      FROM depth_readings
      WHERE ST_DWithin(location, $1, 500)  -- 500m radius
      AND timestamp > NOW() - INTERVAL '30 days'
      AND confidence_score IN ('high', 'verified')
      ORDER BY ST_Distance(location, $1)
      LIMIT 5
    `;

    const nearbyDepths = await db.query(depthQuery, [
      db.createPoint(location.latitude, location.longitude)
    ]);

    if (nearbyDepths.length === 0) return;

    // Get vessel draft
    const vesselQuery = `SELECT draft_meters FROM vessels WHERE id = $1`;
    const vessel = await db.queryOne(vesselQuery, [client.vesselId]);

    if (!vessel) return;

    // Check for concerning depths
    const shallowReadings = nearbyDepths.filter(d => 
      d.depth_meters < (vessel.draft_meters + config.safety.safetyMarginMeters * 2)
    );

    if (shallowReadings.length > 0) {
      const minDepth = Math.min(...shallowReadings.map(d => d.depth_meters));
      
      sendMessage(client.socket, {
        type: 'depth_alert',
        data: {
          location,
          nearbyMinDepth: minDepth,
          vesselDraft: vessel.draft_meters,
          severity: minDepth < vessel.draft_meters ? 'critical' : 'warning',
          message: `Shallow water area detected. Minimum nearby depth: ${minDepth}m`
        },
        timestamp: new Date()
      } as DepthAlertMessage);
    }

  } catch (error) {
    logger.error('Error checking shallow water alert:', error);
  }
}

/**
 * Broadcast location update to subscribers
 */
async function broadcastLocationUpdate(client: ConnectedClient, locationData: any): Promise<void> {
  try {
    // Check user's privacy settings
    const privacyQuery = `SELECT privacy_settings FROM users WHERE id = $1`;
    const user = await db.queryOne(privacyQuery, [client.userId]);

    if (!user?.privacy_settings?.shareTracks) {
      return; // User has disabled track sharing
    }

    const message: LocationUpdateMessage = {
      type: 'location_update',
      data: {
        userId: client.userId,
        vesselId: client.vesselId!,
        location: {
          latitude: locationData.latitude,
          longitude: locationData.longitude
        },
        speedKnots: locationData.speedKnots,
        headingDegrees: locationData.headingDegrees,
        timestamp: new Date()
      },
      timestamp: new Date()
    };

    // Publish to Redis for other services
    await redis.publishLocationUpdate(client.vesselId!, message.data);

  } catch (error) {
    logger.error('Error broadcasting location update:', error);
  }
}

/**
 * Broadcast safety alert to all connections
 */
async function broadcastSafetyAlert(alertData: any): Promise<void> {
  try {
    const alert = {
      type: 'safety_alert',
      data: alertData,
      timestamp: new Date()
    };

    // Send to all connected clients subscribed to safety alerts
    for (const [clientId, client] of activeConnections.entries()) {
      if (client.subscriptions.has('safety_alerts')) {
        sendMessage(client.socket, alert);
      }
    }

    // Publish to Redis for other instances
    await redis.publishSafetyAlert(alertData);

  } catch (error) {
    logger.error('Error broadcasting safety alert:', error);
  }
}

/**
 * Subscribe to safety alerts
 */
async function subscribeToSafetyAlerts(client: ConnectedClient): Promise<void> {
  try {
    // Send recent safety alerts in the area if location is available
    // This would be implemented based on user's last known location
    
    sendMessage(client.socket, {
      type: 'alert_subscription',
      data: {
        subscribed: true,
        types: ['shallow_water', 'weather_warning', 'navigation_hazard']
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error subscribing to safety alerts:', error);
  }
}

/**
 * Send message to WebSocket client
 */
function sendMessage(socket: SocketStream, message: WebSocketMessage): void {
  try {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  } catch (error) {
    logger.error('Error sending WebSocket message:', error);
  }
}

/**
 * Send error message to WebSocket client
 */
function sendError(socket: SocketStream, errorMessage: string): void {
  sendMessage(socket, {
    type: 'error',
    data: { message: errorMessage },
    timestamp: new Date()
  });
}

// Cleanup inactive connections periodically
setInterval(() => {
  const now = new Date();
  const timeout = 5 * 60 * 1000; // 5 minutes

  for (const [clientId, client] of activeConnections.entries()) {
    if (now.getTime() - client.lastActivity.getTime() > timeout) {
      client.socket.close(1000, 'Connection timeout');
      activeConnections.delete(clientId);
      
      logger.info('Cleaned up inactive WebSocket connection', {
        clientId,
        userId: client.userId,
        inactiveFor: now.getTime() - client.lastActivity.getTime()
      });
    }
  }
}, 60000); // Check every minute