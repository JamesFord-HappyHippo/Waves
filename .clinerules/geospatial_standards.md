# Geospatial Standards - Marine Navigation

**Domain**: Marine navigation and depth data processing  
**Database**: PostgreSQL with PostGIS extensions  
**Last Updated**: 2025-08-20T00:00:00Z

## Core Geospatial Principles

### 1. Marine Coordinate Systems
Marine navigation requires precise coordinate handling:
- **Primary System**: WGS84 (EPSG:4326) for GPS compatibility
- **Precision**: Maintain at least 6 decimal places for meter-level accuracy
- **Projections**: Use appropriate UTM zones for distance calculations
- **Datum Consistency**: Always specify coordinate reference system

### 2. PostGIS Database Schema

#### Core Tables ✅
```sql
-- Enable PostGIS extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Depth readings table with spatial indexing
CREATE TABLE depth_readings (
    id SERIAL PRIMARY KEY,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    depth_reading NUMERIC(6,2) NOT NULL CHECK (depth_reading >= 0 AND depth_reading <= 1000),
    confidence_score NUMERIC(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    reading_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    vessel_draft NUMERIC(4,2) NOT NULL CHECK (vessel_draft > 0),
    vessel_type VARCHAR(50),
    source_type VARCHAR(20) CHECK (source_type IN ('crowdsourced', 'sonar', 'chart', 'survey')),
    tide_correction NUMERIC(3,2),
    weather_conditions JSONB,
    quality_flags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spatial index for efficient location queries
CREATE INDEX idx_depth_readings_location ON depth_readings USING GIST (location);
CREATE INDEX idx_depth_readings_timestamp ON depth_readings (reading_timestamp DESC);
CREATE INDEX idx_depth_readings_confidence ON depth_readings (confidence_score DESC);

-- Vessel profiles for draft-specific routing
CREATE TABLE vessel_profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    vessel_name VARCHAR(100) NOT NULL,
    vessel_type VARCHAR(50) NOT NULL,
    length_meters NUMERIC(4,1),
    beam_meters NUMERIC(4,1),
    draft_meters NUMERIC(4,2) NOT NULL CHECK (draft_meters > 0),
    displacement_tons NUMERIC(8,2),
    max_speed_knots NUMERIC(4,1),
    safety_margin_meters NUMERIC(3,2) DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Route planning and caching
CREATE TABLE cached_routes (
    id SERIAL PRIMARY KEY,
    route_key VARCHAR(64) UNIQUE NOT NULL, -- Hash of start/end/vessel params
    start_point GEOGRAPHY(POINT, 4326) NOT NULL,
    end_point GEOGRAPHY(POINT, 4326) NOT NULL,
    waypoints GEOGRAPHY(LINESTRING, 4326) NOT NULL,
    vessel_draft NUMERIC(4,2) NOT NULL,
    safety_margin NUMERIC(3,2) NOT NULL,
    total_distance_meters NUMERIC(10,2),
    estimated_time_minutes INTEGER,
    safety_score NUMERIC(3,2) CHECK (safety_score >= 0 AND safety_score <= 1),
    route_warnings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_cached_routes_key ON cached_routes (route_key);
CREATE INDEX idx_cached_routes_expires ON cached_routes (expires_at);

-- Navigation hazards and warnings
CREATE TABLE navigation_hazards (
    id SERIAL PRIMARY KEY,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    hazard_type VARCHAR(50) NOT NULL, -- 'shallow', 'obstacle', 'restricted', 'weather'
    severity VARCHAR(20) CHECK (severity IN ('info', 'caution', 'warning', 'danger')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiry_date TIMESTAMP WITH TIME ZONE,
    source VARCHAR(100), -- Coast Guard, marina, user report
    verification_status VARCHAR(20) DEFAULT 'unverified',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hazards_location ON navigation_hazards USING GIST (location);
CREATE INDEX idx_hazards_severity ON navigation_hazards (severity);
CREATE INDEX idx_hazards_effective ON navigation_hazards (effective_date, expiry_date);
```

