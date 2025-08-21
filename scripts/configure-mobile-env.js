#!/usr/bin/env node

/**
 * Configure Mobile Environment Script
 * 
 * This script configures the mobile app's app.json and environment variables
 * based on the deployment environment (development, staging, production).
 * 
 * Usage: node configure-mobile-env.js [environment]
 */

const fs = require('fs');
const path = require('path');

const ENVIRONMENTS = {
  development: {
    name: 'Waves (Dev)',
    slug: 'waves-dev',
    scheme: 'waves-dev',
    bundleIdentifier: 'com.wavesapp.mobile.dev',
    package: 'com.wavesapp.mobile.dev',
    apiUrl: 'https://dev-api.wavesapp.com',
    websocketUrl: 'wss://dev-api.wavesapp.com/ws',
    mapboxStyle: 'mapbox://styles/mapbox/outdoors-v12',
    updates: {
      channel: 'development',
      requestHeaders: {
        'expo-channel-name': 'development'
      }
    },
    extra: {
      eas: {
        projectId: process.env.EXPO_PROJECT_ID
      },
      enableAnalytics: false,
      enableCrashReporting: true,
      debugMode: true,
      performanceMonitoring: true
    }
  },
  
  staging: {
    name: 'Waves (Staging)',
    slug: 'waves-staging',
    scheme: 'waves-staging',
    bundleIdentifier: 'com.wavesapp.mobile.staging',
    package: 'com.wavesapp.mobile.staging',
    apiUrl: 'https://staging-api.wavesapp.com',
    websocketUrl: 'wss://staging-api.wavesapp.com/ws',
    mapboxStyle: 'mapbox://styles/mapbox/outdoors-v12',
    updates: {
      channel: 'staging',
      requestHeaders: {
        'expo-channel-name': 'staging'
      }
    },
    extra: {
      eas: {
        projectId: process.env.EXPO_PROJECT_ID
      },
      enableAnalytics: true,
      enableCrashReporting: true,
      debugMode: false,
      performanceMonitoring: true
    }
  },
  
  production: {
    name: 'Waves',
    slug: 'waves',
    scheme: 'waves',
    bundleIdentifier: 'com.wavesapp.mobile',
    package: 'com.wavesapp.mobile',
    apiUrl: 'https://api.wavesapp.com',
    websocketUrl: 'wss://api.wavesapp.com/ws',
    mapboxStyle: 'mapbox://styles/mapbox/outdoors-v12',
    updates: {
      channel: 'production',
      requestHeaders: {
        'expo-channel-name': 'production'
      }
    },
    extra: {
      eas: {
        projectId: process.env.EXPO_PROJECT_ID
      },
      enableAnalytics: true,
      enableCrashReporting: true,
      debugMode: false,
      performanceMonitoring: true
    }
  }
};

function getEnvironment() {
  // Determine environment from various sources
  const env = process.argv[2] || 
              process.env.EAS_BUILD_PROFILE || 
              process.env.EXPO_PUBLIC_ENV ||
              process.env.NODE_ENV ||
              'development';
  
  console.log(`📱 Configuring mobile app for environment: ${env}`);
  
  if (!ENVIRONMENTS[env]) {
    console.error(`❌ Unknown environment: ${env}`);
    console.error(`Available environments: ${Object.keys(ENVIRONMENTS).join(', ')}`);
    process.exit(1);
  }
  
  return env;
}

