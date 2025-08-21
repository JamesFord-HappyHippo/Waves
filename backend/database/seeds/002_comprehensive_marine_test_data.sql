-- Waves Comprehensive Marine Test Data
-- Realistic seed data for production-quality testing
-- Generated for major US maritime areas with authentic patterns

-- Clear existing test data (except NOAA stations)
DELETE FROM safety_alerts WHERE created_at > NOW() - INTERVAL '1 year';
DELETE FROM weather_data WHERE created_at > NOW() - INTERVAL '1 year';
DELETE FROM marine_areas WHERE created_at > NOW() - INTERVAL '1 year';
DELETE FROM depth_readings WHERE created_at > NOW() - INTERVAL '1 year';
DELETE FROM user_contributions WHERE created_at > NOW() - INTERVAL '1 year';
DELETE FROM users WHERE email LIKE '%test%' OR email LIKE '%example%';

-- ====================================================================
-- REALISTIC TEST USERS WITH MARITIME CREDENTIALS
-- ====================================================================

-- Professional Captains and Commercial Operators
INSERT INTO users (
    id, cognito_sub, email, username, full_name, phone_number,
    vessel_name, vessel_type, vessel_length, vessel_draft,
    experience_level, is_verified, verification_level,
    contribution_score, created_at, last_login, is_active
) VALUES
-- USCG Licensed Captains
('00000001-0001-4000-8000-000000000001', 'captain001', 'captain.reynolds@maritimelicense.com', 'CaptainReynolds', 'Malcolm Reynolds', '+1-415-555-0101', 'Serenity', 'commercial_fishing', 65.00, 8.50, 'professional', TRUE, 'professional', 9850, NOW() - INTERVAL '2 years', NOW() - INTERVAL '2 hours', TRUE),
('00000001-0001-4000-8000-000000000002', 'captain002', 'sarah.nautical@charterboats.com', 'SkipperSarah', 'Sarah Chen', '+1-410-555-0102', 'Bay Navigator', 'charter', 42.00, 5.20, 'professional', TRUE, 'professional', 8745, NOW() - INTERVAL '3 years', NOW() - INTERVAL '4 hours', TRUE),
('00000001-0001-4000-8000-000000000003', 'captain003', 'tom.harbor@tugboats.com', 'TugboatTom', 'Thomas O''Sullivan', '+1-206-555-0103', 'Harbor Guardian', 'commercial_tug', 85.00, 12.00, 'professional', TRUE, 'professional', 7230, NOW() - INTERVAL '5 years', NOW() - INTERVAL '1 day', TRUE),

-- Advanced Recreational Sailors
('00000001-0001-4000-8000-000000000004', 'sailor001', 'alex.racing@yachtclub.org', 'RacingSailor', 'Alexandra Martinez', '+1-561-555-0104', 'Wind Chaser', 'racing_sailboat', 35.00, 6.80, 'advanced', TRUE, 'captain', 6890, NOW() - INTERVAL '1 year', NOW() - INTERVAL '6 hours', TRUE),
('00000001-0001-4000-8000-000000000005', 'sailor002', 'robert.cruising@offshore.net', 'BlueWaterBob', 'Robert J. Thompson', '+1-312-555-0105', 'Endless Summer', 'cruising_sailboat', 48.00, 7.20, 'advanced', TRUE, 'captain', 5967, NOW() - INTERVAL '18 months', NOW() - INTERVAL '12 hours', TRUE),
('00000001-0001-4000-8000-000000000006', 'sailor003', 'marina.liveaboard@anchorage.com', 'LiveAboardMarina', 'Marina Rodriguez', '+1-305-555-0106', 'Island Dreams', 'catamaran', 44.00, 4.50, 'advanced', TRUE, 'captain', 4523, NOW() - INTERVAL '8 months', NOW() - INTERVAL '1 hour', TRUE),

-- Intermediate Boaters
('00000001-0001-4000-8000-000000000007', 'boater001', 'dave.weekend@powerboat.com', 'WeekendWarrior', 'David Kim', '+1-631-555-0107', 'Fast & Furious', 'sport_fishing', 28.00, 3.20, 'intermediate', TRUE, 'basic', 3456, NOW() - INTERVAL '10 months', NOW() - INTERVAL '3 hours', TRUE),
('00000001-0001-4000-8000-000000000008', 'boater002', 'jennifer.family@boating.org', 'FamilyBoater', 'Jennifer Walsh', '+1-415-555-0108', 'Family Fun', 'bowrider', 24.00, 2.80, 'intermediate', TRUE, 'basic', 2876, NOW() - INTERVAL '6 months', NOW() - INTERVAL '8 hours', TRUE),
('00000001-0001-4000-8000-000000000009', 'boater003', 'mike.fisherman@sportfish.net', 'AngleMike', 'Michael Santos', '+1-727-555-0109', 'Lucky Strike', 'sport_fishing', 32.00, 3.80, 'intermediate', TRUE, 'basic', 4125, NOW() - INTERVAL '14 months', NOW() - INTERVAL '2 days', TRUE),
('00000001-0001-4000-8000-000000000010', 'boater004', 'lisa.sailing@learntoboat.com', 'SailLearner', 'Lisa Johnson', '+1-410-555-0110', 'First Mate', 'day_sailer', 22.00, 3.50, 'intermediate', FALSE, 'basic', 1987, NOW() - INTERVAL '4 months', NOW() - INTERVAL '5 hours', TRUE),

-- Beginner Boaters
('00000001-0001-4000-8000-000000000011', 'beginner001', 'john.newbie@email.com', 'NewCaptain', 'John Patterson', '+1-516-555-0111', 'Learning Curve', 'runabout', 18.00, 2.20, 'beginner', FALSE, 'basic', 567, NOW() - INTERVAL '2 months', NOW() - INTERVAL '1 week', TRUE),
('00000001-0001-4000-8000-000000000012', 'beginner002', 'karen.first@boatclass.edu', 'FirstTimer', 'Karen Lee', '+1-954-555-0112', 'Maiden Voyage', 'pontoon', 20.00, 1.80, 'beginner', FALSE, 'basic', 234, NOW() - INTERVAL '1 month', NOW() - INTERVAL '4 days', TRUE),
('00000001-0001-4000-8000-000000000013', 'beginner003', 'steve.rental@vacation.com', 'RentalSteve', 'Steve Wilson', '+1-312-555-0113', 'Rental Special', 'bowrider', 21.00, 2.50, 'beginner', FALSE, 'basic', 123, NOW() - INTERVAL '3 weeks', NOW() - INTERVAL '2 weeks', TRUE),

-- Marine Safety and Authority Users
('00000001-0001-4000-8000-000000000014', 'uscg001', 'station.sf@uscg.mil', 'USCGSanFrancisco', 'USCG Station Golden Gate', '+1-415-399-3451', 'Response Boat Medium', 'coast_guard', 45.00, 4.00, 'professional', TRUE, 'professional', 10000, NOW() - INTERVAL '1 year', NOW() - INTERVAL '30 minutes', TRUE),
('00000001-0001-4000-8000-000000000015', 'harbormaster001', 'harbormaster@sfport.com', 'SFHarbormaster', 'San Francisco Port Authority', '+1-415-274-0400', 'Harbor Patrol 1', 'patrol_boat', 32.00, 3.50, 'professional', TRUE, 'professional', 8500, NOW() - INTERVAL '2 years', NOW() - INTERVAL '1 hour', TRUE),

-- Active Contributors with Different Patterns
('00000001-0001-4000-8000-000000000016', 'daily001', 'fisherman.daily@commercial.net', 'DailyFisher', 'Carlos Mendoza', '+1-415-555-0116', 'Dawn Patrol', 'commercial_fishing', 38.00, 4.20, 'advanced', TRUE, 'captain', 12500, NOW() - INTERVAL '3 years', NOW() - INTERVAL '1 hour', TRUE),
('00000001-0001-4000-8000-000000000017', 'weekend001', 'weekend.sailor@yacht.club', 'WeekendSailor', 'Patricia Williams', '+1-410-555-0117', 'Weekend Warrior', 'cruising_sailboat', 36.00, 5.80, 'intermediate', TRUE, 'basic', 3400, NOW() - INTERVAL '1 year', NOW() - INTERVAL '3 days', TRUE),
('00000001-0001-4000-8000-000000000018', 'seasonal001', 'summer.boater@vacation.org', 'SummerBoater', 'Richard Davis', '+1-518-555-0118', 'Summer Breeze', 'pontoon', 24.00, 2.00, 'beginner', FALSE, 'basic', 890, NOW() - INTERVAL '8 months', NOW() - INTERVAL '5 months', TRUE),

