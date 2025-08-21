# Marine Navigation Agent Knowledge Base

**Agent Type**: Specialized Navigation & GPS Processing  
**Last Updated**: 2025-08-20T00:00:00Z
**Domain Focus**: Marine navigation software, GPS tracking, safety-critical systems

## Core Responsibilities

1. **GPS Processing**: Efficient real-time location tracking and route calculation
2. **Navigation Safety**: Safety-critical validation for marine navigation features
3. **Battery Optimization**: Mobile-first GPS tracking with power efficiency
4. **Offline Navigation**: Core navigation features that work without connectivity
5. **Maritime Compliance**: Navigation software following maritime safety standards

## Marine Navigation Patterns

### GPS Tracking Optimization ✅
```typescript
// Battery-efficient location tracking pattern
import Geolocation from 'react-native-geolocation-service';

interface LocationConfig {
  enableHighAccuracy: boolean;
  distanceFilter: number;    // Minimum distance (meters) to trigger update
  interval: number;          // Update frequency (ms)
  fastestInterval: number;   // Maximum update frequency (ms)
  forceRequestLocation?: boolean;
  showLocationDialog?: boolean;
}

const optimizedTrackingConfig: LocationConfig = {
  enableHighAccuracy: true,
  distanceFilter: 10,        // Update every 10 meters
  interval: 5000,            // Check every 5 seconds
  fastestInterval: 2000,     // Max once per 2 seconds
  forceRequestLocation: true,
  showLocationDialog: true,
};

export const startMarineTracking = async (onLocationUpdate: LocationCallback) => {
  const permission = await requestLocationPermission();
  if (permission !== 'granted') {
    throw new NavigationError('Location permission required for marine navigation');
  }

  const watchId = Geolocation.watchPosition(
    (position) => {
      const marineLocation: MarineLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        speed: position.coords.speed,
        heading: position.coords.heading,
        // Marine-specific fields
        estimatedDepth: estimateDepthAtLocation(position.coords),
        navigationZone: determineNavigationZone(position.coords),
        safetyStatus: assessSafetyStatus(position.coords)
      };
      onLocationUpdate(marineLocation);
    },
    (error) => handleLocationError(error),
    optimizedTrackingConfig
  );

  return watchId;
};
```

### Depth Data Processing ✅
```typescript
// Safety-critical depth data validation
export interface DepthReading {
  location: {
    latitude: number;
    longitude: number;
  };
  depth: number;              // Depth in meters
  confidence: number;         // 0-1 confidence score
  timestamp: Date;
  vesselDraft: number;        // Reporting vessel draft
  tideCorrection?: number;    // Tide correction applied
  source: 'crowdsourced' | 'chart' | 'sonar';
}

export const validateDepthData = (reading: DepthReading): ValidationResult => {
  const errors: string[] = [];
  
  // Safety-critical validations
  if (!isValidCoordinate(reading.location)) {
    errors.push('Invalid GPS coordinates');
  }
  
  if (reading.depth < 0 || reading.depth > 1000) {
    errors.push('Depth reading out of reasonable range (0-1000m)');
  }
  
  if (reading.confidence < 0 || reading.confidence > 1) {
    errors.push('Confidence score must be between 0 and 1');
  }
  
  if (reading.vesselDraft <= 0 || reading.vesselDraft > 20) {
    errors.push('Vessel draft must be between 0 and 20 meters');
  }
  
  // Time validation - readings older than 1 year are suspect
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  if (reading.timestamp < oneYearAgo) {
    errors.push('Depth reading timestamp is too old');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    safetyLevel: calculateSafetyLevel(reading)
  };
};
```

### Route Safety Calculation ✅
```typescript
// Safe passage route calculation
export interface RouteRequest {
  startPoint: GPSCoordinate;
  endPoint: GPSCoordinate;
  vesselDraft: number;
  safetyMargin: number;      // Additional depth margin (meters)
  avoidShallowWater: boolean;
  preferDeepWater: boolean;
}

export const calculateSafeRoute = async (request: RouteRequest): Promise<SafeRoute> => {
  // Validate input parameters
  if (request.vesselDraft <= 0) {
    throw new NavigationError('Vessel draft must be greater than 0');
  }
  
  if (request.safetyMargin < 0.5) {
    throw new NavigationError('Safety margin must be at least 0.5 meters');
  }
  
  // Calculate minimum depth required
  const minDepthRequired = request.vesselDraft + request.safetyMargin;
  
  // Query depth data along potential routes
  const depthData = await queryDepthAlongRoute(
    request.startPoint,
    request.endPoint,
    minDepthRequired
  );
  
  // Generate route waypoints avoiding shallow areas
  const routePoints = await generateSafeWaypoints(
    request.startPoint,
    request.endPoint,
    depthData,
    {
      minDepth: minDepthRequired,
      avoidShallow: request.avoidShallowWater,
      preferDeep: request.preferDeepWater
    }
  );
  
  return {
    waypoints: routePoints,
    totalDistance: calculateRouteDistance(routePoints),
    estimatedTime: calculateTransitTime(routePoints, request.vesselDraft),
    safetyScore: calculateRouteSafetyScore(routePoints, depthData),
    warnings: generateRouteWarnings(routePoints, depthData),
    disclaimer: NAVIGATION_DISCLAIMER
  };
};
```