function readAppConfig() {
  const appJsonPath = path.join(__dirname, '..', 'WavesDemo', 'app.json');
  
  if (!fs.existsSync(appJsonPath)) {
    console.error(`❌ app.json not found at: ${appJsonPath}`);
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
}

function configureApp(env) {
  const config = ENVIRONMENTS[env];
  const appConfig = readAppConfig();
  
  // Update app configuration
  appConfig.expo.name = config.name;
  appConfig.expo.slug = config.slug;
  appConfig.expo.scheme = config.scheme;
  
  // iOS configuration
  if (!appConfig.expo.ios) appConfig.expo.ios = {};
  appConfig.expo.ios.bundleIdentifier = config.bundleIdentifier;
  appConfig.expo.ios.buildNumber = process.env.GITHUB_RUN_NUMBER || '1';
  
  // Android configuration
  if (!appConfig.expo.android) appConfig.expo.android = {};
  appConfig.expo.android.package = config.package;
  appConfig.expo.android.versionCode = parseInt(process.env.GITHUB_RUN_NUMBER || '1');
  
  // Updates configuration
  appConfig.expo.updates = config.updates;
  
  // Extra configuration for runtime
  appConfig.expo.extra = {
    ...appConfig.expo.extra,
    ...config.extra,
    apiUrl: config.apiUrl,
    websocketUrl: config.websocketUrl,
    mapboxStyle: config.mapboxStyle,
    environment: env,
    buildVersion: process.env.GITHUB_SHA || 'local',
    buildTimestamp: new Date().toISOString()
  };
  
  // Marine-specific configuration
  appConfig.expo.extra.marine = {
    enableOfflineMaps: env !== 'development',
    enableWeatherOverlay: true,
    enableTideData: true,
    enable3DNavigation: true,
    enableDepthPrediction: env === 'production',
    maxLocationHistory: env === 'production' ? 50000 : 10000,
    mapTileCacheSize: env === 'production' ? 524288000 : 104857600, // 500MB prod, 100MB dev
    depthDataCacheTtl: 300, // 5 minutes
    weatherDataCacheTtl: 1800, // 30 minutes
    defaultSafetyMargin: 0.5,
    defaultVesselDraft: 1.5,
    depthAlertThreshold: 2.0
  };
  
  // Privacy and compliance
  appConfig.expo.extra.privacy = {
    anonymousTrackingDefault: false,
    dataSharingConsentRequired: true,
    locationSharingDefault: false,
    emergencyContactEnabled: true
  };
  
  // EAS Build configuration
  if (!appConfig.expo.build) appConfig.expo.build = {};
  appConfig.expo.build.env = {
    EXPO_PUBLIC_API_URL: config.apiUrl,
    EXPO_PUBLIC_WEBSOCKET_URL: config.websocketUrl,
    EXPO_PUBLIC_ENVIRONMENT: env,
    EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
    EXPO_PUBLIC_ANALYTICS_KEY: process.env.EXPO_PUBLIC_ANALYTICS_KEY || ''
  };
  
  return appConfig;
}

function writeAppConfig(appConfig) {
  const appJsonPath = path.join(__dirname, '..', 'WavesDemo', 'app.json');
  
  fs.writeFileSync(appJsonPath, JSON.stringify(appConfig, null, 2));
  console.log(`✅ Updated app.json for environment configuration`);
}

function createEnvironmentFile(env) {
  const config = ENVIRONMENTS[env];
  const envContent = `# Auto-generated environment configuration for ${env}
# Generated at: ${new Date().toISOString()}

# API Configuration
EXPO_PUBLIC_API_URL=${config.apiUrl}
EXPO_PUBLIC_WEBSOCKET_URL=${config.websocketUrl}
EXPO_PUBLIC_ENVIRONMENT=${env}

# MapBox Configuration
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=${process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || ''}
EXPO_PUBLIC_MAPBOX_STYLE=${config.mapboxStyle}

# Analytics and Monitoring
EXPO_PUBLIC_SENTRY_DSN=${process.env.EXPO_PUBLIC_SENTRY_DSN || ''}
EXPO_PUBLIC_ANALYTICS_KEY=${process.env.EXPO_PUBLIC_ANALYTICS_KEY || ''}

# Feature Flags
EXPO_PUBLIC_ENABLE_ANALYTICS=${config.extra.enableAnalytics}
EXPO_PUBLIC_ENABLE_CRASH_REPORTING=${config.extra.enableCrashReporting}
EXPO_PUBLIC_DEBUG_MODE=${config.extra.debugMode}
EXPO_PUBLIC_PERFORMANCE_MONITORING=${config.extra.performanceMonitoring}

# Marine Configuration
EXPO_PUBLIC_ENABLE_OFFLINE_MAPS=${env !== 'development'}
EXPO_PUBLIC_ENABLE_WEATHER_OVERLAY=true
EXPO_PUBLIC_ENABLE_TIDE_DATA=true
EXPO_PUBLIC_ENABLE_3D_NAVIGATION=true
EXPO_PUBLIC_ENABLE_DEPTH_PREDICTION=${env === 'production'}

# Performance Settings
EXPO_PUBLIC_MAX_LOCATION_HISTORY=${env === 'production' ? 50000 : 10000}
EXPO_PUBLIC_MAP_TILE_CACHE_SIZE=${env === 'production' ? 524288000 : 104857600}
EXPO_PUBLIC_DEPTH_DATA_CACHE_TTL=300
EXPO_PUBLIC_WEATHER_DATA_CACHE_TTL=1800

# Safety Settings
EXPO_PUBLIC_DEFAULT_SAFETY_MARGIN=0.5
EXPO_PUBLIC_DEFAULT_VESSEL_DRAFT=1.5
EXPO_PUBLIC_DEPTH_ALERT_THRESHOLD=2.0

# Build Information
EXPO_PUBLIC_BUILD_VERSION=${process.env.GITHUB_SHA || 'local'}
EXPO_PUBLIC_BUILD_TIMESTAMP=${new Date().toISOString()}
EXPO_PUBLIC_BUILD_NUMBER=${process.env.GITHUB_RUN_NUMBER || '1'}
`;

  const envPath = path.join(__dirname, '..', 'WavesDemo', '.env');
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Created .env file for ${env} environment`);
}

function validateConfiguration() {
  const requiredEnvVars = [
    'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.warn('The app may not function correctly without these variables');
  }
  
  if (process.env.EXPO_PROJECT_ID) {
    console.log(`✅ Expo project ID configured: ${process.env.EXPO_PROJECT_ID}`);
  } else {
    console.warn('⚠️  EXPO_PROJECT_ID not set - EAS updates may not work');
  }
}

function main() {
  console.log('🌊 Waves Mobile App Environment Configuration');
  console.log('============================================');
  
  const env = getEnvironment();
  const appConfig = configureApp(env);
  
  writeAppConfig(appConfig);
  createEnvironmentFile(env);
  validateConfiguration();
  
  console.log('');
  console.log('📋 Configuration Summary:');
  console.log(`   Environment: ${env}`);
  console.log(`   App Name: ${appConfig.expo.name}`);
  console.log(`   Bundle ID: ${appConfig.expo.ios?.bundleIdentifier || 'N/A'}`);
  console.log(`   Package: ${appConfig.expo.android?.package || 'N/A'}`);
  console.log(`   API URL: ${appConfig.expo.extra.apiUrl}`);
  console.log(`   Updates Channel: ${appConfig.expo.updates.channel}`);
  console.log('');
  console.log('✨ Mobile app configured successfully!');
}

if (require.main === module) {
  main();
}

module.exports = {
  configureApp,
  ENVIRONMENTS
};