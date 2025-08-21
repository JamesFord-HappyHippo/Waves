/**
 * Safety Validation Engine - Core safety algorithms and data validation
 * Handles multi-source depth validation, confidence scoring, and safety assessment
 */

import { Location, DepthReading } from '../types';

export interface SafetyValidationConfig {
  minDataPoints: number;
  maxDataAge: number; // milliseconds
  confidenceThreshold: number;
  safetyMarginRatio: number;
  useOfficialChartsOnly: boolean;
  statisticalValidation: boolean;
}

export interface DataQualityMetrics {
  totalReadings: number;
  officialReadings: number;
  crowdsourceReadings: number;
  averageAge: number;
  spatialCoverage: number;
  temporalConsistency: number;
  outlierRate: number;
  confidenceScore: number;
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  estimatedDepth: number | null;
  safetyMargin: number | null;
  qualityMetrics: DataQualityMetrics;
  validationMethod: 'interpolation' | 'official_chart' | 'ml_prediction' | 'insufficient_data';
  warnings: string[];
  recommendations: string[];
}

export interface OutlierAnalysis {
  outlierCount: number;
  outlierPercentage: number;
  suspiciousPatterns: Array<{
    type: 'depth_anomaly' | 'temporal_inconsistency' | 'spatial_gap' | 'user_reliability';
    severity: 'low' | 'medium' | 'high';
    description: string;
    affectedReadings: string[];
  }>;
}

export interface UserReliabilityScore {
  userId: string;
  score: number; // 0-1, 1 being most reliable
  contributionCount: number;
  verificationRate: number;
  outlierRate: number;
  avgConfidence: number;
  recentActivity: boolean;
  expertise: 'novice' | 'intermediate' | 'expert' | 'professional';
}

export class SafetyValidationEngine {
  private config: SafetyValidationConfig;
  private userReliability: Map<string, UserReliabilityScore> = new Map();
  private validationCache: Map<string, ValidationResult> = new Map();

  constructor(config: Partial<SafetyValidationConfig> = {}) {
    this.config = {
      minDataPoints: 3,
      maxDataAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      confidenceThreshold: 0.6,
      safetyMarginRatio: 1.5,
      useOfficialChartsOnly: false,
      statisticalValidation: true,
      ...config
    };
  }

  /**
   * Validate depth data at a specific location with comprehensive analysis
   */
  async validateDepthData(
    position: Location,
    vesselDraft: number,
    depthReadings: DepthReading[],
    officialChartData?: DepthReading[]
  ): Promise<ValidationResult> {
    const cacheKey = this.generateCacheKey(position, vesselDraft);
    const cached = this.validationCache.get(cacheKey);
    
    // Use cache if data is recent (within 5 minutes)
    if (cached && Date.now() - cached.qualityMetrics.averageAge < 300000) {
      return cached;
    }

    // Filter and prepare data
    const relevantReadings = this.filterRelevantReadings(position, depthReadings);
    const qualityMetrics = this.calculateDataQuality(relevantReadings, position);
    
    let result: ValidationResult;

    // Prioritize official chart data if available and config allows
    if (officialChartData && officialChartData.length > 0) {
      result = await this.validateWithOfficialCharts(
        position, 
        vesselDraft, 
        officialChartData, 
        relevantReadings,
        qualityMetrics
      );
    } else if (relevantReadings.length >= this.config.minDataPoints) {
      result = await this.validateWithCrowdsourceData(
        position, 
        vesselDraft, 
        relevantReadings, 
        qualityMetrics
      );
    } else {
      result = this.createInsufficientDataResult(position, vesselDraft, qualityMetrics);
    }

    // Cache result
    this.validationCache.set(cacheKey, result);
    
    // Clean old cache entries
    this.cleanValidationCache();

    return result;
  }

