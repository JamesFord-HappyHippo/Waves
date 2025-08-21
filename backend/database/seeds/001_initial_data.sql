-- Waves Initial Seed Data
-- Sample data for development and testing

-- Insert sample users
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified, privacy_settings) VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'captain@example.com',
    '$2a$10$rBV2HQ/xAUJzGfGiOm7mD.5L4SqV5rJH9HLqQyIGvO8N7vJOoZBei', -- password: captain123
    'Captain',
    'Morgan',
    'captain',
    true,
    '{"share_tracks": true, "share_depth": true, "public_profile": true}'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'sailor@example.com',
    '$2a$10$rBV2HQ/xAUJzGfGiOm7mD.5L4SqV5rJH9HLqQyIGvO8N7vJOoZBei', -- password: sailor123
    'Sarah',
    'Johnson',
    'user',
    true,
    '{"share_tracks": false, "share_depth": true, "public_profile": false}'
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'admin@waves.com',
    '$2a$10$rBV2HQ/xAUJzGfGiOm7mD.5L4SqV5rJH9HLqQyIGvO8N7vJOoZBei', -- password: admin123
    'System',
    'Administrator',
    'admin',
    true,
    '{"share_tracks": false, "share_depth": false, "public_profile": false}'
);

-- Insert sample vessels
INSERT INTO vessels (id, owner_id, name, vessel_type, length_meters, beam_meters, draft_meters, displacement_kg, max_speed_knots, registration_number) VALUES
(
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Sea Explorer',
    'sailboat',
    12.2,
    3.8,
    1.8,
    8500,
    8.5,
    'FL-1234-AB'
),
(
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'Wind Dancer',
    'sailboat',
    9.8,
    3.2,
    1.5,
    5200,
    7.2,
    'CA-5678-CD'
),
(
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Power Wave',
    'powerboat',
    8.5,
    2.8,
    0.9,
    3500,
    25.0,
    'FL-9999-XY'
);

-- Insert sample marine areas (major harbors and anchorages)
INSERT INTO marine_areas (name, description, area_type, geometry, min_depth_meters, max_depth_meters, restrictions) VALUES
(
    'San Francisco Bay',
    'Major bay area with multiple anchorages and channels',
    'harbor',
    ST_GeomFromText('MULTIPOLYGON(((-122.5 37.7, -122.3 37.7, -122.3 37.9, -122.5 37.9, -122.5 37.7)))', 4326),
    3.0,
    60.0,
    '{"speed_limit_knots": 5, "no_wake_zone": true, "restricted_hours": "none"}'
),
(
    'Monterey Harbor',
    'Protected harbor with marine sanctuary nearby',
    'harbor',
    ST_GeomFromText('MULTIPOLYGON(((-121.9 36.6, -121.85 36.6, -121.85 36.65, -121.9 36.65, -121.9 36.6)))', 4326),
    4.5,
    25.0,
    '{"speed_limit_knots": 5, "sanctuary_rules": true}'
),
(
    'Half Moon Bay',
    'Small craft harbor on the California coast',
    'harbor',
    ST_GeomFromText('MULTIPOLYGON(((-122.5 37.45, -122.45 37.45, -122.45 37.5, -122.5 37.5, -122.5 37.45)))', 4326),
    2.5,
    15.0,
    '{"small_craft_only": true, "weather_dependent": true}'
);

-- Insert sample depth readings (San Francisco Bay area)
INSERT INTO depth_readings (user_id, vessel_id, location, timestamp, depth_meters, vessel_draft, confidence_score, is_verified) VALUES
-- Golden Gate area
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', ST_GeogFromText('POINT(-122.4783 37.8199)'), NOW() - INTERVAL '1 day', 45.7, 1.8, 'high', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', ST_GeogFromText('POINT(-122.4650 37.8083)'), NOW() - INTERVAL '1 day', 38.2, 1.8, 'high', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', ST_GeogFromText('POINT(-122.4500 37.7900)'), NOW() - INTERVAL '2 hours', 42.1, 1.5, 'medium', false),

-- Bay Bridge area
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', ST_GeogFromText('POINT(-122.3750 37.7983)'), NOW() - INTERVAL '3 hours', 25.3, 1.8, 'high', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', ST_GeogFromText('POINT(-122.3900 37.7850)'), NOW() - INTERVAL '5 hours', 28.7, 1.5, 'medium', false),

-- Alcatraz area
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', ST_GeogFromText('POINT(-122.4230 37.8267)'), NOW() - INTERVAL '6 hours', 35.5, 1.8, 'high', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', ST_GeogFromText('POINT(-122.4180 37.8300)'), NOW() - INTERVAL '8 hours', 32.1, 1.5, 'medium', false),

