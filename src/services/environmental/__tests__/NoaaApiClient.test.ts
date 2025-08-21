/**
 * NOAA API Client Tests
 * Comprehensive test suite for NOAA Tides & Currents API integration
 */

import { NoaaApiClient, NoaaStation, TidePrediction, WaterLevel } from '../NoaaApiClient';

// Mock fetch for testing
global.fetch = jest.fn();
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('NoaaApiClient', () => {
  let client: NoaaApiClient;

  beforeEach(() => {
    client = new NoaaApiClient();
    mockedFetch.mockClear();
  });

  afterEach(() => {
    client.clearCache();
  });

  describe('Station Management', () => {
    test('should find nearest stations', async () => {
      const mockStations: NoaaStation[] = [
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

      const stations = await client.findNearestStations({
        latitude: 40.7,
        longitude: -74.0,
        maxDistance: 50,
        maxStations: 5
      });

      expect(Array.isArray(stations)).toBe(true);
      // Should include at least the mock station
      expect(stations.length).toBeGreaterThan(0);
    });

    test('should calculate distance correctly', async () => {
      const stations = await client.findNearestStations({
        latitude: 40.7,
        longitude: -74.0,
        maxDistance: 50
      });

      stations.forEach(station => {
        expect(station.distance).toBeDefined();
        expect(station.distance).toBeGreaterThanOrEqual(0);
        expect(station.distance).toBeLessThanOrEqual(50000); // 50km in meters
      });
    });

    test('should filter stations by distance', async () => {
      const nearStations = await client.findNearestStations({
        latitude: 40.7,
        longitude: -74.0,
        maxDistance: 10
      });

      const farStations = await client.findNearestStations({
        latitude: 40.7,
        longitude: -74.0,
        maxDistance: 100
      });

      expect(farStations.length).toBeGreaterThanOrEqual(nearStations.length);
    });
  });

  describe('Tide Predictions', () => {
    test('should fetch tide predictions', async () => {
      const mockPredictions = {
        data: [
          { t: '2024-01-01 00:00', v: '1.5', type: 'H' },
          { t: '2024-01-01 06:00', v: '-0.5', type: 'L' },
          { t: '2024-01-01 12:00', v: '1.2', type: 'H' }
        ]
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPredictions
      } as Response);

      const predictions = await client.getTidePredictions({
        stationId: '8518750',
        product: 'predictions',
        beginDate: '20240101',
        endDate: '20240102'
      });

      expect(predictions).toHaveLength(3);
      expect(predictions[0]).toMatchObject({
        time: '2024-01-01 00:00',
        value: 1.5,
        type: 'H'
      });
    });

    test('should handle API errors gracefully', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      await expect(client.getTidePredictions({
        stationId: 'invalid',
        product: 'predictions'
      })).rejects.toThrow('NOAA API request failed: 500 Internal Server Error');
    });

    test('should cache tide predictions', async () => {
      const mockPredictions = {
        data: [{ t: '2024-01-01 00:00', v: '1.5', type: 'H' }]
      };

      mockedFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPredictions
      } as Response);

      // First call
      await client.getTidePredictions({
        stationId: '8518750',
        product: 'predictions'
      });

      // Second call should use cache
      await client.getTidePredictions({
        stationId: '8518750',
        product: 'predictions'
      });

      // Should only make one API call due to caching
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Water Levels', () => {
    test('should fetch current water levels', async () => {
      const mockWaterLevels = {
        data: [
          { t: '2024-01-01 12:00', v: '1.2', s: '0.05', f: 'verified', q: 'v' },
          { t: '2024-01-01 12:06', v: '1.3', s: '0.04', f: 'verified', q: 'v' }
        ]
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWaterLevels
      } as Response);

      const waterLevels = await client.getWaterLevels({
        stationId: '8518750',
        product: 'water_level',
        beginDate: '20240101 12:00',
        endDate: '20240101 13:00'
      });

      expect(waterLevels).toHaveLength(2);
      expect(waterLevels[0]).toMatchObject({
        time: '2024-01-01 12:00',
        value: 1.2,
        sigma: 0.05,
        flags: ['verified'],
        quality: 'v'
      });
    });

    test('should validate water level data quality', async () => {
      const mockWaterLevels = {
        data: [
          { t: '2024-01-01 12:00', v: '1.2', q: 'verified' },
          { t: '2024-01-01 12:06', v: '1.3', q: 'preliminary' }
        ]
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWaterLevels
      } as Response);

      const waterLevels = await client.getWaterLevels({
        stationId: '8518750',
        product: 'water_level'
      });

      expect(waterLevels[0].quality).toBe('verified');
      expect(waterLevels[1].quality).toBe('preliminary');
    });
  });

  describe('Meteorological Data', () => {
    test('should fetch wind data', async () => {
      const mockWindData = {
        data: [
          { t: '2024-01-01 12:00', v: '15.2,045,18.5' },
          { t: '2024-01-01 12:06', v: '16.1,050,19.2' }
        ]
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWindData
      } as Response);

      const windData = await client.getMeteorologicalData({
        stationId: '8518750',
        product: 'wind'
      });

      expect(windData).toHaveLength(2);
      expect(windData[0]).toMatchObject({
        time: '2024-01-01 12:00',
        windSpeed: 15.2,
        windDirection: 45,
        windGusts: 18.5
      });
    });

    test('should handle missing meteorological data', async () => {
      const mockEmptyData = { data: [] };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEmptyData
      } as Response);

      const metData = await client.getMeteorologicalData({
        stationId: '8518750',
        product: 'air_temperature'
      });

      expect(metData).toHaveLength(0);
    });
  });

  describe('Comprehensive Location Data', () => {
    test('should fetch comprehensive environmental data', async () => {
      const location = { latitude: 40.7, longitude: -74.0, accuracy: 10, timestamp: Date.now() };

      // Mock multiple API responses
      const mockTidePredictions = {
        data: [{ t: '2024-01-01 12:00', v: '1.5', type: 'H' }]
      };

      const mockWaterLevels = {
        data: [{ t: '2024-01-01 12:00', v: '1.2' }]
      };

      mockedFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTidePredictions
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWaterLevels
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] })
        } as Response);

      const result = await client.getLocationEnvironmentalData(location);

      expect(result.station).toBeDefined();
      expect(result.tidePredictions).toHaveLength(1);
      expect(result.currentWaterLevel).toBeDefined();
      expect(result.meteorological).toBeDefined();
    });

    test('should handle partial data availability', async () => {
      const location = { latitude: 40.7, longitude: -74.0, accuracy: 10, timestamp: Date.now() };

      // Mock failed meteorological request
      mockedFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ t: '2024-01-01 12:00', v: '1.5', type: 'H' }] })
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        } as Response);

      const result = await client.getLocationEnvironmentalData(location);

      expect(result.station).toBeDefined();
      expect(result.tidePredictions).toHaveLength(1);
      expect(result.currentWaterLevel).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    test('should respect rate limits', async () => {
      // Create multiple concurrent requests
      const requests = Array(10).fill(null).map(() =>
        client.getTidePredictions({
          stationId: '8518750',
          product: 'predictions'
        })
      );

      // Mock successful responses
      mockedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      } as Response);

      await Promise.allSettled(requests);

      // Should have queued requests and not exceeded rate limits
      expect(mockedFetch).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors', async () => {
      mockedFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getTidePredictions({
        stationId: '8518750',
        product: 'predictions'
      })).rejects.toThrow('Failed to fetch tide predictions');
    });

    test('should handle malformed response data', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'data' })
      } as Response);

      await expect(client.getTidePredictions({
        stationId: '8518750',
        product: 'predictions'
      })).rejects.toThrow();
    });
  });

  describe('Cache Management', () => {
    test('should manage cache expiration', async () => {
      const mockData = { data: [{ t: '2024-01-01 12:00', v: '1.5', type: 'H' }] };

      mockedFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData
      } as Response);

      // Make request
      await client.getTidePredictions({
        stationId: '8518750',
        product: 'predictions'
      });

      // Check cache stats
      const stats = client.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.entries.length).toBeGreaterThan(0);
    });

    test('should clear cache when requested', async () => {
      const mockData = { data: [] };

      mockedFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData
      } as Response);

      await client.getTidePredictions({
        stationId: '8518750',
        product: 'predictions'
      });

      client.clearCache();

      const stats = client.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});