  /**
   * Validate using official nautical chart data
   */
  private async validateWithOfficialCharts(
    position: Location,
    vesselDraft: number,
    officialData: DepthReading[],
    crowdsourceData: DepthReading[],
    qualityMetrics: DataQualityMetrics
  ): Promise<ValidationResult> {
    const nearestOfficial = this.findNearestReadings(position, officialData, 500);
    
    if (nearestOfficial.length === 0) {
      return this.validateWithCrowdsourceData(position, vesselDraft, crowdsourceData, qualityMetrics);
    }

    const interpolatedDepth = this.interpolateDepth(position, nearestOfficial);
    const confidence = this.calculateOfficialDataConfidence(nearestOfficial, position);
    const safetyMargin = interpolatedDepth - vesselDraft;
    
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Cross-validate with crowdsource data if available
    if (crowdsourceData.length > 0) {
      const crowdsourceDepth = this.interpolateDepth(position, crowdsourceData);
      const depthDifference = Math.abs(interpolatedDepth - crowdsourceDepth);
      
      if (depthDifference > Math.max(2, interpolatedDepth * 0.2)) {
        warnings.push(`Significant difference between official chart (${interpolatedDepth.toFixed(1)}m) and crowdsource data (${crowdsourceDepth.toFixed(1)}m)`);
        recommendations.push('Exercise extra caution - verify depth with depth sounder');
      }
    }

    // Check chart data age and resolution
    const avgAge = this.calculateAverageAge(nearestOfficial);
    if (avgAge > 365 * 24 * 60 * 60 * 1000) { // Older than 1 year
      warnings.push('Chart data may be outdated - verify current conditions');
    }

    return {
      isValid: true,
      confidence: Math.min(0.95, confidence), // Official data gets high but not perfect confidence
      estimatedDepth: interpolatedDepth,
      safetyMargin,
      qualityMetrics,
      validationMethod: 'official_chart',
      warnings,
      recommendations
    };
  }

  /**
   * Validate using crowdsourced depth data with statistical analysis
   */
  private async validateWithCrowdsourceData(
    position: Location,
    vesselDraft: number,
    readings: DepthReading[],
    qualityMetrics: DataQualityMetrics
  ): Promise<ValidationResult> {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Perform outlier analysis
    const outlierAnalysis = this.performOutlierAnalysis(readings);
    const cleanedReadings = this.removeOutliers(readings, outlierAnalysis);

    if (outlierAnalysis.outlierPercentage > 0.3) {
      warnings.push(`High outlier rate (${(outlierAnalysis.outlierPercentage * 100).toFixed(1)}%) - data quality may be compromised`);
    }

    // Calculate weighted depth based on user reliability and data quality
    const weightedDepth = this.calculateWeightedDepth(position, cleanedReadings);
    const confidence = this.calculateCrowdsourceConfidence(cleanedReadings, qualityMetrics, outlierAnalysis);
    const safetyMargin = weightedDepth - vesselDraft;

    // Statistical validation
    if (this.config.statisticalValidation) {
      const statisticalAnalysis = this.performStatisticalAnalysis(cleanedReadings);
      
      if (statisticalAnalysis.standardDeviation > weightedDepth * 0.3) {
        warnings.push('High variance in depth readings - exercise caution');
        recommendations.push('Consider reducing speed and using depth sounder for verification');
      }

      if (statisticalAnalysis.sampleSize < 5) {
        warnings.push('Limited data points available for validation');
      }
    }

    // Check data freshness
    const avgAge = this.calculateAverageAge(cleanedReadings);
    if (avgAge > this.config.maxDataAge / 2) {
      warnings.push('Depth data may not reflect current conditions');
      recommendations.push('Consider environmental factors that may affect depth (tides, weather)');
    }

    // Safety recommendations based on margin
    if (safetyMargin < vesselDraft * 0.5) {
      warnings.push('Shallow water - proceed with extreme caution');
      recommendations.push('Use depth sounder, reduce speed, post lookout');
    } else if (safetyMargin < vesselDraft) {
      warnings.push('Limited clearance - monitor depth carefully');
      recommendations.push('Maintain slow speed and continuous depth monitoring');
    }

    return {
      isValid: confidence >= this.config.confidenceThreshold,
      confidence,
      estimatedDepth: weightedDepth,
      safetyMargin,
      qualityMetrics,
      validationMethod: 'interpolation',
      warnings,
      recommendations
    };
  }

