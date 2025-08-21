// API Integration Tests
// Test complete API endpoints with authentication

import { FastifyInstance } from 'fastify';
import WavesServer from '../../src/server';
import { testHelper } from '../setup';
import supertest from 'supertest';

describe('API Integration Tests', () => {
  let app: FastifyInstance;
  let request: supertest.SuperTest<supertest.Test>;
  let testUser: any;
  let testVessel: any;
  let authToken: string;

  beforeAll(async () => {
    // Create server instance
    const server = new WavesServer();
    app = server.getFastifyInstance();
    await app.ready();
    
    // Create supertest instance
    request = supertest(app.server);
  });

  beforeEach(async () => {
    // Create test user and vessel
    testUser = await testHelper.createTestUser({
      email: 'api.test@example.com',
      role: 'captain' // For testing admin endpoints
    });
    
    testVessel = await testHelper.createTestVessel(testUser.id);
    
    // Get auth token (simplified for testing)
    authToken = testHelper.generateTestToken(testUser.id);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    test('GET /api/health should return health status', async () => {
      const response = await request
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: 'healthy',
        service: 'waves-backend',
        version: '1.0.0'
      });
    });

    test('GET /api/health/detailed should return detailed health', async () => {
      const response = await request
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: expect.any(String),
        checks: {
          database: expect.objectContaining({
            status: expect.any(String)
          }),
          redis: expect.objectContaining({
            status: expect.any(String)
          })
        }
      });
    });
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/register should create new user', async () => {
      const userData = {
        email: 'register.test@example.com',
        password: process.env.TEST_PASSWORD || 'TestPassword123',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: 'user'
          },
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresIn: expect.any(Number)
          }
        }
      });
    });

    test('POST /api/auth/register should reject invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: process.env.TEST_PASSWORD || 'TestPassword123'
      };

      const response = await request
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'VALIDATION_ERROR'
      });
    });

    test('POST /api/auth/login should authenticate user', async () => {
      const loginData = {
        email: 'api.test@example.com',
        password: process.env.TEST_PASSWORD || 'test123'
      };

      const response = await request
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            email: loginData.email,
            role: 'captain'
          },
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresIn: expect.any(Number)
          }
        }
      });
    });

    test('POST /api/auth/login should reject invalid credentials', async () => {
      const loginData = {
        email: 'api.test@example.com',
        password: 'wrongpassword' // Intentionally wrong for negative test
      };

      const response = await request
        .post('/api/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'VALIDATION_ERROR'
      });
    });
  });

  describe('Depth Endpoints', () => {
    test('POST /api/depth/report should submit depth reading', async () => {
      const depthData = {
        location: { latitude: 37.8199, longitude: -122.4783 },
        depthMeters: 15.5,
        vesselId: testVessel.id,
        waterTemperatureCelsius: 18.5,
        bottomType: 'sand'
      };

      const response = await request
        .post('/api/depth/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depthData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          reading: {
            id: expect.any(String),
            location: {
              latitude: expect.any(Number),
              longitude: expect.any(Number)
            },
            depthMeters: 15.5,
            confidenceScore: expect.stringMatching(/^(low|medium|high|verified)$/)
          }
        }
      });
    });

    test('POST /api/depth/report should require authentication', async () => {
      const depthData = {
        location: { latitude: 37.8199, longitude: -122.4783 },
        depthMeters: 15.5,
        vesselId: testVessel.id
      };

      await request
        .post('/api/depth/report')
        .send(depthData)
        .expect(401);
    });

    test('GET /api/depth/area should return depth data for area', async () => {
      // First create some depth readings
      await testHelper.createTestDepthReading(testUser.id, testVessel.id, {
        latitude: 37.8199,
        longitude: -122.4783,
        depth_meters: 15.5
      });

      const response = await request
        .get('/api/depth/area')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          'northEast[latitude]': 37.8210,
          'northEast[longitude]': -122.4780,
          'southWest[latitude]': 37.8190,
          'southWest[longitude]': -122.4790
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          readings: expect.any(Array),
          aggregatedData: expect.any(Array),
          safetyWarnings: expect.any(Array),
          dataQualityScore: expect.any(Number)
        },
        safetyNotice: expect.any(String)
      });
    });

    test('GET /api/depth/nearest should return nearest readings', async () => {
      // Create a test reading
      await testHelper.createTestDepthReading(testUser.id, testVessel.id, {
        latitude: 37.8199,
        longitude: -122.4783,
        depth_meters: 15.5
      });

      const response = await request
        .get('/api/depth/nearest')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          latitude: 37.8200,
          longitude: -122.4784,
          radiusMeters: 1000,
          maxResults: 5
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          readings: expect.any(Array),
          searchCenter: {
            latitude: 37.8200,
            longitude: -122.4784
          },
          searchRadius: 1000
        }
      });
    });
  });

  describe('Vessel Endpoints', () => {
    test('GET /api/vessels should return user vessels', async () => {
      const response = await request
        .get('/api/vessels')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          vessels: expect.any(Array),
          total: expect.any(Number)
        }
      });

      expect(response.body.data.vessels.length).toBeGreaterThan(0);
      expect(response.body.data.vessels[0]).toMatchObject({
        id: testVessel.id,
        name: expect.any(String),
        vesselType: expect.any(String),
        draftMeters: expect.any(Number)
      });
    });

    test('POST /api/vessels should create new vessel', async () => {
      const vesselData = {
        name: 'New Test Vessel',
        vesselType: 'powerboat',
        lengthMeters: 8.5,
        beamMeters: 2.8,
        draftMeters: 0.9,
        maxSpeedKnots: 25.0,
        registrationNumber: 'TEST-123'
      };

      const response = await request
        .post('/api/vessels')
        .set('Authorization', `Bearer ${authToken}`)
        .send(vesselData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          vessel: {
            id: expect.any(String),
            name: vesselData.name,
            vesselType: vesselData.vesselType,
            draftMeters: vesselData.draftMeters
          }
        }
      });
    });

    test('GET /api/vessels/:id should return specific vessel', async () => {
      const response = await request
        .get(`/api/vessels/${testVessel.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          vessel: {
            id: testVessel.id,
            name: expect.any(String),
            statistics: expect.any(Object)
          }
        }
      });
    });
  });

  describe('Navigation Endpoints', () => {
    test('POST /api/navigation/route should plan route', async () => {
      const routeData = {
        startPoint: { latitude: 37.8199, longitude: -122.4783 },
        endPoint: { latitude: 37.7749, longitude: -122.4194 },
        vesselId: testVessel.id,
        vesselDraft: 1.8,
        maxWaypoints: 5,
        preferDeepWater: true,
        avoidWeather: true
      };

      const response = await request
        .post('/api/navigation/route')
        .set('Authorization', `Bearer ${authToken}`)
        .send(routeData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          route: {
            route: expect.objectContaining({
              startPoint: routeData.startPoint,
              endPoint: routeData.endPoint,
              totalDistanceNm: expect.any(Number)
            }),
            waypoints: expect.any(Array),
            totalDistance: expect.any(Number),
            estimatedTime: expect.any(Number),
            safetyScore: expect.any(Number)
          }
        },
        safetyNotice: expect.any(String)
      });
    });

    test('POST /api/navigation/routes should save route', async () => {
      const routeData = {
        name: 'Test Route',
        description: 'A test route for integration testing',
        startPoint: { latitude: 37.8199, longitude: -122.4783 },
        endPoint: { latitude: 37.7749, longitude: -122.4194 },
        vesselId: testVessel.id,
        isPublic: false,
        difficultyLevel: 2
      };

      const response = await request
        .post('/api/navigation/routes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(routeData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          route: {
            id: expect.any(String),
            name: routeData.name,
            startPoint: routeData.startPoint,
            endPoint: routeData.endPoint
          }
        }
      });
    });

    test('GET /api/navigation/routes should return user routes', async () => {
      // First create a route
      await testHelper.createTestRoute(testUser.id, testVessel.id);

      const response = await request
        .get('/api/navigation/routes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          routes: expect.any(Array),
          pagination: expect.objectContaining({
            page: expect.any(Number),
            limit: expect.any(Number),
            total: expect.any(Number)
          })
        }
      });
    });
  });

  describe('Weather Endpoints', () => {
    test('GET /api/weather/current should return current weather', async () => {
      const response = await request
        .get('/api/weather/current')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          latitude: 37.8199,
          longitude: -122.4783,
          marine: true
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          location: {
            latitude: 37.8199,
            longitude: -122.4783
          }
        },
        safetyNotice: expect.any(String)
      });

      // Weather data might not be available in test environment
      if (response.body.data.current) {
        expect(response.body.data.current).toMatchObject({
          id: expect.any(String),
          source: expect.any(String),
          timestamp: expect.any(String)
        });
      }
    });

    test('GET /api/weather/alerts should return weather alerts', async () => {
      const response = await request
        .get('/api/weather/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          latitude: 37.8199,
          longitude: -122.4783,
          radiusKm: 25
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          alerts: expect.any(Array),
          summary: expect.objectContaining({
            total: expect.any(Number),
            types: expect.any(Array)
          }),
          location: {
            latitude: 37.8199,
            longitude: -122.4783
          }
        }
      });
    });
  });

  describe('Marine Endpoints', () => {
    test('GET /api/marine/areas should return marine areas', async () => {
      const response = await request
        .get('/api/marine/areas')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          latitude: 37.8199,
          longitude: -122.4783,
          radiusKm: 25
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          areas: expect.any(Array),
          pagination: expect.any(Object)
        }
      });
    });

    test('GET /api/marine/alerts should return safety alerts', async () => {
      const response = await request
        .get('/api/marine/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          latitude: 37.8199,
          longitude: -122.4783,
          radiusKm: 10
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          alerts: expect.any(Array),
          summary: expect.any(Object),
          searchArea: expect.any(Object)
        }
      });
    });

    test('POST /api/marine/alerts should create safety alert (captain only)', async () => {
      const alertData = {
        alertType: 'shallow_water',
        severity: 3,
        location: { latitude: 37.8199, longitude: -122.4783 },
        message: 'Test safety alert for shallow water',
        recommendedAction: 'Navigate with caution',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request
        .post('/api/marine/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(alertData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          alert: {
            id: expect.any(String),
            alertType: alertData.alertType,
            severity: alertData.severity,
            message: alertData.message
          }
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent endpoints', async () => {
      const response = await request
        .get('/api/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        code: 'ROUTE_NOT_FOUND'
      });
    });

    test('should return 401 for missing authentication', async () => {
      await request
        .get('/api/vessels')
        .expect(401);
    });

    test('should return 403 for insufficient permissions', async () => {
      // Create regular user token
      const regularUser = await testHelper.createTestUser({
        email: 'regular@example.com',
        role: 'user'
      });
      const regularToken = testHelper.generateTestToken(regularUser.id);

      // Try to create safety alert (requires captain role)
      const alertData = {
        alertType: 'shallow_water',
        severity: 3,
        location: { latitude: 37.8199, longitude: -122.4783 },
        message: 'Test alert'
      };

      await request
        .post('/api/marine/alerts')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(alertData)
        .expect(403);
    });

    test('should validate request body schemas', async () => {
      const invalidDepthData = {
        location: { latitude: 91, longitude: -122.4783 }, // Invalid latitude
        depthMeters: -5, // Invalid depth
        vesselId: 'invalid-uuid'
      };

      const response = await request
        .post('/api/depth/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDepthData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'VALIDATION_ERROR'
      });
    });
  });
});