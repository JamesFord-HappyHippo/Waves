/**
 * Data Processing Service Tests
 * Comprehensive test suite for environmental data processing and tide corrections
 */

import { DataProcessingService, TideCorrection, EnvironmentalFactors, QualityScore } from '../DataProcessingService';
import { DepthReading } from '../../../types';
import { TidePrediction, WaterLevel, NoaaStation, MeteorologicalData } from '../NoaaApiClient';
import { MarineWeatherExtended } from '../WeatherApiClient';

describe('DataProcessingService', () => {
  let service: DataProcessingService;
  let mockDepthReading: DepthReading;
  let mockStation: NoaaStation;
  let mockWeather: MarineWeatherExtended;

  beforeEach(() => {
    service = new DataProcessingService();

    mockDepthReading = {
      id: 'test-reading-1',
      latitude: 40.7,
      longitude: -74.0,
      depth: 5.0,
      timestamp: Date.now(),
      vesselDraft: 1.5,
      confidenceScore: 0.85,
      source: 'crowdsource',
      userId: 'test-user'
    };

    mockStation = {
      id: '8518750',
      name: 'The Battery, NY',
      latitude: 40.7,
      longitude: -74.015,
      state: 'NY',
      region: 'Atlantic',
      timezone: 'EST',
      tideType: 'harmonic'
    };

    mockWeather = {
      temperature: 15.0,
      windSpeed: 8.0,
      windDirection: 180,
      waveHeight: 1.0,
      visibility: 10.0,
      conditions: 'Clear',
      seaState: 2,
      barometricPressure: 1013.25
    };
  });

  describe('Tide Correction', () => {
    test('should apply observed water level correction', async () => {
      const tidePredictions: TidePrediction[] = [
        { time: '2024-01-01T12:00:00Z', value: 1.5, type: 'H' },
        { time: '2024-01-01T18:00:00Z', value: -0.5, type: 'L' }
      ];

      const currentWaterLevel: WaterLevel = {
        time: new Date(mockDepthReading.timestamp).toISOString(),
        value: 1.2,
        quality: 'verified'
      };

      const correction = await service.applyTideCorrection(
        mockDepthReading,
        mockStation,
        tidePredictions,
        currentWaterLevel
      );

      expect(correction.method).toBe('observed');
      expect(correction.tideHeight).toBe(1.2);
      expect(correction.correctedDepth).toBe(3.8); // 5.0 - 1.2
      expect(correction.confidence).toBeGreaterThan(0.8);
    });

    test('should interpolate between tide predictions', async () => {
      const tidePredictions: TidePrediction[] = [
        { time: new Date(mockDepthReading.timestamp - 3 * 60 * 60 * 1000).toISOString(), value: 1.5, type: 'H' },
        { time: new Date(mockDepthReading.timestamp + 3 * 60 * 60 * 1000).toISOString(), value: -0.5, type: 'L' }
      ];

      const correction = await service.applyTideCorrection(
        mockDepthReading,
        mockStation,
        tidePredictions
      );

      expect(correction.method).toBe('interpolated');
      expect(correction.tideHeight).toBeCloseTo(0.5, 1); // Midpoint interpolation
      expect(correction.confidence).toBeGreaterThan(0.6);
    });

    test('should reduce confidence for distant stations', async () => {
      const distantStation = {
        ...mockStation,
        latitude: 41.0, // About 33km away
        longitude: -73.5
      };

      const tidePredictions: TidePrediction[] = [
        { time: new Date(mockDepthReading.timestamp).toISOString(), value: 1.0, type: 'H' }
      ];

      const correction = await service.applyTideCorrection(
        mockDepthReading,
        distantStation,
        tidePredictions
      );

      expect(correction.confidence).toBeLessThan(0.8);
    });

    test('should handle missing tide data gracefully', async () => {
      const correction = await service.applyTideCorrection(
        mockDepthReading,
        mockStation,
        []
      );

      expect(correction.method).toBe('estimated');
      expect(correction.tideHeight).toBe(0);
      expect(correction.confidence).toBeLessThan(0.6);
    });
  });

  describe('Environmental Corrections', () => {
    test('should calculate wind corrections', () => {
      const highWindWeather = {
        ...mockWeather,
        windSpeed: 20.0 // High wind conditions
      };

      const factors = service.calculateEnvironmentalFactors(
        mockDepthReading,
        highWindWeather
      );

      expect(factors.windCorrection).toBeLessThan(0); // Negative correction for high winds
      expect(factors.confidence).toBeLessThan(1.0);
    });

    test('should calculate pressure corrections', () => {
      const lowPressureWeather = {
        ...mockWeather,
        barometricPressure: 990.0 // Low pressure
      };

      const factors = service.calculateEnvironmentalFactors(
        mockDepthReading,
        lowPressureWeather
      );

      expect(factors.pressureCorrection).toBeGreaterThan(0); // Positive correction for low pressure
    });

    test('should calculate temperature corrections', () => {
      const coldWeather = {
        ...mockWeather,
        temperature: 5.0 // Cold water
      };

      const factors = service.calculateEnvironmentalFactors(
        mockDepthReading,
        coldWeather
      );

      expect(factors.temperatureCorrection).toBeLessThan(0); // Negative correction for cold water
    });

    test('should estimate salinity corrections based on location', () => {
      // Coastal location
      const coastalReading = {
        ...mockDepthReading,
        latitude: 40.7,
        longitude: -74.0 // Near coast
      };

      const factors = service.calculateEnvironmentalFactors(
        coastalReading,
        mockWeather
      );

      expect(factors.salinityCorrection).toBeLessThanOrEqual(0); // Lower salinity near coast
    });

    test('should calculate total environmental correction', () => {
      const factors = service.calculateEnvironmentalFactors(
        mockDepthReading,
        mockWeather
      );

      expect(factors.totalCorrection).toBe(
        factors.windCorrection +
        factors.currentCorrection +
        factors.pressureCorrection +
        factors.temperatureCorrection +
        factors.salinityCorrection
      );
    });
  });

  describe('Quality Assessment', () => {
    test('should score data age factor', () => {
      const freshDataAge = 5 * 60 * 1000; // 5 minutes
      const oldDataAge = 25 * 60 * 60 * 1000; // 25 hours

      const freshScore = service.calculateQualityScore(
        mockDepthReading,
        mockStation,
        mockWeather,
        freshDataAge
      );

      const oldScore = service.calculateQualityScore(
        mockDepthReading,
        mockStation,
        mockWeather,
        oldDataAge
      );

      expect(freshScore.factors.dataAge).toBeGreaterThan(oldScore.factors.dataAge);
    });

    test('should score station distance factor', () => {
      const nearStation = {
        ...mockStation,
        latitude: 40.701, // Very close
        longitude: -74.001
      };

      const farStation = {
        ...mockStation,
        latitude: 41.0, // Far away
        longitude: -73.0
      };

      const nearScore = service.calculateQualityScore(
        mockDepthReading,
        nearStation,
        mockWeather,
        1000
      );

      const farScore = service.calculateQualityScore(
        mockDepthReading,
        farStation,
        mockWeather,
        1000
      );

      expect(nearScore.factors.stationDistance).toBeGreaterThan(farScore.factors.stationDistance);
    });

    test('should score environmental conditions', () => {
      const calmWeather = {
        ...mockWeather,
        windSpeed: 2.0,
        waveHeight: 0.3
      };

      const roughWeather = {
        ...mockWeather,
        windSpeed: 25.0,
        waveHeight: 4.0
      };

      const calmScore = service.calculateQualityScore(
        mockDepthReading,
        mockStation,
        calmWeather,
        1000
      );

      const roughScore = service.calculateQualityScore(
        mockDepthReading,
        mockStation,
        roughWeather,
        1000
      );

      expect(calmScore.factors.environmentalConditions).toBeGreaterThan(
        roughScore.factors.environmentalConditions
      );
    });

    test('should score data source reliability', () => {
      const officialReading = {
        ...mockDepthReading,
        source: 'official' as const
      };

      const predictedReading = {
        ...mockDepthReading,
        source: 'predicted' as const
      };

      const officialScore = service.calculateQualityScore(
        officialReading,
        mockStation,
        mockWeather,
        1000
      );

      const predictedScore = service.calculateQualityScore(
        predictedReading,
        mockStation,
        mockWeather,
        1000
      );

      expect(officialScore.factors.dataSource).toBeGreaterThan(predictedScore.factors.dataSource);
    });

    test('should generate quality warnings', () => {
      const lowConfidenceReading = {
        ...mockDepthReading,
        confidenceScore: 0.3
      };

      const oldDataAge = 25 * 60 * 60 * 1000; // 25 hours

      const score = service.calculateQualityScore(
        lowConfidenceReading,
        mockStation,
        mockWeather,
        oldDataAge
      );

      expect(score.warnings.length).toBeGreaterThan(0);
      expect(score.warnings).toContain('Low confidence depth reading');
      expect(score.warnings).toContain('Data older than 6 hours');
    });
  });

  describe('Complete Processing', () => {
    test('should process depth reading with all corrections', async () => {
      const tidePredictions: TidePrediction[] = [
        { time: new Date(mockDepthReading.timestamp).toISOString(), value: 1.0, type: 'H' }
      ];

      const processed = await service.processDepthReading(
        mockDepthReading,
        mockStation,
        tidePredictions,
        mockWeather
      );

      expect(processed.id).toBe(mockDepthReading.id);
      expect(processed.tideCorrection).toBeDefined();
      expect(processed.environmentalFactors).toBeDefined();
      expect(processed.qualityScore).toBeDefined();
      expect(processed.safetyMargin).toBeGreaterThan(0);
      expect(processed.reliability).toBeOneOf(['high', 'medium', 'low', 'unreliable']);
    });

    test('should determine reliability rating correctly', async () => {
      const highQualityReading = {
        ...mockDepthReading,
        confidenceScore: 0.95
      };

      const processed = await service.processDepthReading(
        highQualityReading,
        mockStation,
        [],
        mockWeather
      );

      expect(['high', 'medium']).toContain(processed.reliability);
    });

    test('should calculate appropriate safety margin', async () => {
      const uncertainReading = {
        ...mockDepthReading,
        confidenceScore: 0.4
      };

      const processed = await service.processDepthReading(
        uncertainReading,
        mockStation,
        [],
        mockWeather
      );

      expect(processed.safetyMargin).toBeGreaterThan(0.5); // Should have larger margin for uncertain data
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple readings efficiently', async () => {
      const readings: DepthReading[] = Array(5).fill(null).map((_, i) => ({
        ...mockDepthReading,
        id: `test-reading-${i}`,
        depth: 5.0 + i * 0.5
      }));

      const tidePredictions: TidePrediction[] = [
        { time: new Date(mockDepthReading.timestamp).toISOString(), value: 1.0, type: 'H' }
      ];

      const processed = await service.batchProcessDepthReadings(
        readings,
        mockStation,
        tidePredictions,
        mockWeather
      );

      expect(processed).toHaveLength(5);
      processed.forEach((reading, i) => {
        expect(reading.id).toBe(`test-reading-${i}`);
        expect(reading.tideCorrection).toBeDefined();
      });
    });

    test('should handle batch processing errors gracefully', async () => {
      const readings: DepthReading[] = [
        mockDepthReading,
        { ...mockDepthReading, id: 'invalid-reading', depth: NaN }
      ];

      const processed = await service.batchProcessDepthReadings(
        readings,
        mockStation,
        [],
        mockWeather
      );

      // Should still process valid readings
      expect(processed.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero depth readings', async () => {
      const shallowReading = {
        ...mockDepthReading,
        depth: 0.1
      };

      const processed = await service.processDepthReading(
        shallowReading,
        mockStation,
        [],
        mockWeather
      );

      expect(processed.reliability).toBe('unreliable');
      expect(processed.safetyMargin).toBeGreaterThan(1.0);
    });

    test('should handle negative corrected depths', async () => {
      const tidePredictions: TidePrediction[] = [
        { time: new Date(mockDepthReading.timestamp).toISOString(), value: 6.0, type: 'H' } // Very high tide
      ];

      const processed = await service.processDepthReading(
        mockDepthReading,
        mockStation,
        tidePredictions,
        mockWeather
      );

      expect(processed.reliability).toBe('unreliable');
      expect(processed.qualityScore.warnings).toContain(expect.stringMatching(/negative.*depth/i));
    });

    test('should handle missing environmental data', async () => {
      const minimalWeather = {
        temperature: 0,
        windSpeed: 0,
        windDirection: 0,
        waveHeight: 0,
        visibility: 0,
        conditions: 'unknown',
        seaState: 0,
        barometricPressure: 0
      };

      const factors = service.calculateEnvironmentalFactors(
        mockDepthReading,
        minimalWeather
      );

      expect(factors.confidence).toBeLessThan(0.8);
      expect(factors.totalCorrection).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should process readings within reasonable time', async () => {
      const startTime = Date.now();

      await service.processDepthReading(
        mockDepthReading,
        mockStation,
        [],
        mockWeather
      );

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(100); // Should complete within 100ms
    });

    test('should handle large batch processing efficiently', async () => {
      const readings: DepthReading[] = Array(100).fill(null).map((_, i) => ({
        ...mockDepthReading,
        id: `test-reading-${i}`
      }));

      const startTime = Date.now();

      const processed = await service.batchProcessDepthReadings(
        readings,
        mockStation,
        [],
        mockWeather
      );

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(processed).toHaveLength(100);
    });
  });
});