## PostGIS Spatial Queries for Marine Data

### Depth Data Aggregation ✅
```sql
-- Aggregate depth readings in a grid for visualization
SELECT 
    ST_AsGeoJSON(ST_Centroid(ST_Collect(location))) as center_point,
    AVG(depth_reading)::NUMERIC(10,2) as avg_depth,
    MIN(depth_reading)::NUMERIC(10,2) as min_depth,
    MAX(depth_reading)::NUMERIC(10,2) as max_depth,
    COUNT(*) as reading_count,
    AVG(confidence_score)::NUMERIC(3,2) as avg_confidence,
    STRING_AGG(DISTINCT vessel_type, ', ') as reporting_vessels
FROM depth_readings 
WHERE ST_Within(
    location,
    ST_MakeEnvelope($1, $2, $3, $4, 4326)  -- Bounding box
)
AND reading_timestamp > NOW() - INTERVAL '30 days'
AND confidence_score > 0.5
GROUP BY ST_SnapToGrid(location, 0.001)  -- ~100m grid cells
HAVING COUNT(*) >= 2  -- Require multiple readings for reliability
ORDER BY avg_confidence DESC;
```

### Safe Route Planning ✅
```sql
-- Find safe passage corridors based on vessel draft
WITH route_corridor AS (
    SELECT ST_MakeLine(ST_MakePoint($1, $2), ST_MakePoint($3, $4)) as route_line
),
buffered_route AS (
    SELECT ST_Buffer(route_line::geography, $5)::geometry as search_area
    FROM route_corridor
)
SELECT 
    dr.location,
    dr.depth_reading,
    dr.confidence_score,
    ST_Distance(dr.location::geography, rc.route_line::geography) as distance_from_route
FROM depth_readings dr, route_corridor rc, buffered_route br
WHERE ST_Within(dr.location, br.search_area)
AND dr.depth_reading >= $6  -- Minimum safe depth (vessel_draft + safety_margin)
AND dr.confidence_score > 0.7
AND dr.reading_timestamp > NOW() - INTERVAL '90 days'
ORDER BY distance_from_route ASC, confidence_score DESC;
```

## Safety-Critical Error Handling

### Navigation Error Types ✅
```typescript
export class NavigationError extends Error {
  constructor(
    message: string,
    public readonly severity: 'warning' | 'error' | 'critical' = 'error',
    public readonly location?: GPSCoordinate,
    public readonly affectedFeatures?: string[]
  ) {
    super(message);
    this.name = 'NavigationError';
  }
}

export class DepthDataError extends NavigationError {
  constructor(message: string, public readonly depthReading?: DepthReading) {
    super(message, 'critical');
    this.name = 'DepthDataError';
  }
}

export const handleMaritimeError = (error: Error, context: NavigationContext): ErrorResponse => {
  // Log all navigation errors for safety analysis
  console.error('Navigation Error:', {
    error: error.message,
    stack: error.stack,
    location: context.currentLocation,
    vessel: context.vesselInfo,
    timestamp: new Date().toISOString()
  });

  // Safety-critical errors require immediate user notification
  if (error instanceof DepthDataError || error.message.includes('depth') || error.message.includes('shallow')) {
    return {
      success: false,
      error: 'NAVIGATION_SAFETY_ERROR',
      message: `${error.message} - Please verify with official charts`,
      severity: 'critical',
      recommendedAction: 'Stop navigation and verify location manually',
      disclaimer: NAVIGATION_DISCLAIMER
    };
  }

  return createStandardErrorResponse(error, context);
};
```

## Marine Data Integration Standards

### NOAA API Integration ✅
```typescript
export interface NOAATideData {
  station: string;
  timestamp: Date;
  waterLevel: number;        // Meters above mean lower low water
  prediction: number;        // Predicted tide level
  residual: number;          // Difference from prediction
  qualityFlag: 'preliminary' | 'verified' | 'estimated';
}

export const fetchTideData = async (
  latitude: number, 
  longitude: number, 
  timeRange: { start: Date; end: Date }
): Promise<NOAATideData[]> => {
  
  // Find nearest NOAA tide station
  const nearestStation = await findNearestTideStation(latitude, longitude);
  
  if (!nearestStation || nearestStation.distance > 50000) { // 50km max
    throw new NavigationError(
      'No tide data available - too far from monitoring stations',
      'warning'
    );
  }

  const response = await fetch(
    `https://tidesandcurrents.noaa.gov/api/datagetter?` +
    `product=water_level&application=waves_marine_nav&` +
    `begin_date=${formatNOAADate(timeRange.start)}&` +
    `end_date=${formatNOAADate(timeRange.end)}&` +
    `datum=MLLW&station=${nearestStation.id}&time_zone=gmt&units=metric&format=json`
  );

  if (!response.ok) {
    throw new NavigationError('Failed to fetch tide data from NOAA');
  }

  const data = await response.json();
  return data.data.map(formatTideReading);
};
```

## Performance Optimization Patterns

### Efficient GPS Data Processing ✅
```typescript
// Batch GPS updates to reduce processing overhead
export class GPSBatchProcessor {
  private updateQueue: GPSUpdate[] = [];
  private batchTimer?: NodeJS.Timeout;
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_TIMEOUT = 2000; // 2 seconds

