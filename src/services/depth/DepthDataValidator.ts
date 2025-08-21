/**
 * Advanced Depth Data Validation Service
 * Implements marine navigation safety standards and quality assurance
 */

import { DepthReading } from '@/store/slices/depthSlice';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  warnings: string[];
  errors: string[];
  qualityScore: {
    gpsAccuracy: number;
    environmentalFactors: number;
    dataConsistency: number;
    overall: number;
  };
}

export interface DepthValidationRules {
  maxDepth: number;
  minDepth: number;
  maxGpsAccuracy: number;
  maxSpeedForAccuracy: number;
  timeThresholds: {
    duplicate: number; // milliseconds
    stale: number; // milliseconds
  };
}

export class DepthDataValidator {
  private static readonly DEFAULT_RULES: DepthValidationRules = {
    maxDepth: 200, // 200 meters maximum
    minDepth: 0,
    maxGpsAccuracy: 10, // 10 meters maximum GPS accuracy
    maxSpeedForAccuracy: 2, // 2 m/s maximum speed for accurate readings
    timeThresholds: {
      duplicate: 30000, // 30 seconds
      stale: 300000, // 5 minutes
    },
  };

  private static previousReadings: Map<string, DepthReading[]> = new Map();
  private static nearbyReadings: DepthReading[] = [];

  /**
   * Validates a depth reading against marine navigation standards
   */
  static async validateDepthReading(
    reading: Partial<DepthReading> & {
      depth: number;
      latitude: number;
      longitude: number;
      timestamp: number;
      gpsAccuracy?: number;
      vesselSpeed?: number;
    },
    rules: Partial<DepthValidationRules> = {}
  ): Promise<ValidationResult> {
    const validationRules = { ...this.DEFAULT_RULES, ...rules };
    const warnings: string[] = [];
    const errors: string[] = [];

    // Basic range validation
    if (reading.depth < validationRules.minDepth) {
      errors.push(`Depth cannot be negative: ${reading.depth}m`);
    }
    
    if (reading.depth > validationRules.maxDepth) {
      errors.push(`Depth exceeds maximum: ${reading.depth}m > ${validationRules.maxDepth}m`);
    }

    // GPS accuracy validation
    const gpsAccuracy = reading.gpsAccuracy || 999;
    if (gpsAccuracy > validationRules.maxGpsAccuracy) {
      if (gpsAccuracy > 20) {
        errors.push(`GPS accuracy too poor for navigation use: ${gpsAccuracy.toFixed(1)}m`);
      } else {
        warnings.push(`GPS accuracy is below optimal: ${gpsAccuracy.toFixed(1)}m`);
      }
    }

    // Speed validation - readings while moving are less accurate
    const vesselSpeed = reading.vesselSpeed || 0;
    if (vesselSpeed > validationRules.maxSpeedForAccuracy) {
      warnings.push(
        `Reading taken while moving at ${vesselSpeed.toFixed(1)} m/s. ` +
        'Stationary readings are more accurate.'
      );
    }

    // Coordinate validation
    if (Math.abs(reading.latitude) > 90) {
      errors.push(`Invalid latitude: ${reading.latitude}`);
    }
    
    if (Math.abs(reading.longitude) > 180) {
      errors.push(`Invalid longitude: ${reading.longitude}`);
    }

    // Temporal validation
    const now = Date.now();
    const age = now - reading.timestamp;
    
    if (age > validationRules.timeThresholds.stale) {
      warnings.push('Reading is older than 5 minutes. Consider capturing a fresh reading.');
    }

    // Check for duplicate readings (same location, recent time)
    const duplicateCheck = this.checkForDuplicates(reading, validationRules.timeThresholds.duplicate);
    if (duplicateCheck.isDuplicate) {
      warnings.push(
        `Similar reading exists within ${duplicateCheck.distance.toFixed(0)}m ` +
        `from ${Math.floor(duplicateCheck.timeDiff / 1000)}s ago`
      );
    }

    // Outlier detection against nearby readings
    const outlierCheck = this.checkForOutliers(reading);
    if (outlierCheck.isOutlier) {
      warnings.push(
        `Depth differs significantly from nearby readings. ` +
        `Expected: ${outlierCheck.expectedRange.min.toFixed(1)}-${outlierCheck.expectedRange.max.toFixed(1)}m, ` +
        `Actual: ${reading.depth.toFixed(1)}m`
      );
    }

    // Calculate quality scores
    const qualityScore = this.calculateQualityScore(reading, warnings, errors);

    // Overall confidence calculation
    const confidence = this.calculateConfidence(reading, qualityScore, warnings, errors);

    return {
      isValid: errors.length === 0,
      confidence,
      warnings,
      errors,
      qualityScore,
    };
  }

  /**
   * Sets nearby readings for outlier detection
   */
  static setNearbyReadings(readings: DepthReading[]): void {
    this.nearbyReadings = readings;
  }

