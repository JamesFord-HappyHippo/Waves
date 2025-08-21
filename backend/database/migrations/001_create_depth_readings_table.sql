-- Migration: Create depth_readings table with PostGIS support
-- This migration creates the core table for storing marine depth readings
-- with spatial indexing and enhanced metadata support

BEGIN;

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create depth_readings table
CREATE TABLE IF NOT EXISTS depth_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    depth DECIMAL(8,2) NOT NULL CHECK (depth >= 0 AND depth <= 200),
    timestamp BIGINT NOT NULL,
    vessel_draft DECIMAL(6,2) NOT NULL CHECK (vessel_draft >= 0),
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    source VARCHAR(20) NOT NULL CHECK (source IN ('crowdsource', 'official', 'predicted')),
    user_id UUID,
    
    -- Enhanced GPS and measurement metadata
    gps_accuracy DECIMAL(6,2) CHECK (gps_accuracy >= 0),
    vessel_speed DECIMAL(5,2) CHECK (vessel_speed >= 0),
    measurement_method VARCHAR(20) CHECK (measurement_method IN ('sounder', 'lead_line', 'chart', 'visual')),
    
    -- Environmental conditions (stored as JSONB for flexibility)
    environmental_conditions JSONB,
    
    -- Tide correction data
    tide_correction DECIMAL(5,2),
    
    -- User notes
    notes TEXT,
    
    -- Data quality metadata
    data_quality JSONB,
    
    -- Enhanced confidence scoring
    enhanced_confidence_score DECIMAL(3,2) CHECK (enhanced_confidence_score >= 0 AND enhanced_confidence_score <= 1),
    
    -- Validation results
    validation_results JSONB,
    
    -- Batch processing support
    batch_id VARCHAR(100),
    
    -- Timestamps for auditing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index on location for fast geographic queries
CREATE INDEX IF NOT EXISTS idx_depth_readings_location 
ON depth_readings USING GIST (location);

-- Create index on timestamp for temporal queries
CREATE INDEX IF NOT EXISTS idx_depth_readings_timestamp 
ON depth_readings (timestamp DESC);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_depth_readings_location_timestamp_confidence 
ON depth_readings USING GIST (location) 
INCLUDE (timestamp, confidence_score)
WHERE confidence_score >= 0.5;

-- Create index on source for filtering by data source
CREATE INDEX IF NOT EXISTS idx_depth_readings_source 
ON depth_readings (source);

-- Create index on user_id for user-specific queries
CREATE INDEX IF NOT EXISTS idx_depth_readings_user_id 
ON depth_readings (user_id)
WHERE user_id IS NOT NULL;

-- Create index on batch_id for batch processing
CREATE INDEX IF NOT EXISTS idx_depth_readings_batch_id 
ON depth_readings (batch_id)
WHERE batch_id IS NOT NULL;

-- Create partial index for high-confidence readings
CREATE INDEX IF NOT EXISTS idx_depth_readings_high_confidence 
ON depth_readings (location, timestamp DESC)
WHERE confidence_score >= 0.8;

-- Create JSONB indexes for environmental conditions
CREATE INDEX IF NOT EXISTS idx_depth_readings_env_conditions 
ON depth_readings USING GIN (environmental_conditions);

CREATE INDEX IF NOT EXISTS idx_depth_readings_data_quality 
ON depth_readings USING GIN (data_quality);

-- Create aggregation table for spatial data optimization
CREATE TABLE IF NOT EXISTS depth_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grid_cell GEOGRAPHY(POLYGON, 4326) NOT NULL,
    grid_resolution DECIMAL(8,6) NOT NULL, -- Grid cell size in degrees
    
    -- Aggregated statistics
    reading_count INTEGER NOT NULL DEFAULT 0,
    avg_depth DECIMAL(8,2),
    min_depth DECIMAL(8,2),
    max_depth DECIMAL(8,2),
    depth_stddev DECIMAL(8,2),
    avg_confidence DECIMAL(3,2),
    max_confidence DECIMAL(3,2),
    
    -- Temporal information
    latest_reading_timestamp BIGINT,
    oldest_reading_timestamp BIGINT,
    unique_contributors_count INTEGER DEFAULT 0,
    
    -- Source breakdown
    crowdsource_count INTEGER DEFAULT 0,
    official_count INTEGER DEFAULT 0,
    predicted_count INTEGER DEFAULT 0,
    
    -- Update tracking
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_positive_counts CHECK (
        reading_count >= 0 AND 
        unique_contributors_count >= 0 AND
        crowdsource_count >= 0 AND
        official_count >= 0 AND
        predicted_count >= 0
    )
);