-- Shallow areas (safety critical)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', ST_GeogFromText('POINT(-122.3500 37.7500)'), NOW() - INTERVAL '12 hours', 2.8, 0.9, 'high', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', ST_GeogFromText('POINT(-122.3450 37.7480)'), NOW() - INTERVAL '1 day', 3.2, 1.5, 'medium', false);

-- Insert sample GPS tracks
INSERT INTO gps_tracks (user_id, vessel_id, location, timestamp, speed_knots, heading_degrees, accuracy_meters, session_id) VALUES
-- Track 1: Golden Gate to Bay Bridge
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', ST_GeogFromText('POINT(-122.4783 37.8199)'), NOW() - INTERVAL '2 hours', 6.2, 90, 3.5, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', ST_GeogFromText('POINT(-122.4650 37.8083)'), NOW() - INTERVAL '1 hour 45 min', 6.8, 95, 2.8, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', ST_GeogFromText('POINT(-122.4500 37.7900)'), NOW() - INTERVAL '1 hour 30 min', 7.1, 100, 3.2, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', ST_GeogFromText('POINT(-122.3750 37.7983)'), NOW() - INTERVAL '1 hour', 5.5, 110, 4.1, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),

-- Track 2: Bay exploration
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', ST_GeogFromText('POINT(-122.4230 37.8267)'), NOW() - INTERVAL '3 hours', 4.2, 180, 5.2, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', ST_GeogFromText('POINT(-122.4000 37.8100)'), NOW() - INTERVAL '2 hours 30 min', 5.8, 160, 3.8, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', ST_GeogFromText('POINT(-122.3900 37.7850)'), NOW() - INTERVAL '2 hours', 6.1, 140, 2.9, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12');

-- Insert sample routes
INSERT INTO routes (user_id, vessel_id, name, description, start_point, end_point, waypoints, total_distance_nm, estimated_duration_hours, min_depth_required, is_public, difficulty_level) VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Golden Gate to Sausalito',
    'Scenic route from Golden Gate to Sausalito with good depth clearance',
    ST_GeogFromText('POINT(-122.4783 37.8199)'),
    ST_GeogFromText('POINT(-122.4852 37.8590)'),
    ST_GeogFromText('LINESTRING(-122.4783 37.8199, -122.4820 37.8350, -122.4852 37.8590)'),
    3.2,
    1.5,
    3.0,
    true,
    2
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'Bay Bridge Circuit',
    'Circuit around Treasure Island with depth monitoring',
    ST_GeogFromText('POINT(-122.3750 37.7983)'),
    ST_GeogFromText('POINT(-122.3750 37.7983)'),
    ST_GeogFromText('LINESTRING(-122.3750 37.7983, -122.3650 37.8100, -122.3700 37.8200, -122.3800 37.8150, -122.3750 37.7983)'),
    5.8,
    2.5,
    4.0,
    true,
    3
);

-- Insert sample weather data
INSERT INTO weather_data (location, timestamp, source, wind_speed_knots, wind_direction, wave_height_meters, temperature_celsius, pressure_mb, expires_at) VALUES
(ST_GeogFromText('POINT(-122.4783 37.8199)'), NOW() - INTERVAL '1 hour', 'NOAA', 12.5, 270, 1.2, 18.5, 1013.2, NOW() + INTERVAL '6 hours'),
(ST_GeogFromText('POINT(-122.3750 37.7983)'), NOW() - INTERVAL '30 minutes', 'NOAA', 8.2, 225, 0.8, 19.2, 1014.1, NOW() + INTERVAL '6 hours'),
(ST_GeogFromText('POINT(-122.4230 37.8267)'), NOW() - INTERVAL '15 minutes', 'NOAA', 15.1, 280, 1.5, 17.8, 1012.8, NOW() + INTERVAL '6 hours');

-- Insert sample tide data (San Francisco station)
INSERT INTO tide_data (station_id, location, timestamp, height_meters, tide_type) VALUES
('9414290', ST_GeogFromText('POINT(-122.4651 37.8063)'), NOW() - INTERVAL '6 hours', 1.85, 'high'),
('9414290', ST_GeogFromText('POINT(-122.4651 37.8063)'), NOW() - INTERVAL '30 minutes', 0.45, 'low'),
('9414290', ST_GeogFromText('POINT(-122.4651 37.8063)'), NOW() + INTERVAL '6 hours', 1.92, 'high');

-- Insert sample navigation sessions
INSERT INTO navigation_sessions (user_id, vessel_id, start_time, end_time, start_location, end_location, total_distance_nm, max_speed_knots, avg_speed_knots) VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '2 hours',
    ST_GeogFromText('POINT(-122.4783 37.8199)'),
    ST_GeogFromText('POINT(-122.3750 37.7983)'),
    8.5,
    7.8,
    6.2
),
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '3 hours',
    ST_GeogFromText('POINT(-122.4230 37.8267)'),
    ST_GeogFromText('POINT(-122.3900 37.7850)'),
    6.2,
    6.5,
    5.1
);