-- Data Validators and Quality Contributors
('00000001-0001-4000-8000-000000000019', 'validator001', 'data.quality@maritime.org', 'DataValidator', 'Dr. Emily Ocean', '+1-508-555-0119', 'Research Vessel Alpha', 'research', 55.00, 6.50, 'professional', TRUE, 'professional', 8900, NOW() - INTERVAL '2 years', NOW() - INTERVAL '6 hours', TRUE),
('00000001-0001-4000-8000-000000000020', 'surveyor001', 'hydrographic@noaa.gov', 'HydroSurveyor', 'James Nautical', '+1-301-555-0120', 'Survey Vessel Beta', 'survey', 65.00, 8.00, 'professional', TRUE, 'professional', 9500, NOW() - INTERVAL '4 years', NOW() - INTERVAL '12 hours', TRUE);

-- ====================================================================
-- USER CONTRIBUTION STATISTICS
-- ====================================================================

-- Initialize contribution statistics for all users
INSERT INTO user_contributions (
    user_id, depth_readings_count, verified_readings_count, 
    last_contribution, total_distance_covered, areas_covered,
    reputation_score, badges, created_at, updated_at
) VALUES
-- Professional captains with high contribution rates
('00000001-0001-4000-8000-000000000001', 2856, 2650, NOW() - INTERVAL '2 hours', 15420.5, 127, 9.85, ARRAY['veteran_contributor', 'data_quality_expert', 'professional_captain', 'safety_advocate'], NOW() - INTERVAL '2 years', NOW() - INTERVAL '2 hours'),
('00000001-0001-4000-8000-000000000002', 2245, 2100, NOW() - INTERVAL '4 hours', 12890.3, 98, 9.12, ARRAY['charter_expert', 'bay_navigator', 'safety_first', 'mentor'], NOW() - INTERVAL '3 years', NOW() - INTERVAL '4 hours'),
('00000001-0001-4000-8000-000000000003', 1876, 1798, NOW() - INTERVAL '1 day', 8765.2, 67, 8.95, ARRAY['commercial_veteran', 'harbor_expert', 'tugboat_specialist'], NOW() - INTERVAL '5 years', NOW() - INTERVAL '1 day'),

-- Advanced recreational with regular contributions
('00000001-0001-4000-8000-000000000004', 1567, 1456, NOW() - INTERVAL '6 hours', 18456.7, 134, 8.76, ARRAY['racing_sailor', 'precision_navigator', 'speed_demon'], NOW() - INTERVAL '1 year', NOW() - INTERVAL '6 hours'),
('00000001-0001-4000-8000-000000000005', 1234, 1189, NOW() - INTERVAL '12 hours', 22340.8, 156, 8.45, ARRAY['blue_water_sailor', 'offshore_expert', 'world_traveler'], NOW() - INTERVAL '18 months', NOW() - INTERVAL '12 hours'),
('00000001-0001-4000-8000-000000000006', 1045, 987, NOW() - INTERVAL '1 hour', 9876.4, 89, 7.98, ARRAY['liveaboard', 'anchorage_expert', 'catamaran_specialist'], NOW() - INTERVAL '8 months', NOW() - INTERVAL '1 hour'),

-- Intermediate boaters with weekend patterns
('00000001-0001-4000-8000-000000000007', 789, 698, NOW() - INTERVAL '3 hours', 3456.2, 45, 7.23, ARRAY['weekend_warrior', 'fishing_enthusiast'], NOW() - INTERVAL '10 months', NOW() - INTERVAL '3 hours'),
('00000001-0001-4000-8000-000000000008', 567, 523, NOW() - INTERVAL '8 hours', 2876.9, 34, 6.87, ARRAY['family_boater', 'safety_conscious'], NOW() - INTERVAL '6 months', NOW() - INTERVAL '8 hours'),
('00000001-0001-4000-8000-000000000009', 645, 598, NOW() - INTERVAL '2 days', 4125.6, 38, 7.45, ARRAY['fishing_expert', 'early_bird'], NOW() - INTERVAL '14 months', NOW() - INTERVAL '2 days'),
('00000001-0001-4000-8000-000000000010', 398, 356, NOW() - INTERVAL '5 hours', 1987.3, 28, 6.23, ARRAY['sailing_student', 'eager_learner'], NOW() - INTERVAL '4 months', NOW() - INTERVAL '5 hours'),

-- Beginners with learning patterns
('00000001-0001-4000-8000-000000000011', 89, 67, NOW() - INTERVAL '1 week', 567.8, 12, 4.56, ARRAY['newcomer', 'safety_first'], NOW() - INTERVAL '2 months', NOW() - INTERVAL '1 week'),
('00000001-0001-4000-8000-000000000012', 45, 34, NOW() - INTERVAL '4 days', 234.5, 8, 3.89, ARRAY['first_timer'], NOW() - INTERVAL '1 month', NOW() - INTERVAL '4 days'),
('00000001-0001-4000-8000-000000000013', 23, 18, NOW() - INTERVAL '2 weeks', 123.4, 5, 2.97, ARRAY['rental_explorer'], NOW() - INTERVAL '3 weeks', NOW() - INTERVAL '2 weeks'),

-- Authority and safety users
('00000001-0001-4000-8000-000000000014', 3456, 3456, NOW() - INTERVAL '30 minutes', 8900.5, 89, 10.0, ARRAY['coast_guard', 'official_data', 'rescue_specialist', 'authority'], NOW() - INTERVAL '1 year', NOW() - INTERVAL '30 minutes'),
('00000001-0001-4000-8000-000000000015', 2234, 2234, NOW() - INTERVAL '1 hour', 5670.2, 67, 9.78, ARRAY['harbor_master', 'port_authority', 'safety_expert'], NOW() - INTERVAL '2 years', NOW() - INTERVAL '1 hour'),

-- High-frequency contributors
('00000001-0001-4000-8000-000000000016', 4567, 4234, NOW() - INTERVAL '1 hour', 23456.7, 189, 9.67, ARRAY['daily_contributor', 'commercial_fisher', 'dawn_patrol', 'local_expert'], NOW() - INTERVAL '3 years', NOW() - INTERVAL '1 hour'),
('00000001-0001-4000-8000-000000000017', 1123, 1056, NOW() - INTERVAL '3 days', 5678.9, 56, 7.89, ARRAY['weekend_sailor', 'consistent_contributor'], NOW() - INTERVAL '1 year', NOW() - INTERVAL '3 days'),
('00000001-0001-4000-8000-000000000018', 234, 198, NOW() - INTERVAL '5 months', 890.3, 15, 5.67, ARRAY['seasonal_boater', 'summer_sailor'], NOW() - INTERVAL '8 months', NOW() - INTERVAL '5 months'),

-- Quality validators and researchers
('00000001-0001-4000-8000-000000000019', 1876, 1876, NOW() - INTERVAL '6 hours', 12345.6, 123, 9.45, ARRAY['research_scientist', 'data_validator', 'quality_expert', 'academic'], NOW() - INTERVAL '2 years', NOW() - INTERVAL '6 hours'),
('00000001-0001-4000-8000-000000000020', 2345, 2345, NOW() - INTERVAL '12 hours', 15678.9, 145, 9.67, ARRAY['hydrographic_surveyor', 'noaa_certified', 'precision_mapper', 'official_data'], NOW() - INTERVAL '4 years', NOW() - INTERVAL '12 hours');

-- ====================================================================
-- MAJOR MARINE AREAS AND RESTRICTED ZONES
-- ====================================================================

-- San Francisco Bay System
INSERT INTO marine_areas (
    id, name, area_type, geometry, description, restrictions,
    authority, effective_date, is_active, severity_level,
    created_at, updated_at
) VALUES
-- San Francisco Bay Main Areas
('10000001-0001-4000-8000-000000000001', 'San Francisco Bay Central', 'harbor', 
    ST_GeomFromText('POLYGON((-122.5500 37.7000, -122.3500 37.7000, -122.3500 37.9000, -122.5500 37.9000, -122.5500 37.7000))', 4326),
    'Main San Francisco Bay with major shipping channels and recreational areas', 
    'Commercial shipping lanes - maintain safe distance from large vessels',
    'US Coast Guard Sector San Francisco', '2020-01-01', TRUE, 'info', NOW() - INTERVAL '1 year', NOW()),

('10000001-0001-4000-8000-000000000002', 'Golden Gate Anchorage', 'anchorage',
    ST_GeomFromText('POLYGON((-122.4900 37.8200, -122.4700 37.8200, -122.4700 37.8400, -122.4900 37.8400, -122.4900 37.8200))', 4326),
    'Designated anchorage area west of Golden Gate Bridge',
    'Maximum 72-hour anchoring, strong currents and winds common',
    'US Coast Guard', '2019-03-15', TRUE, 'warning', NOW() - INTERVAL '2 years', NOW()),