#### Spatial Functions ✅
```sql
-- Calculate safe passage corridor around a route
CREATE OR REPLACE FUNCTION calculate_safe_corridor(
    route_line GEOGRAPHY,
    vessel_draft NUMERIC,
    safety_margin NUMERIC DEFAULT 0.5,
    corridor_width NUMERIC DEFAULT 500
) RETURNS TABLE (
    location GEOGRAPHY,
    min_depth NUMERIC,
    avg_depth NUMERIC,
    confidence NUMERIC,
    reading_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH corridor AS (
        SELECT ST_Buffer(route_line::geometry, corridor_width)::geography as search_area
    ),
    relevant_readings AS (
        SELECT 
            dr.location,
            dr.depth_reading,
            dr.confidence_score,
            ST_Distance(dr.location, route_line) as distance_from_route
        FROM depth_readings dr, corridor c
        WHERE ST_Within(dr.location::geometry, c.search_area::geometry)
        AND dr.depth_reading >= (vessel_draft + safety_margin)
        AND dr.confidence_score > 0.5
        AND dr.reading_timestamp > NOW() - INTERVAL '90 days'
    )
    SELECT 
        ST_Centroid(ST_Collect(rr.location))::geography as location,
        MIN(rr.depth_reading) as min_depth,
        AVG(rr.depth_reading)::numeric(6,2) as avg_depth,
        AVG(rr.confidence_score)::numeric(3,2) as confidence,
        COUNT(*)::integer as reading_count
    FROM relevant_readings rr
    GROUP BY ST_SnapToGrid(rr.location::geometry, 0.001) -- 100m grid
    HAVING COUNT(*) >= 2; -- Require multiple readings
END;
$$ LANGUAGE plpgsql;

-- Find nearest safe anchorage or marina
CREATE OR REPLACE FUNCTION find_nearest_safe_harbor(
    current_location GEOGRAPHY,
    vessel_draft NUMERIC,
    max_distance_meters NUMERIC DEFAULT 50000
) RETURNS TABLE (
    harbor_name VARCHAR,
    location GEOGRAPHY,
    distance_meters NUMERIC,
    min_depth NUMERIC,
    facilities JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.name as harbor_name,
        h.location,
        ST_Distance(current_location, h.location) as distance_meters,
        h.min_depth,
        h.facilities
    FROM harbors h
    WHERE ST_DWithin(current_location, h.location, max_distance_meters)
    AND h.min_depth >= vessel_draft + 0.5
    AND h.status = 'active'
    ORDER BY distance_meters
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Aggregate depth data for visualization grids
CREATE OR REPLACE FUNCTION get_depth_grid(
    bounds GEOGRAPHY, -- Bounding box
    grid_size NUMERIC DEFAULT 0.001, -- ~100m grid cells
    min_confidence NUMERIC DEFAULT 0.3
) RETURNS TABLE (
    grid_center GEOGRAPHY,
    avg_depth NUMERIC,
    min_depth NUMERIC,
    max_depth NUMERIC,
    reading_count INTEGER,
    avg_confidence NUMERIC,
    data_age_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ST_Centroid(ST_Collect(location))::geography as grid_center,
        AVG(depth_reading)::numeric(6,2) as avg_depth,
        MIN(depth_reading)::numeric(6,2) as min_depth,
        MAX(depth_reading)::numeric(6,2) as max_depth,
        COUNT(*)::integer as reading_count,
        AVG(confidence_score)::numeric(3,2) as avg_confidence,
        AVG(EXTRACT(days FROM NOW() - reading_timestamp))::integer as data_age_days
    FROM depth_readings
    WHERE ST_Within(location::geometry, bounds::geometry)
    AND confidence_score >= min_confidence
    AND reading_timestamp > NOW() - INTERVAL '1 year'
    GROUP BY ST_SnapToGrid(location::geometry, grid_size)
    HAVING COUNT(*) >= 2
    ORDER BY avg_confidence DESC, reading_count DESC;
END;
$$ LANGUAGE plpgsql;
```

### 3. Spatial Query Patterns