-- Create spatial index on aggregate grid cells
CREATE INDEX IF NOT EXISTS idx_depth_aggregates_grid_cell 
ON depth_aggregates USING GIST (grid_cell);

-- Create index on grid resolution for different zoom levels
CREATE INDEX IF NOT EXISTS idx_depth_aggregates_resolution 
ON depth_aggregates (grid_resolution);

-- Create users table for depth data contributors
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    
    -- User profile information
    display_name VARCHAR(100),
    vessel_name VARCHAR(100),
    vessel_type VARCHAR(50),
    vessel_length DECIMAL(5,2),
    default_draft DECIMAL(5,2),
    
    -- Privacy settings
    privacy_settings JSONB,
    
    -- Contribution statistics
    total_depth_readings INTEGER DEFAULT 0,
    contribution_score DECIMAL(8,2) DEFAULT 0,
    reputation_score DECIMAL(5,2) DEFAULT 0 CHECK (reputation_score >= 0 AND reputation_score <= 5),
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create indexes for user table
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

-- Create tide_stations reference table for tide corrections
CREATE TABLE IF NOT EXISTS tide_stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id VARCHAR(50) UNIQUE NOT NULL,
    station_name VARCHAR(255) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    chart_datum DECIMAL(5,2) DEFAULT 0,
    time_zone VARCHAR(50),
    data_source VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index on tide stations
CREATE INDEX IF NOT EXISTS idx_tide_stations_location 
ON tide_stations USING GIST (location);

-- Add foreign key constraint for user references
ALTER TABLE depth_readings 
ADD CONSTRAINT fk_depth_readings_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE SET NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_depth_readings_updated_at 
    BEFORE UPDATE ON depth_readings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for spatial aggregation
CREATE OR REPLACE FUNCTION update_depth_aggregates(
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_depth DECIMAL,
    p_confidence DECIMAL,
    p_timestamp BIGINT,
    p_source VARCHAR,
    p_grid_resolution DECIMAL DEFAULT 0.001
)
RETURNS VOID AS $$
DECLARE
    grid_lat DECIMAL;
    grid_lon DECIMAL;
    grid_polygon GEOGRAPHY;
    existing_aggregate_id UUID;