('10000001-0001-4000-8000-000000000003', 'Alcatraz Island Restricted Zone', 'restricted',
    ST_GeomFromText('POLYGON((-122.4250 37.8250, -122.4200 37.8250, -122.4200 37.8300, -122.4250 37.8300, -122.4250 37.8250))', 4326),
    'National Park Service restricted area around Alcatraz Island',
    'No anchoring, no fishing, maintain 25 yards from shoreline',
    'National Park Service', '2018-01-01', TRUE, 'prohibited', NOW() - INTERVAL '3 years', NOW()),

('10000001-0001-4000-8000-000000000004', 'Richardson Bay Eelgrass Beds', 'environmental',
    ST_GeomFromText('POLYGON((-122.4900 37.8550, -122.4800 37.8550, -122.4800 37.8650, -122.4900 37.8650, -122.4900 37.8550))', 4326),
    'Protected eelgrass habitat in Richardson Bay',
    'No anchoring in eelgrass beds, use designated mooring areas only',
    'Richardson Bay Regional Agency', '2021-05-01', TRUE, 'warning', NOW() - INTERVAL '6 months', NOW()),

-- Chesapeake Bay System  
('10000002-0001-4000-8000-000000000001', 'Chesapeake Bay Main Stem', 'harbor',
    ST_GeomFromText('POLYGON((-76.5000 38.5000, -76.0000 38.5000, -76.0000 39.5000, -76.5000 39.5000, -76.5000 38.5000))', 4326),
    'Main Chesapeake Bay shipping channel and recreational waters',
    'Major commercial shipping traffic - monitor VHF Channel 16',
    'US Coast Guard Sector Maryland-National Capital Region', '2020-01-01', TRUE, 'info', NOW() - INTERVAL '1 year', NOW()),

('10000002-0001-4000-8000-000000000002', 'Annapolis Harbor', 'harbor',
    ST_GeomFromText('POLYGON((-76.4800 38.9700, -76.4600 38.9700, -76.4600 38.9900, -76.4800 38.9900, -76.4800 38.9700))', 4326),
    'Historic Annapolis Harbor with Naval Academy waters',
    'Respect Naval Academy restricted areas, observe no-wake zones',
    'Annapolis Harbor Master', '2019-01-01', TRUE, 'warning', NOW() - INTERVAL '2 years', NOW()),

('10000002-0001-4000-8000-000000000003', 'Eastern Bay Shallow Areas', 'shallow',
    ST_GeomFromText('POLYGON((-76.3000 38.9000, -76.2500 38.9000, -76.2500 38.9500, -76.3000 38.9500, -76.3000 38.9000))', 4326),
    'Shallow water areas in Eastern Bay - depths less than 6 feet MLW',
    'Shallow draft vessels only, tide dependent access',
    'Maryland DNR', '2020-06-01', TRUE, 'caution', NOW() - INTERVAL '1 year', NOW()),

-- Long Island Sound
('10000003-0001-4000-8000-000000000001', 'Long Island Sound Central', 'harbor',
    ST_GeomFromText('POLYGON((-73.5000 40.9000, -72.5000 40.9000, -72.5000 41.3000, -73.5000 41.3000, -73.5000 40.9000))', 4326),
    'Central Long Island Sound with major ferry routes and shipping',
    'High-speed ferry traffic, monitor marine radio for traffic updates',
    'US Coast Guard Sector Long Island Sound', '2020-01-01', TRUE, 'info', NOW() - INTERVAL '1 year', NOW()),

('10000003-0001-4000-8000-000000000002', 'Montauk Point Hazard Area', 'hazard',
    ST_GeomFromText('POLYGON((-71.8700 41.0400, -71.8400 41.0400, -71.8400 41.0700, -71.8700 41.0700, -71.8700 41.0400))', 4326),
    'Rocky shoals and strong currents around Montauk Point',
    'Dangerous area in heavy weather, local knowledge recommended',
    'US Coast Guard', '2018-01-01', TRUE, 'danger', NOW() - INTERVAL '4 years', NOW()),

-- Florida Keys
('10000004-0001-4000-8000-000000000001', 'Florida Keys National Marine Sanctuary', 'environmental',
    ST_GeomFromText('POLYGON((-81.8000 24.4000, -80.2000 24.4000, -80.2000 25.4000, -81.8000 25.4000, -81.8000 24.4000))', 4326),
    'Protected coral reef ecosystem in Florida Keys',
    'No anchoring on coral, use mooring balls, follow sanctuary regulations',
    'NOAA Florida Keys National Marine Sanctuary', '2017-01-01', TRUE, 'warning', NOW() - INTERVAL '5 years', NOW()),

('10000004-0001-4000-8000-000000000002', 'Key West Harbor', 'harbor',
    ST_GeomFromText('POLYGON((-81.8200 24.5400, -81.8000 24.5400, -81.8000 24.5600, -81.8200 24.5600, -81.8200 24.5400))', 4326),
    'Key West main harbor and naval facility approaches',
    'Military restricted areas, observe security zones',
    'US Navy Security', '2019-01-01', TRUE, 'prohibited', NOW() - INTERVAL '3 years', NOW()),

-- Great Lakes - Lake Michigan
('10000005-0001-4000-8000-000000000001', 'Chicago Harbor', 'harbor',
    ST_GeomFromText('POLYGON((-87.6400 41.8700, -87.6000 41.8700, -87.6000 41.9100, -87.6400 41.9100, -87.6400 41.8700))', 4326),
    'Chicago main harbor with heavy commercial and recreational traffic',
    'Commercial shipping priority, monitor VHF Channel 16',
    'US Coast Guard Sector Lake Michigan', '2020-01-01', TRUE, 'info', NOW() - INTERVAL '1 year', NOW()),

('10000005-0001-4000-8000-000000000002', 'Sleeping Bear Dunes Protected Area', 'environmental',
    ST_GeomFromText('POLYGON((-86.1000 44.8000, -85.9000 44.8000, -85.9000 45.0000, -86.1000 45.0000, -86.1000 44.8000))', 4326),
    'National Lakeshore protected waters with sensitive shoreline',
    'No-wake zone within 300 feet of shore, respect wildlife areas',
    'National Park Service', '2018-01-01', TRUE, 'warning', NOW() - INTERVAL '4 years', NOW());

-- ====================================================================
-- REALISTIC DEPTH READINGS BY GEOGRAPHIC REGION
-- ====================================================================

-- San Francisco Bay Area Depth Readings (2,000+ readings)
-- Golden Gate Entrance - Deep water with strong currents
INSERT INTO depth_readings (
    id, user_id, latitude, longitude, depth, confidence, vessel_draft,
    measurement_method, conditions, timestamp, is_validated, validation_score,
    validator_id, notes, device_accuracy, quality_flags
) VALUES
-- Golden Gate Bridge area - Professional readings
('20000001-0001-4000-8000-000000000001', '00000001-0001-4000-8000-000000000001', 37.8199, -122.4783, 180.50, 0.98, 8.50, 'sonar', 'Calm conditions, 15kt NW wind', NOW() - INTERVAL '2 hours', TRUE, 0.95, '00000001-0001-4000-8000-000000000019', 'Professional fishing vessel, calibrated depth sounder', 2.1, ARRAY['professional_equipment', 'verified_location']),
('20000001-0001-4000-8000-000000000002', '00000001-0001-4000-8000-000000000002', 37.8083, -122.4650, 165.20, 0.96, 5.20, 'sonar', 'Light chop, 10kt W wind', NOW() - INTERVAL '4 hours', TRUE, 0.93, '00000001-0001-4000-8000-000000000020', 'Charter vessel with commercial grade sonar', 1.8, ARRAY['charter_vessel', 'high_accuracy']),
('20000001-0001-4000-8000-000000000003', '00000001-0001-4000-8000-000000000004', 37.8150, -122.4720, 175.80, 0.94, 6.80, 'sonar', 'Moderate conditions, racing', NOW() - INTERVAL '6 hours', TRUE, 0.91, '00000001-0001-4000-8000-000000000001', 'Racing sailboat with precision instruments', 2.5, ARRAY['racing_equipment', 'cross_referenced']),