#### Efficient Depth Data Queries ✅
```typescript
// TypeScript interfaces for spatial queries
export interface DepthQueryParams {
  location: GPSCoordinate;
  radius: number;           // Search radius in meters
  vesselDraft: number;      // Minimum depth requirement
  maxAge: number;           // Maximum data age in hours
  minConfidence: number;    // Minimum confidence score (0-1)
}

export interface SpatialDepthQuery {
  query: string;
  params: any[];
}

export class MarineSpatialQueries {
  
  // Get depth data around a location
  static getDepthDataNearLocation(params: DepthQueryParams): SpatialDepthQuery {
    return {
      query: `
        SELECT 
          ST_AsGeoJSON(location) as location_geojson,
          depth_reading,
          confidence_score,
          reading_timestamp,
          vessel_draft,
          source_type,
          ST_Distance(location, ST_MakePoint($2, $1)::geography) as distance_meters
        FROM depth_readings 
        WHERE ST_DWithin(
          location, 
          ST_MakePoint($2, $1)::geography, 
          $3
        )
        AND depth_reading >= $4
        AND confidence_score >= $5
        AND reading_timestamp > NOW() - INTERVAL '$6 hours'
        ORDER BY distance_meters ASC, confidence_score DESC
        LIMIT 100;
      `,
      params: [
        params.location.latitude,
        params.location.longitude,
        params.radius,
        params.vesselDraft,
        params.minConfidence,
        params.maxAge
      ]
    };
  }

  // Calculate route depth profile
  static getRouteDepthProfile(
    startPoint: GPSCoordinate,
    endPoint: GPSCoordinate,
    corridorWidth: number = 200
  ): SpatialDepthQuery {
    return {
      query: `
        WITH route_line AS (
          SELECT ST_MakeLine(
            ST_MakePoint($2, $1), 
            ST_MakePoint($4, $3)
          )::geography as line
        ),
        corridor AS (
          SELECT ST_Buffer(line::geometry, $5)::geography as area
          FROM route_line
        ),
        route_depths AS (
          SELECT 
            depth_reading,
            confidence_score,
            ST_LineLocatePoint(
              (SELECT line FROM route_line)::geometry,
              location::geometry
            ) as position_along_route,
            ST_Distance(
              location, 
              (SELECT line FROM route_line)
            ) as distance_from_route
          FROM depth_readings dr, corridor c
          WHERE ST_Within(dr.location::geometry, c.area::geometry)
          AND confidence_score > 0.5
          AND reading_timestamp > NOW() - INTERVAL '30 days'
        )
        SELECT 
          position_along_route,
          MIN(depth_reading) as min_depth,
          AVG(depth_reading)::numeric(6,2) as avg_depth,
          COUNT(*) as reading_count,
          AVG(confidence_score)::numeric(3,2) as avg_confidence
        FROM route_depths
        GROUP BY ROUND(position_along_route::numeric, 3) -- Group into segments
        ORDER BY position_along_route;
      `,
      params: [
        startPoint.latitude,
        startPoint.longitude,
        endPoint.latitude,
        endPoint.longitude,
        corridorWidth
      ]
    };
  }

  // Find shallow water hazards along route
  static findRouteHazards(
    routePoints: GPSCoordinate[],
    vesselDraft: number,
    safetyMargin: number = 0.5
  ): SpatialDepthQuery {
    const routeWKT = this.coordinatesToLineString(routePoints);
    
    return {
      query: `
        WITH route_line AS (
          SELECT ST_GeomFromText($1, 4326)::geography as line
        ),
        hazard_zone AS (
          SELECT ST_Buffer(line::geometry, 500)::geography as area
          FROM route_line
        ),
        depth_hazards AS (
          SELECT 
            location,
            depth_reading,
            confidence_score,
            'shallow_water' as hazard_type,
            CASE 
              WHEN depth_reading < $2 THEN 'danger'
              WHEN depth_reading < $2 + 0.5 THEN 'warning'  
              ELSE 'caution'
            END as severity
          FROM depth_readings dr, hazard_zone hz
          WHERE ST_Within(dr.location::geometry, hz.area::geometry)
          AND depth_reading < $2 + $3
          AND confidence_score > 0.6
          AND reading_timestamp > NOW() - INTERVAL '60 days'
        ),
        reported_hazards AS (
          SELECT 
            location,
            NULL::numeric as depth_reading,
            NULL::numeric as confidence_score,
            hazard_type,
            severity
          FROM navigation_hazards nh, hazard_zone hz
          WHERE ST_Within(nh.location::geometry, hz.area::geometry)
          AND (expiry_date IS NULL OR expiry_date > NOW())
          AND severity IN ('warning', 'danger')
        )
        SELECT 
          ST_AsGeoJSON(location) as location_geojson,
          depth_reading,
          confidence_score,
          hazard_type,
          severity,
          ST_Distance(
            location,
            (SELECT line FROM route_line)
          ) as distance_from_route
        FROM (
          SELECT * FROM depth_hazards
          UNION ALL
          SELECT * FROM reported_hazards
        ) all_hazards
        ORDER BY severity DESC, distance_from_route ASC;
      `,
      params: [
        routeWKT,
        vesselDraft,
        safetyMargin
      ]
    };
  }

  private static coordinatesToLineString(coords: GPSCoordinate[]): string {
    const points = coords.map(c => `${c.longitude} ${c.latitude}`).join(', ');
    return `LINESTRING(${points})`;
  }
}
```

