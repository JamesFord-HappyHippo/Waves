#!/usr/bin/env node

/**
 * Waves Marine Test Data Loader
 * Comprehensive script to load realistic marine navigation test data
 * 
 * Usage:
 *   node load_test_data.js [--environment=dev|test|staging]
 *   
 * This script loads:
 * - 20+ realistic users with maritime credentials
 * - 8,000+ depth readings across major US maritime areas
 * - 12+ marine protected/restricted areas
 * - 15+ weather data points with forecasts
 * - 12+ active safety alerts and notices
 * - 25+ NOAA tide stations
 * - Data quality validation functions
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuration
const config = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'waves_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  },
  test: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_TEST_NAME || 'waves_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  },
  staging: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'waves_staging',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const environment = args.find(arg => arg.startsWith('--environment='))?.split('=')[1] || 'development';
const force = args.includes('--force');
const validate = args.includes('--validate');
const verbose = args.includes('--verbose');

if (!config[environment]) {
  console.error(`❌ Invalid environment: ${environment}`);
  console.error('Valid environments: development, test, staging');
  process.exit(1);
}

const dbConfig = config[environment];
const pool = new Pool(dbConfig);

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

// Data validation functions
async function validateDatabase() {
  logSection('🔍 VALIDATING DATABASE STRUCTURE');
  
  try {
    // Check if database exists and is accessible
    const client = await pool.connect();
    log('✅ Database connection successful', 'green');
    
    // Check for required extensions
    const extensions = await client.query(`
      SELECT extname FROM pg_extension 
      WHERE extname IN ('postgis', 'postgis_topology', 'uuid-ossp', 'timescaledb')
    `);
    
    const requiredExtensions = ['postgis', 'postgis_topology', 'uuid-ossp', 'timescaledb'];
    const installedExtensions = extensions.rows.map(row => row.extname);
    
    for (const ext of requiredExtensions) {
      if (installedExtensions.includes(ext)) {
        log(`✅ Extension ${ext} is installed`, 'green');
      } else {
        log(`❌ Extension ${ext} is missing`, 'red');
        throw new Error(`Required extension ${ext} is not installed`);
      }
    }
    
    // Check for required tables
    const tables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'depth_readings', 'marine_areas', 'weather_data', 'safety_alerts', 'tide_stations', 'user_contributions')
    `);
    
    const requiredTables = ['users', 'depth_readings', 'marine_areas', 'weather_data', 'safety_alerts', 'tide_stations', 'user_contributions'];
    const existingTables = tables.rows.map(row => row.tablename);
    
    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        log(`✅ Table ${table} exists`, 'green');
      } else {
        log(`❌ Table ${table} is missing`, 'red');
        throw new Error(`Required table ${table} does not exist`);
      }
    }
    
    client.release();
    return true;
    
  } catch (error) {
    log(`❌ Database validation failed: ${error.message}`, 'red');
    return false;
  }
}

async function checkExistingData() {
  logSection('📊 CHECKING EXISTING DATA');
  
  try {
    const client = await pool.connect();
    
    // Check for existing test data
    const userCount = await client.query(`SELECT COUNT(*) FROM users WHERE email LIKE '%test%' OR email LIKE '%example%'`);
    const depthCount = await client.query(`SELECT COUNT(*) FROM depth_readings WHERE created_at > NOW() - INTERVAL '1 year'`);
    const alertCount = await client.query(`SELECT COUNT(*) FROM safety_alerts WHERE created_at > NOW() - INTERVAL '1 year'`);
    
    log(`📈 Found ${userCount.rows[0].count} test users`, 'blue');
    log(`📈 Found ${depthCount.rows[0].count} recent depth readings`, 'blue');
    log(`📈 Found ${alertCount.rows[0].count} recent safety alerts`, 'blue');
    
    if (parseInt(userCount.rows[0].count) > 0 && !force) {
      log('⚠️  Test data already exists. Use --force to overwrite', 'yellow');
      return false;
    }
    
    client.release();
    return true;
    
  } catch (error) {
    log(`❌ Error checking existing data: ${error.message}`, 'red');
    return false;
  }
}

async function loadSeedFile(filename) {
  logSection(`📥 LOADING ${filename.toUpperCase()}`);
  
  try {
    const filePath = path.join(__dirname, '..', 'seeds', filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Seed file not found: ${filePath}`);
    }
    
    const seedData = fs.readFileSync(filePath, 'utf8');
    log(`📄 Read ${(seedData.length / 1024).toFixed(1)}KB from ${filename}`, 'blue');
    
    const client = await pool.connect();
    
    // Execute the seed data
    await client.query(seedData);
    log(`✅ Successfully loaded ${filename}`, 'green');
    
    client.release();
    return true;
    
  } catch (error) {
    log(`❌ Error loading ${filename}: ${error.message}`, 'red');
    if (verbose) {
      console.error(error.stack);
    }
    return false;
  }
}

async function validateLoadedData() {
  logSection('🔍 VALIDATING LOADED DATA');
  
  try {
    const client = await pool.connect();
    
    // Get summary statistics
    const summaryQuery = await client.query('SELECT * FROM marine_data_summary ORDER BY data_type');
    
    log('📊 Data Summary:', 'bright');
    for (const row of summaryQuery.rows) {
      log(`   ${row.data_type}: ${row.total_records} total, ${row.last_24h || 0} in last 24h`, 'blue');
    }
    
    // Get quality metrics
    const qualityQuery = await client.query('SELECT * FROM data_quality_metrics ORDER BY category');
    
    log('\n🎯 Quality Metrics:', 'bright');
    for (const row of qualityQuery.rows) {
      if (row.avg_confidence) {
        log(`   ${row.category}: ${row.total_depth_readings} readings, ${(row.avg_confidence * 100).toFixed(1)}% avg confidence`, 'blue');
      }
    }
    
    // Test custom functions
    log('\n🔧 Testing Custom Functions:', 'bright');
    
    // Test hazard identification
    const hazardQuery = await client.query('SELECT COUNT(*) FROM identify_hazard_areas()');
    log(`   Identified ${hazardQuery.rows[0].count} potential hazard areas`, 'blue');
    
    // Test user performance metrics for a sample user
    const userQuery = await client.query(`
      SELECT user_id FROM depth_readings 
      GROUP BY user_id 
      HAVING COUNT(*) > 10 
      LIMIT 1
    `);
    
    if (userQuery.rows.length > 0) {
      const performanceQuery = await client.query(
        'SELECT * FROM calculate_user_performance_metrics($1)',
        [userQuery.rows[0].user_id]
      );
      
      if (performanceQuery.rows.length > 0) {
        const perf = performanceQuery.rows[0];
        log(`   Sample user performance: ${perf.total_contributions} contributions, ${perf.validation_rate}% validated`, 'blue');
      }
    }
    
    // Geographic distribution check
    const geoQuery = await client.query(`
      SELECT 
        CASE 
          WHEN longitude < -120 THEN 'West Coast'
          WHEN longitude > -80 THEN 'East Coast' 
          WHEN longitude > -90 THEN 'Florida/Gulf'
          ELSE 'Great Lakes'
        END as region,
        COUNT(*) as readings
      FROM depth_readings 
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 2 DESC
    `);
    
    log('\n🌍 Geographic Distribution:', 'bright');
    for (const row of geoQuery.rows) {
      log(`   ${row.region}: ${row.readings} readings`, 'blue');
    }
    
    client.release();
    
    log('\n✅ Data validation completed successfully', 'green');
    return true;
    
  } catch (error) {
    log(`❌ Data validation failed: ${error.message}`, 'red');
    if (verbose) {
      console.error(error.stack);
    }
    return false;
  }
}

async function generateAdditionalData() {
  logSection('🏭 GENERATING ADDITIONAL DEPTH READINGS');
  
  try {
    const client = await pool.connect();
    
    // Generate additional depth readings to reach target of 8,000+ readings
    const currentCount = await client.query('SELECT COUNT(*) FROM depth_readings');
    const current = parseInt(currentCount.rows[0].count);
    
    if (current < 8000) {
      const needed = 8000 - current;
      log(`📈 Generating ${needed} additional depth readings...`, 'blue');
      
      // Generate readings using existing user patterns
      const users = await client.query(`
        SELECT id, experience_level, vessel_draft 
        FROM users 
        WHERE is_active = TRUE 
        ORDER BY contribution_score DESC
      `);
      
      const regions = [
        { name: 'San Francisco Bay', lat_center: 37.8, lng_center: -122.4, lat_range: 0.3, lng_range: 0.3, depth_range: [6, 180] },
        { name: 'Chesapeake Bay', lat_center: 39.0, lng_center: -76.3, lat_range: 0.5, lng_range: 0.4, depth_range: [8, 85] },
        { name: 'Long Island Sound', lat_center: 41.1, lng_center: -72.8, lat_range: 0.3, lng_range: 1.0, depth_range: [15, 125] },
        { name: 'Florida Keys', lat_center: 24.7, lng_center: -80.8, lat_range: 0.6, lng_range: 1.2, depth_range: [8, 45] },
        { name: 'Lake Michigan', lat_center: 42.5, lng_center: -87.0, lat_range: 2.0, lng_range: 1.5, depth_range: [20, 280] }
      ];
      
      let generated = 0;
      const batchSize = 100;
      
      while (generated < needed) {
        const batch = [];
        
        for (let i = 0; i < batchSize && generated < needed; i++) {
          const user = users.rows[Math.floor(Math.random() * users.rows.length)];
          const region = regions[Math.floor(Math.random() * regions.length)];
          
          const lat = region.lat_center + (Math.random() - 0.5) * region.lat_range;
          const lng = region.lng_center + (Math.random() - 0.5) * region.lng_range;
          const depth = region.depth_range[0] + Math.random() * (region.depth_range[1] - region.depth_range[0]);
          
          // Adjust confidence based on user experience
          let confidence = 0.5 + Math.random() * 0.4;
          if (user.experience_level === 'professional') confidence += 0.1;
          if (user.experience_level === 'advanced') confidence += 0.05;
          confidence = Math.min(confidence, 0.99);
          
          const hoursAgo = Math.floor(Math.random() * 720); // Up to 30 days ago
          
          batch.push({
            user_id: user.id,
            lat: lat,
            lng: lng,
            depth: depth.toFixed(2),
            confidence: confidence.toFixed(2),
            vessel_draft: user.vessel_draft || 3.0,
            hours_ago: hoursAgo
          });
          
          generated++;
        }
        
        // Insert batch
        const values = batch.map((r, i) => 
          `('${r.user_id}', ${r.lat}, ${r.lng}, ${r.depth}, ${r.confidence}, ${r.vessel_draft}, 'sonar', 'Generated test data', NOW() - INTERVAL '${r.hours_ago} hours', FALSE, 0.5, NULL, 'Auto-generated depth reading', ${(2 + Math.random() * 3).toFixed(1)}, ARRAY['generated_data'])`
        ).join(',');
        
        await client.query(`
          INSERT INTO depth_readings (
            user_id, latitude, longitude, depth, confidence, vessel_draft,
            measurement_method, conditions, timestamp, is_validated, validation_score,
            validator_id, notes, device_accuracy, quality_flags
          ) VALUES ${values}
        `);
        
        if (generated % 1000 === 0) {
          log(`   Generated ${generated}/${needed} readings...`, 'blue');
        }
      }
      
      log(`✅ Generated ${generated} additional depth readings`, 'green');
    } else {
      log(`✅ Already have ${current} depth readings (target: 8000+)`, 'green');
    }
    
    client.release();
    return true;
    
  } catch (error) {
    log(`❌ Error generating additional data: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log(`🌊 Waves Marine Test Data Loader`, 'bright');
  log(`Environment: ${environment}`, 'blue');
  log(`Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`, 'blue');
  
  try {
    // Step 1: Validate database
    if (!(await validateDatabase())) {
      throw new Error('Database validation failed');
    }
    
    // Step 2: Check existing data
    if (!(await checkExistingData())) {
      if (!force) {
        log('💡 Use --force to overwrite existing data', 'yellow');
        process.exit(0);
      }
    }
    
    // Step 3: Load seed files
    const seedFiles = [
      '002_comprehensive_marine_test_data.sql'
    ];
    
    for (const seedFile of seedFiles) {
      if (!(await loadSeedFile(seedFile))) {
        throw new Error(`Failed to load ${seedFile}`);
      }
    }
    
    // Step 4: Generate additional data if needed
    await generateAdditionalData();
    
    // Step 5: Validate loaded data
    if (validate) {
      await validateLoadedData();
    }
    
    logSection('🎉 SUCCESS');
    log('✅ Marine test data loaded successfully!', 'green');
    log('\nNext steps:', 'bright');
    log('1. Run the backend server: npm run dev', 'blue');
    log('2. Test API endpoints with realistic data', 'blue');
    log('3. Use --validate flag to run data quality checks', 'blue');
    log('4. Check marine_data_summary view for statistics', 'blue');
    
  } catch (error) {
    logSection('❌ FAILED');
    log(`Error: ${error.message}`, 'red');
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle command line help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🌊 Waves Marine Test Data Loader

USAGE:
  node load_test_data.js [OPTIONS]

OPTIONS:
  --environment=ENV    Set environment (dev, test, staging) [default: development]
  --force             Overwrite existing test data
  --validate          Run data validation after loading
  --verbose           Show detailed error messages
  --help, -h          Show this help message

EXAMPLES:
  node load_test_data.js --environment=test --force --validate
  node load_test_data.js --validate
  
FEATURES:
  ✅ 20+ realistic users with maritime credentials
  ✅ 8,000+ depth readings across major US waters
  ✅ 12+ marine protected/restricted areas  
  ✅ 15+ weather data points with forecasts
  ✅ 12+ active safety alerts and notices
  ✅ 25+ NOAA tide stations
  ✅ Data quality validation functions
  ✅ Performance monitoring views
`);
  process.exit(0);
}

// Run the main function
main().catch(console.error);