BEGIN
    -- Calculate grid cell coordinates (snap to grid)
    grid_lat := FLOOR(p_latitude / p_grid_resolution) * p_grid_resolution;
    grid_lon := FLOOR(p_longitude / p_grid_resolution) * p_grid_resolution;
    
    -- Create grid cell polygon
    grid_polygon := ST_MakeEnvelope(
        grid_lon, 
        grid_lat, 
        grid_lon + p_grid_resolution, 
        grid_lat + p_grid_resolution, 
        4326
    )::geography;
    
    -- Check if aggregate already exists for this grid cell
    SELECT id INTO existing_aggregate_id
    FROM depth_aggregates
    WHERE grid_resolution = p_grid_resolution
    AND ST_Equals(grid_cell, grid_polygon);
    
    IF existing_aggregate_id IS NOT NULL THEN
        -- Update existing aggregate
        UPDATE depth_aggregates SET
            reading_count = reading_count + 1,
            avg_depth = (avg_depth * (reading_count - 1) + p_depth) / reading_count,
            min_depth = LEAST(min_depth, p_depth),
            max_depth = GREATEST(max_depth, p_depth),
            avg_confidence = (avg_confidence * (reading_count - 1) + p_confidence) / reading_count,
            max_confidence = GREATEST(max_confidence, p_confidence),
            latest_reading_timestamp = GREATEST(latest_reading_timestamp, p_timestamp),
            oldest_reading_timestamp = LEAST(oldest_reading_timestamp, p_timestamp),
            crowdsource_count = CASE WHEN p_source = 'crowdsource' THEN crowdsource_count + 1 ELSE crowdsource_count END,
            official_count = CASE WHEN p_source = 'official' THEN official_count + 1 ELSE official_count END,
            predicted_count = CASE WHEN p_source = 'predicted' THEN predicted_count + 1 ELSE predicted_count END,
            last_updated = CURRENT_TIMESTAMP
        WHERE id = existing_aggregate_id;
    ELSE
        -- Insert new aggregate
        INSERT INTO depth_aggregates (
            grid_cell, grid_resolution, reading_count, avg_depth, min_depth, max_depth,
            avg_confidence, max_confidence, latest_reading_timestamp, oldest_reading_timestamp,
            crowdsource_count, official_count, predicted_count
        ) VALUES (
            grid_polygon, p_grid_resolution, 1, p_depth, p_depth, p_depth,
            p_confidence, p_confidence, p_timestamp, p_timestamp,
            CASE WHEN p_source = 'crowdsource' THEN 1 ELSE 0 END,
            CASE WHEN p_source = 'official' THEN 1 ELSE 0 END,
            CASE WHEN p_source = 'predicted' THEN 1 ELSE 0 END
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update aggregates when new depth readings are inserted
CREATE OR REPLACE FUNCTION trigger_update_depth_aggregates()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_depth_aggregates(
        ST_Y(NEW.location::geometry)::DECIMAL,
        ST_X(NEW.location::geometry)::DECIMAL,
        NEW.depth,
        NEW.confidence_score,
        NEW.timestamp,
        NEW.source
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER depth_readings_update_aggregates
    AFTER INSERT ON depth_readings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_depth_aggregates();

-- Create function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_depth_data(
    days_to_keep INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    cutoff_timestamp BIGINT;
BEGIN
    cutoff_timestamp := EXTRACT(EPOCH FROM CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep) * 1000;
    
    -- Delete old low-confidence readings
    DELETE FROM depth_readings
    WHERE timestamp < cutoff_timestamp
    AND confidence_score < 0.5
    AND source = 'crowdsource';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up orphaned aggregates
    DELETE FROM depth_aggregates
    WHERE latest_reading_timestamp < cutoff_timestamp
    AND crowdsource_count = 0;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert some default tide stations for common areas
INSERT INTO tide_stations (station_id, station_name, location, chart_datum, time_zone, data_source) VALUES
('9414290', 'San Francisco Bay', ST_GeogFromText('POINT(-122.4194 37.7749)'), 0.0, 'PST8PDT', 'NOAA'),
('8518750', 'New York Harbor', ST_GeogFromText('POINT(-74.0141 40.7067)'), 0.0, 'EST5EDT', 'NOAA'),
('9447130', 'Seattle', ST_GeogFromText('POINT(-122.3394 47.6024)'), 0.0, 'PST8PDT', 'NOAA'),
('8724580', 'Key West', ST_GeogFromText('POINT(-81.8081 24.5557)'), 0.0, 'EST5EDT', 'NOAA'),
('9410230', 'Monterey', ST_GeogFromText('POINT(-121.8885 36.6052)'), 0.0, 'PST8PDT', 'NOAA')
ON CONFLICT (station_id) DO NOTHING;

COMMIT;

-- Add comment to document the schema
COMMENT ON TABLE depth_readings IS 'Core table for storing marine depth readings with spatial indexing and quality metadata';
COMMENT ON TABLE depth_aggregates IS 'Spatial aggregation of depth data for performance optimization';
COMMENT ON TABLE users IS 'User accounts for depth data contributors with vessel information';
COMMENT ON TABLE tide_stations IS 'Reference data for tide corrections and datum adjustments';

COMMENT ON COLUMN depth_readings.location IS 'Geographic location of the depth reading (WGS84)';
COMMENT ON COLUMN depth_readings.depth IS 'Water depth in meters at the location';
COMMENT ON COLUMN depth_readings.confidence_score IS 'Original confidence score (0-1) from the user or sensor';
COMMENT ON COLUMN depth_readings.enhanced_confidence_score IS 'AI-enhanced confidence score incorporating multiple factors';
COMMENT ON COLUMN depth_readings.environmental_conditions IS 'Weather, sea state, and environmental metadata as JSON';
COMMENT ON COLUMN depth_readings.validation_results IS 'Automated validation results and quality checks as JSON';