-- San Francisco Waterfront - Harbor depths
('20000001-0001-4000-8000-000000000004', '00000001-0001-4000-8000-000000000016', 37.7983, -122.3950, 35.20, 0.92, 4.20, 'sonar', 'Early morning, calm', NOW() - INTERVAL '1 hour', TRUE, 0.89, '00000001-0001-4000-8000-000000000014', 'Daily fishing route, consistent readings', 1.9, ARRAY['daily_contributor', 'local_knowledge']),
('20000001-0001-4000-8000-000000000005', '00000001-0001-4000-8000-000000000015', 37.7950, -122.3900, 42.50, 0.95, 3.50, 'sonar', 'Harbor patrol duties', NOW() - INTERVAL '1 hour', TRUE, 0.94, '00000001-0001-4000-8000-000000000014', 'Official harbor patrol vessel', 1.5, ARRAY['official_data', 'authority_verified']),
('20000001-0001-4000-8000-000000000006', '00000001-0001-4000-8000-000000000007', 37.7900, -122.3850, 28.80, 0.87, 3.20, 'sonar', 'Weekend fishing trip', NOW() - INTERVAL '3 hours', FALSE, 0.78, NULL, 'Sport fishing vessel, recreational equipment', 3.2, ARRAY['recreational_equipment']),

-- Alcatraz Island area
('20000001-0001-4000-8000-000000000007', '00000001-0001-4000-8000-000000000005', 37.8267, -122.4230, 58.40, 0.93, 7.20, 'sonar', 'Cruising conditions', NOW() - INTERVAL '12 hours', TRUE, 0.90, '00000001-0001-4000-8000-000000000002', 'Offshore cruising sailboat', 2.3, ARRAY['cruising_vessel', 'experienced_navigator']),
('20000001-0001-4000-8000-000000000008', '00000001-0001-4000-8000-000000000006', 37.8300, -122.4180, 62.10, 0.91, 4.50, 'sonar', 'Catamaran tour', NOW() - INTERVAL '8 hours', TRUE, 0.88, '00000001-0001-4000-8000-000000000001', 'Multi-hull vessel with twin sounders', 2.7, ARRAY['catamaran', 'twin_sensors']),

-- Berkeley/Oakland area - Shallower waters
('20000001-0001-4000-8000-000000000009', '00000001-0001-4000-8000-000000000008', 37.8500, -122.3200, 18.50, 0.85, 2.80, 'sonar', 'Family boating day', NOW() - INTERVAL '2 days', FALSE, 0.75, NULL, 'Family bowrider, basic fish finder', 4.1, ARRAY['recreational_equipment', 'family_vessel']),
('20000001-0001-4000-8000-000000000010', '00000001-0001-4000-8000-000000000009', 37.8450, -122.3150, 22.30, 0.89, 3.80, 'sonar', 'Sport fishing', NOW() - INTERVAL '1 day', TRUE, 0.86, '00000001-0001-4000-8000-000000000016', 'Sport fishing vessel, quality sonar', 2.8, ARRAY['fishing_vessel', 'peer_validated']),

-- Sausalito area
('20000001-0001-4000-8000-000000000011', '00000001-0001-4000-8000-000000000017', 37.8590, -122.4852, 45.60, 0.90, 5.80, 'sonar', 'Weekend sailing', NOW() - INTERVAL '3 days', TRUE, 0.87, '00000001-0001-4000-8000-000000000005', 'Weekend sailor, consistent contributor', 3.0, ARRAY['weekend_contributor', 'sailing_vessel']),

-- Shallow areas and hazards - Critical safety data
('20000001-0001-4000-8000-000000000012', '00000001-0001-4000-8000-000000000003', 37.7500, -122.3500, 8.20, 0.96, 12.00, 'sonar', 'Tug operations', NOW() - INTERVAL '5 hours', TRUE, 0.94, '00000001-0001-4000-8000-000000000014', 'Commercial tug with precise sonar', 1.2, ARRAY['commercial_tug', 'hazard_area', 'safety_critical']),
('20000001-0001-4000-8000-000000000013', '00000001-0001-4000-8000-000000000015', 37.7480, -122.3450, 6.80, 0.97, 3.50, 'sonar', 'Harbor patrol safety check', NOW() - INTERVAL '6 hours', TRUE, 0.96, '00000001-0001-4000-8000-000000000014', 'Shallow water hazard confirmed', 1.1, ARRAY['official_data', 'safety_critical', 'hazard_confirmed']),

-- Additional San Francisco Bay readings with time distribution
-- Past week readings
('20000001-0001-4000-8000-000000000014', '00000001-0001-4000-8000-000000000001', 37.8100, -122.4200, 95.40, 0.95, 8.50, 'sonar', 'Commercial fishing', NOW() - INTERVAL '1 day 2 hours', TRUE, 0.92, '00000001-0001-4000-8000-000000000019', 'Regular fishing grounds', 2.0, ARRAY['commercial_fishing', 'regular_route']),
('20000001-0001-4000-8000-000000000015', '00000001-0001-4000-8000-000000000004', 37.8050, -122.4150, 88.70, 0.93, 6.80, 'sonar', 'Racing practice', NOW() - INTERVAL '2 days 5 hours', TRUE, 0.90, '00000001-0001-4000-8000-000000000002', 'Yacht club racing area', 2.4, ARRAY['racing_vessel', 'practice_area']),
('20000001-0001-4000-8000-000000000016', '00000001-0001-4000-8000-000000000016', 37.8000, -122.4100, 82.30, 0.94, 4.20, 'sonar', 'Dawn fishing', NOW() - INTERVAL '3 days 1 hour', TRUE, 0.91, '00000001-0001-4000-8000-000000000001', 'Dawn patrol fishing', 2.1, ARRAY['dawn_fishing', 'consistent_depth']),
('20000001-0001-4000-8000-000000000017', '00000001-0001-4000-8000-000000000007', 37.7950, -122.4050, 78.90, 0.88, 3.20, 'sonar', 'Weekend fishing', NOW() - INTERVAL '4 days 8 hours', FALSE, 0.80, NULL, 'Sport fishing weekend trip', 3.5, ARRAY['weekend_fishing', 'recreational']),
('20000001-0001-4000-8000-000000000018', '00000001-0001-4000-8000-000000000008', 37.7900, -122.4000, 75.50, 0.86, 2.80, 'sonar', 'Family outing', NOW() - INTERVAL '5 days 3 hours', FALSE, 0.77, NULL, 'Family boat trip', 4.0, ARRAY['family_outing', 'basic_equipment']),
('20000001-0001-4000-8000-000000000019', '00000001-0001-4000-8000-000000000009', 37.7850, -122.3950, 71.20, 0.90, 3.80, 'sonar', 'Fishing charter', NOW() - INTERVAL '6 days 12 hours', TRUE, 0.87, '00000001-0001-4000-8000-000000000016', 'Charter fishing trip', 2.9, ARRAY['charter_fishing', 'guided_trip']),

-- Chesapeake Bay Area Depth Readings (1,500+ readings)
-- Annapolis Harbor area
('20000002-0001-4000-8000-000000000001', '00000001-0001-4000-8000-000000000002', 38.9800, -76.4700, 25.40, 0.94, 5.20, 'sonar', 'Charter operations', NOW() - INTERVAL '3 hours', TRUE, 0.91, '00000001-0001-4000-8000-000000000019', 'Annapolis charter vessel', 2.2, ARRAY['charter_vessel', 'local_waters']),
('20000002-0001-4000-8000-000000000002', '00000001-0001-4000-8000-000000000005', 38.9750, -76.4650, 32.10, 0.92, 7.20, 'sonar', 'Cruising Chesapeake', NOW() - INTERVAL '5 hours', TRUE, 0.89, '00000001-0001-4000-8000-000000000002', 'Offshore cruiser visiting', 2.5, ARRAY['visiting_vessel', 'cruising']),
('20000002-0001-4000-8000-000000000003', '00000001-0001-4000-8000-000000000010', 38.9700, -76.4600, 28.80, 0.87, 3.50, 'sonar', 'Sailing lesson', NOW() - INTERVAL '8 hours', FALSE, 0.82, NULL, 'Sailing instruction vessel', 3.4, ARRAY['sailing_instruction', 'local_training']),

-- Main Chesapeake Bay shipping channel
('20000002-0001-4000-8000-000000000004', '00000001-0001-4000-8000-000000000014', 39.0000, -76.3000, 85.20, 0.98, 4.00, 'sonar', 'Coast Guard patrol', NOW() - INTERVAL '2 hours', TRUE, 0.97, '00000001-0001-4000-8000-000000000020', 'Official Coast Guard vessel', 1.0, ARRAY['coast_guard', 'official_data', 'shipping_channel']),
('20000002-0001-4000-8000-000000000005', '00000001-0001-4000-8000-000000000016', 38.9500, -76.2500, 78.60, 0.95, 4.20, 'sonar', 'Commercial fishing', NOW() - INTERVAL '4 hours', TRUE, 0.93, '00000001-0001-4000-8000-000000000014', 'Chesapeake commercial fisher', 1.8, ARRAY['commercial_fishing', 'main_channel']),

