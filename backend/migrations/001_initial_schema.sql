-- Waves Marine Navigation Database Schema
-- Initial migration for production PostgreSQL with PostGIS

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cognito_sub VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    full_name VARCHAR(255),
    phone_number VARCHAR(20),
    vessel_name VARCHAR(255),
    vessel_type VARCHAR(100),
    vessel_length DECIMAL(5,2), -- in feet
    vessel_draft DECIMAL(4,2), -- in feet
    experience_level VARCHAR(50) DEFAULT 'beginner', -- beginner, intermediate, advanced, professional
    is_verified BOOLEAN DEFAULT FALSE,
    verification_level VARCHAR(50) DEFAULT 'basic', -- basic, captain, professional
    contribution_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create spatial index for user locations (when they submit readings)
CREATE INDEX idx_users_cognito_sub ON users(cognito_sub);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verification ON users(is_verified, verification_level);

-- Create depth_readings table with PostGIS geometry
CREATE TABLE depth_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    location GEOMETRY(POINT, 4326) NOT NULL, -- PostGIS point in WGS84
    depth DECIMAL(6,2) NOT NULL, -- in feet
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    vessel_draft DECIMAL(4,2), -- in feet, optional
    measurement_method VARCHAR(50) DEFAULT 'sonar', -- sonar, lead_line, chart, estimated
    conditions TEXT, -- weather/sea conditions when measured
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_validated BOOLEAN DEFAULT FALSE,
    validation_score DECIMAL(3,2) DEFAULT 0.5,
    validator_id UUID REFERENCES users(id),
    validation_timestamp TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    source_system VARCHAR(100) DEFAULT 'waves_mobile',
    device_accuracy DECIMAL(5,2), -- GPS accuracy in meters
    is_public BOOLEAN DEFAULT TRUE,
    quality_flags TEXT[] DEFAULT '{}' -- array of quality indicators
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('depth_readings', 'timestamp', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Create spatial indexes for depth readings
CREATE INDEX idx_depth_readings_location ON depth_readings USING GIST(location);
CREATE INDEX idx_depth_readings_user_id ON depth_readings(user_id);
CREATE INDEX idx_depth_readings_timestamp ON depth_readings(timestamp DESC);
CREATE INDEX idx_depth_readings_depth ON depth_readings(depth);
CREATE INDEX idx_depth_readings_confidence ON depth_readings(confidence);
CREATE INDEX idx_depth_readings_validation ON depth_readings(is_validated, validation_score);
CREATE INDEX idx_depth_readings_public ON depth_readings(is_public);

-- Spatial index for location-based queries with different radii
CREATE INDEX idx_depth_readings_location_100m ON depth_readings USING GIST(location) 
    WHERE ST_DWithin(location, ST_Point(0,0)::geography, 100);
CREATE INDEX idx_depth_readings_location_1km ON depth_readings USING GIST(location) 
    WHERE ST_DWithin(location, ST_Point(0,0)::geography, 1000);

-- Create tide_stations table for NOAA station data
CREATE TABLE tide_stations (
    id VARCHAR(20) PRIMARY KEY, -- NOAA station ID
    name VARCHAR(255) NOT NULL,
    location GEOMETRY(POINT, 4326) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    state VARCHAR(2),
    station_type VARCHAR(50), -- tide, current, weather
    datum VARCHAR(50), -- MLLW, MSL, etc.
    time_zone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tide_stations_location ON tide_stations USING GIST(location);
CREATE INDEX idx_tide_stations_type ON tide_stations(station_type);
CREATE INDEX idx_tide_stations_active ON tide_stations(is_active);

-- Create marine_areas table for restricted/special areas
CREATE TABLE marine_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    area_type VARCHAR(100) NOT NULL, -- anchorage, no_motor, restricted, shallow, hazard
    geometry GEOMETRY(POLYGON, 4326) NOT NULL,
    description TEXT,
    restrictions TEXT,
    authority VARCHAR(255), -- Coast Guard, National Park Service, etc.
    effective_date DATE,
    expiration_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    severity_level VARCHAR(20) DEFAULT 'info', -- info, warning, danger, prohibited
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_marine_areas_geometry ON marine_areas USING GIST(geometry);
CREATE INDEX idx_marine_areas_type ON marine_areas(area_type);
CREATE INDEX idx_marine_areas_severity ON marine_areas(severity_level);
CREATE INDEX idx_marine_areas_active ON marine_areas(is_active);

-- Create weather_data table for cached weather information
CREATE TABLE weather_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOMETRY(POINT, 4326) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    data_source VARCHAR(50) NOT NULL, -- noaa, openweather, stormglass
    temperature DECIMAL(5,2), -- Celsius
    wind_speed DECIMAL(5,2), -- knots
    wind_direction INTEGER, -- degrees
    wave_height DECIMAL(4,2), -- meters
    wave_period DECIMAL(4,1), -- seconds
    wave_direction INTEGER, -- degrees
    pressure DECIMAL(6,2), -- hPa
    humidity INTEGER, -- percentage
    visibility DECIMAL(5,2), -- km
    conditions TEXT,
    forecast_data JSONB, -- extended forecast information
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('weather_data', 'timestamp', 
    chunk_time_interval => INTERVAL '6 hours',
    if_not_exists => TRUE
);

CREATE INDEX idx_weather_data_location ON weather_data USING GIST(location);
CREATE INDEX idx_weather_data_source ON weather_data(data_source);
CREATE INDEX idx_weather_data_expires ON weather_data(expires_at);

-- Create user_contributions table for tracking user statistics
CREATE TABLE user_contributions (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    depth_readings_count INTEGER DEFAULT 0,
    verified_readings_count INTEGER DEFAULT 0,
    last_contribution TIMESTAMP WITH TIME ZONE,
    total_distance_covered DECIMAL(10,2) DEFAULT 0, -- nautical miles
    areas_covered INTEGER DEFAULT 0, -- distinct grid squares
    reputation_score DECIMAL(5,2) DEFAULT 0,
    badges TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_contributions_count ON user_contributions(depth_readings_count DESC);
CREATE INDEX idx_user_contributions_reputation ON user_contributions(reputation_score DESC);
CREATE INDEX idx_user_contributions_last ON user_contributions(last_contribution DESC);

-- Create safety_alerts table for marine safety warnings
CREATE TABLE safety_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL, -- weather, hazard, equipment, navigation
    severity VARCHAR(20) NOT NULL, -- info, warning, critical, emergency
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    affected_area GEOMETRY(POLYGON, 4326),
    point_location GEOMETRY(POINT, 4326),
    radius_meters INTEGER, -- for point-based alerts
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    issuing_authority VARCHAR(255),
    reference_number VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_safety_alerts_geometry ON safety_alerts USING GIST(affected_area);
CREATE INDEX idx_safety_alerts_point ON safety_alerts USING GIST(point_location);
CREATE INDEX idx_safety_alerts_type ON safety_alerts(alert_type);
CREATE INDEX idx_safety_alerts_severity ON safety_alerts(severity);
CREATE INDEX idx_safety_alerts_active ON safety_alerts(is_active);
CREATE INDEX idx_safety_alerts_time ON safety_alerts(start_time, end_time);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_depth_readings_updated_at BEFORE UPDATE ON depth_readings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tide_stations_updated_at BEFORE UPDATE ON tide_stations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marine_areas_updated_at BEFORE UPDATE ON marine_areas 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_contributions_updated_at BEFORE UPDATE ON user_contributions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safety_alerts_updated_at BEFORE UPDATE ON safety_alerts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create geometry from lat/lng
CREATE OR REPLACE FUNCTION set_location_from_coordinates() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_Point(NEW.longitude, NEW.latitude);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_depth_reading_location BEFORE INSERT OR UPDATE ON depth_readings
    FOR EACH ROW EXECUTE FUNCTION set_location_from_coordinates();

CREATE TRIGGER set_tide_station_location BEFORE INSERT OR UPDATE ON tide_stations
    FOR EACH ROW EXECUTE FUNCTION set_location_from_coordinates();

CREATE TRIGGER set_weather_data_location BEFORE INSERT OR UPDATE ON weather_data
    FOR EACH ROW EXECUTE FUNCTION set_location_from_coordinates();

-- Create function to update user contribution statistics
CREATE OR REPLACE FUNCTION update_user_contributions() 
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO user_contributions (user_id, depth_readings_count, last_contribution)
        VALUES (NEW.user_id, 1, NEW.created_at)
        ON CONFLICT (user_id) DO UPDATE SET 
            depth_readings_count = user_contributions.depth_readings_count + 1,
            last_contribution = NEW.created_at,
            updated_at = NOW();
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' AND OLD.is_validated = FALSE AND NEW.is_validated = TRUE THEN
        UPDATE user_contributions 
        SET verified_readings_count = verified_readings_count + 1,
            updated_at = NOW()
        WHERE user_id = NEW.user_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_contributions_trigger 
    AFTER INSERT OR UPDATE ON depth_readings
    FOR EACH ROW EXECUTE FUNCTION update_user_contributions();

-- Create view for public depth readings with safety information
CREATE VIEW public_depth_readings AS 
SELECT 
    d.id,
    d.latitude,
    d.longitude,
    d.location,
    d.depth,
    d.confidence,
    d.vessel_draft,
    d.timestamp,
    d.validation_score,
    d.is_validated,
    CASE 
        WHEN d.depth > 20 THEN 'safe'
        WHEN d.depth > 10 THEN 'caution' 
        ELSE 'shallow'
    END as safety_category,
    u.verification_level,
    u.experience_level,
    ST_AsGeoJSON(d.location) as geojson
FROM depth_readings d
JOIN users u ON d.user_id = u.id
WHERE d.is_public = TRUE 
    AND d.confidence > 0.5
    AND d.timestamp > NOW() - INTERVAL '90 days';

-- Create view for marine area intersections
CREATE VIEW depth_readings_with_areas AS
SELECT 
    dr.*,
    COALESCE(
        string_agg(ma.name, ', '),
        'Open Water'
    ) as marine_areas,
    COALESCE(
        array_agg(ma.area_type) FILTER (WHERE ma.area_type IS NOT NULL),
        '{}'
    ) as area_types
FROM public_depth_readings dr
LEFT JOIN marine_areas ma ON ST_Intersects(dr.location, ma.geometry) AND ma.is_active = TRUE
GROUP BY dr.id, dr.latitude, dr.longitude, dr.location, dr.depth, dr.confidence, 
         dr.vessel_draft, dr.timestamp, dr.validation_score, dr.is_validated, 
         dr.safety_category, dr.verification_level, dr.experience_level, dr.geojson;

-- Insert initial tide stations (sample NOAA stations)
INSERT INTO tide_stations (id, name, latitude, longitude, state, station_type, datum, time_zone, is_active) VALUES
('8518750', 'The Battery, NY', 40.7006, -74.0142, 'NY', 'tide', 'MLLW', 'EST', TRUE),
('8443970', 'Boston, MA', 42.3559, -71.0533, 'MA', 'tide', 'MLLW', 'EST', TRUE),
('8632200', 'Kiptopeke Beach, VA', 37.1667, -75.9883, 'VA', 'tide', 'MLLW', 'EST', TRUE),
('8665530', 'Charleston, SC', 32.7816, -79.9250, 'SC', 'tide', 'MLLW', 'EST', TRUE),
('8729840', 'Key West, FL', 24.5513, -81.8082, 'FL', 'tide', 'MLLW', 'EST', TRUE),
('9414290', 'San Francisco, CA', 37.8067, -122.4650, 'CA', 'tide', 'MLLW', 'PST', TRUE),
('9447130', 'Seattle, WA', 47.6062, -122.3321, 'WA', 'tide', 'MLLW', 'PST', TRUE);

-- Create database maintenance functions
CREATE OR REPLACE FUNCTION cleanup_old_weather_data()
RETURNS void AS $$
BEGIN
    DELETE FROM weather_data WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_depth_statistics(
    center_lat DECIMAL(10,8),
    center_lng DECIMAL(11,8),
    radius_meters INTEGER DEFAULT 1000
)
RETURNS TABLE (
    total_readings BIGINT,
    avg_depth DECIMAL(6,2),
    min_depth DECIMAL(6,2),
    max_depth DECIMAL(6,2),
    avg_confidence DECIMAL(3,2),
    unique_contributors BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_readings,
        AVG(d.depth)::DECIMAL(6,2) as avg_depth,
        MIN(d.depth) as min_depth,
        MAX(d.depth) as max_depth,
        AVG(d.confidence)::DECIMAL(3,2) as avg_confidence,
        COUNT(DISTINCT d.user_id) as unique_contributors
    FROM depth_readings d
    WHERE ST_DWithin(d.location::geography, ST_Point(center_lng, center_lat)::geography, radius_meters)
        AND d.is_public = TRUE
        AND d.confidence > 0.5
        AND d.timestamp > NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust based on your user setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO waves_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO waves_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO waves_app_user;

-- Create scheduled cleanup job (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-weather-data', '0 2 * * *', 'SELECT cleanup_old_weather_data();');

COMMIT;