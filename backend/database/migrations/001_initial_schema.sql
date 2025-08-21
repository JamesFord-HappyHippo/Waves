-- Waves Marine Navigation Database Schema
-- PostgreSQL 16 with PostGIS and TimescaleDB extensions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create custom types
CREATE TYPE vessel_type AS ENUM ('sailboat', 'powerboat', 'catamaran', 'trawler', 'yacht', 'dinghy', 'pwc', 'other');
CREATE TYPE depth_confidence AS ENUM ('low', 'medium', 'high', 'verified');
CREATE TYPE weather_condition AS ENUM ('calm', 'light_wind', 'moderate_wind', 'strong_wind', 'storm', 'fog', 'rain');
CREATE TYPE user_role AS ENUM ('user', 'premium', 'captain', 'admin');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role user_role DEFAULT 'user',
    is_verified BOOLEAN DEFAULT FALSE,
    privacy_settings JSONB DEFAULT '{"share_tracks": false, "share_depth": true, "public_profile": false}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- Vessels table
CREATE TABLE vessels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    vessel_type vessel_type NOT NULL,
    length_meters DECIMAL(5,2),
    beam_meters DECIMAL(5,2),
    draft_meters DECIMAL(4,2) NOT NULL,
    displacement_kg INTEGER,
    max_speed_knots DECIMAL(4,1),
    fuel_capacity_liters INTEGER,
    registration_number VARCHAR(50),
    mmsi VARCHAR(15),
    insurance_policy JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- GPS Tracking table (TimescaleDB hypertable)
CREATE TABLE gps_tracks (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    speed_knots DECIMAL(5,2),
    heading_degrees INTEGER CHECK (heading_degrees >= 0 AND heading_degrees <= 360),
    altitude_meters DECIMAL(6,2),
    accuracy_meters DECIMAL(5,2),
    satellites INTEGER,
    hdop DECIMAL(4,2),
    session_id UUID,
    weather_condition weather_condition,
    sea_state INTEGER CHECK (sea_state >= 0 AND sea_state <= 9),
    visibility_km DECIMAL(4,1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('gps_tracks', 'timestamp');

-- Depth readings table (TimescaleDB hypertable)
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

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('depth_readings', 'timestamp');

-- Marine areas of interest
CREATE TABLE marine_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    area_type VARCHAR(50) NOT NULL, -- 'harbor', 'anchorage', 'channel', 'reef', 'restricted'
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    min_depth_meters DECIMAL(6,2),
    max_depth_meters DECIMAL(6,2),
    restrictions JSONB,
    contact_info JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routes table
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    start_point GEOGRAPHY(POINT, 4326) NOT NULL,
    end_point GEOGRAPHY(POINT, 4326) NOT NULL,
    waypoints GEOGRAPHY(LINESTRING, 4326),
    total_distance_nm DECIMAL(8,2),
    estimated_duration_hours DECIMAL(6,2),
    min_depth_required DECIMAL(4,2),
    weather_constraints JSONB,
    is_public BOOLEAN DEFAULT FALSE,
    difficulty_level INTEGER CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Navigation sessions
CREATE TABLE navigation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    start_location GEOGRAPHY(POINT, 4326) NOT NULL,
    end_location GEOGRAPHY(POINT, 4326),
    total_distance_nm DECIMAL(8,2),
    max_speed_knots DECIMAL(5,2),
    avg_speed_knots DECIMAL(5,2),
    fuel_consumed_liters DECIMAL(8,2),
    track_geometry GEOMETRY(LINESTRING, 4326),
    weather_summary JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weather data cache
CREATE TABLE weather_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    source VARCHAR(50) NOT NULL,
    wind_speed_knots DECIMAL(5,2),
    wind_direction INTEGER CHECK (wind_direction >= 0 AND wind_direction <= 360),
    wave_height_meters DECIMAL(4,2),
    wave_period_seconds INTEGER,
    wave_direction INTEGER CHECK (wave_direction >= 0 AND wave_direction <= 360),
    visibility_km DECIMAL(4,1),
    precipitation_mm DECIMAL(5,2),
    temperature_celsius DECIMAL(4,1),
    pressure_mb DECIMAL(6,1),
    humidity_percent INTEGER CHECK (humidity_percent >= 0 AND humidity_percent <= 100),
    forecast_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('weather_data', 'timestamp');

-- Tide data cache
CREATE TABLE tide_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id VARCHAR(20) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    height_meters DECIMAL(4,2) NOT NULL,
    tide_type VARCHAR(20), -- 'high', 'low', 'rising', 'falling'
    prediction_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('tide_data', 'timestamp');

-- Safety alerts
CREATE TABLE safety_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'shallow_water', 'weather_warning', 'restricted_area'
    severity INTEGER CHECK (severity >= 1 AND severity <= 5),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    message TEXT NOT NULL,
    recommended_action TEXT,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User sessions (for JWT token management)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- API usage tracking
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    response_time_ms INTEGER,
    status_code INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('api_usage', 'timestamp');