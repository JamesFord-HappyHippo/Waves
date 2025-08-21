-- Environmental Data Storage Schema with TimescaleDB
-- Optimized for time-series marine environmental data

-- Enable PostGIS and TimescaleDB extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create schema for environmental data
CREATE SCHEMA IF NOT EXISTS environmental;

-- Set search path to include environmental schema
SET search_path TO environmental, public;

-- ==============================================
-- CORE REFERENCE TABLES
-- ==============================================

-- NOAA stations reference table
CREATE TABLE noaa_stations (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    state VARCHAR(10),
    region VARCHAR(50),
    timezone VARCHAR(50),
    tide_type VARCHAR(20) CHECK (tide_type IN ('harmonic', 'subordinate')),
    station_type VARCHAR(50), -- water_level, met, current, etc.
    datum VARCHAR(10) DEFAULT 'MLLW',
    established_date DATE,
    decommissioned_date DATE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create spatial index on station locations
CREATE INDEX idx_noaa_stations_location ON noaa_stations USING GIST (location);
CREATE INDEX idx_noaa_stations_region ON noaa_stations (region);
CREATE INDEX idx_noaa_stations_type ON noaa_stations (station_type);

-- Weather data providers reference
CREATE TABLE weather_providers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    base_url VARCHAR(255),
    api_version VARCHAR(20),
    rate_limit INTEGER,
    data_types TEXT[], -- array of supported data types
    coverage_area GEOGRAPHY(POLYGON, 4326),
    reliability_score DECIMAL(3,2) DEFAULT 0.90,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- TIME-SERIES HYPERTABLES
-- ==============================================

-- Tide predictions time-series table
CREATE TABLE tide_predictions (
    station_id VARCHAR(20) NOT NULL,
    prediction_time TIMESTAMPTZ NOT NULL,
    water_level DECIMAL(8,3) NOT NULL, -- meters
    tide_type CHAR(1) CHECK (tide_type IN ('H', 'L')), -- High or Low
    prediction_interval VARCHAR(10), -- 'hilo', 'hourly', '6min'
    datum VARCHAR(10) DEFAULT 'MLLW',
    quality_code VARCHAR(10),
    source VARCHAR(50) DEFAULT 'NOAA',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (station_id, prediction_time),
    FOREIGN KEY (station_id) REFERENCES noaa_stations(id) ON DELETE CASCADE
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('tide_predictions', 'prediction_time', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Observed water levels time-series table
CREATE TABLE water_levels (
    station_id VARCHAR(20) NOT NULL,
    observation_time TIMESTAMPTZ NOT NULL,
    water_level DECIMAL(8,3) NOT NULL, -- meters
    sigma DECIMAL(6,3), -- standard deviation
    quality_flags VARCHAR(20),
    verification_status VARCHAR(20) DEFAULT 'preliminary',
    datum VARCHAR(10) DEFAULT 'MLLW',
    source VARCHAR(50) DEFAULT 'NOAA',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (station_id, observation_time),
    FOREIGN KEY (station_id) REFERENCES noaa_stations(id) ON DELETE CASCADE
);

-- Convert to hypertable
SELECT create_hypertable('water_levels', 'observation_time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Marine weather observations time-series
CREATE TABLE weather_observations (
    id BIGSERIAL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    observation_time TIMESTAMPTZ NOT NULL,
    provider_id VARCHAR(50) NOT NULL,
    
    -- Temperature data (Celsius)
    air_temperature DECIMAL(5,2),
    water_temperature DECIMAL(5,2),
    dew_point DECIMAL(5,2),
    
    -- Wind data (m/s and degrees)
    wind_speed DECIMAL(6,2),
    wind_direction DECIMAL(5,1),
    wind_gust DECIMAL(6,2),
    
    -- Pressure data (hPa)
    barometric_pressure DECIMAL(7,2),
    pressure_tendency DECIMAL(4,2),
    
    -- Visibility (km)
    visibility DECIMAL(6,2),
    
    -- Wave data (meters and seconds)
    wave_height DECIMAL(5,2),
    dominant_wave_period DECIMAL(5,1),
    average_wave_period DECIMAL(5,1),
    wave_direction DECIMAL(5,1),
    
    -- Swell data
    swell_height DECIMAL(5,2),
    swell_period DECIMAL(5,1),
    swell_direction DECIMAL(5,1),
    
    -- Current data (m/s and degrees)
    current_speed DECIMAL(5,2),
    current_direction DECIMAL(5,1),
    
    -- Additional marine conditions
    sea_state INTEGER CHECK (sea_state BETWEEN 0 AND 9),
    weather_conditions TEXT,
    cloud_cover INTEGER CHECK (cloud_cover BETWEEN 0 AND 100),
    humidity INTEGER CHECK (humidity BETWEEN 0 AND 100),
    precipitation DECIMAL(6,2), -- mm
    
    -- Quality and metadata
    data_quality DECIMAL(3,2) DEFAULT 1.0,
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id, observation_time),
    FOREIGN KEY (provider_id) REFERENCES weather_providers(id)
);

-- Convert to hypertable
SELECT create_hypertable('weather_observations', 'observation_time',
    chunk_time_interval => INTERVAL '6 hours',
    if_not_exists => TRUE
);

-- Create spatial index on weather observations
CREATE INDEX idx_weather_obs_location ON weather_observations USING GIST (location);
CREATE INDEX idx_weather_obs_provider ON weather_observations (provider_id);

-- Weather forecasts time-series
CREATE TABLE weather_forecasts (
    id BIGSERIAL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    forecast_time TIMESTAMPTZ NOT NULL, -- when forecast is valid for
    issued_time TIMESTAMPTZ NOT NULL, -- when forecast was issued
    provider_id VARCHAR(50) NOT NULL,
    forecast_hour INTEGER NOT NULL, -- hours ahead from issue time
    
    -- Same weather parameters as observations
    air_temperature DECIMAL(5,2),
    water_temperature DECIMAL(5,2),
    wind_speed DECIMAL(6,2),
    wind_direction DECIMAL(5,1),
    wind_gust DECIMAL(6,2),
    barometric_pressure DECIMAL(7,2),
    visibility DECIMAL(6,2),
    wave_height DECIMAL(5,2),
    wave_period DECIMAL(5,1),
    wave_direction DECIMAL(5,1),
    swell_height DECIMAL(5,2),
    swell_period DECIMAL(5,1),
    swell_direction DECIMAL(5,1),
    
    -- Forecast-specific fields
    precipitation_probability INTEGER CHECK (precipitation_probability BETWEEN 0 AND 100),
    precipitation_amount DECIMAL(6,2),
    weather_conditions TEXT,
    cloud_cover INTEGER,
    
    confidence_score DECIMAL(3,2) DEFAULT 0.8,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id, forecast_time),
    FOREIGN KEY (provider_id) REFERENCES weather_providers(id)
);

-- Convert to hypertable
SELECT create_hypertable('weather_forecasts', 'forecast_time',
    chunk_time_interval => INTERVAL '12 hours',
    if_not_exists => TRUE
);

-- Marine alerts and warnings
CREATE TABLE marine_alerts (
    id BIGSERIAL,
    alert_id VARCHAR(100) UNIQUE NOT NULL, -- Provider's alert ID
    alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN 
        ('gale', 'storm', 'hurricane', 'smallcraft', 'marine', 'fog', 'ice', 'tsunami')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN 
        ('minor', 'moderate', 'severe', 'extreme')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    areas TEXT[], -- Affected geographic areas
    coordinates GEOGRAPHY(MULTIPOLYGON, 4326), -- Affected areas geometry
    
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    issued_time TIMESTAMPTZ NOT NULL,
    updated_time TIMESTAMPTZ,
    
    provider_id VARCHAR(50) NOT NULL,
    source_url VARCHAR(500),
    urgency VARCHAR(20) DEFAULT 'expected',
    certainty VARCHAR(20) DEFAULT 'likely',
    
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id, issued_time),
    FOREIGN KEY (provider_id) REFERENCES weather_providers(id)
);

-- Convert to hypertable
SELECT create_hypertable('marine_alerts', 'issued_time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Create spatial index on alert areas
CREATE INDEX idx_marine_alerts_coords ON marine_alerts USING GIST (coordinates);
CREATE INDEX idx_marine_alerts_validity ON marine_alerts (valid_from, valid_to);
CREATE INDEX idx_marine_alerts_severity ON marine_alerts (severity, alert_type);

-- ==============================================
-- PROCESSED AND DERIVED DATA TABLES
-- ==============================================

-- Corrected depth readings with environmental factors
CREATE TABLE processed_depth_readings (
    id BIGSERIAL,
    original_reading_id VARCHAR(100) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    reading_time TIMESTAMPTZ NOT NULL,
    
    -- Original depth data
    raw_depth DECIMAL(8,3) NOT NULL,
    vessel_draft DECIMAL(6,3) NOT NULL,
    
    -- Corrections applied
    tide_correction DECIMAL(6,3) DEFAULT 0,
    tide_station_id VARCHAR(20),
    tide_station_distance DECIMAL(8,2), -- meters
    tide_correction_method VARCHAR(20) CHECK (tide_correction_method IN 
        ('interpolated', 'predicted', 'observed', 'estimated')),
    tide_confidence DECIMAL(3,2) DEFAULT 0.5,
    
    environmental_correction DECIMAL(6,3) DEFAULT 0,
    wind_correction DECIMAL(6,3) DEFAULT 0,
    current_correction DECIMAL(6,3) DEFAULT 0,
    pressure_correction DECIMAL(6,3) DEFAULT 0,
    temperature_correction DECIMAL(6,3) DEFAULT 0,
    salinity_correction DECIMAL(6,3) DEFAULT 0,
    
    -- Final corrected depth
    corrected_depth DECIMAL(8,3) NOT NULL,
    safety_margin DECIMAL(6,3) NOT NULL,
    
    -- Quality assessment
    overall_quality_score DECIMAL(3,2) NOT NULL,
    data_age_score DECIMAL(3,2),
    station_distance_score DECIMAL(3,2),
    environmental_conditions_score DECIMAL(3,2),
    source_reliability_score DECIMAL(3,2),
    instrument_accuracy_score DECIMAL(3,2),
    
    reliability_rating VARCHAR(20) CHECK (reliability_rating IN 
        ('high', 'medium', 'low', 'unreliable')),
    
    quality_warnings TEXT[],
    processing_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id, reading_time),
    FOREIGN KEY (tide_station_id) REFERENCES noaa_stations(id)
);

-- Convert to hypertable
SELECT create_hypertable('processed_depth_readings', 'reading_time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Create indexes for spatial and quality queries
CREATE INDEX idx_processed_depth_location ON processed_depth_readings USING GIST (location);
CREATE INDEX idx_processed_depth_quality ON processed_depth_readings (overall_quality_score);
CREATE INDEX idx_processed_depth_reliability ON processed_depth_readings (reliability_rating);

-- Environmental data aggregations (hourly summaries)
CREATE TABLE environmental_hourly_summary (
    location_grid VARCHAR(20) NOT NULL, -- Spatial grid cell identifier
    summary_time TIMESTAMPTZ NOT NULL, -- Hour timestamp
    
    -- Weather summary statistics
    avg_air_temperature DECIMAL(5,2),
    min_air_temperature DECIMAL(5,2),
    max_air_temperature DECIMAL(5,2),
    
    avg_wind_speed DECIMAL(6,2),
    max_wind_speed DECIMAL(6,2),
    predominant_wind_direction DECIMAL(5,1),
    
    avg_wave_height DECIMAL(5,2),
    max_wave_height DECIMAL(5,2),
    
    avg_barometric_pressure DECIMAL(7,2),
    min_barometric_pressure DECIMAL(7,2),
    max_barometric_pressure DECIMAL(7,2),
    
    total_precipitation DECIMAL(6,2),
    avg_visibility DECIMAL(6,2),
    min_visibility DECIMAL(6,2),
    
    -- Data quality metrics
    observation_count INTEGER DEFAULT 0,
    data_quality_avg DECIMAL(3,2),
    provider_coverage JSONB, -- Which providers contributed data
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (location_grid, summary_time)
);

-- Convert to hypertable
SELECT create_hypertable('environmental_hourly_summary', 'summary_time',
    chunk_time_interval => INTERVAL '1 week',
    if_not_exists => TRUE
);

-- ==============================================
-- CACHING AND PERFORMANCE TABLES
-- ==============================================

-- Environmental data cache metadata
CREATE TABLE cache_metadata (
    cache_key VARCHAR(255) PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    size_bytes INTEGER,
    hit_count INTEGER DEFAULT 0,
    provider_source VARCHAR(50),
    cache_status VARCHAR(20) DEFAULT 'active'
);

-- Create index for cache cleanup
CREATE INDEX idx_cache_expiry ON cache_metadata (expires_at, cache_status);
CREATE INDEX idx_cache_location ON cache_metadata USING GIST (location);

-- Real-time subscription tracking
CREATE TABLE realtime_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    radius_meters INTEGER NOT NULL,
    data_types TEXT[] NOT NULL,
    update_interval_seconds INTEGER NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT TRUE,
    last_update_sent TIMESTAMPTZ,
    total_updates_sent INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Create indexes for subscription queries
CREATE INDEX idx_realtime_subs_location ON realtime_subscriptions USING GIST (location);
CREATE INDEX idx_realtime_subs_active ON realtime_subscriptions (is_active, expires_at);

-- ==============================================
-- DATA RETENTION POLICIES
-- ==============================================

-- Retention policy for raw weather observations (keep 30 days)
SELECT add_retention_policy('weather_observations', INTERVAL '30 days');

-- Retention policy for weather forecasts (keep 7 days)
SELECT add_retention_policy('weather_forecasts', INTERVAL '7 days');

-- Retention policy for marine alerts (keep 90 days)
SELECT add_retention_policy('marine_alerts', INTERVAL '90 days');

-- Retention policy for processed depth readings (keep 1 year)
SELECT add_retention_policy('processed_depth_readings', INTERVAL '1 year');

-- Retention policy for hourly summaries (keep 2 years)
SELECT add_retention_policy('environmental_hourly_summary', INTERVAL '2 years');

-- ==============================================
-- CONTINUOUS AGGREGATES FOR PERFORMANCE
-- ==============================================

-- Continuous aggregate for hourly weather statistics
CREATE MATERIALIZED VIEW weather_hourly_stats
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', observation_time) as hour,
    ST_SnapToGrid(location, 0.01) as location_grid, -- ~1km grid
    provider_id,
    COUNT(*) as observation_count,
    AVG(air_temperature) as avg_air_temp,
    MIN(air_temperature) as min_air_temp,
    MAX(air_temperature) as max_air_temp,
    AVG(wind_speed) as avg_wind_speed,
    MAX(wind_speed) as max_wind_speed,
    AVG(wave_height) as avg_wave_height,
    MAX(wave_height) as max_wave_height,
    AVG(barometric_pressure) as avg_pressure,
    AVG(data_quality) as avg_quality
FROM weather_observations
GROUP BY hour, location_grid, provider_id;

-- Refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('weather_hourly_stats',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '10 minutes');

-- Continuous aggregate for daily tide statistics
CREATE MATERIALIZED VIEW tide_daily_stats
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', prediction_time) as day,
    station_id,
    COUNT(*) as prediction_count,
    MIN(water_level) as daily_low,
    MAX(water_level) as daily_high,
    AVG(water_level) as avg_level,
    COUNT(*) FILTER (WHERE tide_type = 'H') as high_tide_count,
    COUNT(*) FILTER (WHERE tide_type = 'L') as low_tide_count
FROM tide_predictions
GROUP BY day, station_id;

-- Refresh policy for tide statistics
SELECT add_continuous_aggregate_policy('tide_daily_stats',
    start_offset => INTERVAL '1 day',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- ==============================================
-- UTILITY FUNCTIONS
-- ==============================================

-- Function to find nearest NOAA station
CREATE OR REPLACE FUNCTION find_nearest_station(
    query_lat DECIMAL,
    query_lon DECIMAL,
    max_distance_km DECIMAL DEFAULT 50,
    station_types TEXT[] DEFAULT ARRAY['water_level']
)
RETURNS TABLE(
    station_id VARCHAR(20),
    station_name VARCHAR(200),
    distance_km DECIMAL,
    station_type VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        ROUND((ST_Distance(
            s.location, 
            ST_SetSRID(ST_Point(query_lon, query_lat), 4326)::geography
        ) / 1000)::DECIMAL, 2) as distance_km,
        s.station_type
    FROM noaa_stations s
    WHERE 
        (station_types IS NULL OR s.station_type = ANY(station_types))
        AND s.decommissioned_date IS NULL
        AND ST_DWithin(
            s.location, 
            ST_SetSRID(ST_Point(query_lon, query_lat), 4326)::geography,
            max_distance_km * 1000
        )
    ORDER BY distance_km
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to get current environmental conditions for location
CREATE OR REPLACE FUNCTION get_current_conditions(
    query_lat DECIMAL,
    query_lon DECIMAL,
    radius_km DECIMAL DEFAULT 5
)
RETURNS TABLE(
    air_temp DECIMAL,
    wind_speed DECIMAL,
    wind_direction DECIMAL,
    wave_height DECIMAL,
    pressure DECIMAL,
    visibility DECIMAL,
    data_age_minutes INTEGER,
    quality_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wo.air_temperature,
        wo.wind_speed,
        wo.wind_direction,
        wo.wave_height,
        wo.barometric_pressure,
        wo.visibility,
        EXTRACT(EPOCH FROM (NOW() - wo.observation_time))::INTEGER / 60 as data_age_minutes,
        wo.data_quality
    FROM weather_observations wo
    WHERE 
        ST_DWithin(
            wo.location,
            ST_SetSRID(ST_Point(query_lon, query_lat), 4326)::geography,
            radius_km * 1000
        )
        AND wo.observation_time > NOW() - INTERVAL '2 hours'
    ORDER BY 
        wo.observation_time DESC,
        ST_Distance(wo.location, ST_SetSRID(ST_Point(query_lon, query_lat), 4326)::geography)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_metadata 
    WHERE expires_at < NOW() OR cache_status = 'expired';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- TRIGGERS AND AUTOMATION
-- ==============================================

-- Trigger to update station updated_at timestamp
CREATE OR REPLACE FUNCTION update_station_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_noaa_stations_updated
    BEFORE UPDATE ON noaa_stations
    FOR EACH ROW
    EXECUTE FUNCTION update_station_timestamp();

-- Trigger to automatically generate hourly summaries
CREATE OR REPLACE FUNCTION generate_hourly_summary()
RETURNS TRIGGER AS $$
DECLARE
    grid_cell VARCHAR(20);
    hour_timestamp TIMESTAMPTZ;
BEGIN
    -- Generate grid cell identifier (simplified)
    grid_cell := CONCAT(
        ROUND(ST_X(NEW.location::geometry)::DECIMAL, 2)::TEXT, '_',
        ROUND(ST_Y(NEW.location::geometry)::DECIMAL, 2)::TEXT
    );
    
    hour_timestamp := date_trunc('hour', NEW.observation_time);
    
    -- Insert or update hourly summary
    INSERT INTO environmental_hourly_summary (
        location_grid, 
        summary_time,
        avg_air_temperature,
        avg_wind_speed,
        avg_wave_height,
        avg_barometric_pressure,
        observation_count,
        data_quality_avg
    ) VALUES (
        grid_cell,
        hour_timestamp,
        NEW.air_temperature,
        NEW.wind_speed,
        NEW.wave_height,
        NEW.barometric_pressure,
        1,
        NEW.data_quality
    )
    ON CONFLICT (location_grid, summary_time) DO UPDATE SET
        avg_air_temperature = COALESCE(
            (environmental_hourly_summary.avg_air_temperature * environmental_hourly_summary.observation_count + COALESCE(NEW.air_temperature, 0)) / 
            (environmental_hourly_summary.observation_count + 1), 
            environmental_hourly_summary.avg_air_temperature
        ),
        avg_wind_speed = COALESCE(
            (environmental_hourly_summary.avg_wind_speed * environmental_hourly_summary.observation_count + COALESCE(NEW.wind_speed, 0)) / 
            (environmental_hourly_summary.observation_count + 1), 
            environmental_hourly_summary.avg_wind_speed
        ),
        avg_wave_height = COALESCE(
            (environmental_hourly_summary.avg_wave_height * environmental_hourly_summary.observation_count + COALESCE(NEW.wave_height, 0)) / 
            (environmental_hourly_summary.observation_count + 1), 
            environmental_hourly_summary.avg_wave_height
        ),
        avg_barometric_pressure = COALESCE(
            (environmental_hourly_summary.avg_barometric_pressure * environmental_hourly_summary.observation_count + COALESCE(NEW.barometric_pressure, 0)) / 
            (environmental_hourly_summary.observation_count + 1), 
            environmental_hourly_summary.avg_barometric_pressure
        ),
        observation_count = environmental_hourly_summary.observation_count + 1,
        data_quality_avg = COALESCE(
            (environmental_hourly_summary.data_quality_avg * environmental_hourly_summary.observation_count + COALESCE(NEW.data_quality, 0)) / 
            (environmental_hourly_summary.observation_count + 1), 
            environmental_hourly_summary.data_quality_avg
        );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_weather_hourly_summary
    AFTER INSERT ON weather_observations
    FOR EACH ROW
    EXECUTE FUNCTION generate_hourly_summary();

-- ==============================================
-- INITIAL DATA SEEDING
-- ==============================================

-- Insert common weather providers
INSERT INTO weather_providers (id, name, base_url, api_version, rate_limit, data_types, reliability_score) VALUES
('stormglass', 'Stormglass Marine Weather', 'https://api.stormglass.io/v2', '2.0', 50, 
 ARRAY['weather', 'waves', 'tides'], 0.95),
('openweather', 'OpenWeatherMap', 'https://api.openweathermap.org/data/2.5', '2.5', 60, 
 ARRAY['weather', 'forecast'], 0.85),
('noaa', 'NOAA National Weather Service', 'https://api.weather.gov', '1.0', 300, 
 ARRAY['weather', 'alerts', 'forecasts'], 0.98),
('weatherapi', 'WeatherAPI', 'https://api.weatherapi.com/v1', '1.0', 100, 
 ARRAY['weather', 'forecast', 'marine'], 0.80)
ON CONFLICT (id) DO NOTHING;

-- Insert sample NOAA stations (these would be loaded from NOAA's station inventory)
INSERT INTO noaa_stations (id, name, location, state, region, timezone, tide_type, station_type) VALUES
('8518750', 'The Battery, NY', ST_SetSRID(ST_Point(-74.015, 40.7), 4326)::geography, 'NY', 'Atlantic', 'EST', 'harmonic', 'water_level'),
('8557380', 'Lewes, DE', ST_SetSRID(ST_Point(-75.12, 38.782), 4326)::geography, 'DE', 'Atlantic', 'EST', 'harmonic', 'water_level'),
('8594900', 'Annapolis, MD', ST_SetSRID(ST_Point(-76.481, 38.983), 4326)::geography, 'MD', 'Atlantic', 'EST', 'harmonic', 'water_level'),
('9414290', 'San Francisco, CA', ST_SetSRID(ST_Point(-122.465, 37.807), 4326)::geography, 'CA', 'Pacific', 'PST', 'harmonic', 'water_level'),
('9447130', 'Seattle, WA', ST_SetSRID(ST_Point(-122.339, 47.602), 4326)::geography, 'WA', 'Pacific', 'PST', 'harmonic', 'water_level'),
('9410170', 'San Diego, CA', ST_SetSRID(ST_Point(-117.173, 32.714), 4326)::geography, 'CA', 'Pacific', 'PST', 'harmonic', 'water_level')
ON CONFLICT (id) DO NOTHING;

-- Create scheduled job for cache cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-environmental-cache', '0 2 * * *', 'SELECT cleanup_expired_cache();');

-- ==============================================
-- PERFORMANCE MONITORING VIEWS
-- ==============================================

-- View for monitoring hypertable compression
CREATE VIEW hypertable_compression_stats AS
SELECT 
    hypertable_name,
    compression_status,
    uncompressed_heap_size,
    compressed_heap_size,
    uncompressed_index_size,
    compressed_index_size,
    CASE 
        WHEN uncompressed_heap_size > 0 
        THEN ROUND((compressed_heap_size::DECIMAL / uncompressed_heap_size) * 100, 2)
        ELSE 0 
    END as compression_ratio_percent
FROM timescaledb_information.compressed_hypertable_stats
WHERE schema_name = 'environmental';

-- View for monitoring chunk statistics
CREATE VIEW chunk_statistics AS
SELECT 
    hypertable_name,
    chunk_name,
    range_start,
    range_end,
    is_compressed,
    chunk_size,
    EXTRACT(EPOCH FROM (range_end - range_start)) / 3600 as chunk_hours
FROM timescaledb_information.chunks
WHERE hypertable_schema = 'environmental'
ORDER BY hypertable_name, range_start DESC;

-- Performance comment
COMMENT ON SCHEMA environmental IS 'Environmental data schema optimized for time-series marine navigation data with PostGIS spatial capabilities and TimescaleDB time-series optimization';

-- Grant permissions (adjust as needed for your application)
-- GRANT USAGE ON SCHEMA environmental TO waves_app_user;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA environmental TO waves_app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA environmental TO waves_app_user;