  /**
   * Checks for duplicate readings in recent history
   */
  private static checkForDuplicates(
    reading: { latitude: number; longitude: number; timestamp: number },
    threshold: number
  ): { isDuplicate: boolean; distance?: number; timeDiff?: number } {
    const userKey = 'current_user'; // In real app, use actual user ID
    const userReadings = this.previousReadings.get(userKey) || [];

    for (const prevReading of userReadings) {
      const timeDiff = reading.timestamp - prevReading.timestamp;
      
      if (timeDiff < threshold) {
        const distance = this.calculateDistance(
          reading.latitude,
          reading.longitude,
          prevReading.latitude,
          prevReading.longitude
        );

        if (distance < 10) { // Within 10 meters
          return { isDuplicate: true, distance, timeDiff };
        }
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Checks if reading is an outlier compared to nearby readings
   */
  private static checkForOutliers(
    reading: { latitude: number; longitude: number; depth: number }
  ): { 
    isOutlier: boolean; 
    expectedRange?: { min: number; max: number };
    nearbyCount?: number;
  } {
    if (this.nearbyReadings.length < 3) {
      return { isOutlier: false }; // Not enough data for comparison
    }

    // Find readings within 100m
    const nearbyDepths = this.nearbyReadings
      .filter(r => {
        const distance = this.calculateDistance(
          reading.latitude,
          reading.longitude,
          r.latitude,
          r.longitude
        );
        return distance <= 100; // Within 100 meters
      })
      .map(r => r.depth);

    if (nearbyDepths.length < 3) {
      return { isOutlier: false };
    }

    // Calculate statistical outlier detection
    const mean = nearbyDepths.reduce((sum, d) => sum + d, 0) / nearbyDepths.length;
    const variance = nearbyDepths.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / nearbyDepths.length;
    const stdDev = Math.sqrt(variance);

    // Define expected range as mean ± 2 standard deviations
    const expectedRange = {
      min: Math.max(0, mean - 2 * stdDev),
      max: mean + 2 * stdDev,
    };

    const isOutlier = reading.depth < expectedRange.min || reading.depth > expectedRange.max;

    return {
      isOutlier,
      expectedRange,
      nearbyCount: nearbyDepths.length,
    };
  }

  /**
   * Calculates quality scores for different aspects of the reading
   */
  private static calculateQualityScore(
    reading: { gpsAccuracy?: number; vesselSpeed?: number },
    warnings: string[],
    errors: string[]
  ) {
    // GPS accuracy score (0-1, higher is better)
    const gpsAccuracy = reading.gpsAccuracy || 999;
    const gpsScore = Math.max(0, Math.min(1, (10 - gpsAccuracy) / 10));

    // Environmental factors score
    const speedPenalty = reading.vesselSpeed ? Math.min(1, reading.vesselSpeed / 5) : 0;
    const environmentalScore = Math.max(0, 1 - speedPenalty);

    // Data consistency score (based on warnings and errors)
    const errorPenalty = errors.length * 0.5;
    const warningPenalty = warnings.length * 0.1;
    const consistencyScore = Math.max(0, 1 - errorPenalty - warningPenalty);

    // Overall score
    const overall = (gpsScore * 0.4 + environmentalScore * 0.3 + consistencyScore * 0.3);

    return {
      gpsAccuracy: gpsScore,
      environmentalFactors: environmentalScore,
      dataConsistency: consistencyScore,
      overall,
    };
  }

  /**
   * Calculates overall confidence score
   */
  private static calculateConfidence(
    reading: any,
    qualityScore: { overall: number },
    warnings: string[],
    errors: string[]
  ): number {
    if (errors.length > 0) return 0;

    let confidence = qualityScore.overall;

    // Apply confidence modifiers
    if (reading.measurementMethod === 'sounder') confidence *= 1.0;
    else if (reading.measurementMethod === 'lead_line') confidence *= 0.95;
    else if (reading.measurementMethod === 'chart') confidence *= 0.8;
    else if (reading.measurementMethod === 'visual') confidence *= 0.6;

    // Reduce confidence for warnings
    confidence *= Math.max(0.5, 1 - warnings.length * 0.1);

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculates distance between two coordinates using Haversine formula
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Updates previous readings for duplicate detection
   */
  static updatePreviousReadings(userId: string, reading: DepthReading): void {
    const userReadings = this.previousReadings.get(userId) || [];
    userReadings.push(reading);

    // Keep only last 50 readings per user
    if (userReadings.length > 50) {
      userReadings.shift();
    }

    this.previousReadings.set(userId, userReadings);
  }

  /**
   * Validates environmental conditions consistency
   */
  static validateEnvironmentalConditions(conditions: any): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check for realistic combinations
    if (conditions.seaState >= 6 && conditions.visibility === 'excellent') {
      warnings.push('High sea state typically reduces visibility');
    }

    if (conditions.weatherCondition === 'very_rough' && conditions.seaState < 5) {
      warnings.push('Very rough weather typically corresponds to higher sea state');
    }

    if (conditions.windSpeed > 25 && conditions.seaState < 4) {
      warnings.push('High wind speeds typically create higher sea states');
    }

    return {
      isValid: true, // Environmental conditions are subjective, so always valid
      warnings,
    };
  }

  /**
   * Calculates tide correction accuracy
   */
  static calculateTideCorrection(
    depth: number,
    tideLevel: number,
    chartDatum: number = 0
  ): {
    correctedDepth: number;
    confidence: number;
    notes: string;
  } {
    const correctedDepth = depth + tideLevel - chartDatum;
    
    // Confidence decreases with larger tide corrections
    const correctionMagnitude = Math.abs(tideLevel - chartDatum);
    const confidence = Math.max(0.7, 1 - correctionMagnitude / 3);

    let notes = '';
    if (correctionMagnitude > 1) {
      notes = `Significant tide correction applied: ${correctionMagnitude.toFixed(1)}m`;
    }

    return {
      correctedDepth: Math.max(0, correctedDepth),
      confidence,
      notes,
    };
  }
}