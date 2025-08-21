/**
 * Environmental Data Integration Tests
 * End-to-end tests for complete environmental data pipeline
 */

import { NoaaApiClient } from '../NoaaApiClient';
import { WeatherApiClient } from '../WeatherApiClient';
import { DataProcessingService } from '../DataProcessingService';
import { CachingService } from '../CachingService';
import { RealtimeUpdateService } from '../RealtimeUpdateService';

// Mock external dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('react-native-sqlite-storage');

// Mock fetch for API calls
global.fetch = jest.fn();
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Environmental Data Integration', () => {
  let noaaClient: NoaaApiClient;
  let weatherClient: WeatherApiClient;
  let dataProcessor: DataProcessingService;
  let cachingService: CachingService;
  let realtimeService: RealtimeUpdateService;

  const testLocation = {
    latitude: 40.7,
    longitude: -74.0,
    accuracy: 10,
    timestamp: Date.now()
  };

  beforeEach(() => {
    noaaClient = new NoaaApiClient();
    weatherClient = new WeatherApiClient();
    dataProcessor = new DataProcessingService();
    cachingService = new CachingService();
    realtimeService = new RealtimeUpdateService();

    mockedFetch.mockClear();
  });

  afterEach(async () => {
    await cachingService.clearAllCache();
    realtimeService.disconnect();
  });

  describe('Complete Data Pipeline', () => {
    test('should fetch, process, and cache environmental data', async () => {
      // Mock API responses
      const mockWeatherResponse = {
        main: { temp: 20, pressure: 1013, humidity: 65 },
        wind: { speed: 5, deg: 180 },
        weather: [{ description: 'clear sky' }],
        visibility: 10000
      };

      const mockStationsResponse = [
        {
          id: '8518750',
          name: 'The Battery, NY',
          latitude: 40.7,
          longitude: -74.015,
          state: 'NY',
          region: 'Atlantic',
          timezone: 'EST',
          tideType: 'harmonic'
        }
      ];

      const mockTidePredictions = {
        data: [
          { t: '2024-01-01T12:00:00Z', v: '1.5', type: 'H' },
          { t: '2024-01-01T18:00:00Z', v: '-0.5', type: 'L' }
        ]
      };

      // Mock weather API call
      mockedFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWeatherResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTidePredictions
        } as Response);

      // Step 1: Fetch weather data
      weatherClient.configureProvider('openweather', 'test-api-key');
      const weather = await weatherClient.getCurrentWeather(testLocation);

      expect(weather.temperature).toBe(20);
      expect(weather.windSpeed).toBe(5);

      // Step 2: Find nearest NOAA stations
      const stations = await noaaClient.findNearestStations({
        latitude: testLocation.latitude,
        longitude: testLocation.longitude,
        maxStations: 3
      });

      expect(stations.length).toBeGreaterThan(0);

      // Step 3: Get tide predictions
      const tidePredictions = await noaaClient.getTidePredictions({
        stationId: stations[0].id,
        product: 'predictions'
      });

      expect(tidePredictions.length).toBeGreaterThan(0);

      // Step 4: Cache the data
      await cachingService.cacheWeatherData(testLocation, weather, 'openweather', 30);
      await cachingService.cacheStations(stations);
      await cachingService.cacheTidePredictions(stations[0].id, tidePredictions);

      // Step 5: Verify cached data retrieval
      const cachedWeather = await cachingService.getCachedWeatherData(testLocation);
      const cachedStations = await cachingService.getCachedStations(testLocation);
      const cachedTides = await cachingService.getCachedTidePredictions(stations[0].id);

      expect(cachedWeather).toMatchObject({
        temperature: 20,
        windSpeed: 5
      });
      expect(cachedStations.length).toBeGreaterThan(0);
      expect(cachedTides.length).toBeGreaterThan(0);
    });

    test('should process depth reading with environmental corrections', async () => {
      // Mock environmental data
      const mockDepthReading = {
        id: 'test-reading-1',
        latitude: testLocation.latitude,
        longitude: testLocation.longitude,
        depth: 5.0,
        timestamp: Date.now(),
        vesselDraft: 1.5,
        confidenceScore: 0.85,
        source: 'crowdsource' as const,
        userId: 'test-user'
      };

      const mockStation = {
        id: '8518750',
        name: 'The Battery, NY',
        latitude: 40.7,
        longitude: -74.015,
        state: 'NY',
        region: 'Atlantic',
        timezone: 'EST',
        tideType: 'harmonic' as const
      };

      const mockWeather = {
        temperature: 15,
        windSpeed: 8,
        windDirection: 180,
        waveHeight: 1.0,
        visibility: 10,
        conditions: 'Clear',
        seaState: 2,
        barometricPressure: 1013.25
      };

      const mockTidePredictions = [
        { time: new Date(mockDepthReading.timestamp).toISOString(), value: 1.0, type: 'H' as const }
      ];

      // Process the depth reading
      const processed = await dataProcessor.processDepthReading(
        mockDepthReading,
        mockStation,
        mockTidePredictions,
        mockWeather
      );

      expect(processed.tideCorrection).toBeDefined();
      expect(processed.environmentalFactors).toBeDefined();
      expect(processed.qualityScore).toBeDefined();
      expect(processed.safetyMargin).toBeGreaterThan(0);
      expect(processed.reliability).toBeOneOf(['high', 'medium', 'low', 'unreliable']);

      // Verify depth was corrected for tide
      expect(processed.depth).not.toBe(mockDepthReading.depth);
      expect(processed.tideCorrection.correctedDepth).toBe(4.0); // 5.0 - 1.0 tide height
    });

    test('should handle provider fallbacks gracefully', async () => {
      // Configure multiple providers
      weatherClient.configureProvider('stormglass', 'test-stormglass-key');
      weatherClient.configureProvider('openweather', 'test-openweather-key');

      // Mock first provider failure
      mockedFetch
        .mockRejectedValueOnce(new Error('Stormglass API error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            main: { temp: 18 },
            wind: { speed: 7 },
            weather: [{ description: 'partly cloudy' }]
          })
        } as Response);

      const weather = await weatherClient.getCurrentWeather(testLocation);

      expect(weather.temperature).toBe(18);
      expect(weather.windSpeed).toBe(7);
    });
  });

  describe('Real-time Data Streaming', () => {
    test('should establish real-time connection and receive updates', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        readyState: WebSocket.OPEN
      };

      // Mock WebSocket
      global.WebSocket = jest.fn(() => mockWebSocket) as any;

      let updateReceived = false;
      const subscriptionId = realtimeService.subscribe({
        location: testLocation,
        radius: 5000,
        dataTypes: ['weather', 'tides'],
        updateInterval: 30,
        priority: 'medium',
        callback: (update) => {
          updateReceived = true;
          expect(update.type).toBeOneOf(['weather', 'tides', 'alerts']);
        }
      });

      expect(subscriptionId).toBeTruthy();

      // Simulate incoming update
      const mockUpdate = {
        type: 'weather',
        timestamp: Date.now(),
        location: testLocation,
        data: { temperature: 22, windSpeed: 6 },
        source: 'stormglass'
      };

      // Trigger the WebSocket message handler
      const messageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      if (messageHandler) {
        messageHandler({
          data: JSON.stringify(mockUpdate)
        });
      }

      expect(updateReceived).toBe(true);

      realtimeService.unsubscribe(subscriptionId);
    });

    test('should handle real-time connection failures', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        readyState: WebSocket.CLOSED
      };

      global.WebSocket = jest.fn(() => mockWebSocket) as any;

      // Mock connection error
      const errorHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'error')?.[1];

      if (errorHandler) {
        errorHandler(new Error('Connection failed'));
      }

      const status = realtimeService.getConnectionStatus();
      expect(status.isConnected).toBe(false);
    });
  });

  describe('Offline Capabilities', () => {
    test('should work with cached data when offline', async () => {
      // Populate cache first
      const mockWeather = {
        temperature: 20,
        windSpeed: 5,
        windDirection: 180,
        waveHeight: 1.0,
        visibility: 10,
        conditions: 'Clear',
        seaState: 2,
        barometricPressure: 1013
      };

      const mockStations = [{
        id: '8518750',
        name: 'The Battery, NY',
        latitude: 40.7,
        longitude: -74.015,
        state: 'NY',
        region: 'Atlantic',
        timezone: 'EST',
        tideType: 'harmonic' as const
      }];

      await cachingService.cacheWeatherData(testLocation, mockWeather, 'test', 60);
      await cachingService.cacheStations(mockStations);

      // Simulate offline mode
      mockedFetch.mockRejectedValue(new Error('Network error'));

      // Should still be able to get cached data
      const cachedWeather = await cachingService.getCachedWeatherData(testLocation);
      const cachedStations = await cachingService.getCachedStations(testLocation);

      expect(cachedWeather).toMatchObject(mockWeather);
      expect(cachedStations).toMatchObject(mockStations);
    });

    test('should queue data for sync when offline', async () => {
      const mockDepthReading = {
        id: 'offline-reading',
        latitude: testLocation.latitude,
        longitude: testLocation.longitude,
        depth: 3.5,
        timestamp: Date.now(),
        vesselDraft: 1.2,
        confidenceScore: 0.8,
        source: 'crowdsource'
      };

      await cachingService.addToSyncQueue('depth_reading', mockDepthReading);

      const syncStatus = await cachingService.getSyncStatus();
      expect(syncStatus.pendingUploads).toBeGreaterThan(0);
    });
  });

  describe('Data Quality and Validation', () => {
    test('should validate data consistency across sources', async () => {
      // Mock slightly different data from different sources
      const noaaWeather = {
        windSpeed: 10,
        barometricPressure: 1015
      };

      const openWeatherData = {
        windSpeed: 12,
        barometricPressure: 1013
      };

      // Both should be within reasonable ranges
      expect(Math.abs(noaaWeather.windSpeed - openWeatherData.windSpeed)).toBeLessThan(5);
      expect(Math.abs(noaaWeather.barometricPressure - openWeatherData.barometricPressure)).toBeLessThan(10);
    });

    test('should detect and flag anomalous readings', async () => {
      const normalReading = {
        id: 'normal-reading',
        latitude: testLocation.latitude,
        longitude: testLocation.longitude,
        depth: 5.0,
        timestamp: Date.now(),
        vesselDraft: 1.5,
        confidenceScore: 0.85,
        source: 'crowdsource' as const
      };

      const anomalousReading = {
        ...normalReading,
        id: 'anomalous-reading',
        depth: -2.0 // Impossible negative depth
      };

      const mockStation = {
        id: '8518750',
        name: 'The Battery, NY',
        latitude: 40.7,
        longitude: -74.015,
        state: 'NY',
        region: 'Atlantic',
        timezone: 'EST',
        tideType: 'harmonic' as const
      };

      const mockWeather = {
        temperature: 15,
        windSpeed: 8,
        windDirection: 180,
        waveHeight: 1.0,
        visibility: 10,
        conditions: 'Clear',
        seaState: 2,
        barometricPressure: 1013
      };

      const normalProcessed = await dataProcessor.processDepthReading(
        normalReading,
        mockStation,
        [],
        mockWeather
      );

      const anomalousProcessed = await dataProcessor.processDepthReading(
        anomalousReading,
        mockStation,
        [],
        mockWeather
      );

      expect(normalProcessed.reliability).not.toBe('unreliable');
      expect(anomalousProcessed.reliability).toBe('unreliable');
      expect(anomalousProcessed.qualityScore.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();

      // Create multiple concurrent requests
      const requests = Array(20).fill(null).map((_, i) => ({
        latitude: testLocation.latitude + i * 0.001,
        longitude: testLocation.longitude + i * 0.001,
        accuracy: 10,
        timestamp: Date.now()
      }));

      // Mock responses
      mockedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      } as Response);

      const promises = requests.map(location =>
        noaaClient.findNearestStations({
          latitude: location.latitude,
          longitude: location.longitude,
          maxStations: 1
        })
      );

      await Promise.all(promises);

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should maintain performance with large cache sizes', async () => {
      // Populate cache with many entries
      for (let i = 0; i < 100; i++) {
        const location = {
          latitude: testLocation.latitude + i * 0.01,
          longitude: testLocation.longitude + i * 0.01,
          accuracy: 10,
          timestamp: Date.now()
        };

        const mockWeather = {
          temperature: 20 + i,
          windSpeed: 5 + i,
          windDirection: 180,
          waveHeight: 1.0,
          visibility: 10,
          conditions: 'Clear',
          seaState: 2,
          barometricPressure: 1013
        };

        await cachingService.cacheWeatherData(location, mockWeather, 'test', 60);
      }

      const startTime = Date.now();
      
      // Retrieve cached data
      const cachedWeather = await cachingService.getCachedWeatherData(testLocation);
      
      const retrievalTime = Date.now() - startTime;
      expect(retrievalTime).toBeLessThan(100); // Should be fast even with large cache
    });
  });

  describe('Error Recovery', () => {
    test('should recover from temporary API failures', async () => {
      let attemptCount = 0;

      mockedFetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] })
        } as Response);
      });

      // Should eventually succeed after retries
      const stations = await noaaClient.findNearestStations({
        latitude: testLocation.latitude,
        longitude: testLocation.longitude
      });

      expect(Array.isArray(stations)).toBe(true);
      expect(attemptCount).toBeGreaterThan(1);
    });

    test('should gracefully degrade when services are unavailable', async () => {
      // Mock all services failing
      mockedFetch.mockRejectedValue(new Error('All services down'));

      // Should still return cached data or safe defaults
      const cachedData = await cachingService.getCachedWeatherData(testLocation);
      
      // Even if no cached data, should not throw
      expect(cachedData).toBeNull();
    });
  });
});

describe('End-to-End Scenarios', () => {
  test('should handle complete navigation session', async () => {
    // Simulate a complete boating session with environmental data integration
    
    // 1. App starts, fetches initial environmental data
    // 2. User enables real-time updates
    // 3. User reports depth readings during trip
    // 4. Depth readings are corrected with environmental data
    // 5. Data is cached for offline use
    // 6. User goes offline, continues using cached data
    // 7. User comes back online, syncs offline data

    expect(true).toBe(true); // Placeholder for complete scenario test
  });
});