  /**
   * Perform comprehensive outlier analysis
   */
  private performOutlierAnalysis(readings: DepthReading[]): OutlierAnalysis {
    if (readings.length < 3) {
      return {
        outlierCount: 0,
        outlierPercentage: 0,
        suspiciousPatterns: []
      };
    }

    const depths = readings.map(r => r.depth).sort((a, b) => a - b);
    const q1 = depths[Math.floor(depths.length * 0.25)];
    const q3 = depths[Math.floor(depths.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers = readings.filter(r => r.depth < lowerBound || r.depth > upperBound);
    const suspiciousPatterns: OutlierAnalysis['suspiciousPatterns'] = [];

    // Detect depth anomalies
    if (outliers.length > 0) {
      const extremeOutliers = outliers.filter(r => 
        r.depth < q1 - 3 * iqr || r.depth > q3 + 3 * iqr
      );
      
      if (extremeOutliers.length > 0) {
        suspiciousPatterns.push({
          type: 'depth_anomaly',
          severity: 'high',
          description: `${extremeOutliers.length} extreme depth outliers detected`,
          affectedReadings: extremeOutliers.map(r => r.id)
        });
      }
    }

    // Check for temporal inconsistencies
    const timeOrdered = [...readings].sort((a, b) => a.timestamp - b.timestamp);
    let temporalInconsistencies = 0;
    
    for (let i = 1; i < timeOrdered.length; i++) {
      const depthDiff = Math.abs(timeOrdered[i].depth - timeOrdered[i-1].depth);
      const timeDiff = timeOrdered[i].timestamp - timeOrdered[i-1].timestamp;
      
      // Flag if depth changes dramatically in short time (> 5m in < 1 hour)
      if (depthDiff > 5 && timeDiff < 3600000) {
        temporalInconsistencies++;
      }
    }

    if (temporalInconsistencies > readings.length * 0.2) {
      suspiciousPatterns.push({
        type: 'temporal_inconsistency',
        severity: 'medium',
        description: `${temporalInconsistencies} suspicious temporal depth changes`,
        affectedReadings: []
      });
    }

    // Check user reliability patterns
    const userReadings = new Map<string, DepthReading[]>();
    readings.forEach(r => {
      if (r.userId) {
        if (!userReadings.has(r.userId)) userReadings.set(r.userId, []);
        userReadings.get(r.userId)!.push(r);
      }
    });

    userReadings.forEach((userReadingList, userId) => {
      const userScore = this.userReliability.get(userId);
      if (userScore && userScore.score < 0.5 && userReadingList.length > readings.length * 0.3) {
        suspiciousPatterns.push({
          type: 'user_reliability',
          severity: 'medium',
          description: `High contribution from low-reliability user (${userId})`,
          affectedReadings: userReadingList.map(r => r.id)
        });
      }
    });

    return {
      outlierCount: outliers.length,
      outlierPercentage: outliers.length / readings.length,
      suspiciousPatterns
    };
  }

  /**
   * Remove outliers from dataset
   */
  private removeOutliers(readings: DepthReading[], analysis: OutlierAnalysis): DepthReading[] {
    const outlierIds = new Set(
      analysis.suspiciousPatterns.flatMap(p => p.affectedReadings)
    );
    
    return readings.filter(r => !outlierIds.has(r.id));
  }

  /**
   * Calculate weighted depth considering user reliability and data quality
   */
  private calculateWeightedDepth(position: Location, readings: DepthReading[]): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const reading of readings) {
      let weight = reading.confidenceScore;
      
      // Distance weighting (inverse distance squared)
      const distance = this.calculateDistance(position, {
        latitude: reading.latitude,
        longitude: reading.longitude
      });
      weight *= 1 / Math.pow(Math.max(distance, 1), 2);

      // User reliability weighting
      if (reading.userId) {
        const userScore = this.userReliability.get(reading.userId);
        if (userScore) {
          weight *= userScore.score;
        }
      }

      // Source type weighting
      const sourceWeight = reading.source === 'official' ? 2.0 : 
                          reading.source === 'predicted' ? 0.8 : 1.0;
      weight *= sourceWeight;

      // Age weighting (more recent data weighted higher)
      const age = Date.now() - reading.timestamp;
      const ageWeight = Math.exp(-age / (7 * 24 * 60 * 60 * 1000)); // Exponential decay over 7 days
      weight *= ageWeight;

      totalWeight += weight;
      weightedSum += reading.depth * weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Calculate confidence for crowdsourced data
   */
  private calculateCrowdsourceConfidence(
    readings: DepthReading[],
    qualityMetrics: DataQualityMetrics,
    outlierAnalysis: OutlierAnalysis
  ): number {
    let confidence = 0.5; // Base confidence for crowdsourced data

    // Factor in number of readings
    const sampleBonus = Math.min(0.3, readings.length * 0.05);
    confidence += sampleBonus;

    // Factor in average confidence of readings
    const avgReadingConfidence = readings.reduce((sum, r) => sum + r.confidenceScore, 0) / readings.length;
    confidence += avgReadingConfidence * 0.3;

    // Penalty for outliers
    const outlierPenalty = outlierAnalysis.outlierPercentage * 0.4;
    confidence -= outlierPenalty;

    // Factor in spatial coverage
    confidence += qualityMetrics.spatialCoverage * 0.2;

    // Penalty for old data
    const dataFreshness = Math.exp(-qualityMetrics.averageAge / (14 * 24 * 60 * 60 * 1000));
    confidence *= dataFreshness;

    return Math.max(0, Math.min(0.9, confidence)); // Cap at 0.9 for crowdsourced data
  }

  /**
   * Calculate confidence for official chart data
   */
  private calculateOfficialDataConfidence(readings: DepthReading[], position: Location): number {
    let confidence = 0.8; // Base confidence for official data

    // Factor in number of nearby readings
    confidence += Math.min(0.1, readings.length * 0.02);

    // Factor in proximity to readings
    const avgDistance = readings.reduce((sum, r) => {
      return sum + this.calculateDistance(position, {
        latitude: r.latitude,
        longitude: r.longitude
      });
    }, 0) / readings.length;

    const proximityBonus = Math.max(0, 0.1 - avgDistance / 1000); // Bonus for proximity within 1km
    confidence += proximityBonus;

    return Math.min(0.95, confidence);
  }

  /**
   * Perform statistical analysis on depth readings
   */
  private performStatisticalAnalysis(readings: DepthReading[]) {
    const depths = readings.map(r => r.depth);
    const mean = depths.reduce((sum, d) => sum + d, 0) / depths.length;
    
    const variance = depths.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / depths.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      sampleSize: readings.length,
      mean,
      standardDeviation,
      variance,
      min: Math.min(...depths),
      max: Math.max(...depths)
    };
  }

  /**
   * Calculate data quality metrics
   */
  private calculateDataQuality(readings: DepthReading[], position: Location): DataQualityMetrics {
    const totalReadings = readings.length;
    const officialReadings = readings.filter(r => r.source === 'official').length;
    const crowdsourceReadings = readings.filter(r => r.source === 'crowdsource').length;

    const currentTime = Date.now();
    const ages = readings.map(r => currentTime - r.timestamp);
    const averageAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;

    // Calculate spatial coverage (how well distributed the readings are)
    const distances = readings.map(r => this.calculateDistance(position, {
      latitude: r.latitude,
      longitude: r.longitude
    }));
    const maxDistance = Math.max(...distances);
    const spatialCoverage = maxDistance > 0 ? Math.min(1, maxDistance / 1000) : 0; // Normalize to 1km

    // Calculate temporal consistency
    const timeSorted = [...readings].sort((a, b) => a.timestamp - b.timestamp);
    let consistentPairs = 0;
    for (let i = 1; i < timeSorted.length; i++) {
      const depthDiff = Math.abs(timeSorted[i].depth - timeSorted[i-1].depth);
      if (depthDiff < 2) consistentPairs++; // Consistent if depth difference < 2m
    }
    const temporalConsistency = timeSorted.length > 1 ? consistentPairs / (timeSorted.length - 1) : 1;

    const avgConfidence = readings.reduce((sum, r) => sum + r.confidenceScore, 0) / readings.length;

    return {
      totalReadings,
      officialReadings,
      crowdsourceReadings,
      averageAge,
      spatialCoverage,
      temporalConsistency,
      outlierRate: 0, // Will be calculated by outlier analysis
      confidenceScore: avgConfidence
    };
  }

  /**
   * Filter readings relevant to position and recency
   */
  private filterRelevantReadings(position: Location, readings: DepthReading[]): DepthReading[] {
    const currentTime = Date.now();
    
    return readings.filter(reading => {
      // Check age
      if (currentTime - reading.timestamp > this.config.maxDataAge) {
        return false;
      }

      // Check proximity (within 2km)
      const distance = this.calculateDistance(position, {
        latitude: reading.latitude,
        longitude: reading.longitude
      });
      
      return distance <= 2000; // 2km radius
    });
  }

  /**
   * Find nearest readings within specified radius
   */
  private findNearestReadings(
    position: Location, 
    readings: DepthReading[], 
    radiusMeters: number
  ): DepthReading[] {
    return readings
      .filter(reading => {
        const distance = this.calculateDistance(position, {
          latitude: reading.latitude,
          longitude: reading.longitude
        });
        return distance <= radiusMeters;
      })
      .sort((a, b) => {
        const distanceA = this.calculateDistance(position, {
          latitude: a.latitude,
          longitude: a.longitude
        });
        const distanceB = this.calculateDistance(position, {
          latitude: b.latitude,
          longitude: b.longitude
        });
        return distanceA - distanceB;
      });
  }

  /**
   * Interpolate depth using inverse distance weighting
   */
  private interpolateDepth(position: Location, readings: DepthReading[]): number {
    if (readings.length === 0) return 0;
    if (readings.length === 1) return readings[0].depth;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const reading of readings) {
      const distance = this.calculateDistance(position, {
        latitude: reading.latitude,
        longitude: reading.longitude
      });
      
      // Inverse distance weighting with minimum distance to avoid division by zero
      const weight = 1 / Math.pow(Math.max(distance, 1), 2);
      totalWeight += weight * reading.confidenceScore;
      weightedSum += reading.depth * weight * reading.confidenceScore;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : readings[0].depth;
  }

  /**
   * Calculate average age of readings
   */
  private calculateAverageAge(readings: DepthReading[]): number {
    const currentTime = Date.now();
    const totalAge = readings.reduce((sum, r) => sum + (currentTime - r.timestamp), 0);
    return totalAge / readings.length;
  }

  /**
   * Calculate distance between two locations (Haversine formula)
   */
  private calculateDistance(pos1: Location, pos2: { latitude: number; longitude: number }): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = pos1.latitude * Math.PI / 180;
    const φ2 = pos2.latitude * Math.PI / 180;
    const Δφ = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const Δλ = (pos2.longitude - pos1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Create result for insufficient data scenario
   */
  private createInsufficientDataResult(
    position: Location,
    vesselDraft: number,
    qualityMetrics: DataQualityMetrics
  ): ValidationResult {
    return {
      isValid: false,
      confidence: 0,
      estimatedDepth: null,
      safetyMargin: null,
      qualityMetrics,
      validationMethod: 'insufficient_data',
      warnings: ['Insufficient depth data for safe navigation validation'],
      recommendations: [
        'Use official nautical charts',
        'Deploy depth sounder',
        'Proceed with extreme caution at reduced speed',
        'Consider alternative route'
      ]
    };
  }

  /**
   * Update user reliability scores based on contribution history
   */
  updateUserReliability(userId: string, score: Partial<UserReliabilityScore>): void {
    const existing = this.userReliability.get(userId) || {
      userId,
      score: 0.5,
      contributionCount: 0,
      verificationRate: 0,
      outlierRate: 0,
      avgConfidence: 0.5,
      recentActivity: false,
      expertise: 'novice' as const
    };

    this.userReliability.set(userId, { ...existing, ...score });
  }

  /**
   * Generate cache key for validation results
   */
  private generateCacheKey(position: Location, vesselDraft: number): string {
    const roundedLat = Math.round(position.latitude * 1000) / 1000;
    const roundedLng = Math.round(position.longitude * 1000) / 1000;
    return `${roundedLat}_${roundedLng}_${vesselDraft}`;
  }

  /**
   * Clean old entries from validation cache
   */
  private cleanValidationCache(): void {
    const maxCacheSize = 1000;
    if (this.validationCache.size > maxCacheSize) {
      const entries = Array.from(this.validationCache.entries());
      // Keep most recent 50% of entries
      entries.slice(0, entries.length / 2).forEach(([key]) => {
        this.validationCache.delete(key);
      });
    }
  }
}

export default SafetyValidationEngine;