  queueUpdate(update: GPSUpdate): void {
    this.updateQueue.push(update);
    
    if (this.updateQueue.length >= this.BATCH_SIZE) {
      this.processBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_TIMEOUT);
    }
  }

  private processBatch(): void {
    if (this.updateQueue.length === 0) return;

    const updates = [...this.updateQueue];
    this.updateQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    // Process updates efficiently
    this.processGPSUpdates(updates);
  }

  private processGPSUpdates(updates: GPSUpdate[]): void {
    // Filter out duplicate/redundant updates
    const filtered = this.deduplicateUpdates(updates);
    
    // Update depth estimates for new locations
    const withDepth = filtered.map(update => ({
      ...update,
      estimatedDepth: this.estimateDepthAtLocation(update.location),
      safetyStatus: this.assessLocationSafety(update.location)
    }));

    // Batch database updates
    this.updateLocationDatabase(withDepth);
    
    // Update navigation display
    this.updateNavigationDisplay(withDepth);
  }
}
```

## Offline Capability Patterns

### Critical Data Caching ✅
```typescript
export class MarineDataCache {
  private depthCache: Map<string, CachedDepthData> = new Map();
  private chartCache: Map<string, ChartTile> = new Map();
  private tideCache: Map<string, TideData[]> = new Map();

  async cacheDepthDataForRoute(route: GPSCoordinate[]): Promise<void> {
    const cacheRadius = 1000; // 1km radius around route
    
    for (const point of route) {
      const key = this.generateLocationKey(point, cacheRadius);
      
      if (!this.depthCache.has(key)) {
        try {
          const depthData = await this.fetchDepthData(point, cacheRadius);
          this.depthCache.set(key, {
            data: depthData,
            cachedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          });
        } catch (error) {
          console.warn(`Failed to cache depth data for ${key}:`, error);
        }
      }
    }
  }

  getCachedDepthData(location: GPSCoordinate): DepthReading[] | null {
    const key = this.generateLocationKey(location, 1000);
    const cached = this.depthCache.get(key);
    
    if (!cached || cached.expiresAt < new Date()) {
      this.depthCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  // Prioritize safety-critical data for offline storage
  async ensureSafetyDataCached(userLocation: GPSCoordinate): Promise<void> {
    const priorities = [
      { type: 'depth', radius: 2000, maxAge: 12 * 60 * 60 * 1000 },    // 2km, 12 hours
      { type: 'hazards', radius: 5000, maxAge: 24 * 60 * 60 * 1000 },  // 5km, 24 hours  
      { type: 'charts', radius: 1000, maxAge: 7 * 24 * 60 * 60 * 1000 } // 1km, 7 days
    ];

    await Promise.all(
      priorities.map(priority => 
        this.cacheSafetyData(userLocation, priority.type, priority.radius, priority.maxAge)
      )
    );
  }
}
```

## Navigation Disclaimer Constants ✅

```typescript
export const NAVIGATION_DISCLAIMER = 
  "⚠️ FOR REFERENCE ONLY - This application provides crowdsourced depth data and should not be used as the sole source for navigation. Always consult official nautical charts and use proper marine navigation equipment. Water depths change due to tides, weather, and bottom conditions. The accuracy of crowdsourced data cannot be guaranteed.";

export const SAFETY_REMINDERS = {
  SHALLOW_WATER: "⚠️ SHALLOW WATER DETECTED - Reduce speed and proceed with extreme caution",
  NO_DATA: "❓ NO DEPTH DATA - Unknown water conditions ahead, navigate with caution",
  OLD_DATA: "⏰ OUTDATED DATA - Depth readings are more than 30 days old, verify conditions",
  LOW_CONFIDENCE: "❌ LOW CONFIDENCE - Depth data has low reliability score, verify manually"
};
```

## Best Practices Summary

1. **Safety First**: Always validate navigation-critical data
2. **Battery Optimization**: Use efficient GPS tracking with appropriate intervals
3. **Offline-First**: Cache critical navigation data for areas without connectivity
4. **Performance**: Batch GPS updates and optimize database queries
5. **Error Handling**: Fail safely with clear user guidance
6. **Compliance**: Include appropriate navigation disclaimers
7. **Data Quality**: Validate and score confidence of crowdsourced data
8. **Privacy Protection**: Anonymize tracking data while preserving utility

---

**🧭 Specialized for marine navigation safety and performance** ⚓