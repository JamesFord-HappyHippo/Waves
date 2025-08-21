-- Waves Marine Navigation Platform - Production Database Setup
-- PostgreSQL 16 with PostGIS and TimescaleDB optimizations
-- Execute this script after RDS instance is created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create application user with limited privileges
CREATE USER waves_app WITH PASSWORD 'generate_secure_password_here';

-- Create database schema
CREATE SCHEMA IF NOT EXISTS waves;
CREATE SCHEMA IF NOT EXISTS marine_data;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant permissions to application user
GRANT USAGE ON SCHEMA waves TO waves_app;
GRANT USAGE ON SCHEMA marine_data TO waves_app;
GRANT USAGE ON SCHEMA analytics TO waves_app;

-- Core tables for marine navigation
CREATE TABLE IF NOT EXISTS waves.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    privacy_settings JSONB DEFAULT '{"share_location": false, "anonymous_tracking": true}',
    
    -- Indexes
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON waves.users(email);
CREATE INDEX idx_users_active ON waves.users(is_active);
CREATE INDEX idx_users_created_at ON waves.users(created_at);

-- Vessel registration table
CREATE TABLE IF NOT EXISTS waves.vessels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES waves.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    vessel_type VARCHAR(50) NOT NULL, -- sailboat, powerboat, kayak, etc.
    length_meters DECIMAL(5,2),
    beam_meters DECIMAL(4,2),
    draft_meters DECIMAL(4,2) NOT NULL, -- Critical for depth calculations
    hull_material VARCHAR(50), -- fiberglass, aluminum, steel, wood
    engine_type VARCHAR(50), -- outboard, inboard, sail, electric
    max_speed_knots DECIMAL(4,1),
    registration_number VARCHAR(50),
    mmsi VARCHAR(20), -- Maritime Mobile Service Identity
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- Safety equipment tracking
    safety_equipment JSONB DEFAULT '{
        "life_jackets": 0,
        "flares": 0,
        "fire_extinguisher": false,
        "first_aid_kit": false,
        "radio_vhf": false,
        "epirb": false,
        "radar": false,
        "gps": false,
        "depth_sounder": false
    }'
);

CREATE INDEX idx_vessels_user_id ON waves.vessels(user_id);
CREATE INDEX idx_vessels_active ON waves.vessels(is_active);
CREATE INDEX idx_vessels_draft ON waves.vessels(draft_meters);

-- Location tracking table - TimescaleDB hypertable
CREATE TABLE IF NOT EXISTS marine_data.location_tracks (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES waves.users(id) ON DELETE CASCADE,
    vessel_id UUID REFERENCES waves.vessels(id) ON DELETE SET NULL,
    
    -- Geospatial data
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    altitude_meters DECIMAL(8,2),
    accuracy_meters DECIMAL(6,2),
    heading_degrees DECIMAL(5,2), -- 0-360 degrees
    speed_knots DECIMAL(5,2),
    
    -- Timestamp
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Environmental conditions
    water_depth_meters DECIMAL(6,2), -- If known from depth sounder
    water_temperature_celsius DECIMAL(4,1),
    air_temperature_celsius DECIMAL(4,1),
    wind_speed_knots DECIMAL(4,1),
    wind_direction_degrees DECIMAL(5,2),
    wave_height_meters DECIMAL(3,1),
    visibility_meters DECIMAL(6,1),
    
    -- Data quality and source
    data_source VARCHAR(50) DEFAULT 'mobile_app', -- mobile_app, ais, manual
    confidence_score DECIMAL(3,2) DEFAULT 0.95, -- 0.0 to 1.0
    is_anomaly BOOLEAN DEFAULT false,
    
    -- Privacy and sharing
    is_private BOOLEAN DEFAULT false,
    share_depth_data BOOLEAN DEFAULT true,
    
    PRIMARY KEY (recorded_at, id)
);

-- Convert to TimescaleDB hypertable for time-series optimization
SELECT create_hypertable('marine_data.location_tracks', 'recorded_at', chunk_time_interval => INTERVAL '1 day');