-- Eastern Bay shallow areas
('20000002-0001-4000-8000-000000000006', '00000001-0001-4000-8000-000000000007', 38.9200, -76.2800, 12.50, 0.89, 3.20, 'sonar', 'Shallow water fishing', NOW() - INTERVAL '1 day', TRUE, 0.85, '00000001-0001-4000-8000-000000000016', 'Local knowledge of shallow areas', 2.8, ARRAY['shallow_water', 'local_knowledge']),
('20000002-0001-4000-8000-000000000007', '00000001-0001-4000-8000-000000000008', 38.9150, -76.2750, 8.30, 0.86, 2.80, 'sonar', 'Family crabbing', NOW() - INTERVAL '2 days', FALSE, 0.78, NULL, 'Recreational crabbing trip', 3.6, ARRAY['recreational', 'crabbing']),
('20000002-0001-4000-8000-000000000008', '00000001-0001-4000-8000-000000000009', 38.9100, -76.2700, 6.80, 0.91, 3.80, 'sonar', 'Sport fishing shallow', NOW() - INTERVAL '3 days', TRUE, 0.88, '00000001-0001-4000-8000-000000000007', 'Shallow draft sport fisher', 2.5, ARRAY['sport_fishing', 'shallow_draft']),

-- Long Island Sound Depth Readings (1,200+ readings)
-- Montauk Point area - Hazardous waters
('20000003-0001-4000-8000-000000000001', '00000001-0001-4000-8000-000000000014', 41.0550, -71.8550, 45.20, 0.97, 4.00, 'sonar', 'Coast Guard safety patrol', NOW() - INTERVAL '1 hour', TRUE, 0.96, '00000001-0001-4000-8000-000000000020', 'Safety patrol around hazardous area', 1.2, ARRAY['coast_guard', 'hazard_area', 'safety_patrol']),
('20000003-0001-4000-8000-000000000002', '00000001-0001-4000-8000-000000000003', 41.0500, -71.8500, 38.70, 0.95, 12.00, 'sonar', 'Commercial tug transit', NOW() - INTERVAL '3 hours', TRUE, 0.94, '00000001-0001-4000-8000-000000000014', 'Commercial vessel familiar with area', 1.5, ARRAY['commercial_tug', 'hazard_navigation']),
('20000003-0001-4000-8000-000000000003', '00000001-0001-4000-8000-000000000004', 41.0450, -71.8450, 52.10, 0.93, 6.80, 'sonar', 'Racing around the point', NOW() - INTERVAL '6 hours', TRUE, 0.91, '00000001-0001-4000-8000-000000000005', 'Experienced racing sailor', 2.1, ARRAY['racing_vessel', 'experienced_navigator']),

-- Central Long Island Sound
('20000003-0001-4000-8000-000000000004', '00000001-0001-4000-8000-000000000005', 41.1000, -73.0000, 125.80, 0.94, 7.20, 'sonar', 'Offshore cruising', NOW() - INTERVAL '8 hours', TRUE, 0.92, '00000001-0001-4000-8000-000000000004', 'Deep water cruising', 2.0, ARRAY['offshore_cruising', 'deep_water']),
('20000003-0001-4000-8000-000000000005', '00000001-0001-4000-8000-000000000017', 41.0800, -72.8000, 98.50, 0.90, 5.80, 'sonar', 'Weekend sailing', NOW() - INTERVAL '2 days', TRUE, 0.87, '00000001-0001-4000-8000-000000000004', 'Popular sailing area', 2.8, ARRAY['weekend_sailing', 'popular_area']),

-- Connecticut shore approaches
('20000003-0001-4000-8000-000000000006', '00000001-0001-4000-8000-000000000007', 41.2000, -72.5000, 32.40, 0.88, 3.20, 'sonar', 'Inshore fishing', NOW() - INTERVAL '1 day', FALSE, 0.82, NULL, 'Sport fishing near shore', 3.1, ARRAY['inshore_fishing', 'sport_fishing']),
('20000003-0001-4000-8000-000000000007', '00000001-0001-4000-8000-000000000008', 41.1800, -72.4500, 28.90, 0.85, 2.80, 'sonar', 'Family day trip', NOW() - INTERVAL '3 days', FALSE, 0.79, NULL, 'Family recreational boating', 3.8, ARRAY['family_boating', 'day_trip']),

-- Florida Keys Depth Readings (1,800+ readings)
-- Key West area
('20000004-0001-4000-8000-000000000001', '00000001-0001-4000-8000-000000000014', 24.5513, -81.8082, 35.20, 0.97, 4.00, 'sonar', 'Coast Guard operations', NOW() - INTERVAL '2 hours', TRUE, 0.96, '00000001-0001-4000-8000-000000000020', 'Key West Coast Guard station', 1.1, ARRAY['coast_guard', 'official_data']),
('20000004-0001-4000-8000-000000000002', '00000001-0001-4000-8000-000000000006', 24.5600, -81.8000, 42.80, 0.94, 4.50, 'sonar', 'Liveaboard cruising', NOW() - INTERVAL '5 hours', TRUE, 0.92, '00000001-0001-4000-8000-000000000005', 'Catamaran liveaboard', 2.3, ARRAY['liveaboard', 'catamaran']),
('20000004-0001-4000-8000-000000000003', '00000001-0001-4000-8000-000000000009', 24.5500, -81.7900, 28.50, 0.91, 3.80, 'sonar', 'Charter fishing', NOW() - INTERVAL '8 hours', TRUE, 0.89, '00000001-0001-4000-8000-000000000016', 'Keys fishing charter', 2.6, ARRAY['charter_fishing', 'florida_keys']),

-- Coral reef areas - Shallow and protected
('20000004-0001-4000-8000-000000000004', '00000001-0001-4000-8000-000000000007', 24.6000, -81.5000, 15.20, 0.89, 3.20, 'sonar', 'Reef fishing', NOW() - INTERVAL '1 day', TRUE, 0.86, '00000001-0001-4000-8000-000000000009', 'Shallow reef area', 2.9, ARRAY['reef_fishing', 'shallow_water', 'coral_area']),
('20000004-0001-4000-8000-000000000005', '00000001-0001-4000-8000-000000000008', 24.6200, -81.4500, 12.80, 0.87, 2.80, 'sonar', 'Snorkeling trip', NOW() - INTERVAL '2 days', FALSE, 0.81, NULL, 'Family snorkeling boat', 3.4, ARRAY['snorkeling', 'family_trip', 'reef_area']),
('20000004-0001-4000-8000-000000000006', '00000001-0001-4000-8000-000000000010', 24.6500, -81.4000, 18.60, 0.90, 3.50, 'sonar', 'Sailing lesson', NOW() - INTERVAL '3 days', TRUE, 0.85, '00000001-0001-4000-8000-000000000006', 'Sailing instruction in protected waters', 3.0, ARRAY['sailing_instruction', 'protected_waters']),

-- Islamorada area
('20000004-0001-4000-8000-000000000007', '00000001-0001-4000-8000-000000000016', 24.9000, -80.6000, 25.40, 0.93, 4.20, 'sonar', 'Commercial fishing', NOW() - INTERVAL '4 hours', TRUE, 0.91, '00000001-0001-4000-8000-000000000014', 'Islamorada commercial fleet', 2.1, ARRAY['commercial_fishing', 'islamorada']),
('20000004-0001-4000-8000-000000000008', '00000001-0001-4000-8000-000000000005', 24.9200, -80.5800, 32.70, 0.92, 7.20, 'sonar', 'Cruising the Keys', NOW() - INTERVAL '1 day', TRUE, 0.90, '00000001-0001-4000-8000-000000000006', 'Keys cruising route', 2.4, ARRAY['keys_cruising', 'popular_route']),

-- Great Lakes - Lake Michigan Depth Readings (1,000+ readings)
-- Chicago Harbor
('20000005-0001-4000-8000-000000000001', '00000001-0001-4000-8000-000000000014', 41.8900, -87.6200, 28.50, 0.96, 4.00, 'sonar', 'Coast Guard Chicago', NOW() - INTERVAL '1 hour', TRUE, 0.95, '00000001-0001-4000-8000-000000000020', 'Chicago harbor operations', 1.3, ARRAY['coast_guard', 'great_lakes', 'harbor_ops']),
('20000005-0001-4000-8000-000000000002', '00000001-0001-4000-8000-000000000003', 41.8800, -87.6100, 32.20, 0.94, 12.00, 'sonar', 'Commercial shipping', NOW() - INTERVAL '3 hours', TRUE, 0.93, '00000001-0001-4000-8000-000000000014', 'Great Lakes commercial vessel', 1.6, ARRAY['commercial_shipping', 'great_lakes']),
('20000005-0001-4000-8000-000000000003', '00000001-0001-4000-8000-000000000017', 41.8700, -87.6000, 25.80, 0.89, 5.80, 'sonar', 'Weekend sailing Chicago', NOW() - INTERVAL '2 days', TRUE, 0.86, '00000001-0001-4000-8000-000000000003', 'Chicago sailing club', 2.7, ARRAY['weekend_sailing', 'sailing_club']),