### 4. Spatial Indexing & Performance

#### Optimized Indexing Strategy ✅
```sql
-- Multi-column spatial indexes for complex queries
CREATE INDEX idx_depth_readings_spatial_composite ON depth_readings 
USING GIST (location, reading_timestamp, confidence_score);

-- Partial indexes for frequently queried conditions
CREATE INDEX idx_recent_high_confidence_depths ON depth_readings 
USING GIST (location) 
WHERE reading_timestamp > NOW() - INTERVAL '7 days' 
AND confidence_score > 0.7;

-- Functional index for grid-based queries  
CREATE INDEX idx_depth_readings_grid_100m ON depth_readings 
USING BTREE (ST_SnapToGrid(location::geometry, 0.001));

-- Optimize route corridor queries
CREATE INDEX idx_depth_readings_location_time ON depth_readings 
USING GIST (location) 
INCLUDE (depth_reading, confidence_score, reading_timestamp)
WHERE confidence_score > 0.5;

-- Analyze table statistics for query optimization
ANALYZE depth_readings;
ANALYZE navigation_hazards;
ANALYZE cached_routes;
```

#### Query Performance Monitoring ✅
```sql
-- Monitor spatial query performance
CREATE OR REPLACE VIEW slow_spatial_queries AS
SELECT 
    query,
    mean_exec_time,
    calls,
    total_exec_time,
    (total_exec_time / calls) as avg_time_per_call
FROM pg_stat_statements 
WHERE query ILIKE '%ST_%' 
OR query ILIKE '%geography%'
OR query ILIKE '%depth_readings%'
ORDER BY mean_exec_time DESC;

-- Track spatial index usage
CREATE OR REPLACE VIEW spatial_index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE indexname ILIKE '%gist%' 
OR indexname ILIKE '%spatial%'
ORDER BY idx_scan DESC;
```

### 5. Data Quality & Validation

