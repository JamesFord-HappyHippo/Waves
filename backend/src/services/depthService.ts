// Depth Data Service
// PostGIS-powered depth reading and aggregation service

import { db } from '../config/database';
import { redis } from '../config/redis';
import { 
  DepthReading, 
  DepthDataRequest, 
  DepthDataResponse, 
  DepthAggregation,
  SafetyAlert,
  Point,
  BoundingBox 
} from '../types';
import { GeospatialError, ValidationError, SafetyError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import config from '../config';

export class DepthService {
  
  /**
   * Submit a new depth reading
   */
  static async submitDepthReading(
    userId: string,
    vesselId: string,
    depthData: {
      location: Point;
      depthMeters: number;
      vesselDraft: number;
      tideHeightMeters?: number;
      waterTemperatureCelsius?: number;
      bottomType?: string;
      notes?: string;
    }
  ): Promise<DepthReading> {
    try {
      // Validate depth reading
      this.validateDepthReading(depthData);

      // Check for safety violations
      const safetyCheck = this.checkSafetyViolation(depthData.depthMeters, depthData.vesselDraft);
      if (safetyCheck.violation) {
        logger.warn('Depth reading indicates potential grounding', {
          userId,
          vesselId,
          location: depthData.location,
          depth: depthData.depthMeters,
          draft: depthData.vesselDraft
        });
      }

      // Determine confidence score based on data quality
      const confidenceScore = this.calculateConfidenceScore(depthData);

      const query = `
        INSERT INTO depth_readings (
          user_id, vessel_id, location, timestamp, depth_meters, vessel_draft,
          tide_height_meters, water_temperature_celsius, bottom_type, notes,
          confidence_score
        ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10)
        RETURNING 
          id,
          user_id as "userId",
          vessel_id as "vesselId",
          ST_Y(location::geometry) as latitude,
          ST_X(location::geometry) as longitude,
          timestamp,
          depth_meters as "depthMeters",
          vessel_draft as "vesselDraft",
          tide_height_meters as "tideHeightMeters",
          water_temperature_celsius as "waterTemperatureCelsius",
          bottom_type as "bottomType",
          notes,
          confidence_score as "confidenceScore",
          verification_count as "verificationCount",
          is_verified as "isVerified",
          created_at as "createdAt"
      `;

      const result = await db.queryOne<DepthReading & { latitude: number; longitude: number }>(query, [
        userId,
        vesselId,
        db.createPoint(depthData.location.latitude, depthData.location.longitude),
        depthData.depthMeters,
        depthData.vesselDraft,
        depthData.tideHeightMeters || null,
        depthData.waterTemperatureCelsius || null,
        depthData.bottomType || null,
        depthData.notes || null,
        confidenceScore
      ]);

      // Convert lat/lng back to Point object
      const depthReading: DepthReading = {
        ...result,
        location: {
          latitude: result.latitude,
          longitude: result.longitude
        }
      };

      // Cache the reading for nearby queries
      await this.cacheDepthReading(depthReading);

      // Check if this creates any safety alerts for nearby vessels
      await this.checkNearbyVesselSafety(depthReading);

      logger.info('Depth reading submitted successfully', {
        id: depthReading.id,
        userId,
        vesselId,
        depth: depthData.depthMeters,
        confidence: confidenceScore
      });

      return depthReading;

    } catch (error) {
      logger.error('Error submitting depth reading:', error);
      throw error;
    }
  }

  /**
   * Get depth data for a specific area
   */
  static async getDepthDataForArea(request: DepthDataRequest): Promise<DepthDataResponse> {
    try {
      const { bounds, vesselDraft, confidenceLevel, maxAge } = request;

      // Create cache key for this request
      const cacheKey = this.createCacheKey(bounds, vesselDraft, confidenceLevel, maxAge);
      
      // Check cache first
      const cachedData = await redis.getCachedDepthAggregation(cacheKey);
      if (cachedData) {
        logger.debug('Returning cached depth data', { cacheKey });
        return cachedData;
      }

      // Build time constraint
      const maxAgeHours = maxAge || config.safety.maxTrackAgeHours;
      const timeConstraint = `timestamp > NOW() - INTERVAL '${maxAgeHours} hours'`;

      // Build confidence constraint
      let confidenceConstraint = '';
      if (confidenceLevel) {
        const confidenceLevels = {
          low: ['low', 'medium', 'high', 'verified'],
          medium: ['medium', 'high', 'verified'],
          high: ['high', 'verified'],
          verified: ['verified']
        };
        const allowedLevels = confidenceLevels[confidenceLevel].map(l => `'${l}'`).join(',');
        confidenceConstraint = `AND confidence_score IN (${allowedLevels})`;
      }

      // Get individual depth readings
      const readingsQuery = `
        SELECT 
          id,
          user_id as "userId",
          vessel_id as "vesselId",
          ${db.extractCoordinates('location')},
          timestamp,
          depth_meters as "depthMeters",
          vessel_draft as "vesselDraft",
          tide_height_meters as "tideHeightMeters",
          confidence_score as "confidenceScore",
          verification_count as "verificationCount",
          is_verified as "isVerified",
          bottom_type as "bottomType",
          notes
        FROM depth_readings
        WHERE ${db.createBoundsCondition('location', bounds.northEast, bounds.southWest)}
        AND ${timeConstraint}
        ${confidenceConstraint}
        ORDER BY timestamp DESC
        LIMIT 1000
      `;

      const readings = await db.query<DepthReading & { latitude: number; longitude: number }>(readingsQuery);

      // Convert to proper format
      const formattedReadings: DepthReading[] = readings.map(r => ({
        ...r,
        location: { latitude: r.latitude, longitude: r.longitude }
      }));

      // Get aggregated data using PostGIS
      const aggregationQuery = `
        SELECT 
          ST_Y(center_point) as latitude,
          ST_X(center_point) as longitude,
          avg_depth,
          min_depth,
          max_depth,
          reading_count,
          confidence_avg
        FROM aggregate_depth_data(
          ST_MakeEnvelope($1, $2, $3, $4, 4326),
          0.002  -- Grid size approximately 200m
        )
        WHERE reading_count >= 3  -- Minimum readings for reliability
      `;

      const aggregations = await db.query<DepthAggregation & { latitude: number; longitude: number }>(
        aggregationQuery,
        [bounds.southWest.longitude, bounds.southWest.latitude, bounds.northEast.longitude, bounds.northEast.latitude]
      );

      const formattedAggregations: DepthAggregation[] = aggregations.map(a => ({
        centerPoint: { latitude: a.latitude, longitude: a.longitude },
        avgDepth: a.avg_depth,
        minDepth: a.min_depth,
        maxDepth: a.max_depth,
        readingCount: a.reading_count,
        confidenceAvg: a.confidence_avg,
        gridSize: 0.002
      }));

      // Generate safety warnings if vessel draft is provided
      const safetyWarnings: SafetyAlert[] = [];
      if (vesselDraft) {
        const dangerousReadings = formattedReadings.filter(r => 
          r.depthMeters < (vesselDraft + config.safety.safetyMarginMeters)
        );

        for (const reading of dangerousReadings) {
          safetyWarnings.push({
            id: `safety_${reading.id}`,
            userId: '', // Will be filled by calling function
            alertType: 'shallow_water',
            severity: this.calculateSafetySeverity(reading.depthMeters, vesselDraft),
            location: reading.location,
            message: `Shallow water detected: ${reading.depthMeters}m depth (vessel draft: ${vesselDraft}m)`,
            recommendedAction: 'Reduce speed and navigate with extreme caution. Verify with official charts.',
            isAcknowledged: false,
            createdAt: new Date()
          });
        }
      }

      // Calculate data quality score
      const dataQualityScore = this.calculateDataQualityScore(formattedReadings);

      const response: DepthDataResponse = {
        readings: formattedReadings,
        aggregatedData: formattedAggregations,
        safetyWarnings,
        dataQualityScore
      };

      // Cache the response for 5 minutes
      await redis.cacheDepthAggregation(cacheKey, response, 300);

      logger.info('Depth data retrieved for area', {
        bounds,
        readingCount: formattedReadings.length,
        aggregationCount: formattedAggregations.length,
        safetyWarnings: safetyWarnings.length
      });

      return response;

    } catch (error) {
      logger.error('Error retrieving depth data for area:', error);
      throw new GeospatialError('Failed to retrieve depth data for the specified area');
    }
  }

  /**
   * Get nearest depth readings to a specific point
   */
  static async getNearestDepthReadings(
    location: Point,
    radiusMeters: number = 1000,
    maxResults: number = 10
  ): Promise<DepthReading[]> {
    try {
      const query = `
        SELECT 
          id,
          user_id as "userId",
          vessel_id as "vesselId",
          ${db.extractCoordinates('location')},
          timestamp,
          depth_meters as "depthMeters",
          vessel_draft as "vesselDraft",
          confidence_score as "confidenceScore",
          is_verified as "isVerified",
          ST_Distance(location, ${db.createPoint(location.latitude, location.longitude)}) as distance_meters
        FROM depth_readings
        WHERE ${db.createDistanceCondition('location', location, radiusMeters)}
        AND timestamp > NOW() - INTERVAL '90 days'
        ORDER BY location <-> ${db.createPoint(location.latitude, location.longitude)}
        LIMIT $1
      `;

      const readings = await db.query<DepthReading & { latitude: number; longitude: number; distance_meters: number }>(
        query, [maxResults]
      );

      return readings.map(r => ({
        ...r,
        location: { latitude: r.latitude, longitude: r.longitude }
      }));

    } catch (error) {
      logger.error('Error getting nearest depth readings:', error);
      throw error;
    }
  }

  /**
   * Verify a depth reading
   */
  static async verifyDepthReading(
    readingId: string,
    verifierId: string,
    isVerified: boolean
  ): Promise<void> {
    try {
      const query = `
        UPDATE depth_readings 
        SET 
          is_verified = $1,
          verified_by = $2,
          verified_at = NOW(),
          verification_count = verification_count + 1,
          confidence_score = CASE 
            WHEN $1 = true THEN 'verified'::depth_confidence
            ELSE confidence_score
          END
        WHERE id = $3
      `;

      await db.query(query, [isVerified, verifierId, readingId]);

      logger.info('Depth reading verification updated', {
        readingId,
        verifierId,
        isVerified
      });

    } catch (error) {
      logger.error('Error verifying depth reading:', error);
      throw error;
    }
  }

  // Private helper methods

  private static validateDepthReading(depthData: any): void {
    if (!depthData.location || !depthData.location.latitude || !depthData.location.longitude) {
      throw new ValidationError('Valid location coordinates are required');
    }

    if (depthData.depthMeters <= 0 || depthData.depthMeters > 11000) {
      throw new ValidationError('Depth must be between 0 and 11000 meters');
    }

    if (depthData.vesselDraft <= 0 || depthData.vesselDraft > 50) {
      throw new ValidationError('Vessel draft must be between 0 and 50 meters');
    }

    if (Math.abs(depthData.location.latitude) > 90) {
      throw new ValidationError('Latitude must be between -90 and 90 degrees');
    }

    if (Math.abs(depthData.location.longitude) > 180) {
      throw new ValidationError('Longitude must be between -180 and 180 degrees');
    }
  }

  private static checkSafetyViolation(depthMeters: number, vesselDraft: number): { violation: boolean; severity: number } {
    const clearance = depthMeters - vesselDraft;
    const safetyMargin = config.safety.safetyMarginMeters;

    if (clearance < safetyMargin) {
      const severity = clearance <= 0 ? 5 : Math.max(1, 5 - Math.floor(clearance / safetyMargin * 5));
      return { violation: true, severity };
    }

    return { violation: false, severity: 0 };
  }

  private static calculateConfidenceScore(depthData: any): 'low' | 'medium' | 'high' {
    let score = 0;

    // Base score for having depth and location
    score += 2;

    // Additional points for extra data
    if (depthData.tideHeightMeters !== undefined) score += 1;
    if (depthData.waterTemperatureCelsius !== undefined) score += 1;
    if (depthData.bottomType) score += 1;

    // Score based on depth reasonableness
    if (depthData.depthMeters >= 1 && depthData.depthMeters <= 200) score += 1;

    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  private static calculateSafetySeverity(depthMeters: number, vesselDraft: number): number {
    const clearance = depthMeters - vesselDraft;
    const safetyMargin = config.safety.safetyMarginMeters;

    if (clearance <= 0) return 5; // Critical - grounding risk
    if (clearance < safetyMargin) return 4; // High - very shallow
    if (clearance < safetyMargin * 2) return 3; // Medium - shallow
    if (clearance < safetyMargin * 3) return 2; // Low - caution
    return 1; // Minimal - note only
  }

  private static calculateDataQualityScore(readings: DepthReading[]): number {
    if (readings.length === 0) return 0;

    const verifiedCount = readings.filter(r => r.isVerified).length;
    const highConfidenceCount = readings.filter(r => 
      r.confidenceScore === 'high' || r.confidenceScore === 'verified'
    ).length;
    
    const recentCount = readings.filter(r => 
      new Date(r.timestamp).getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000) // Last 7 days
    ).length;

    const verificationScore = (verifiedCount / readings.length) * 0.4;
    const confidenceScore = (highConfidenceCount / readings.length) * 0.4;
    const freshnessScore = (recentCount / readings.length) * 0.2;

    return Math.round((verificationScore + confidenceScore + freshnessScore) * 100);
  }

  private static createCacheKey(
    bounds: BoundingBox,
    vesselDraft?: number,
    confidenceLevel?: string,
    maxAge?: number
  ): string {
    const boundsStr = `${bounds.southWest.latitude},${bounds.southWest.longitude}_${bounds.northEast.latitude},${bounds.northEast.longitude}`;
    return `depth_${boundsStr}_${vesselDraft || 'all'}_${confidenceLevel || 'all'}_${maxAge || 24}`;
  }

  private static async cacheDepthReading(reading: DepthReading): Promise<void> {
    try {
      const cacheKey = `reading_${reading.location.latitude.toFixed(4)}_${reading.location.longitude.toFixed(4)}`;
      await redis.cacheDepthAggregation(cacheKey, reading, 3600); // Cache for 1 hour
    } catch (error) {
      logger.warn('Failed to cache depth reading:', error);
    }
  }

  private static async checkNearbyVesselSafety(reading: DepthReading): Promise<void> {
    try {
      // This would integrate with real-time vessel tracking
      // For now, just log potential safety concerns
      if (reading.depthMeters < config.safety.minDepthThreshold) {
        logger.warn('Shallow water depth reading detected', {
          readingId: reading.id,
          location: reading.location,
          depth: reading.depthMeters
        });
      }
    } catch (error) {
      logger.warn('Failed to check nearby vessel safety:', error);
    }
  }
}