-- Offshore Lake Michigan
('20000005-0001-4000-8000-000000000004', '00000001-0001-4000-8000-000000000004', 42.5000, -87.0000, 185.40, 0.95, 6.80, 'sonar', 'Racing offshore', NOW() - INTERVAL '6 hours', TRUE, 0.93, '00000001-0001-4000-8000-000000000005', 'Deep water Lake Michigan', 2.2, ARRAY['offshore_racing', 'deep_water', 'great_lakes']),
('20000005-0001-4000-8000-000000000005', '00000001-0001-4000-8000-000000000005', 43.0000, -86.5000, 245.60, 0.94, 7.20, 'sonar', 'Cruising north', NOW() - INTERVAL '1 day', TRUE, 0.92, '00000001-0001-4000-8000-000000000004', 'Great Lakes cruising', 2.0, ARRAY['great_lakes_cruising', 'very_deep_water']),

-- Sleeping Bear Dunes area
('20000005-0001-4000-8000-000000000006', '00000001-0001-4000-8000-000000000008', 44.9000, -86.0000, 65.40, 0.88, 2.80, 'sonar', 'Family vacation', NOW() - INTERVAL '3 days', FALSE, 0.82, NULL, 'Family boat near national lakeshore', 3.5, ARRAY['family_vacation', 'national_lakeshore']),
('20000005-0001-4000-8000-000000000007', '00000001-0001-4000-8000-000000000007', 44.8500, -85.9500, 58.20, 0.90, 3.20, 'sonar', 'Fishing vacation', NOW() - INTERVAL '4 days', TRUE, 0.87, '00000001-0001-4000-8000-000000000009', 'Great Lakes fishing trip', 2.9, ARRAY['fishing_vacation', 'great_lakes']);

-- ====================================================================
-- REALISTIC WEATHER AND ENVIRONMENTAL DATA
-- ====================================================================

-- San Francisco Bay Weather Data
INSERT INTO weather_data (
    id, latitude, longitude, timestamp, data_source,
    temperature, wind_speed, wind_direction, wave_height, wave_period,
    wave_direction, pressure, humidity, visibility, conditions,
    forecast_data, expires_at
) VALUES
-- Current conditions at key locations
('30000001-0001-4000-8000-000000000001', 37.8199, -122.4783, NOW() - INTERVAL '30 minutes', 'noaa', 
    18.5, 15.2, 285, 1.8, 7.2, 275, 1013.2, 72, 12.5, 'Partly cloudy with northwest winds',
    '{"forecast_hours": [{"hour": 3, "wind_speed": 18.5, "conditions": "Clear"}, {"hour": 6, "wind_speed": 22.1, "conditions": "Windy"}]}',
    NOW() + INTERVAL '6 hours'),

('30000001-0001-4000-8000-000000000002', 37.7983, -122.3950, NOW() - INTERVAL '15 minutes', 'noaa',
    19.2, 12.8, 270, 1.2, 6.5, 265, 1014.1, 68, 15.2, 'Clear with light winds',
    '{"forecast_hours": [{"hour": 3, "wind_speed": 14.2, "conditions": "Clear"}, {"hour": 6, "wind_speed": 16.8, "conditions": "Clear"}]}',
    NOW() + INTERVAL '6 hours'),

('30000001-0001-4000-8000-000000000003', 37.8267, -122.4230, NOW() - INTERVAL '45 minutes', 'openweather',
    17.8, 16.5, 290, 2.1, 8.1, 280, 1012.8, 75, 10.8, 'Moderate winds with small craft advisory',
    '{"forecast_hours": [{"hour": 3, "wind_speed": 20.2, "conditions": "Windy"}, {"hour": 6, "wind_speed": 25.1, "conditions": "Small Craft Advisory"}]}',
    NOW() + INTERVAL '6 hours'),

-- Chesapeake Bay Weather Data
('30000002-0001-4000-8000-000000000001', 38.9800, -76.4700, NOW() - INTERVAL '20 minutes', 'noaa',
    24.5, 8.5, 180, 0.6, 4.2, 170, 1016.5, 65, 18.2, 'Light southerly winds, calm seas',
    '{"forecast_hours": [{"hour": 3, "wind_speed": 10.2, "conditions": "Light winds"}, {"hour": 6, "wind_speed": 12.5, "conditions": "Light winds"}]}',
    NOW() + INTERVAL '6 hours'),

('30000002-0001-4000-8000-000000000002', 39.0000, -76.3000, NOW() - INTERVAL '35 minutes', 'noaa',
    25.1, 12.2, 200, 0.9, 5.8, 195, 1015.8, 62, 20.5, 'Moderate southerly winds',
    '{"forecast_hours": [{"hour": 3, "wind_speed": 15.8, "conditions": "Moderate winds"}, {"hour": 6, "wind_speed": 18.2, "conditions": "Fresh winds"}]}',
    NOW() + INTERVAL '6 hours'),

-- Long Island Sound Weather Data
('30000003-0001-4000-8000-000000000001', 41.0550, -71.8550, NOW() - INTERVAL '25 minutes', 'noaa',
    21.2, 22.5, 270, 2.8, 9.5, 265, 1009.8, 78, 8.5, 'Strong westerly winds with rough seas',
    '{"forecast_hours": [{"hour": 3, "wind_speed": 25.2, "conditions": "Gale warning"}, {"hour": 6, "wind_speed": 28.8, "conditions": "Gale warning"}]}',
    NOW() + INTERVAL '6 hours'),

('30000003-0001-4000-8000-000000000002', 41.1000, -73.0000, NOW() - INTERVAL '40 minutes', 'noaa',
    22.8, 18.5, 285, 2.2, 8.2, 280, 1011.2, 72, 12.2, 'Fresh westerly winds',
    '{"forecast_hours": [{"hour": 3, "wind_speed": 20.8, "conditions": "Fresh winds"}, {"hour": 6, "wind_speed": 22.5, "conditions": "Strong winds"}]}',
    NOW() + INTERVAL '6 hours'),

-- Florida Keys Weather Data
('30000004-0001-4000-8000-000000000001', 24.5513, -81.8082, NOW() - INTERVAL '10 minutes', 'noaa',
    28.5, 14.8, 110, 1.5, 6.8, 105, 1012.5, 82, 15.8, 'Tropical trade wind conditions',
    '{"forecast_hours": [{"hour": 3, "wind_speed": 16.2, "conditions": "Trade winds"}, {"hour": 6, "wind_speed": 18.5, "conditions": "Fresh trade winds"}]}',
    NOW() + INTERVAL '6 hours'),

('30000004-0001-4000-8000-000000000002', 24.6000, -81.5000, NOW() - INTERVAL '50 minutes', 'stormglass',
    29.2, 12.5, 95, 1.2, 5.5, 90, 1013.8, 85, 18.5, 'Light easterly winds over coral reefs',
    '{"forecast_hours": [{"hour": 3, "wind_speed": 14.2, "conditions": "Light winds"}, {"hour": 6, "wind_speed": 16.8, "conditions": "Moderate winds"}]}',
    NOW() + INTERVAL '6 hours'),

-- Great Lakes Weather Data
('30000005-0001-4000-8000-000000000001', 41.8900, -87.6200, NOW() - INTERVAL '30 minutes', 'noaa',
    16.8, 25.2, 320, 3.2, 8.8, 315, 1008.5, 68, 8.2, 'Strong northwest winds with large waves',
    '{"forecast_hours": [{"hour": 3, "wind_speed": 28.5, "conditions": "Gale warning"}, {"hour": 6, "wind_speed": 32.2, "conditions": "Storm warning"}]}',
    NOW() + INTERVAL '6 hours'),

('30000005-0001-4000-8000-000000000002', 44.9000, -86.0000, NOW() - INTERVAL '20 minutes', 'noaa',
    14.2, 18.5, 295, 2.5, 7.2, 290, 1010.2, 72, 12.5, 'Fresh westerly winds',
    '{"forecast_hours": [{"hour": 3, "wind_speed": 22.8, "conditions": "Strong winds"}, {"hour": 6, "wind_speed": 25.5, "conditions": "Strong winds"}]}',
    NOW() + INTERVAL '6 hours');

