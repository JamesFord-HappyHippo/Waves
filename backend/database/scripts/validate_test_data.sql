-- Waves Marine Test Data Validation Script
-- Run this after loading test data to verify integrity

-- Check total record counts
SELECT 
    'Data Load Summary' as section,
    '==================' as divider;

SELECT 
    'users' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE email LIKE '%@%') as valid_emails,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_users,
    COUNT(*) FILTER (WHERE experience_level = 'professional') as professionals
FROM users
UNION ALL
SELECT 
    'depth_readings' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE confidence >= 0.8) as high_confidence,
    COUNT(*) FILTER (WHERE is_validated = TRUE) as validated,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '30 days') as recent
FROM depth_readings
UNION ALL
SELECT 
    'marine_areas' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_areas,
    COUNT(*) FILTER (WHERE severity_level = 'danger') as danger_zones,
    COUNT(*) FILTER (WHERE area_type = 'harbor') as harbors
FROM marine_areas
UNION ALL
SELECT 
    'safety_alerts' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_alerts,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_alerts,
    COUNT(*) FILTER (WHERE start_time <= NOW() AND (end_time IS NULL OR end_time > NOW())) as current_alerts
FROM safety_alerts
UNION ALL
SELECT 
    'weather_data' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_forecasts,
    COUNT(*) FILTER (WHERE data_source = 'noaa') as noaa_data,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '6 hours') as recent_data
FROM weather_data
UNION ALL
SELECT 
    'tide_stations' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_stations,
    COUNT(*) FILTER (WHERE station_type = 'tide') as tide_stations,
    COUNT(*) FILTER (WHERE state IN ('CA', 'FL', 'NY', 'MA')) as major_states
FROM tide_stations;

-- Geographic distribution check
SELECT 
    '' as spacer,
    'Geographic Distribution' as section,
    '======================' as divider;

SELECT 
    CASE 
        WHEN longitude < -120 THEN 'West Coast (CA/WA)'
        WHEN longitude > -80 THEN 'East Coast (MA/NY/VA)'
        WHEN longitude > -90 THEN 'Southeast (FL/SC)'
        WHEN longitude > -100 THEN 'Gulf Coast'
        ELSE 'Great Lakes'
    END as region,
    COUNT(*) as depth_readings,
    AVG(depth)::DECIMAL(6,2) as avg_depth,
    MIN(depth)::DECIMAL(6,2) as min_depth,
    MAX(depth)::DECIMAL(6,2) as max_depth,
    AVG(confidence)::DECIMAL(4,2) as avg_confidence
FROM depth_readings 
GROUP BY 1
ORDER BY 2 DESC;

-- Data quality metrics
SELECT 
    '' as spacer,
    'Data Quality Metrics' as section,
    '====================' as divider;

SELECT 
    experience_level,
    COUNT(dr.*) as contributions,
    AVG(dr.confidence)::DECIMAL(4,2) as avg_confidence,
    COUNT(dr.*) FILTER (WHERE dr.is_validated = TRUE) * 100.0 / COUNT(dr.*) as validation_pct,
    AVG(dr.device_accuracy)::DECIMAL(4,2) as avg_gps_accuracy
FROM depth_readings dr
JOIN users u ON dr.user_id = u.id
GROUP BY experience_level
ORDER BY contributions DESC;

-- Safety alert verification
SELECT 
    '' as spacer,
    'Active Safety Alerts' as section,
    '===================' as divider;

SELECT 
    alert_type,
    severity,
    COUNT(*) as alert_count,
    STRING_AGG(DISTINCT issuing_authority, ', ') as authorities
FROM safety_alerts 
WHERE is_active = TRUE
  AND start_time <= NOW() 
  AND (end_time IS NULL OR end_time > NOW())
GROUP BY alert_type, severity
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'warning' THEN 2 
        WHEN 'info' THEN 3 
    END,
    alert_type;

-- Weather data freshness
SELECT 
    '' as spacer,
    'Weather Data Status' as section,
    '==================' as divider;

SELECT 
    data_source,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_forecasts,
    MAX(timestamp) as latest_data,
    AVG(wind_speed)::DECIMAL(4,1) as avg_wind_speed,
    AVG(wave_height)::DECIMAL(4,1) as avg_wave_height
FROM weather_data
GROUP BY data_source
ORDER BY latest_data DESC;

-- Potential hazard areas
SELECT 
    '' as spacer,
    'Identified Hazard Areas' as section,
    '======================' as divider;

SELECT 
    hazard_level,
    COUNT(*) as area_count,
    AVG(average_depth)::DECIMAL(4,2) as avg_depth,
    AVG(reading_count)::DECIMAL(4,0) as avg_readings_per_area
FROM identify_hazard_areas(15.0, 0.7)
GROUP BY hazard_level
ORDER BY 
    CASE hazard_level 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'moderate' THEN 3 
        WHEN 'low' THEN 4 
    END;

-- Data integrity checks
SELECT 
    '' as spacer,
    'Data Integrity Checks' as section,
    '=====================' as divider;

SELECT 
    'Geographic Bounds' as check_name,
    CASE 
        WHEN COUNT(*) FILTER (WHERE latitude < 24.0 OR latitude > 49.0) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as status,
    COUNT(*) FILTER (WHERE latitude < 24.0 OR latitude > 49.0) as violations
FROM depth_readings
UNION ALL
SELECT 
    'Longitude Bounds' as check_name,
    CASE 
        WHEN COUNT(*) FILTER (WHERE longitude < -130.0 OR longitude > -65.0) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as status,
    COUNT(*) FILTER (WHERE longitude < -130.0 OR longitude > -65.0) as violations
FROM depth_readings
UNION ALL
SELECT 
    'Depth Validity' as check_name,
    CASE 
        WHEN COUNT(*) FILTER (WHERE depth < 0 OR depth > 1000) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as status,
    COUNT(*) FILTER (WHERE depth < 0 OR depth > 1000) as violations
FROM depth_readings
UNION ALL
SELECT 
    'Confidence Range' as check_name,
    CASE 
        WHEN COUNT(*) FILTER (WHERE confidence < 0 OR confidence > 1) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as status,
    COUNT(*) FILTER (WHERE confidence < 0 OR confidence > 1) as violations
FROM depth_readings
UNION ALL
SELECT 
    'Future Timestamps' as check_name,
    CASE 
        WHEN COUNT(*) FILTER (WHERE timestamp > NOW()) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as status,
    COUNT(*) FILTER (WHERE timestamp > NOW()) as violations
FROM depth_readings;

-- Performance test - spatial queries
SELECT 
    '' as spacer,
    'Performance Test Results' as section,
    '========================' as divider;

-- Test spatial query performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM depth_readings 
WHERE ST_DWithin(location::geography, ST_Point(-122.4783, 37.8199)::geography, 1000);

-- Summary validation results
SELECT 
    '' as spacer,
    'Validation Summary' as section,
    '=================' as divider;

SELECT 
    'TEST DATA VALIDATION COMPLETE' as message,
    CASE 
        WHEN (SELECT COUNT(*) FROM users WHERE email LIKE '%test%' OR email LIKE '%example%') >= 15 
        AND (SELECT COUNT(*) FROM depth_readings) >= 1000
        AND (SELECT COUNT(*) FROM safety_alerts WHERE is_active = TRUE) >= 5
        AND (SELECT COUNT(*) FROM weather_data WHERE expires_at > NOW()) >= 5
        THEN '✅ ALL CHECKS PASSED'
        ELSE '❌ SOME CHECKS FAILED'
    END as status,
    NOW() as validation_timestamp;