-- Spatial index for location queries
CREATE INDEX idx_location_tracks_location ON marine_data.location_tracks USING GIST(location);
CREATE INDEX idx_location_tracks_user_id ON marine_data.location_tracks(user_id);
CREATE INDEX idx_location_tracks_vessel_id ON marine_data.location_tracks(vessel_id);
CREATE INDEX idx_location_tracks_recorded_at ON marine_data.location_tracks(recorded_at DESC);
CREATE INDEX idx_location_tracks_depth ON marine_data.location_tracks(water_depth_meters) WHERE water_depth_meters IS NOT NULL;

-- Depth readings aggregated table
CREATE TABLE IF NOT EXISTS marine_data.depth_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    depth_meters DECIMAL(6,2) NOT NULL,
    vessel_draft_meters DECIMAL(4,2) NOT NULL,
    tide_height_meters DECIMAL(4,2), -- Tide correction if available
    corrected_depth_meters DECIMAL(6,2), -- Depth corrected for tide
    
    -- Data quality
    confidence_score DECIMAL(3,2) DEFAULT 0.8,
    measurement_count INTEGER DEFAULT 1, -- Number of readings aggregated
    standard_deviation DECIMAL(4,2), -- Variability in readings
    
    -- Temporal data
    first_reading_at TIMESTAMPTZ NOT NULL,
    last_reading_at TIMESTAMPTZ NOT NULL,
    
    -- Source tracking
    contributing_users INTEGER DEFAULT 1,
    data_sources TEXT[] DEFAULT ARRAY['mobile_app'],
    
    -- Geospatial grouping (approximately 10m grid)
    location_hash VARCHAR(20) GENERATED ALWAYS AS (
        ST_GeoHash(location::geometry, 8)
    ) STORED,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index and constraints
CREATE INDEX idx_depth_readings_location ON marine_data.depth_readings USING GIST(location);
CREATE INDEX idx_depth_readings_location_hash ON marine_data.depth_readings(location_hash);
CREATE INDEX idx_depth_readings_depth ON marine_data.depth_readings(depth_meters);
CREATE INDEX idx_depth_readings_confidence ON marine_data.depth_readings(confidence_score);
CREATE INDEX idx_depth_readings_updated_at ON marine_data.depth_readings(updated_at DESC);

-- Constraint to ensure reasonable depth values
ALTER TABLE marine_data.depth_readings ADD CONSTRAINT reasonable_depth 
    CHECK (depth_meters >= 0 AND depth_meters <= 11000); -- Max ocean depth

-- Navigation hazards table
CREATE TABLE IF NOT EXISTS marine_data.navigation_hazards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    hazard_type VARCHAR(50) NOT NULL, -- shoal, rock, wreck, bridge, restricted_area
    severity VARCHAR(20) NOT NULL DEFAULT 'moderate', -- low, moderate, high, critical
    
    -- Hazard details
    name VARCHAR(200),
    description TEXT,
    min_depth_meters DECIMAL(6,2),
    clearance_height_meters DECIMAL(6,2), -- For bridges
    
    -- Verification
    reported_by UUID REFERENCES waves.users(id),
    verified_by UUID REFERENCES waves.users(id),
    verification_count INTEGER DEFAULT 0,
    last_verified TIMESTAMPTZ,
    
    -- Temporal validity
    is_permanent BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'moderate', 'high', 'critical'))
);

CREATE INDEX idx_navigation_hazards_location ON marine_data.navigation_hazards USING GIST(location);
CREATE INDEX idx_navigation_hazards_type ON marine_data.navigation_hazards(hazard_type);
CREATE INDEX idx_navigation_hazards_severity ON marine_data.navigation_hazards(severity);