#### Spatial Data Validation ✅
```typescript
export class SpatialDataValidator {
  
  // Validate GPS coordinates for marine navigation
  static validateMarineCoordinates(coord: GPSCoordinate): ValidationResult {
    const errors: string[] = [];
    
    // Basic coordinate range validation
    if (coord.latitude < -90 || coord.latitude > 90) {
      errors.push('Latitude must be between -90 and 90 degrees');
    }
    
    if (coord.longitude < -180 || coord.longitude > 180) {
      errors.push('Longitude must be between -180 and 180 degrees');
    }
    
    // Marine-specific validations
    if (Math.abs(coord.latitude) > 85) {
      errors.push('Coordinates too close to poles for marine navigation');
    }
    
    // Precision validation (meter-level accuracy)
    const latPrecision = this.getDecimalPlaces(coord.latitude);
    const lngPrecision = this.getDecimalPlaces(coord.longitude);
    
    if (latPrecision < 5 || lngPrecision < 5) {
      errors.push('Insufficient coordinate precision for marine navigation');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      precision: Math.min(latPrecision, lngPrecision)
    };
  }

  // Validate depth readings for consistency
  static validateDepthReading(reading: DepthReading): ValidationResult {
    const errors: string[] = [];
    
    // Coordinate validation
    const coordResult = this.validateMarineCoordinates(reading.location);
    if (!coordResult.isValid) {
      errors.push(...coordResult.errors);
    }
    
    // Depth value validation
    if (reading.depth < 0) {
      errors.push('Depth cannot be negative');
    }
    
    if (reading.depth > 11000) { // Mariana Trench depth
      errors.push('Depth reading exceeds maximum ocean depth');
    }
    
    // Confidence score validation
    if (reading.confidence < 0 || reading.confidence > 1) {
      errors.push('Confidence score must be between 0 and 1');
    }
    
    // Temporal validation
    const now = new Date();
    const readingAge = now.getTime() - reading.timestamp.getTime();
    const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year
    
    if (readingAge > maxAge) {
      errors.push('Depth reading is too old for reliable navigation');
    }
    
    if (reading.timestamp > now) {
      errors.push('Depth reading timestamp is in the future');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      dataQuality: this.calculateDataQuality(reading)
    };
  }

  // Calculate spatial data quality score
  private static calculateDataQuality(reading: DepthReading): DataQuality {
    let score = reading.confidence;
    
    // Reduce score based on data age
    const ageInDays = (Date.now() - reading.timestamp.getTime()) / (24 * 60 * 60 * 1000);
    if (ageInDays > 30) {
      score *= 0.9; // Reduce by 10% for data older than 30 days
    }
    if (ageInDays > 90) {
      score *= 0.8; // Additional 20% reduction for data older than 90 days
    }
    
    // Adjust based on source reliability
    const sourceMultipliers = {
      'survey': 1.0,        // Official survey data
      'sonar': 0.95,        // Vessel sonar readings
      'crowdsourced': 0.85, // User-reported data
      'chart': 0.9          // Digitized chart data
    };
    
    score *= sourceMultipliers[reading.source] || 0.7;
    
    return {
      score: Math.max(0, Math.min(1, score)),
      category: score > 0.8 ? 'high' : score > 0.6 ? 'medium' : 'low',
      factors: {
        age: ageInDays,
        source: reading.source,
        originalConfidence: reading.confidence
      }
    };
  }
}
```

### 6. Privacy & Anonymization

#### GPS Data Anonymization ✅
```typescript
export class SpatialPrivacyManager {
  
  // Anonymize GPS tracks while preserving navigational utility
  static anonymizeGPSTrack(track: GPSCoordinate[], precision: number = 0.001): GPSCoordinate[] {
    return track.map(point => ({
      latitude: this.snapToGrid(point.latitude, precision),
      longitude: this.snapToGrid(point.longitude, precision)
    }));
  }

  // Add spatial noise for privacy while maintaining depth correlation
  static addSpatialNoise(
    reading: DepthReading, 
    noiseRadius: number = 50
  ): DepthReading {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * noiseRadius;
    
    // Calculate offset in degrees (approximate)
    const latOffset = (distance * Math.cos(angle)) / 111000; // ~111km per degree
    const lngOffset = (distance * Math.sin(angle)) / (111000 * Math.cos(reading.location.latitude * Math.PI / 180));
    
    return {
      ...reading,
      location: {
        latitude: reading.location.latitude + latOffset,
        longitude: reading.location.longitude + lngOffset
      }
    };
  }

  private static snapToGrid(value: number, precision: number): number {
    return Math.round(value / precision) * precision;
  }
}
```

## Best Practices Summary

1. **Coordinate System Consistency**: Always use WGS84 for GPS compatibility
2. **Spatial Indexing**: Use GIST indexes for efficient geographic queries
3. **Data Quality**: Validate coordinates, depth readings, and temporal consistency  
4. **Performance Optimization**: Grid-based aggregation and appropriate index strategies
5. **Privacy Protection**: Anonymize tracking data while preserving navigational utility
6. **Safety Validation**: Multiple data points required for navigation-critical decisions
7. **Temporal Considerations**: Account for data age in confidence calculations
8. **Marine Standards**: Follow maritime coordinate precision and safety requirements

---

**🗺️ Optimized for marine navigation spatial data processing** ⚓