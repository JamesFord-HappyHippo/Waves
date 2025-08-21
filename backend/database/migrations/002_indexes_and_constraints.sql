-- Waves Database Indexes and Constraints
-- Optimized for marine geospatial queries and performance

-- Spatial indexes for PostGIS geometry/geography columns
CREATE INDEX idx_gps_tracks_location ON gps_tracks USING GIST (location);
CREATE INDEX idx_depth_readings_location ON depth_readings USING GIST (location);
CREATE INDEX idx_marine_areas_geometry ON marine_areas USING GIST (geometry);
CREATE INDEX idx_routes_start_point ON routes USING GIST (start_point);
CREATE INDEX idx_routes_end_point ON routes USING GIST (end_point);
CREATE INDEX idx_routes_waypoints ON routes USING GIST (waypoints);
CREATE INDEX idx_navigation_sessions_start_location ON navigation_sessions USING GIST (start_location);
CREATE INDEX idx_navigation_sessions_track_geometry ON navigation_sessions USING GIST (track_geometry);
CREATE INDEX idx_weather_data_location ON weather_data USING GIST (location);
CREATE INDEX idx_tide_data_location ON tide_data USING GIST (location);
CREATE INDEX idx_safety_alerts_location ON safety_alerts USING GIST (location);

-- Time-based indexes for TimescaleDB optimization
CREATE INDEX idx_gps_tracks_timestamp ON gps_tracks (timestamp DESC);
CREATE INDEX idx_depth_readings_timestamp ON depth_readings (timestamp DESC);
CREATE INDEX idx_weather_data_timestamp ON weather_data (timestamp DESC);
CREATE INDEX idx_tide_data_timestamp ON tide_data (timestamp DESC);
CREATE INDEX idx_api_usage_timestamp ON api_usage (timestamp DESC);

-- User and vessel relationship indexes
CREATE INDEX idx_gps_tracks_user_id ON gps_tracks (user_id);
CREATE INDEX idx_gps_tracks_vessel_id ON gps_tracks (vessel_id);
CREATE INDEX idx_depth_readings_user_id ON depth_readings (user_id);
CREATE INDEX idx_depth_readings_vessel_id ON depth_readings (vessel_id);
CREATE INDEX idx_vessels_owner_id ON vessels (owner_id);
CREATE INDEX idx_routes_user_id ON routes (user_id);
CREATE INDEX idx_navigation_sessions_user_id ON navigation_sessions (user_id);
CREATE INDEX idx_safety_alerts_user_id ON safety_alerts (user_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_gps_tracks_user_timestamp ON gps_tracks (user_id, timestamp DESC);
CREATE INDEX idx_depth_readings_location_timestamp ON depth_readings USING GIST (location, timestamp);
CREATE INDEX idx_depth_readings_confidence_verified ON depth_readings (confidence_score, is_verified);
CREATE INDEX idx_weather_data_location_timestamp ON weather_data USING GIST (location, timestamp);
CREATE INDEX idx_user_sessions_user_active ON user_sessions (user_id, is_active);

-- Performance indexes for marine-specific queries
CREATE INDEX idx_depth_readings_depth_confidence ON depth_readings (depth_meters, confidence_score);
CREATE INDEX idx_vessels_draft_type ON vessels (draft_meters, vessel_type);
CREATE INDEX idx_routes_public_difficulty ON routes (is_public, difficulty_level);
CREATE INDEX idx_marine_areas_type ON marine_areas (area_type);

-- Full-text search indexes
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_vessels_name ON vessels (name);
CREATE INDEX idx_routes_name ON routes (name);
CREATE INDEX idx_marine_areas_name ON marine_areas (name);

-- Session and security indexes
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions (refresh_token_hash);
CREATE INDEX idx_user_sessions_expires ON user_sessions (expires_at);
CREATE INDEX idx_api_usage_user_endpoint ON api_usage (user_id, endpoint);

-- Partial indexes for active records
CREATE INDEX idx_users_active ON users (id) WHERE is_active = true;
CREATE INDEX idx_vessels_active ON vessels (id) WHERE is_active = true;
CREATE INDEX idx_user_sessions_active ON user_sessions (id) WHERE is_active = true;

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    
CREATE TRIGGER update_vessels_modtime BEFORE UPDATE ON vessels 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    
CREATE TRIGGER update_marine_areas_modtime BEFORE UPDATE ON marine_areas 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    
CREATE TRIGGER update_routes_modtime BEFORE UPDATE ON routes 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Function to calculate distance between two points
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

-- Function to check if location is in shallow water
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

-- Function to get nearest depth readings
CREATE OR REPLACE FUNCTION get_nearest_depth_readings(
    search_location GEOGRAPHY,
    search_radius_m INTEGER DEFAULT 1000,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    distance_m DECIMAL,
    depth_meters DECIMAL,
    confidence_score depth_confidence,
    timestamp TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dr.id,
        ST_Distance(dr.location, search_location) as distance_m,
        dr.depth_meters,
        dr.confidence_score,
        dr.timestamp
    FROM depth_readings dr
    WHERE ST_DWithin(dr.location, search_location, search_radius_m)
    AND dr.timestamp > NOW() - INTERVAL '90 days'
    ORDER BY dr.location <-> search_location
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to aggregate depth data for areas
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

-- Add constraints for data integrity
ALTER TABLE depth_readings ADD CONSTRAINT check_depth_positive 
    CHECK (depth_meters > 0 AND depth_meters < 11000); -- Deepest ocean ~11km

ALTER TABLE vessels ADD CONSTRAINT check_vessel_dimensions 
    CHECK (length_meters > 0 AND beam_meters > 0 AND draft_meters > 0);

ALTER TABLE gps_tracks ADD CONSTRAINT check_speed_realistic 
    CHECK (speed_knots >= 0 AND speed_knots <= 100); -- Max realistic boat speed

ALTER TABLE weather_data ADD CONSTRAINT check_wind_speed_realistic 
    CHECK (wind_speed_knots >= 0 AND wind_speed_knots <= 200); -- Max realistic wind

ALTER TABLE tide_data ADD CONSTRAINT check_tide_height_realistic 
    CHECK (height_meters >= -5 AND height_meters <= 15); -- Realistic tide range