-- Weather and marine conditions cache
CREATE TABLE IF NOT EXISTS marine_data.weather_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    
    -- Weather data
    timestamp TIMESTAMPTZ NOT NULL,
    temperature_celsius DECIMAL(4,1),
    humidity_percent DECIMAL(3,1),
    pressure_hpa DECIMAL(6,1),
    visibility_km DECIMAL(5,2),
    
    -- Wind conditions
    wind_speed_knots DECIMAL(4,1),
    wind_direction_degrees DECIMAL(5,2),
    wind_gust_knots DECIMAL(4,1),
    
    -- Wave conditions
    wave_height_meters DECIMAL(3,1),
    wave_period_seconds DECIMAL(4,1),
    wave_direction_degrees DECIMAL(5,2),
    
    -- Tide information
    tide_height_meters DECIMAL(4,2),
    tide_direction VARCHAR(10), -- rising, falling, high, low
    next_tide_time TIMESTAMPTZ,
    
    -- Data source
    data_source VARCHAR(50) NOT NULL, -- noaa, openweather, stormglass
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable
SELECT create_hypertable('marine_data.weather_conditions', 'timestamp', chunk_time_interval => INTERVAL '6 hours');

CREATE INDEX idx_weather_conditions_location ON marine_data.weather_conditions USING GIST(location);
CREATE INDEX idx_weather_conditions_timestamp ON marine_data.weather_conditions(timestamp DESC);

-- User sessions and authentication
CREATE TABLE IF NOT EXISTS waves.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES waves.users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON waves.user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON waves.user_sessions(expires_at);
CREATE INDEX idx_user_sessions_refresh_token ON waves.user_sessions(refresh_token_hash);

-- Analytics and aggregated data
CREATE TABLE IF NOT EXISTS analytics.daily_track_summary (
    date DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES waves.users(id) ON DELETE CASCADE,
    vessel_id UUID REFERENCES waves.vessels(id) ON DELETE SET NULL,
    
    -- Distance and time
    total_distance_nm DECIMAL(8,2), -- Nautical miles
    total_time_hours DECIMAL(8,2),
    avg_speed_knots DECIMAL(5,2),
    max_speed_knots DECIMAL(5,2),
    
    -- Geographic bounds
    route_bounds GEOMETRY(POLYGON, 4326),
    start_location GEOGRAPHY(POINT, 4326),
    end_location GEOGRAPHY(POINT, 4326),
    
    -- Depth data contributed
    depth_readings_count INTEGER DEFAULT 0,
    avg_depth_contributed DECIMAL(6,2),
    
    -- Environmental conditions
    avg_wave_height DECIMAL(3,1),
    avg_wind_speed DECIMAL(4,1),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (date, user_id)
);

CREATE INDEX idx_daily_track_summary_date ON analytics.daily_track_summary(date DESC);
CREATE INDEX idx_daily_track_summary_user_id ON analytics.daily_track_summary(user_id);

-- Grant table permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA waves TO waves_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA marine_data TO waves_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO waves_app;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA waves TO waves_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA marine_data TO waves_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO waves_app;

-- Row Level Security (RLS) for data privacy
ALTER TABLE waves.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE waves.vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE marine_data.location_tracks ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY user_own_data ON waves.users FOR ALL USING (id = current_setting('app.current_user_id')::UUID);
CREATE POLICY vessel_owner_data ON waves.vessels FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

-- Location tracks privacy policy
CREATE POLICY location_privacy ON marine_data.location_tracks FOR SELECT USING (
    user_id = current_setting('app.current_user_id')::UUID OR 
    (NOT is_private AND share_depth_data)
);

