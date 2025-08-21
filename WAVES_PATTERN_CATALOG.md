# Waves Marine Navigation Platform - Code Pattern Catalog

## Overview

This comprehensive catalog documents all reusable code patterns from the Waves marine navigation platform. These patterns have been proven in production and optimized for marine navigation use cases, providing a foundation for rapid development of maritime applications.

## Table of Contents

1. [React Native Component Patterns](#react-native-component-patterns)
2. [Lambda Function Patterns](#lambda-function-patterns)
3. [Database & PostGIS Patterns](#database--postgis-patterns)
4. [API Route Patterns](#api-route-patterns)
5. [Service Layer Patterns](#service-layer-patterns)
6. [Redux Store Patterns](#redux-store-patterns)
7. [Utility & Helper Patterns](#utility--helper-patterns)
8. [Authentication & Security Patterns](#authentication--security-patterns)
9. [Infrastructure & Deployment Patterns](#infrastructure--deployment-patterns)
10. [Maritime Domain Patterns](#maritime-domain-patterns)

---

## React Native Component Patterns

### Marine Interface Component Pattern

**Purpose**: Marine-optimized UI components with environmental adaptations
**File**: `/src/components/marine-interface/MapView.tsx`

```typescript
interface MapViewProps {
  userLocation: Location;
  depthData: DepthReading[];
  route: NavigationRoute | null;
  displayMode: 'standard' | '3d_preview';
  onDepthTap: (reading: DepthReading) => void;
  onRouteRequest: (destination: Location) => void;
  onModeSwitch: (mode: 'map' | '3d' | 'split') => void;
}

const WavesMapView: React.FC<MapViewProps> = ({ ... }) => {
  // Marine condition adaptations
  const uiAdapter = useMemo(() => new MarineUIAdapter(), []);
  const batteryOptimizer = useMemo(() => new BatteryOptimizer(), []);
  
  // Adapt UI for marine conditions
  useEffect(() => {
    uiAdapter.adaptForConditions(marineConditions);
  }, [marineConditions, uiAdapter]);

  // Marine-specific MapBox configuration
  const mapStyle = useMemo(() => ({
    version: 8,
    sources: {
      'depth-data': {
        type: 'geojson',
        data: depthGeoJSON,
        cluster: viewState.zoom < 12,
        clusterRadius: 50
      },
      'nautical-charts': {
        type: 'raster',
        tiles: ['https://seamlessrnc.nauticalcharts.noaa.gov/...']
      }
    },
    layers: [/* Depth-colored layers */]
  }), [depthGeoJSON, viewState.zoom]);
};
```

**Key Features**:
- Marine condition adaptation
- Battery optimization for extended trips
- Depth-colored GeoJSON rendering
- NOAA nautical chart integration
- Real-time GPS tracking optimization

### Quality Indicator Component Pattern

**Purpose**: Visual data quality representation for navigation safety
**File**: `/src/components/depth/DepthQualityIndicator.tsx`

```typescript
interface ValidationResult {
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

export const DepthQualityIndicator: React.FC<{
  validation: ValidationResult;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}> = ({ validation, size = 'medium', showDetails = false }) => {
  const getQualityLevel = (score: number): 'high' | 'medium' | 'low' => {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.indicator, { backgroundColor: qualityColor }]}>
        <Icon name={qualityIcon} size={sizeStyles.iconSize} color="#FFFFFF" />
        <Text style={styles.indicatorText}>
          {Math.round(validation.confidence * 100)}%
        </Text>
      </View>
      
      {showDetails && (
        <View style={styles.scoreBreakdown}>
          {/* GPS, Environmental, Consistency scores */}
        </View>
      )}
    </View>
  );
};
```

### Safety Dashboard Pattern

**Purpose**: Comprehensive safety monitoring interface
**File**: `/src/components/safety/SafetyDashboard.tsx`

```typescript
const SafetyDashboard: React.FC<SafetyDashboardProps> = ({
  safetyStatus,
  activeAlerts,
  navigationStatus,
  complianceCheck,
  emergencyIncidents,
  onEmergencyReport,
  // ... other handlers
}) => {
  // Safety status color coding
  const getSafetyStatusColor = () => {
    if (emergencyIncidents.some(i => i.status !== 'resolved')) return '#CC0000';
    if (activeAlerts.some(a => a.severity === 'critical')) return '#FF4444';
    if (activeAlerts.some(a => a.severity === 'warning')) return '#FF8800';
    return '#00C851';
  };

  return (
    <ScrollView style={styles.container}>
      {/* Safety Status Header */}
      <LinearGradient colors={[getSafetyStatusColor(), getSafetyStatusColor() + '80']}>
        <View style={styles.statusContent}>
          <MaterialIcons name="security" size={32} color="white" />
          <Text style={styles.statusValue}>{getSafetyStatusText()}</Text>
        </View>
      </LinearGradient>

      {/* Emergency Button */}
      <TouchableOpacity style={styles.emergencyButton} onPress={onEmergencyReport}>
        <LinearGradient colors={['#FF0000', '#CC0000']}>
          <MaterialIcons name="emergency" size={24} color="white" />
          <Text style={styles.emergencyText}>REPORT EMERGENCY</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Key Safety Metrics Grid */}
      <View style={styles.metricsGrid}>
        {/* Depth Safety, Data Quality, Compliance, Navigation Status */}
      </View>
    </ScrollView>
  );
};
```

---

## Lambda Function Patterns

### Depth Handler Pattern

**Purpose**: Serverless depth data processing with PostGIS integration
**File**: `/backend/src/lambda/depthHandler.ts`

```typescript
// Database connection pool (reused across invocations)
let dbPool: Pool | null = null;

const getDbPool = (): Pool => {
  if (!dbPool) {
    dbPool = new Pool({
      host: process.env.RDS_HOSTNAME,
      port: parseInt(process.env.RDS_PORT || '5432'),
      database: process.env.RDS_DB_NAME,
      user: process.env.RDS_USERNAME,
      password: process.env.RDS_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return dbPool;
};

// Standardized API response pattern
const createSuccessResponse = (data: any, message?: string): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  },
  body: JSON.stringify({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  }),
});

export const getDepthReadings = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const queryParams = DepthQuerySchema.parse(event.queryStringParameters || {});
    const pool = getDbPool();
    const client = await pool.connect();
    
    try {
      // PostGIS spatial query
      const query = `
        SELECT 
          id, latitude, longitude, depth, confidence,
          vessel_draft, timestamp, user_id,
          ST_Distance(
            ST_Point(longitude, latitude)::geography,
            ST_Point($2, $1)::geography
          ) as distance_meters
        FROM depth_readings 
        WHERE 
          ST_DWithin(
            ST_Point(longitude, latitude)::geography,
            ST_Point($2, $1)::geography,
            $3
          )
          AND timestamp > NOW() - INTERVAL '${queryParams.maxAge} days'
          AND confidence > 0.5
        ORDER BY distance_meters ASC, confidence DESC
        LIMIT 100
      `;
      
      const result = await client.query(query, [
        queryParams.latitude,
        queryParams.longitude,
        queryParams.radius,
      ]);
      
      return createSuccessResponse({
        readings: result.rows,
        safety_notice: "Always verify depth readings with your depth sounder.",
        count: result.rows.length,
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(400, 'Invalid query parameters', error.errors);
    }
    return createErrorResponse(500, 'Internal server error');
  }
};
```

### Weather Handler Pattern

**Purpose**: Marine weather data integration with NOAA APIs
**File**: `/backend/src/lambda/weatherHandler.ts`

```typescript
async function fetchNoaaWeather(latitude: number, longitude: number): Promise<any> {
  try {
    // Get nearest weather station
    const stationsResponse = await fetch(
      `https://api.weather.gov/points/${latitude},${longitude}`
    );
    
    if (!stationsResponse.ok) {
      throw new Error(`NOAA API error: ${stationsResponse.status}`);
    }
    
    const stationsData = await stationsResponse.json();
    const forecastUrl = stationsData.properties.forecast;
    
    // Get current observations and forecast in parallel
    const [observationData, forecastData] = await Promise.allSettled([
      fetchCurrentObservations(stationsData.properties.observationStations),
      fetchForecast(forecastUrl)
    ]);
    
    return {
      current: observationData.status === 'fulfilled' ? observationData.value : null,
      forecast: forecastData.status === 'fulfilled' ? forecastData.value : null
    };
  } catch (error) {
    console.error('NOAA weather fetch error:', error);
    throw error;
  }
}

export const getMarineWeather = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const queryParams = WeatherQuerySchema.parse(event.queryStringParameters || {});
    
    // Try NOAA first, fallback to OpenWeatherMap
    let weatherData;
    try {
      weatherData = await fetchNoaaWeather(queryParams.latitude, queryParams.longitude);
    } catch (noaaError) {
      console.warn('NOAA data unavailable, using fallback:', noaaError);
      weatherData = await fetchMarineData(queryParams.latitude, queryParams.longitude);
    }
    
    // Get tide data if requested
    if (queryParams.includeTides) {
      const tideData = await fetchTideData(queryParams.latitude, queryParams.longitude);
      if (tideData) {
        weatherData.marine.tide = tideData;
      }
    }
    
    return createSuccessResponse({
      weather: weatherData,
      dataSources: ['NOAA', 'OpenWeatherMap'],
      safety_notice: "Weather data is for informational purposes. Always check official marine forecasts.",
    });
  } catch (error) {
    return createErrorResponse(500, 'Weather service unavailable');
  }
};
```

---

## Database & PostGIS Patterns

### Core Schema Pattern

**Purpose**: Marine-optimized PostgreSQL schema with PostGIS extensions
**File**: `/backend/database/migrations/001_initial_schema.sql`

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Marine-specific custom types
CREATE TYPE vessel_type AS ENUM ('sailboat', 'powerboat', 'catamaran', 'trawler', 'yacht', 'dinghy', 'pwc', 'other');
CREATE TYPE depth_confidence AS ENUM ('low', 'medium', 'high', 'verified');
CREATE TYPE weather_condition AS ENUM ('calm', 'light_wind', 'moderate_wind', 'strong_wind', 'storm', 'fog', 'rain');

-- Depth readings with TimescaleDB optimization
CREATE TABLE depth_readings (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    depth_meters DECIMAL(6,2) NOT NULL CHECK (depth_meters > 0),
    vessel_draft DECIMAL(4,2) NOT NULL,
    tide_height_meters DECIMAL(4,2),
    confidence_score depth_confidence DEFAULT 'medium',
    verification_count INTEGER DEFAULT 0,
    sonar_frequency_khz INTEGER,
    water_temperature_celsius DECIMAL(4,1),
    bottom_type VARCHAR(50),
    notes TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable for time-series optimization
SELECT create_hypertable('depth_readings', 'timestamp');
```

### Spatial Index Pattern

**Purpose**: Optimized PostGIS indexes for marine geospatial queries
**File**: `/backend/database/migrations/002_indexes_and_constraints.sql`

```sql
-- Spatial indexes for PostGIS geometry/geography columns
CREATE INDEX idx_depth_readings_location ON depth_readings USING GIST (location);
CREATE INDEX idx_gps_tracks_location ON gps_tracks USING GIST (location);
CREATE INDEX idx_marine_areas_geometry ON marine_areas USING GIST (geometry);

-- Composite indexes for common marine query patterns
CREATE INDEX idx_depth_readings_location_timestamp ON depth_readings USING GIST (location, timestamp);
CREATE INDEX idx_depth_readings_confidence_verified ON depth_readings (confidence_score, is_verified);

-- Custom function for distance calculations in nautical miles
CREATE OR REPLACE FUNCTION calculate_distance_nm(
    lat1 DECIMAL, lon1 DECIMAL, 
    lat2 DECIMAL, lon2 DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ST_Distance(
        ST_GeogFromText('POINT(' || lon1 || ' ' || lat1 || ')'),
        ST_GeogFromText('POINT(' || lon2 || ' ' || lat2 || ')')
    ) * 0.000539957; -- Convert meters to nautical miles
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Marine safety function: check for shallow water
CREATE OR REPLACE FUNCTION is_shallow_water(
    check_location GEOGRAPHY,
    vessel_draft DECIMAL,
    safety_margin DECIMAL DEFAULT 0.5
)
RETURNS BOOLEAN AS $$
DECLARE
    min_depth DECIMAL;
BEGIN
    SELECT MIN(depth_meters) INTO min_depth
    FROM depth_readings
    WHERE ST_DWithin(location, check_location, 100) -- 100m radius
    AND confidence_score IN ('high', 'verified')
    AND timestamp > NOW() - INTERVAL '30 days';
    
    IF min_depth IS NULL THEN
        RETURN FALSE; -- No data available
    END IF;
    
    RETURN min_depth < (vessel_draft + safety_margin);
END;
$$ LANGUAGE plpgsql STABLE;
```

### Depth Aggregation Pattern

**Purpose**: Efficient spatial data aggregation for marine areas
**File**: `/backend/database/migrations/002_indexes_and_constraints.sql`

```sql
-- Function to aggregate depth data for areas with grid snapping
CREATE OR REPLACE FUNCTION aggregate_depth_data(
    bounds GEOMETRY,
    grid_size_degrees DECIMAL DEFAULT 0.001
)
RETURNS TABLE(
    center_point GEOMETRY,
    avg_depth DECIMAL,
    min_depth DECIMAL,
    max_depth DECIMAL,
    reading_count INTEGER,
    confidence_avg DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ST_Centroid(ST_Collect(ST_Transform(location::geometry, 4326))) as center_point,
        AVG(depth_meters) as avg_depth,
        MIN(depth_meters) as min_depth,
        MAX(depth_meters) as max_depth,
        COUNT(*)::INTEGER as reading_count,
        AVG(CASE 
            WHEN dr.confidence_score = 'low' THEN 1
            WHEN dr.confidence_score = 'medium' THEN 2
            WHEN dr.confidence_score = 'high' THEN 3
            WHEN dr.confidence_score = 'verified' THEN 4
            ELSE 2
        END) as confidence_avg
    FROM depth_readings dr
    WHERE ST_Within(ST_Transform(location::geometry, 4326), bounds)
    AND timestamp > NOW() - INTERVAL '90 days'
    GROUP BY ST_SnapToGrid(ST_Transform(location::geometry, 4326), grid_size_degrees);
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## API Route Patterns

### Authenticated Route Pattern

**Purpose**: Secure API routes with JWT authentication and validation
**File**: `/backend/src/routes/depth.ts`

```typescript
export default async function depthRoutes(fastify: FastifyInstance) {
  /**
   * Submit Depth Reading
   * POST /api/depth/report
   */
  fastify.post<{ Body: DepthReportRequest }>(
    '/report',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: depthReportSchema,
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: AuthenticatedRequest & { Body: DepthReportRequest }, reply: FastifyReply) => {
      try {
        const { location, depthMeters, vesselId } = request.body;

        // Validate input
        const { error } = depthReportSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Verify vessel ownership
        const vessel = await fastify.db.queryOne(
          'SELECT id FROM vessels WHERE id = $1 AND owner_id = $2 AND is_active = true',
          [vesselId, request.user.id]
        );
        
        if (!vessel) {
          throw new ValidationError('Invalid vessel ID or vessel does not belong to user');
        }

        // Submit depth reading
        const reading = await DepthService.submitDepthReading(
          request.user.id,
          vesselId,
          { location, depthMeters, vesselDraft: 0 }
        );

        // Log the submission
        logger.info('Depth reading submitted', {
          userId: request.user.id,
          vesselId,
          readingId: reading.id,
          location,
          depth: depthMeters
        });

        reply.status(201).send({
          success: true,
          data: { reading },
          message: 'Depth reading submitted successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );
}
```

### Role-Based Authorization Pattern

**Purpose**: Permission-based access control for marine data verification
**File**: `/backend/src/routes/depth.ts`

```typescript
/**
 * Verify Depth Reading (Captain/Admin only)
 * POST /api/depth/readings/:id/verify
 */
fastify.post<{ Params: { id: string }; Body: VerifyDepthRequest }>(
  '/readings/:id/verify',
  {
    preHandler: [
      fastify.authenticate,
      async (request: AuthenticatedRequest, reply: FastifyReply) => {
        if (!['captain', 'admin'].includes(request.user.role)) {
          reply.status(403).send({
            success: false,
            message: 'Only captains and administrators can verify depth readings',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }
      }
    ]
  },
  async (request: AuthenticatedRequest & { Params: { id: string }; Body: VerifyDepthRequest }, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { isVerified } = request.body;

      await DepthService.verifyDepthReading(id, request.user.id, isVerified);

      logger.info('Depth reading verification updated', {
        readingId: id,
        verifierId: request.user.id,
        verifierRole: request.user.role,
        isVerified
      });

      reply.send({
        success: true,
        data: {
          readingId: id,
          isVerified,
          verifiedBy: request.user.id,
          verifiedAt: new Date()
        },
        message: `Depth reading ${isVerified ? 'verified' : 'unverified'} successfully`
      });

    } catch (error) {
      throw error;
    }
  }
);
```

### Pagination Pattern

**Purpose**: Efficient data pagination for large marine datasets
**File**: `/backend/src/routes/depth.ts`

```typescript
/**
 * Get User's Depth Reading History
 * GET /api/depth/history
 */
fastify.get(
  '/history',
  {
    preHandler: fastify.authenticate,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          vesselId: { type: 'string' }
        }
      }
    }
  },
  async (request: AuthenticatedRequest & { 
    Querystring: { page: number; limit: number; vesselId?: string } 
  }, reply: FastifyReply) => {
    try {
      const { page, limit, vesselId } = request.query;
      const offset = (page - 1) * limit;

      let vesselFilter = '';
      let params = [request.user.id, limit, offset];

      if (vesselId) {
        vesselFilter = 'AND vessel_id = $4';
        params.push(vesselId);
      }

      const readings = await fastify.db.query(`
        SELECT 
          id, vessel_id as "vesselId",
          ST_Y(location::geometry) as latitude,
          ST_X(location::geometry) as longitude,
          timestamp, depth_meters as "depthMeters",
          confidence_score as "confidenceScore",
          verification_count as "verificationCount",
          is_verified as "isVerified"
        FROM depth_readings
        WHERE user_id = $1 ${vesselFilter}
        ORDER BY timestamp DESC
        LIMIT $2 OFFSET $3
      `, params);

      // Get total count for pagination
      const countParams = vesselFilter ? [request.user.id, vesselId] : [request.user.id];
      const { total } = await fastify.db.queryOne(`
        SELECT COUNT(*) as total
        FROM depth_readings
        WHERE user_id = $1 ${vesselFilter}
      `, countParams);

      reply.send({
        success: true,
        data: {
          readings: readings.map(r => ({
            ...r,
            location: { latitude: r.latitude, longitude: r.longitude }
          })),
          pagination: {
            page,
            limit,
            total: parseInt(total),
            totalPages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
          }
        },
        message: 'Depth reading history retrieved successfully'
      });

    } catch (error) {
      throw error;
    }
  }
);
```

---

## Service Layer Patterns

### Marine API Client Pattern

**Purpose**: NOAA Tides & Currents API integration with caching and rate limiting
**File**: `/src/services/environmental/NoaaApiClient.ts`

```typescript
export class NoaaApiClient {
  private baseUrl = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
  private stationCache = new Map<string, NoaaStation[]>();
  private dataCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private requestQueue: Promise<any>[] = [];
  private maxConcurrentRequests = 5;

  /**
   * Rate limiting and request queuing
   */
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    while (this.requestQueue.length >= this.maxConcurrentRequests) {
      await Promise.race(this.requestQueue);
    }

    const promise = requestFn().finally(() => {
      const index = this.requestQueue.indexOf(promise);
      if (index > -1) {
        this.requestQueue.splice(index, 1);
      }
    });

    this.requestQueue.push(promise);
    return promise;
  }

  /**
   * Cache management with TTL
   */
  private getCached<T>(key: string): T | null {
    const cached = this.dataCache.get(key);
    if (cached && Date.now() < cached.timestamp + cached.ttl) {
      return cached.data as T;
    }
    this.dataCache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttlMinutes: number): void {
    this.dataCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    });
  }

  /**
   * Get tide predictions for a station
   */
  async getTidePredictions(params: DataQueryParams): Promise<TidePrediction[]> {
    const cacheKey = `predictions_${params.stationId}_${params.beginDate}_${params.endDate}`;
    const cached = this.getCached<TidePrediction[]>(cacheKey);
    if (cached) {
      return cached;
    }

    return this.queueRequest(async () => {
      try {
        const queryParams = new URLSearchParams({
          product: 'predictions',
          application: 'WavesApp',
          format: 'json',
          station: params.stationId,
          datum: params.datum || 'MLLW',
          units: params.units || 'metric',
          time_zone: params.timeZone || 'gmt',
          interval: 'hilo' // High/Low only for tide predictions
        });

        const response = await fetch(`${this.baseUrl}?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error(`NOAA API request failed: ${response.status} ${response.statusText}`);
        }

        const data: NoaaApiResponse<{ t: string; v: string; type: string }> = await response.json();
        
        const predictions: TidePrediction[] = data.data.map(item => ({
          time: item.t,
          value: parseFloat(item.v),
          type: item.type as 'H' | 'L'
        }));

        this.setCache(cacheKey, predictions, 60); // Cache for 1 hour
        return predictions;
      } catch (error) {
        console.error('Error fetching tide predictions:', error);
        throw new Error(`Failed to fetch tide predictions: ${error}`);
      }
    });
  }
}
```

### Data Validation Service Pattern

**Purpose**: Marine navigation safety validation for depth readings
**File**: `/src/services/depth/DepthDataValidator.ts`

```typescript
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
   * Checks if reading is an outlier compared to nearby readings
   */
  private static checkForOutliers(
    reading: { latitude: number; longitude: number; depth: number }
  ): { 
    isOutlier: boolean; 
    expectedRange?: { min: number; max: number };
    nearbyCount?: number;
  } {
    // Find readings within 100m
    const nearbyDepths = this.nearbyReadings
      .filter(r => {
        const distance = this.calculateDistance(
          reading.latitude, reading.longitude,
          r.latitude, r.longitude
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
```

---

## Redux Store Patterns

### Enhanced Slice Pattern

**Purpose**: Marine-specific state management with environmental integration
**File**: `/src/store/slices/depthSlice.ts`

```typescript
export interface DepthState {
  nearbyReadings: DepthReading[];
  userReadings: DepthReading[];
  processedReadings: ProcessedDepthReading[];
  currentDepth: number | null;
  correctedDepth: number | null;
  depthQuality: QualityScore | null;
  
  isReporting: boolean;
  reportingMode: 'manual' | 'automatic';
  vesselDraft: number;
  safetyMargin: number;
  depthAlerts: boolean;
  minSafeDepth: number;
  
  // Environmental integration settings
  enableTideCorrections: boolean;
  enableEnvironmentalCorrections: boolean;
  qualityThreshold: number;
  displayMode: 'raw' | 'corrected' | 'both';
  
  // Active alerts
  activeAlerts: DepthAlert[];
  alertSettings: {
    shallowWaterThreshold: number;
    dataQualityThreshold: number;
    enableAudioAlerts: boolean;
    enableVibrationAlerts: boolean;
    autoAcknowledgeTimeout: number;
  };
  
  error: string | null;
  lastEnvironmentalUpdate: number | null;
}

export const depthSlice = createSlice({
  name: 'depth',
  initialState,
  reducers: {
    updateDepthCorrections: (state, action: PayloadAction<{
      tideCorrection?: TideCorrection;
      environmentalFactors?: EnvironmentalFactors;
      quality?: QualityScore;
    }>) => {
      // Update the current depth reading with corrections
      if (state.currentDepth !== null) {
        const { tideCorrection, environmentalFactors, quality } = action.payload;
        
        let correctedDepth = state.currentDepth;
        if (tideCorrection && state.enableTideCorrections) {
          correctedDepth = tideCorrection.correctedDepth;
        }
        if (environmentalFactors && state.enableEnvironmentalCorrections) {
          correctedDepth += environmentalFactors.totalCorrection;
        }
        
        state.correctedDepth = correctedDepth;
        state.depthQuality = quality || null;
        state.lastEnvironmentalUpdate = Date.now();
      }
    },
    
    updateVesselDraft: (state, action: PayloadAction<number>) => {
      state.vesselDraft = action.payload;
      // Recalculate minimum safe depth
      state.minSafeDepth = action.payload + state.safetyMargin;
      // Update shallow water alert threshold
      state.alertSettings.shallowWaterThreshold = action.payload + state.safetyMargin;
    },

    addDepthAlert: (state, action: PayloadAction<DepthAlert>) => {
      // Avoid duplicate alerts
      const existingAlert = state.activeAlerts.find(
        alert => alert.type === action.payload.type && !alert.acknowledged
      );
      
      if (!existingAlert) {
        state.activeAlerts.push(action.payload);
      }
    },
    
    // Auto-acknowledge expired alerts
    autoAcknowledgeExpiredAlerts: (state) => {
      const now = Date.now();
      const timeout = state.alertSettings.autoAcknowledgeTimeout * 1000;
      
      state.activeAlerts.forEach(alert => {
        if (alert.autoAcknowledge !== false && 
            !alert.acknowledged && 
            now - alert.timestamp > timeout) {
          alert.acknowledged = true;
        }
      });
    },
  },
});

// Computed selectors
export const selectEffectiveDepth = (state: { depth: DepthState }) => {
  const { currentDepth, correctedDepth, displayMode } = state.depth;
  
  switch (displayMode) {
    case 'raw':
      return currentDepth;
    case 'corrected':
      return correctedDepth || currentDepth;
    case 'both':
      return { raw: currentDepth, corrected: correctedDepth };
    default:
      return correctedDepth || currentDepth;
  }
};

export const selectDepthSafety = (state: { depth: DepthState }) => {
  const { correctedDepth, currentDepth, vesselDraft, safetyMargin, depthQuality } = state.depth;
  const effectiveDepth = correctedDepth || currentDepth;
  
  if (effectiveDepth === null) {
    return { status: 'unknown', margin: null, quality: null };
  }
  
  const clearance = effectiveDepth - vesselDraft;
  const isSafe = clearance >= safetyMargin;
  const qualityScore = depthQuality?.score || 0;
  
  return {
    status: isSafe ? 'safe' : 'unsafe',
    clearance,
    margin: clearance - safetyMargin,
    quality: qualityScore,
    reliability: qualityScore > 0.8 ? 'high' : qualityScore > 0.6 ? 'medium' : 'low'
  };
};
```

### RTK Query API Pattern

**Purpose**: Marine data fetching with caching and environmental integration
**File**: `/src/store/api/wavesApi.ts`

```typescript
export const wavesApi = createApi({
  reducerPath: 'wavesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: Config.API_BASE_URL || 'https://api.wavesapp.com',
    prepareHeaders: (headers, {getState}) => {
      headers.set('Content-Type', 'application/json');
      
      // Add authorization if available
      // const token = (getState() as RootState).auth?.token;
      // if (token) {
      //   headers.set('Authorization', `Bearer ${token}`);
      // }
      
      return headers;
    },
  }),
  tagTypes: ['DepthData', 'WeatherData', 'TideData', 'UserData'],
  endpoints: (builder) => ({
    // Depth data endpoints
    getDepthData: builder.query<DepthReading[], DepthDataQuery>({
      query: ({latitude, longitude, radius = 1000, draft, minConfidence = 0.7}) =>
        `/depth?lat=${latitude}&lon=${longitude}&radius=${radius}&draft=${draft}&minConfidence=${minConfidence}`,
      providesTags: ['DepthData'],
      keepUnusedDataFor: 300, // Cache for 5 minutes
    }),
    
    // Enhanced environmental data endpoints
    getEnvironmentalData: builder.query<EnvironmentalData, {
      latitude: number;
      longitude: number;
      includeWeather?: boolean;
      includeTides?: boolean;
      includeAlerts?: boolean;
    }>({
      query: ({latitude, longitude, includeWeather = true, includeTides = true, includeAlerts = true}) => {
        const params = new URLSearchParams({
          lat: latitude.toString(),
          lon: longitude.toString(),
          weather: includeWeather.toString(),
          tides: includeTides.toString(),
          alerts: includeAlerts.toString()
        });
        return `/environmental?${params.toString()}`;
      },
      providesTags: ['WeatherData', 'TideData'],
      keepUnusedDataFor: 900, // Cache for 15 minutes
    }),

    processDepthReading: builder.mutation<any, ProcessDepthRequest>({
      query: (request) => ({
        url: '/depth/process',
        method: 'POST',
        body: request,
      }),
      invalidatesTags: ['DepthData'],
    }),

    // Offline sync endpoint
    syncOfflineData: builder.mutation<{success: boolean}, {
      depthReadings: DepthReading[];
      trackingData: any[];
      environmentalData?: any[];
    }>({
      query: (data) => ({
        url: '/sync',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['DepthData', 'WeatherData', 'TideData'],
    }),
  }),
});

export const {
  useGetDepthDataQuery,
  useSubmitDepthReadingMutation,
  useGetEnvironmentalDataQuery,
  useProcessDepthReadingMutation,
  useSyncOfflineDataMutation,
} = wavesApi;
```

---

## Utility & Helper Patterns

### Marine Color System Pattern

**Purpose**: Depth-based safety color coding optimized for marine conditions
**File**: `/src/utils/DepthColorSystem.ts`

```typescript
// Color definitions optimized for marine conditions and accessibility
export const DepthColors = {
  // Primary safety colors - optimized for sunlight readability
  SAFE_GREEN: '#00C851',        // Deep water - safe navigation
  CAUTION_YELLOW: '#FFB000',    // Minimal clearance - proceed with caution  
  DANGER_RED: '#FF4444',        // Shallow water - avoid or extreme caution
  
  // Secondary indicators
  UNKNOWN_GRAY: '#6C757D',      // No data available
  LOW_CONFIDENCE: '#B0BEC5',    // Uncertain data quality
  VERY_SHALLOW: '#CC0000',      // Extremely shallow - immediate danger
  
  // High contrast variants for bright sunlight conditions
  SAFE_GREEN_HC: '#00A844',
  CAUTION_YELLOW_HC: '#E69500', 
  DANGER_RED_HC: '#E53935',
  
  // Night mode variants - reduced blue light
  SAFE_GREEN_NIGHT: '#26A69A',
  CAUTION_YELLOW_NIGHT: '#FFA726',
  DANGER_RED_NIGHT: '#EF5350',
};

export const RiskProfiles: Record<string, RiskProfile> = {
  conservative: { 
    safetyMultiplier: 2.5, 
    confidenceMin: 0.8,
    alertSensitivity: 0.8
  },
  moderate: { 
    safetyMultiplier: 1.8, 
    confidenceMin: 0.6,
    alertSensitivity: 0.6
  },
  aggressive: { 
    safetyMultiplier: 1.3, 
    confidenceMin: 0.4,
    alertSensitivity: 0.4
  },
  professional: {
    safetyMultiplier: 2.0,
    confidenceMin: 0.7,
    alertSensitivity: 0.7
  }
};

export class DepthColorCalculator {
  private colorPalette: Record<string, string>;
  
  constructor(displayMode: DisplayMode = { contrast: 'standard', brightness: 1.0, colorBlindness: 'none' }) {
    this.colorPalette = this.selectColorPalette(displayMode);
  }
  
  /**
   * Calculate appropriate color for a depth reading
   */
  calculateDepthColor(
    depth: number,
    thresholds: DepthThresholds, 
    confidence: number,
    riskProfile: RiskProfile = RiskProfiles.moderate
  ): string {
    // Handle missing or invalid data
    if (depth === null || depth === undefined || isNaN(depth)) {
      return this.colorPalette.UNKNOWN_GRAY;
    }
    
    // Apply confidence penalty
    if (confidence < thresholds.confidenceThreshold) {
      return this.colorPalette.LOW_CONFIDENCE;
    }
    
    // Calculate effective depth with tide correction
    const effectiveDepth = depth + thresholds.tideCorrection;
    
    // Calculate safety thresholds
    const minSafeDepth = thresholds.vesselDraft + 
                        (thresholds.safetyMargin * riskProfile.safetyMultiplier);
    const cautionDepth = minSafeDepth * 1.5;
    const dangerDepth = minSafeDepth * 0.8;
    const criticalDepth = thresholds.vesselDraft * 0.9;
    
    // Determine color based on safety analysis
    if (effectiveDepth < criticalDepth) {
      return this.colorPalette.VERY_SHALLOW;
    } else if (effectiveDepth < dangerDepth) {
      return this.colorPalette.DANGER_RED;
    } else if (effectiveDepth < minSafeDepth) {
      return this.colorPalette.CAUTION_YELLOW;
    } else if (effectiveDepth < cautionDepth) {
      // Gradient between caution and safe based on confidence
      return confidence > 0.8 ? 
             this.colorPalette.SAFE_GREEN : 
             this.colorPalette.CAUTION_YELLOW;
    } else {
      return this.colorPalette.SAFE_GREEN;
    }
  }
  
  /**
   * Adjust colors for color blindness accessibility
   */
  private adjustForColorBlindness(
    palette: Record<string, string>, 
    type: 'protanopia' | 'deuteranopia' | 'tritanopia'
  ): Record<string, string> {
    // Color blind friendly alternatives
    const adjustedPalette = { ...palette };
    
    switch (type) {
      case 'protanopia': // Red-blind
        adjustedPalette.DANGER_RED = '#FF6B1A'; // Orange instead of red
        adjustedPalette.SAFE_GREEN = '#0099CC'; // Blue-green
        break;
      case 'deuteranopia': // Green-blind  
        adjustedPalette.SAFE_GREEN = '#0099CC'; // Blue
        adjustedPalette.CAUTION_YELLOW = '#FFCC00'; // More saturated yellow
        break;
      case 'tritanopia': // Blue-blind
        adjustedPalette.SAFE_GREEN = '#00CC66'; // More green
        adjustedPalette.CAUTION_YELLOW = '#FF9900'; // Orange-yellow
        break;
    }
    
    return adjustedPalette;
  }
}
```

---

## Authentication & Security Patterns

### JWT Authentication Pattern

**Purpose**: Secure JWT token management with refresh token rotation
**File**: `/backend/src/routes/auth.ts`

```typescript
export default async function authRoutes(fastify: FastifyInstance) {
  
  /**
   * User Registration
   * POST /api/auth/register
   */
  fastify.post<{ Body: RegisterRequest }>(
    '/register',
    {
      schema: {
        body: registerSchema,
        response: { 201: { /* response schema */ } }
      }
    },
    async (request: FastifyRequest<{ Body: RegisterRequest }>, reply: FastifyReply) => {
      try {
        const { email, password, firstName, lastName, phone } = request.body;

        // Validate input
        const { error } = registerSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Check if user already exists
        const existingUser = await AuthService.emailExists(email);
        if (existingUser) {
          throw new ConflictError('An account with this email already exists');
        }

        // Create new user
        const user = await AuthService.createUser({
          email, password, firstName, lastName, phone
        });

        // Create session and tokens
        const deviceInfo = {
          userAgent: request.headers['user-agent'],
          platform: 'web'
        };

        const { sessionId, refreshToken } = await SessionManager.createSession(
          user.id,
          deviceInfo,
          request.ip,
          request.headers['user-agent']
        );

        const tokens = await TokenManager.generateTokens(fastify, user.id, sessionId);

        // Remove sensitive data from user object
        const { privacySettings, ...safeUser } = user;

        reply.status(201).send({
          success: true,
          data: {
            user: safeUser,
            tokens: {
              accessToken: tokens.accessToken,
              refreshToken,
              expiresIn: tokens.expiresIn
            }
          },
          message: 'Account created successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * Refresh Access Token
   * POST /api/auth/refresh
   */
  fastify.post<{ Body: RefreshTokenRequest }>(
    '/refresh',
    {
      schema: { body: refreshTokenSchema }
    },
    async (request: FastifyRequest<{ Body: RefreshTokenRequest }>, reply: FastifyReply) => {
      try {
        const { refreshToken, sessionId } = request.body;

        // Validate input
        const { error } = refreshTokenSchema.validate(request.body);
        if (error) {
          throw new ValidationError(error.details[0].message);
        }

        // Extract user ID from token header (if present)
        const authHeader = request.headers.authorization;
        let userId: string | null = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.slice(7);
          const decoded = TokenManager.decodeToken(token);
          userId = decoded?.userId;
        }

        if (!userId) {
          throw new ValidationError('User identification required for token refresh');
        }

        // Refresh session
        const refreshResult = await SessionManager.refreshSession(userId, sessionId, refreshToken);
        
        if (!refreshResult.valid) {
          throw new ValidationError('Invalid or expired refresh token');
        }

        // Generate new access token
        const tokens = await TokenManager.generateTokens(
          fastify, 
          userId, 
          refreshResult.newSessionId!
        );

        reply.send({
          success: true,
          data: {
            tokens: {
              accessToken: tokens.accessToken,
              refreshToken: refreshResult.newRefreshToken,
              expiresIn: tokens.expiresIn
            }
          },
          message: 'Token refreshed successfully'
        });

      } catch (error) {
        throw error;
      }
    }
  );
}
```

### Password Security Pattern

**Purpose**: Secure password validation with marine industry requirements
**File**: `/backend/src/routes/auth.ts`

```typescript
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'any.required': 'Password is required'
  }),
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number'
  })
});
```

---

## Infrastructure & Deployment Patterns

### Multi-Environment Terraform Pattern

**Purpose**: Production-ready AWS infrastructure with marine-specific optimizations
**File**: `/infrastructure/aws/terraform/main.tf`

```hcl
# Waves Marine Navigation Platform - AWS Infrastructure
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "waves-terraform-state"
    key            = "waves/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "waves-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Waves"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Team        = "Marine-Navigation"
    }
  }
}

# RDS - PostgreSQL with PostGIS
module "database" {
  source = "./modules/rds"

  vpc_id              = module.vpc.vpc_id
  db_subnet_group_name = module.vpc.database_subnet_group_name
  security_group_ids  = [module.security_groups.rds_security_group_id]
  
  environment     = var.environment
  project_name    = var.project_name
  
  # PostGIS optimized instance
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  
  db_name     = var.db_name
  db_username = var.db_username
  db_password = random_password.db_password.result
  
  # High performance for geospatial queries
  performance_insights_enabled = true
  monitoring_interval = 60
  
  # Backup and maintenance
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  # Enable deletion protection for production
  deletion_protection = var.environment == "production" ? true : false
}

# ECS Cluster for backend services
module "ecs" {
  source = "./modules/ecs"

  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnets
  public_subnet_ids   = module.vpc.public_subnets
  security_group_ids  = [module.security_groups.ecs_security_group_id]
  
  # Environment variables for backend
  environment_variables = [
    {
      name  = "NODE_ENV"
      value = var.environment
    },
    {
      name  = "DATABASE_URL"
      value = "postgresql://${var.db_username}:${random_password.db_password.result}@${module.database.db_endpoint}:5432/${var.db_name}"
    },
    {
      name  = "REDIS_URL"
      value = "redis://${module.redis.primary_endpoint}:6379"
    },
    {
      name  = "MAPBOX_ACCESS_TOKEN"
      value = var.mapbox_access_token
    },
    {
      name  = "NOAA_API_KEY"
      value = var.noaa_api_key
    }
  ]
}

# Secrets Manager for API keys and sensitive data
resource "aws_secretsmanager_secret" "api_keys" {
  name        = "${var.project_name}-${var.environment}-api-keys"
  description = "API keys and secrets for Waves marine navigation platform"
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id
  secret_string = jsonencode({
    database_password    = random_password.db_password.result
    jwt_secret          = var.jwt_secret
    jwt_refresh_secret  = var.jwt_refresh_secret
    mapbox_access_token = var.mapbox_access_token
    noaa_api_key        = var.noaa_api_key
    openweather_api_key = var.openweather_api_key
    stormglass_api_key  = var.stormglass_api_key
  })
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = module.ecs.service_name
    ClusterName = module.ecs.cluster_name
  }
}
```

---

## Maritime Domain Patterns

### Safety Alert Hierarchy Pattern

**Purpose**: Marine safety alert prioritization and management
**File**: `/src/utils/SafetyAlertHierarchy.ts`

```typescript
export interface SafetyAlert {
  id: string;
  type: SafetyAlertType;
  severity: AlertSeverity;
  priority: number;
  title: string;
  message: string;
  timestamp: number;
  location?: { latitude: number; longitude: number };
  acknowledged: boolean;
  autoAcknowledge?: boolean;
  expiresAt?: number;
  actionRequired?: boolean;
  relatedData?: any;
}

export enum SafetyAlertType {
  SHALLOW_WATER = 'shallow_water',
  NAVIGATION_HAZARD = 'navigation_hazard',
  WEATHER_WARNING = 'weather_warning',
  EQUIPMENT_FAILURE = 'equipment_failure',
  EMERGENCY = 'emergency',
  DATA_QUALITY = 'data_quality',
  REGULATORY = 'regulatory',
  COLLISION_RISK = 'collision_risk'
}

export enum AlertSeverity {
  INFO = 'info',
  CAUTION = 'caution', 
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

export class SafetyAlertManager {
  private static readonly PRIORITY_MATRIX: Record<SafetyAlertType, Record<AlertSeverity, number>> = {
    [SafetyAlertType.EMERGENCY]: {
      [AlertSeverity.EMERGENCY]: 1000,
      [AlertSeverity.CRITICAL]: 950,
      [AlertSeverity.WARNING]: 900,
      [AlertSeverity.CAUTION]: 850,
      [AlertSeverity.INFO]: 800
    },
    [SafetyAlertType.COLLISION_RISK]: {
      [AlertSeverity.EMERGENCY]: 950,
      [AlertSeverity.CRITICAL]: 900,
      [AlertSeverity.WARNING]: 850,
      [AlertSeverity.CAUTION]: 800,
      [AlertSeverity.INFO]: 750
    },
    [SafetyAlertType.SHALLOW_WATER]: {
      [AlertSeverity.EMERGENCY]: 900,
      [AlertSeverity.CRITICAL]: 850,
      [AlertSeverity.WARNING]: 800,
      [AlertSeverity.CAUTION]: 750,
      [AlertSeverity.INFO]: 700
    },
    // ... other alert types
  };

  static calculatePriority(type: SafetyAlertType, severity: AlertSeverity): number {
    return this.PRIORITY_MATRIX[type]?.[severity] || 500;
  }

  static createShallowWaterAlert(
    depthReading: DepthReading,
    vesselDraft: number,
    safetyMargin: number
  ): SafetyAlert {
    const clearance = depthReading.depth - vesselDraft;
    let severity: AlertSeverity;
    let actionRequired = false;

    if (clearance < 0) {
      severity = AlertSeverity.EMERGENCY;
      actionRequired = true;
    } else if (clearance < safetyMargin * 0.5) {
      severity = AlertSeverity.CRITICAL;
      actionRequired = true;
    } else if (clearance < safetyMargin) {
      severity = AlertSeverity.WARNING;
    } else {
      severity = AlertSeverity.CAUTION;
    }

    return {
      id: `shallow_${depthReading.id}_${Date.now()}`,
      type: SafetyAlertType.SHALLOW_WATER,
      severity,
      priority: this.calculatePriority(SafetyAlertType.SHALLOW_WATER, severity),
      title: 'Shallow Water Alert',
      message: `Depth: ${depthReading.depth.toFixed(1)}m, Clearance: ${clearance.toFixed(1)}m`,
      timestamp: Date.now(),
      location: {
        latitude: depthReading.latitude,
        longitude: depthReading.longitude
      },
      acknowledged: false,
      actionRequired,
      autoAcknowledge: severity === AlertSeverity.CAUTION,
      relatedData: { depthReading, vesselDraft, safetyMargin }
    };
  }

  static sortAlertsByPriority(alerts: SafetyAlert[]): SafetyAlert[] {
    return alerts.sort((a, b) => {
      // Emergency alerts first
      if (a.severity === AlertSeverity.EMERGENCY && b.severity !== AlertSeverity.EMERGENCY) return -1;
      if (b.severity === AlertSeverity.EMERGENCY && a.severity !== AlertSeverity.EMERGENCY) return 1;
      
      // Then by priority score
      if (a.priority !== b.priority) return b.priority - a.priority;
      
      // Then by timestamp (newest first)
      return b.timestamp - a.timestamp;
    });
  }

  static getAlertVisualization(alert: SafetyAlert): {
    color: string;
    icon: string;
    animation: 'none' | 'pulse' | 'flash';
    sound: boolean;
    vibration: boolean;
  } {
    const baseConfig = {
      color: '#FF9500',
      icon: 'warning',
      animation: 'none' as const,
      sound: false,
      vibration: false
    };

    switch (alert.severity) {
      case AlertSeverity.EMERGENCY:
        return {
          ...baseConfig,
          color: '#CC0000',
          icon: 'emergency',
          animation: 'flash',
          sound: true,
          vibration: true
        };
      case AlertSeverity.CRITICAL:
        return {
          ...baseConfig,
          color: '#FF3B30',
          icon: 'warning',
          animation: 'pulse',
          sound: true,
          vibration: true
        };
      case AlertSeverity.WARNING:
        return {
          ...baseConfig,
          color: '#FF9500',
          icon: 'warning',
          animation: 'pulse',
          sound: true,
          vibration: false
        };
      case AlertSeverity.CAUTION:
        return {
          ...baseConfig,
          color: '#FFB000',
          icon: 'info',
          animation: 'none',
          sound: false,
          vibration: false
        };
      default:
        return baseConfig;
    }
  }
}
```

### Emergency Protocol Pattern

**Purpose**: Marine emergency response and communication protocols
**File**: `/src/utils/EmergencyProtocolManager.ts`

```typescript
export interface EmergencyIncident {
  id: string;
  type: EmergencyType;
  severity: EmergencySeverity;
  status: IncidentStatus;
  location: { latitude: number; longitude: number };
  timestamp: number;
  reportedBy: string;
  description: string;
  vesselsNearby: NearbyVessel[];
  coastGuardNotified: boolean;
  maydayBroadcast: boolean;
  automaticResponse?: AutomaticResponse;
  followUpActions: FollowUpAction[];
}

export enum EmergencyType {
  GROUNDING = 'grounding',
  COLLISION = 'collision',
  FIRE = 'fire',
  FLOODING = 'flooding',
  MEDICAL = 'medical',
  MECHANICAL_FAILURE = 'mechanical_failure',
  PERSON_OVERBOARD = 'person_overboard',
  DISTRESS_CALL = 'distress_call',
  SEARCH_AND_RESCUE = 'search_and_rescue'
}

export class EmergencyProtocolManager {
  static async initiateEmergencyResponse(
    type: EmergencyType,
    location: { latitude: number; longitude: number },
    description: string,
    reportedBy: string
  ): Promise<EmergencyIncident> {
    const incident: EmergencyIncident = {
      id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: this.determineSeverity(type, description),
      status: IncidentStatus.ACTIVE,
      location,
      timestamp: Date.now(),
      reportedBy,
      description,
      vesselsNearby: [],
      coastGuardNotified: false,
      maydayBroadcast: false,
      followUpActions: []
    };

    // Automatic response protocols
    incident.automaticResponse = await this.executeAutomaticResponse(incident);

    // Notify nearby vessels
    incident.vesselsNearby = await this.findNearbyVessels(location, 5000); // 5km radius

    // Determine if Coast Guard notification is required
    if (this.requiresCoastGuardNotification(incident)) {
      await this.notifyCoastGuard(incident);
      incident.coastGuardNotified = true;
    }

    // Determine if Mayday broadcast is required
    if (this.requiresMaydayBroadcast(incident)) {
      await this.broadcastMayday(incident);
      incident.maydayBroadcast = true;
    }

    return incident;
  }

  private static determineSeverity(type: EmergencyType, description: string): EmergencySeverity {
    // Life-threatening emergencies
    if ([
      EmergencyType.FIRE,
      EmergencyType.FLOODING,
      EmergencyType.PERSON_OVERBOARD,
      EmergencyType.MEDICAL
    ].includes(type)) {
      return EmergencySeverity.LIFE_THREATENING;
    }

    // Navigation hazards
    if ([
      EmergencyType.GROUNDING,
      EmergencyType.COLLISION,
      EmergencyType.MECHANICAL_FAILURE
    ].includes(type)) {
      // Check description for severity indicators
      if (description.toLowerCase().includes('taking on water') ||
          description.toLowerCase().includes('engine failure') ||
          description.toLowerCase().includes('steering')) {
        return EmergencySeverity.VESSEL_IN_DISTRESS;
      }
      return EmergencySeverity.NAVIGATION_HAZARD;
    }

    return EmergencySeverity.SAFETY_CONCERN;
  }

  private static requiresCoastGuardNotification(incident: EmergencyIncident): boolean {
    return incident.severity === EmergencySeverity.LIFE_THREATENING ||
           incident.severity === EmergencySeverity.VESSEL_IN_DISTRESS ||
           incident.type === EmergencyType.SEARCH_AND_RESCUE;
  }

  private static requiresMaydayBroadcast(incident: EmergencyIncident): boolean {
    return incident.severity === EmergencySeverity.LIFE_THREATENING;
  }

  private static async executeAutomaticResponse(incident: EmergencyIncident): Promise<AutomaticResponse> {
    const actions: string[] = [];

    // Send location to emergency contacts
    actions.push('Emergency location shared with registered contacts');

    // Activate emergency beacon if available
    if (incident.severity === EmergencySeverity.LIFE_THREATENING) {
      actions.push('Emergency beacon activated');
    }

    // Log incident for SAR coordination
    actions.push('Incident logged with Search and Rescue coordination system');

    // Generate safety recommendations
    const recommendations = this.generateSafetyRecommendations(incident);
    actions.push(`Safety recommendations generated: ${recommendations.join(', ')}`);

    return {
      timestamp: Date.now(),
      actionsPerformed: actions,
      nextSteps: this.generateNextSteps(incident),
      estimatedResponseTime: this.calculateResponseTime(incident)
    };
  }

  private static generateSafetyRecommendations(incident: EmergencyIncident): string[] {
    const recommendations: string[] = [];

    switch (incident.type) {
      case EmergencyType.GROUNDING:
        recommendations.push('Stop engines immediately');
        recommendations.push('Check for hull damage and water ingress');
        recommendations.push('Do not attempt to reverse off ground without assessing damage');
        recommendations.push('Signal for assistance if unable to refloat safely');
        break;

      case EmergencyType.FIRE:
        recommendations.push('Sound alarm and muster crew');
        recommendations.push('Attempt to extinguish if safe to do so');
        recommendations.push('Prepare for abandon ship if fire spreads');
        recommendations.push('Mayday call if fire cannot be controlled');
        break;

      case EmergencyType.PERSON_OVERBOARD:
        recommendations.push('Throw flotation device immediately');
        recommendations.push('Assign spotter to maintain visual contact');
        recommendations.push('Execute MOB recovery maneuver');
        recommendations.push('Call for assistance if unable to recover');
        break;

      case EmergencyType.MEDICAL:
        recommendations.push('Assess patient condition');
        recommendations.push('Provide first aid as trained');
        recommendations.push('Contact Coast Guard for medical advice');
        recommendations.push('Prepare for medical evacuation if required');
        break;
    }

    return recommendations;
  }

  static async updateIncidentStatus(
    incidentId: string,
    status: IncidentStatus,
    notes?: string
  ): Promise<void> {
    // Update incident status
    // Log status change
    // Notify relevant parties
    // Update follow-up actions if needed
  }

  static generateEmergencyReport(incident: EmergencyIncident): EmergencyReport {
    return {
      incidentId: incident.id,
      type: incident.type,
      location: incident.location,
      timestamp: incident.timestamp,
      duration: Date.now() - incident.timestamp,
      outcome: incident.status,
      responseActions: incident.automaticResponse?.actionsPerformed || [],
      lessonsLearned: this.generateLessonsLearned(incident),
      recommendations: this.generateFutureRecommendations(incident)
    };
  }
}
```

---

## Pattern Usage Guidelines

### Implementation Best Practices

1. **Always start with the base pattern** and adapt to your specific needs
2. **Maintain marine safety standards** in all implementations
3. **Test patterns thoroughly** in marine conditions (poor connectivity, bright sunlight, etc.)
4. **Document any modifications** to patterns for team knowledge sharing
5. **Follow the established error handling** and logging patterns
6. **Implement proper data validation** using the validation patterns
7. **Use TypeScript interfaces** consistently across all patterns

### Pattern Selection Guide

- **Use React Native Component Patterns** for marine-optimized mobile UI
- **Use Lambda Function Patterns** for serverless backend processing
- **Use Database Patterns** for PostGIS spatial operations
- **Use API Route Patterns** for secure marine data endpoints
- **Use Service Layer Patterns** for external API integrations (NOAA, weather)
- **Use Redux Patterns** for complex marine navigation state management
- **Use Utility Patterns** for marine-specific calculations and formatting
- **Use Security Patterns** for user authentication and data protection
- **Use Infrastructure Patterns** for production AWS deployments
- **Use Maritime Domain Patterns** for safety-critical marine operations

### Testing Recommendations

Each pattern should be tested with:

```bash
# Component testing
npm run test:components

# API testing  
npm run test:api

# Database testing
npm run test:database

# Integration testing
npm run test:integration

# Performance testing
npm run test:performance

# Marine-specific testing
npm run test:marine-conditions
npm run test:offline-capability
npm run test:battery-optimization
```

---

## Contributing to the Pattern Library

### Adding New Patterns

1. **Document the pattern purpose** and marine navigation use case
2. **Include complete code examples** with TypeScript types
3. **Provide usage examples** and configuration options
4. **Add test coverage** for the pattern
5. **Document any dependencies** and setup requirements
6. **Include performance considerations** for marine environments
7. **Add accessibility considerations** for marine conditions

### Pattern Review Checklist

- [ ] Marine safety compliance verified
- [ ] Offline capability tested
- [ ] Battery optimization implemented
- [ ] GPS accuracy handling included
- [ ] Error handling comprehensive
- [ ] TypeScript types complete
- [ ] Documentation thorough
- [ ] Test coverage adequate
- [ ] Performance optimized
- [ ] Accessibility considered

---

This pattern catalog provides a comprehensive foundation for building marine navigation applications with proven, production-ready code patterns optimized for maritime use cases.