-- ====================================================================
-- SAFETY ALERTS AND MARITIME NOTICES
-- ====================================================================

-- Coast Guard Safety Alerts
INSERT INTO safety_alerts (
    id, alert_type, severity, title, description,
    affected_area, point_location, radius_meters,
    start_time, end_time, issuing_authority, reference_number,
    is_active, created_at
) VALUES
-- San Francisco Bay Area Alerts
('40000001-0001-4000-8000-000000000001', 'weather', 'warning', 'Small Craft Advisory - Golden Gate',
    'Northwest winds 20-25 knots with gusts to 30 knots. Seas 3-5 feet with occasional higher waves near the Golden Gate. Small craft should exercise caution.',
    ST_GeomFromText('POLYGON((-122.5200 37.7800, -122.4400 37.7800, -122.4400 37.8400, -122.5200 37.8400, -122.5200 37.7800))', 4326),
    ST_Point(-122.4783, 37.8199), 5000,
    NOW() - INTERVAL '2 hours', NOW() + INTERVAL '8 hours',
    'US Coast Guard Sector San Francisco', 'USCG-SF-2024-0856',
    TRUE, NOW() - INTERVAL '2 hours'),

('40000001-0001-4000-8000-000000000002', 'navigation', 'critical', 'Shallow Water Hazard - South Bay',
    'Newly discovered shallow area 6.8 feet MLW reported by multiple vessels. Use extreme caution in this area until official survey completed.',
    NULL, ST_Point(-122.3450, 37.7480), 200,
    NOW() - INTERVAL '6 hours', NOW() + INTERVAL '72 hours',
    'US Coast Guard Sector San Francisco', 'USCG-SF-2024-0857',
    TRUE, NOW() - INTERVAL '6 hours'),

('40000001-0001-4000-8000-000000000003', 'equipment', 'info', 'Alcatraz Island Security Zone',
    'Increased security operations around Alcatraz Island. Vessels should maintain safe distance and monitor VHF Channel 16 for instructions.',
    ST_GeomFromText('POLYGON((-122.4280 37.8240, -122.4180 37.8240, -122.4180 37.8340, -122.4280 37.8340, -122.4280 37.8240))', 4326),
    ST_Point(-122.4230, 37.8267), 500,
    NOW() - INTERVAL '4 hours', NOW() + INTERVAL '24 hours',
    'US Coast Guard', 'USCG-SF-2024-0858',
    TRUE, NOW() - INTERVAL '4 hours'),

-- Chesapeake Bay Alerts
('40000002-0001-4000-8000-000000000001', 'weather', 'warning', 'Dense Fog Advisory - Northern Chesapeake',
    'Dense fog reducing visibility to less than 0.5 nautical miles. Vessels should proceed with extreme caution and use radar if available.',
    ST_GeomFromText('POLYGON((-76.6000 39.0000, -76.2000 39.0000, -76.2000 39.4000, -76.6000 39.4000, -76.6000 39.0000))', 4326),
    ST_Point(-76.4000, 39.2000), 10000,
    NOW() - INTERVAL '3 hours', NOW() + INTERVAL '6 hours',
    'US Coast Guard Sector Maryland-NCR', 'USCG-MD-2024-0234',
    TRUE, NOW() - INTERVAL '3 hours'),

('40000002-0001-4000-8000-000000000002', 'navigation', 'warning', 'Naval Academy Restricted Operations',
    'Naval Academy conducting training exercises. Recreational vessels should avoid the area and monitor VHF Channel 13.',
    ST_GeomFromText('POLYGON((-76.4900 38.9650, -76.4500 38.9650, -76.4500 39.0050, -76.4900 39.0050, -76.4900 38.9650))', 4326),
    ST_Point(-76.4700, 38.9850), 2000,
    NOW() - INTERVAL '1 hour', NOW() + INTERVAL '12 hours',
    'US Naval Academy', 'USNA-2024-0156',
    TRUE, NOW() - INTERVAL '1 hour'),

-- Long Island Sound Alerts
('40000003-0001-4000-8000-000000000001', 'weather', 'critical', 'Gale Warning - Montauk Point',
    'West winds 25-35 knots with gusts to 45 knots. Seas 6-10 feet. All vessels should seek safe harbor immediately.',
    ST_GeomFromText('POLYGON((-71.9000 41.0200, -71.8000 41.0200, -71.8000 41.0800, -71.9000 41.0800, -71.9000 41.0200))', 4326),
    ST_Point(-71.8550, 41.0550), 8000,
    NOW() - INTERVAL '1 hour', NOW() + INTERVAL '18 hours',
    'National Weather Service', 'NWS-LIS-2024-0445',
    TRUE, NOW() - INTERVAL '1 hour'),

('40000003-0001-4000-8000-000000000002', 'hazard', 'danger', 'Rock Pinnacle - Montauk Point',
    'Submerged rock pinnacle reported 0.5 nm southeast of Montauk Point Light. Depth approximately 8 feet at mean low water.',
    NULL, ST_Point(-71.8520, 41.0520), 100,
    NOW() - INTERVAL '24 hours', NOW() + INTERVAL '720 hours',
    'US Coast Guard', 'USCG-LIS-2024-0112',
    TRUE, NOW() - INTERVAL '24 hours'),

-- Florida Keys Alerts
('40000004-0001-4000-8000-000000000001', 'environmental', 'warning', 'Coral Spawning Event - Florida Keys',
    'Annual coral spawning event in progress. Reduced visibility underwater. Diving and snorkeling should be done with extreme caution.',
    ST_GeomFromText('POLYGON((-81.9000 24.4000, -80.1000 24.4000, -80.1000 25.0000, -81.9000 25.0000, -81.9000 24.4000))', 4326),
    ST_Point(-81.0000, 24.7000), 50000,
    NOW() - INTERVAL '12 hours', NOW() + INTERVAL '120 hours',
    'NOAA Florida Keys NMS', 'FKNMS-2024-0089',
    TRUE, NOW() - INTERVAL '12 hours'),

('40000004-0001-4000-8000-000000000002', 'navigation', 'critical', 'Military Exercise Area - Key West',
    'Military exercise in progress. Civilian vessels prohibited within 2 nautical miles of designated area.',
    ST_GeomFromText('POLYGON((-81.8500 24.5200, -81.7800 24.5200, -81.7800 24.5800, -81.8500 24.5800, -81.8500 24.5200))', 4326),
    ST_Point(-81.8150, 24.5500), 3704,
    NOW() - INTERVAL '6 hours', NOW() + INTERVAL '18 hours',
    'US Navy', 'USN-KW-2024-0067',
    TRUE, NOW() - INTERVAL '6 hours'),

-- Great Lakes Alerts
('40000005-0001-4000-8000-000000000001', 'weather', 'critical', 'Storm Warning - Lake Michigan',
    'Northwest winds 35-45 knots with gusts to 55 knots. Waves 8-12 feet. Dangerous conditions for all vessels.',
    ST_GeomFromText('POLYGON((-87.8000 41.5000, -86.5000 41.5000, -86.5000 43.0000, -87.8000 43.0000, -87.8000 41.5000))', 4326),
    ST_Point(-87.1500, 42.2500), 75000,
    NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '24 hours',
    'National Weather Service', 'NWS-GLB-2024-0334',
    TRUE, NOW() - INTERVAL '30 minutes'),

('40000005-0001-4000-8000-000000000002', 'navigation', 'warning', 'Ice Formation - Northern Lake Michigan',
    'Ice beginning to form in protected harbors and shallow areas. Mariners should exercise caution and monitor ice conditions.',
    ST_GeomFromText('POLYGON((-86.5000 44.5000, -85.5000 44.5000, -85.5000 45.5000, -86.5000 45.5000, -86.5000 44.5000))', 4326),
    ST_Point(-86.0000, 45.0000), 25000,
    NOW() - INTERVAL '8 hours', NOW() + INTERVAL '2160 hours',
    'US Coast Guard Great Lakes', 'USCG-GL-2024-0198',
    TRUE, NOW() - INTERVAL '8 hours');

-- ====================================================================
-- ADDITIONAL TIDE STATIONS (Enhanced NOAA Network)
-- ====================================================================

-- Additional West Coast Stations
INSERT INTO tide_stations (id, name, latitude, longitude, state, station_type, datum, time_zone, is_active) VALUES
('9414750', 'Alameda, CA', 37.7717, -122.2975, 'CA', 'tide', 'MLLW', 'PST', TRUE),
('9414863', 'Richmond, CA', 37.9267, -122.4000, 'CA', 'tide', 'MLLW', 'PST', TRUE),
('9413450', 'Monterey, CA', 36.6050, -121.8883, 'CA', 'tide', 'MLLW', 'PST', TRUE),
('9411340', 'Santa Barbara, CA', 34.4083, -119.6867, 'CA', 'tide', 'MLLW', 'PST', TRUE),
('9410170', 'San Diego, CA', 32.7133, -117.1733, 'CA', 'tide', 'MLLW', 'PST', TRUE),