-- Create functions for common queries
CREATE OR REPLACE FUNCTION marine_data.get_depth_in_area(
    center_lat DECIMAL,
    center_lon DECIMAL,
    radius_meters INTEGER DEFAULT 1000
) RETURNS TABLE (
    location_lat DECIMAL,
    location_lon DECIMAL,
    depth_meters DECIMAL,
    confidence_score DECIMAL,
    reading_age_hours INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ST_Y(location::geometry)::DECIMAL as location_lat,
        ST_X(location::geometry)::DECIMAL as location_lon,
        dr.depth_meters,
        dr.confidence_score,
        EXTRACT(EPOCH FROM (NOW() - dr.updated_at))/3600::INTEGER as reading_age_hours
    FROM marine_data.depth_readings dr
    WHERE ST_DWithin(
        dr.location,
        ST_MakePoint(center_lon, center_lat)::geography,
        radius_meters
    )
    AND dr.confidence_score > 0.5
    ORDER BY dr.confidence_score DESC, dr.updated_at DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- Function to safely insert location tracks with validation
CREATE OR REPLACE FUNCTION marine_data.insert_location_track(
    p_user_id UUID,
    p_vessel_id UUID,
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_accuracy_meters DECIMAL DEFAULT NULL,
    p_speed_knots DECIMAL DEFAULT NULL,
    p_heading_degrees DECIMAL DEFAULT NULL,
    p_water_depth_meters DECIMAL DEFAULT NULL,
    p_share_depth_data BOOLEAN DEFAULT true
) RETURNS UUID AS $$
DECLARE
    track_id UUID;
    prev_location GEOGRAPHY;
    distance_moved DECIMAL;
BEGIN
    -- Validate coordinates
    IF p_latitude < -90 OR p_latitude > 90 OR p_longitude < -180 OR p_longitude > 180 THEN
        RAISE EXCEPTION 'Invalid coordinates: lat=%, lon=%', p_latitude, p_longitude;
    END IF;
    
    -- Check for reasonable movement (prevent GPS jitter)
    SELECT location INTO prev_location 
    FROM marine_data.location_tracks 
    WHERE user_id = p_user_id 
    ORDER BY recorded_at DESC 
    LIMIT 1;
    
    IF prev_location IS NOT NULL THEN
        distance_moved := ST_Distance(
            prev_location,
            ST_MakePoint(p_longitude, p_latitude)::geography
        );
        
        -- Skip if moved less than 10 meters (unless depth data provided)
        IF distance_moved < 10 AND p_water_depth_meters IS NULL THEN
            RETURN NULL;
        END IF;
    END IF;
    
    -- Insert the track
    INSERT INTO marine_data.location_tracks (
        user_id, vessel_id, location, accuracy_meters, 
        speed_knots, heading_degrees, water_depth_meters, 
        share_depth_data
    ) VALUES (
        p_user_id, p_vessel_id, 
        ST_MakePoint(p_longitude, p_latitude)::geography,
        p_accuracy_meters, p_speed_knots, p_heading_degrees,
        p_water_depth_meters, p_share_depth_data
    ) RETURNING id INTO track_id;
    
    -- Update depth readings if depth data provided
    IF p_water_depth_meters IS NOT NULL AND p_share_depth_data THEN
        PERFORM marine_data.update_depth_readings(p_longitude, p_latitude, p_water_depth_meters, p_user_id);
    END IF;
    
    RETURN track_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update aggregated depth readings
CREATE OR REPLACE FUNCTION marine_data.update_depth_readings(
    p_longitude DECIMAL,
    p_latitude DECIMAL,
    p_depth_meters DECIMAL,
    p_user_id UUID
) RETURNS VOID AS $$
DECLARE
    location_point GEOGRAPHY;
    existing_reading RECORD;
    vessel_draft DECIMAL;
BEGIN
    location_point := ST_MakePoint(p_longitude, p_latitude)::geography;
    
    -- Get vessel draft for depth correction
    SELECT draft_meters INTO vessel_draft
    FROM waves.vessels v
    JOIN marine_data.location_tracks lt ON lt.vessel_id = v.id
    WHERE lt.user_id = p_user_id
    ORDER BY lt.recorded_at DESC
    LIMIT 1;
    
    vessel_draft := COALESCE(vessel_draft, 1.5); -- Default draft
    
    -- Look for existing reading within 50 meters
    SELECT * INTO existing_reading
    FROM marine_data.depth_readings
    WHERE ST_DWithin(location, location_point, 50)
    ORDER BY ST_Distance(location, location_point)
    LIMIT 1;
    
    IF existing_reading IS NOT NULL THEN
        -- Update existing reading with weighted average
        UPDATE marine_data.depth_readings SET
            depth_meters = (
                (depth_meters * measurement_count + p_depth_meters) / 
                (measurement_count + 1)
            ),
            measurement_count = measurement_count + 1,
            last_reading_at = NOW(),
            updated_at = NOW(),
            contributing_users = GREATEST(contributing_users, 1) + 1
        WHERE id = existing_reading.id;
    ELSE
        -- Create new depth reading
        INSERT INTO marine_data.depth_readings (
            location, depth_meters, vessel_draft_meters,
            first_reading_at, last_reading_at
        ) VALUES (
            location_point, p_depth_meters, vessel_draft,
            NOW(), NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for popular navigation areas
CREATE MATERIALIZED VIEW analytics.popular_navigation_areas AS
SELECT 
    ST_SnapToGrid(location::geometry, 0.01)::geography as area_center, -- ~1km grid
    COUNT(*) as track_count,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(water_depth_meters) as avg_depth,
    MIN(water_depth_meters) as min_depth,
    MAX(water_depth_meters) as max_depth,
    ST_Extent(location::geometry) as area_bounds
FROM marine_data.location_tracks
WHERE recorded_at > NOW() - INTERVAL '30 days'
AND location IS NOT NULL
GROUP BY ST_SnapToGrid(location::geometry, 0.01)
HAVING COUNT(*) > 10 -- Areas with at least 10 tracks
ORDER BY track_count DESC;

CREATE INDEX idx_popular_areas_center ON analytics.popular_navigation_areas USING GIST(area_center);

-- Refresh schedule for materialized view
CREATE OR REPLACE FUNCTION analytics.refresh_popular_areas() RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.popular_navigation_areas;
END;
$$ LANGUAGE plpgsql;

-- Set up automatic cleanup of old data
CREATE OR REPLACE FUNCTION marine_data.cleanup_old_data() RETURNS VOID AS $$
BEGIN
    -- Delete location tracks older than 2 years
    DELETE FROM marine_data.location_tracks 
    WHERE recorded_at < NOW() - INTERVAL '2 years';
    
    -- Delete old weather data (keep 30 days)
    DELETE FROM marine_data.weather_conditions 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    -- Delete expired user sessions
    DELETE FROM waves.user_sessions 
    WHERE expires_at < NOW() OR revoked_at IS NOT NULL;
    
    RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Production security settings
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Performance optimization: Create partial indexes for active data
CREATE INDEX CONCURRENTLY idx_location_tracks_recent 
ON marine_data.location_tracks(recorded_at DESC, location) 
WHERE recorded_at > NOW() - INTERVAL '7 days';

CREATE INDEX CONCURRENTLY idx_depth_readings_quality 
ON marine_data.depth_readings(confidence_score DESC, updated_at DESC) 
WHERE confidence_score > 0.7;

-- Analyze tables for query optimization
ANALYZE waves.users;
ANALYZE waves.vessels;
ANALYZE marine_data.location_tracks;
ANALYZE marine_data.depth_readings;
ANALYZE marine_data.navigation_hazards;
ANALYZE marine_data.weather_conditions;

-- Create a view for API health checks
CREATE OR REPLACE VIEW waves.health_check AS
SELECT 
    'database' as component,
    'healthy' as status,
    json_build_object(
        'total_users', (SELECT COUNT(*) FROM waves.users WHERE is_active),
        'total_tracks', (SELECT COUNT(*) FROM marine_data.location_tracks WHERE recorded_at > NOW() - INTERVAL '24 hours'),
        'total_depth_readings', (SELECT COUNT(*) FROM marine_data.depth_readings),
        'last_track_time', (SELECT MAX(recorded_at) FROM marine_data.location_tracks),
        'database_size', pg_size_pretty(pg_database_size(current_database()))
    ) as details,
    NOW() as checked_at;

GRANT SELECT ON waves.health_check TO waves_app;