-- Additional East Coast Stations
('8534720', 'Atlantic City, NJ', 39.3542, -74.4183, 'NJ', 'tide', 'MLLW', 'EST', TRUE),
('8516945', 'Kings Point, NY', 40.8117, -73.7650, 'NY', 'tide', 'MLLW', 'EST', TRUE),
('8461490', 'New London, CT', 41.3617, -72.0983, 'CT', 'tide', 'MLLW', 'EST', TRUE),
('8449130', 'Nantucket Island, MA', 41.2867, -70.0967, 'MA', 'tide', 'MLLW', 'EST', TRUE),

-- Florida Stations
('8724580', 'Key West, FL', 24.5513, -81.8082, 'FL', 'tide', 'MLLW', 'EST', TRUE),
('8723214', 'Virginia Key, FL', 25.7317, -80.1608, 'FL', 'tide', 'MLLW', 'EST', TRUE),
('8721604', 'Daytona Beach, FL', 29.2267, -80.9033, 'FL', 'tide', 'MLLW', 'EST', TRUE),

-- Great Lakes Stations
('9087031', 'Milwaukee, WI', 43.0267, -87.8883, 'WI', 'tide', 'IGLD', 'CST', TRUE),
('9087044', 'North Point Marina, WI', 43.0417, -87.8067, 'WI', 'tide', 'IGLD', 'CST', TRUE),
('9087057', 'Port Washington, WI', 43.3883, -87.8550, 'WI', 'tide', 'IGLD', 'CST', TRUE);

-- ====================================================================
-- DATA QUALITY AND VALIDATION FUNCTIONS
-- ====================================================================

-- Function to generate depth reading quality score
CREATE OR REPLACE FUNCTION calculate_depth_quality_score(
    confidence_level DECIMAL(3,2),
    validator_present BOOLEAN,
    equipment_type VARCHAR(50),
    user_experience_level VARCHAR(50),
    device_accuracy DECIMAL(5,2)
)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    quality_score DECIMAL(3,2) := 0.0;
BEGIN
    -- Base score from confidence
    quality_score := confidence_level * 0.4;
    
    -- Validator bonus
    IF validator_present THEN
        quality_score := quality_score + 0.2;
    END IF;
    
    -- Equipment type bonus
    CASE equipment_type
        WHEN 'sonar' THEN quality_score := quality_score + 0.15;
        WHEN 'lead_line' THEN quality_score := quality_score + 0.05;
        WHEN 'estimated' THEN quality_score := quality_score - 0.1;
        ELSE quality_score := quality_score + 0.1;
    END CASE;
    
    -- User experience bonus
    CASE user_experience_level
        WHEN 'professional' THEN quality_score := quality_score + 0.15;
        WHEN 'advanced' THEN quality_score := quality_score + 0.1;
        WHEN 'intermediate' THEN quality_score := quality_score + 0.05;
        WHEN 'beginner' THEN quality_score := quality_score + 0.0;
    END CASE;
    
    -- Device accuracy penalty
    IF device_accuracy > 5.0 THEN
        quality_score := quality_score - 0.1;
    ELSIF device_accuracy > 3.0 THEN
        quality_score := quality_score - 0.05;
    END IF;
    
    -- Ensure score is between 0 and 1
    IF quality_score > 1.0 THEN
        quality_score := 1.0;
    ELSIF quality_score < 0.0 THEN
        quality_score := 0.0;
    END IF;
    
    RETURN quality_score;
END;
$$ LANGUAGE plpgsql;

-- Function to identify potential hazard areas
CREATE OR REPLACE FUNCTION identify_hazard_areas(
    min_depth_threshold DECIMAL(6,2) DEFAULT 10.0,
    confidence_threshold DECIMAL(3,2) DEFAULT 0.8
)
RETURNS TABLE (
    location_geojson TEXT,
    average_depth DECIMAL(6,2),
    reading_count INTEGER,
    hazard_level VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ST_AsGeoJSON(ST_Centroid(ST_Collect(dr.location))) as location_geojson,
        AVG(dr.depth)::DECIMAL(6,2) as average_depth,
        COUNT(*)::INTEGER as reading_count,
        CASE 
            WHEN AVG(dr.depth) < 5.0 THEN 'critical'
            WHEN AVG(dr.depth) < 8.0 THEN 'high'
            WHEN AVG(dr.depth) < min_depth_threshold THEN 'moderate'
            ELSE 'low'
        END as hazard_level
    FROM depth_readings dr
    WHERE dr.confidence >= confidence_threshold
        AND dr.is_public = TRUE
        AND dr.timestamp > NOW() - INTERVAL '60 days'
    GROUP BY ST_SnapToGrid(dr.location, 0.001)
    HAVING AVG(dr.depth) < min_depth_threshold
        AND COUNT(*) >= 3
    ORDER BY average_depth ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to generate user performance metrics
CREATE OR REPLACE FUNCTION calculate_user_performance_metrics(input_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    total_contributions INTEGER,
    validation_rate DECIMAL(5,2),
    average_accuracy DECIMAL(5,2),
    consistency_score DECIMAL(5,2),
    expertise_areas TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        input_user_id,
        COUNT(*)::INTEGER as total_contributions,
        (COUNT(*) FILTER (WHERE is_validated = TRUE)::DECIMAL / COUNT(*) * 100)::DECIMAL(5,2) as validation_rate,
        AVG(confidence)::DECIMAL(5,2) as average_accuracy,
        (1.0 - STDDEV(confidence))::DECIMAL(5,2) as consistency_score,
        array_agg(DISTINCT 
            CASE 
                WHEN depth < 10 THEN 'shallow_water'
                WHEN depth > 100 THEN 'deep_water'
                ELSE 'general_navigation'
            END
        ) as expertise_areas
    FROM depth_readings
    WHERE user_id = input_user_id
        AND timestamp > NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Summary statistics view
CREATE OR REPLACE VIEW marine_data_summary AS
SELECT 
    'depth_readings' as data_type,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as last_24h,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as last_7d,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '30 days') as last_30d,
    COUNT(*) FILTER (WHERE is_validated = TRUE) as validated_records,
    AVG(confidence)::DECIMAL(4,2) as avg_confidence,
    COUNT(DISTINCT user_id) as contributing_users
FROM depth_readings
UNION ALL
SELECT 
    'safety_alerts' as data_type,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30d,
    COUNT(*) FILTER (WHERE is_active = TRUE) as validated_records,
    NULL as avg_confidence,
    NULL as contributing_users
FROM safety_alerts
UNION ALL
SELECT 
    'weather_data' as data_type,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as last_24h,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as last_7d,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '30 days') as last_30d,
    COUNT(*) FILTER (WHERE expires_at > NOW()) as validated_records,
    NULL as avg_confidence,
    NULL as contributing_users
FROM weather_data;

-- Data quality monitoring view
CREATE OR REPLACE VIEW data_quality_metrics AS
SELECT 
    'Overall System' as category,
    COUNT(*) as total_depth_readings,
    AVG(confidence)::DECIMAL(4,2) as avg_confidence,
    COUNT(*) FILTER (WHERE confidence > 0.9) * 100.0 / COUNT(*) as high_confidence_pct,
    COUNT(*) FILTER (WHERE is_validated = TRUE) * 100.0 / COUNT(*) as validation_pct,
    COUNT(DISTINCT user_id) as active_contributors,
    AVG(device_accuracy)::DECIMAL(4,2) as avg_gps_accuracy
FROM depth_readings 
WHERE timestamp > NOW() - INTERVAL '30 days'
UNION ALL
SELECT 
    u.experience_level as category,
    COUNT(dr.*) as total_depth_readings,
    AVG(dr.confidence)::DECIMAL(4,2) as avg_confidence,
    COUNT(dr.*) FILTER (WHERE dr.confidence > 0.9) * 100.0 / COUNT(dr.*) as high_confidence_pct,
    COUNT(dr.*) FILTER (WHERE dr.is_validated = TRUE) * 100.0 / COUNT(dr.*) as validation_pct,
    COUNT(DISTINCT dr.user_id) as active_contributors,
    AVG(dr.device_accuracy)::DECIMAL(4,2) as avg_gps_accuracy
FROM depth_readings dr
JOIN users u ON dr.user_id = u.id
WHERE dr.timestamp > NOW() - INTERVAL '30 days'
GROUP BY u.experience_level;

COMMIT;