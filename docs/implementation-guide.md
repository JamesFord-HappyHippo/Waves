# Marine Interface Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the Waves marine interface design system, including setup, integration, and customization.

## Quick Start

### 1. Install Dependencies

```bash
npm install @react-native-mapbox-gl/maps
npm install @react-three/fiber @react-three/drei
npm install react-native-vector-icons
npm install @react-native-community/geolocation
npm install @react-native-async-storage/async-storage
npm install react-native-device-info
npm install @react-native-community/netinfo
```

### 2. Platform Setup

#### iOS Setup

Add to `ios/Podfile`:
```ruby
pod 'RNMBGL', :path => '../node_modules/@react-native-mapbox-gl/maps'
```

Add MapBox access token to `Info.plist`:
```xml
<key>MBXAccessToken</key>
<string>YOUR_MAPBOX_ACCESS_TOKEN</string>
```

#### Android Setup

Add to `android/app/build.gradle`:
```gradle
implementation 'com.mapbox.mapboxsdk:mapbox-android-sdk:9.6.0'
```

Add MapBox access token to `strings.xml`:
```xml
<string name="mapbox_access_token">YOUR_MAPBOX_ACCESS_TOKEN</string>
```

### 3. Basic Integration

```typescript
import React from 'react';
import ViewModeController from './src/components/marine-interface/ViewModeController';
import { Provider } from 'react-redux';
import { store } from './src/store';

const App = () => {
  return (
    <Provider store={store}>
      <ViewModeController
        userLocation={{
          latitude: 37.7749,
          longitude: -122.4194,
          heading: 0,
          speed: 5
        }}
        depthData={[]}
        route={null}
        onRouteRequest={(destination) => console.log('Route to:', destination)}
        onDepthTap={(reading) => console.log('Depth tap:', reading)}
      />
    </Provider>
  );
};

export default App;
```

## Component Architecture

### Core Components

1. **ViewModeController** - Main container managing view transitions
2. **WavesMapView** - 2D map interface with depth overlays
3. **Guidance3DView** - 3D underwater terrain visualization
4. **NavigationControls** - Marine-optimized control interface

### Utility Classes

1. **DepthColorCalculator** - Calculates safety colors for depth readings
2. **MarineUIAdapter** - Adapts interface for marine conditions
3. **SafetySystem** - Grounding prevention and safety alerts
4. **ContextAnalyzer** - Intelligent mode switching recommendations

## Configuration

### User Preferences

```typescript
interface UserDepthPreferences {
  vesselDraft: number;        // Vessel draft in meters
  safetyMargin: number;       // Safety clearance in meters
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  displayMode: 'standard' | 'high_contrast' | 'night';
  confidenceFilter: number;   // Minimum data confidence (0.3-0.9)
  allowAutoModeSwitch: boolean;
  defaultViewMode: 'map' | '3d' | 'split';
}
```

### Marine Conditions

```typescript
interface MarineConditions {
  sunGlare: 'none' | 'moderate' | 'severe';
  motion: 'calm' | 'moderate' | 'rough';
  visibility: 'excellent' | 'good' | 'poor';
  spray: boolean;
  windSpeed: number;    // knots
  seaState: number;     // 0-9 scale
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
}
```

### Depth Color Thresholds

```typescript
// Configure depth safety thresholds
const depthCalculator = new DepthColorCalculator({
  contrast: 'high',           // For bright sunlight
  brightness: 1.5,           // Increased visibility
  colorBlindness: 'none'     // Standard colors
});

const thresholds: DepthThresholds = {
  vesselDraft: 2.0,          // 2 meter draft
  safetyMargin: 1.5,         // 1.5 meter safety margin
  tideCorrection: 0,         // Real-time tide data
  confidenceThreshold: 0.6   // 60% minimum confidence
};
```

## Customization

### Color Scheme Customization

```typescript
// Custom color palette for specific conditions
const CustomDepthColors = {
  ...DepthColors,
  SAFE_GREEN: '#00E676',      // Brighter green for sunlight
  CAUTION_YELLOW: '#FF8F00',  // More orange for visibility
  DANGER_RED: '#D32F2F'       // Deeper red for urgency
};
```

### Marine UI Adaptations

```typescript
const uiAdapter = new MarineUIAdapter();

// Adapt for severe sun glare
uiAdapter.adaptForConditions({
  sunGlare: 'severe',
  motion: 'moderate',
  visibility: 'good',
  spray: false,
  windSpeed: 12,
  seaState: 3,
  timeOfDay: 'day'
});
```

### Safety System Configuration

```typescript
const safetySystem = new GroundingPrevention();

// Configure alert thresholds
const customThresholds = {
  emergency: { depthRatio: 0.7, timeSeconds: 10 },  // More aggressive
  critical: { depthRatio: 0.85, timeSeconds: 20 },
  caution: { depthRatio: 1.1, timeSeconds: 90 },
  warning: { depthRatio: 1.3, timeSeconds: 240 }
};
```

## Data Integration

### Depth Data Format

```typescript
interface DepthReading {
  id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  depth: number;              // Meters below surface
  confidence: number;         // 0-1 confidence score
  timestamp: Date;
  source: 'user' | 'official' | 'sensor';
  vesselDraft?: number;       // Draft of measuring vessel
  tideCorrection?: number;    // Applied tide correction
  conditions?: {
    seaState: number;
    visibility: string;
    weather: string;
  };
}
```

### Real-time Updates

```typescript
// Subscribe to depth data updates
const subscription = depthDataStream.subscribe(newReadings => {
  dispatch(updateDepthData(newReadings));
});

// GPS location updates
Geolocation.watchPosition(
  position => {
    dispatch(updateUserLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      heading: position.coords.heading,
      speed: position.coords.speed,
      accuracy: position.coords.accuracy
    }));
  },
  error => console.error('GPS Error:', error),
  {
    enableHighAccuracy: true,
    distanceFilter: 5,        // Update every 5 meters
    interval: 2000,           // Check every 2 seconds
    fastestInterval: 1000
  }
);
```

### API Integration

```typescript
// Fetch official nautical chart data
const fetchOfficialData = async (bounds: MapBounds) => {
  const response = await fetch(
    `https://seamlessrnc.nauticalcharts.noaa.gov/arcgis/services/RNC/NOAA_RNC/MapServer/export?` +
    `bbox=${bounds.west},${bounds.south},${bounds.east},${bounds.north}&` +
    `bboxSR=4326&imageSR=4326&size=512,512&format=png&f=json`
  );
  
  return response.json();
};

// Tide data integration
const fetchTideData = async (location: Location) => {
  const response = await fetch(
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
    `product=predictions&datum=MLLW&time_zone=lst_ldt&units=metric&` +
    `lat=${location.latitude}&lon=${location.longitude}&format=json`
  );
  
  return response.json();
};
```

## Performance Optimization

### Battery Optimization

```typescript
const batteryOptimizer = new BatteryOptimizer();

// Monitor battery level and adapt
DeviceInfo.getBatteryLevel().then(level => {
  if (level < 0.3) {
    // Enable power saving mode
    batteryOptimizer.enablePowerSaving({
      reducedRendering: true,
      lowerGPSFrequency: true,
      disableAnimations: true,
      dimScreen: true
    });
  }
});
```

### Memory Management

```typescript
// Limit depth data in memory
const MAX_DEPTH_POINTS = 10000;
const MAX_DATA_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const optimizeDepthData = (depthData: DepthReading[]) => {
  return depthData
    .filter(reading => 
      Date.now() - reading.timestamp.getTime() < MAX_DATA_AGE_MS
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_DEPTH_POINTS);
};
```

### Rendering Optimization

```typescript
// Adaptive rendering quality
const getRenderQuality = (batteryLevel: number, devicePerformance: string) => {
  if (batteryLevel < 0.2) return 'low';
  if (devicePerformance === 'low') return 'medium';
  return 'high';
};

// LOD (Level of Detail) for 3D terrain
const calculateLOD = (distance: number, zoomLevel: number) => {
  if (distance > 1000 || zoomLevel < 12) return 4; // Low detail
  if (distance > 500 || zoomLevel < 14) return 2;  // Medium detail
  return 1; // High detail
};
```

## Testing

### Unit Tests

```typescript
// DepthColorCalculator tests
describe('DepthColorCalculator', () => {
  const calculator = new DepthColorCalculator();
  
  test('should return danger color for shallow water', () => {
    const color = calculator.calculateDepthColor(
      1.0, // 1 meter depth
      { vesselDraft: 2.0, safetyMargin: 1.0, tideCorrection: 0, confidenceThreshold: 0.5 },
      0.8  // 80% confidence
    );
    expect(color).toBe(DepthColors.DANGER_RED);
  });
  
  test('should return safe color for deep water', () => {
    const color = calculator.calculateDepthColor(
      10.0, // 10 meter depth
      { vesselDraft: 2.0, safetyMargin: 1.0, tideCorrection: 0, confidenceThreshold: 0.5 },
      0.8
    );
    expect(color).toBe(DepthColors.SAFE_GREEN);
  });
});
```

### Integration Tests

```typescript
// Marine UI Adapter tests
describe('MarineUIAdapter', () => {
  const adapter = new MarineUIAdapter();
  
  test('should adapt for severe sun glare', () => {
    const adaptations = adapter.adaptForConditions({
      sunGlare: 'severe',
      motion: 'calm',
      visibility: 'good',
      spray: false,
      windSpeed: 5,
      seaState: 1,
      timeOfDay: 'day'
    });
    
    expect(adaptations.brightness).toBeGreaterThan(1.5);
    expect(adaptations.contrast).toBeGreaterThan(1.5);
    expect(adaptations.colorMode).toBe('high_contrast');
  });
});
```

### Device Testing

```bash
# Test on various screen sizes and orientations
npm run test:device -- --device="iPhone 12 Pro"
npm run test:device -- --device="iPad Pro"
npm run test:device -- --device="Samsung Galaxy S21"

# Test marine conditions simulation
npm run test:marine-conditions -- --glare=severe --motion=rough
```

## Deployment

### Environment Configuration

```typescript
// Production environment
const config = {
  API_BASE_URL: 'https://api.wavesapp.com',
  MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN,
  NOAA_API_KEY: process.env.NOAA_API_KEY,
  SENTRY_DSN: process.env.SENTRY_DSN,
  
  // Marine-specific settings
  DEFAULT_SAFETY_MARGIN: 1.5,
  MAX_DEPTH_DATA_AGE: 24 * 60 * 60 * 1000,
  GPS_UPDATE_INTERVAL: 2000,
  BATTERY_SAVE_THRESHOLD: 0.3,
  
  // Performance tuning
  RENDER_QUALITY_AUTO: true,
  MAX_CONCURRENT_REQUESTS: 5,
  CACHE_SIZE_MB: 50
};
```

### Store Submission

#### iOS App Store

1. Configure Info.plist:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Waves needs location access for marine navigation and depth data collection</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Background location is needed for continuous navigation tracking</string>
```

2. Add marine safety warnings in App Store description:
   - "Not for primary navigation - verify with official charts"
   - "Crowdsourced depth data for reference only"
   - "Always maintain proper marine safety practices"

#### Android Play Store

1. Configure permissions in `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.VIBRATE" />
```

2. Include marine safety disclaimers and data usage policies.

## Monitoring and Analytics

### Performance Monitoring

```typescript
// Track key marine navigation metrics
const trackNavigationMetrics = {
  depthDataAccuracy: (predicted: number, actual: number) => {
    const accuracy = 1 - Math.abs(predicted - actual) / actual;
    analytics.track('depth_prediction_accuracy', { accuracy });
  },
  
  safetyAlertResponse: (alertId: string, userAction: string, timeToResponse: number) => {
    analytics.track('safety_alert_response', {
      alert_id: alertId,
      user_action: userAction,
      response_time_ms: timeToResponse
    });
  },
  
  modeUsage: (mode: ViewMode, sessionDuration: number, conditions: MarineConditions) => {
    analytics.track('view_mode_usage', {
      mode,
      session_duration_ms: sessionDuration,
      marine_conditions: conditions
    });
  }
};
```

### Error Tracking

```typescript
// Marine-specific error categories
const errorCategories = {
  GPS_ACCURACY_LOW: 'GPS accuracy below safe navigation threshold',
  DEPTH_DATA_STALE: 'Depth data older than safety threshold',
  SAFETY_SYSTEM_OFFLINE: 'Grounding prevention system unavailable',
  CHART_DATA_MISSING: 'Official chart data not available for area'
};

// Automatic error reporting with marine context
Sentry.configureScope(scope => {
  scope.setContext('marine_conditions', marineConditions);
  scope.setContext('vessel_info', vesselInfo);
  scope.setContext('navigation_state', {
    current_mode: viewMode,
    depth_data_count: depthData.length,
    active_alerts: safetyAlerts.length
  });
});
```

## Support and Documentation

### User Documentation

Create comprehensive user guides covering:

1. **Getting Started**
   - Initial setup and vessel configuration
   - Understanding depth color coding
   - Basic navigation patterns

2. **Safety Guidelines**
   - Limitations of crowdsourced data
   - When to rely on official charts
   - Emergency procedures

3. **Advanced Features**
   - 3D terrain visualization
   - Custom safety margins
   - Marine condition adaptations

### Developer Resources

1. **API Documentation** - Complete reference for all components and utilities
2. **Integration Examples** - Sample code for common use cases
3. **Troubleshooting Guide** - Solutions for common implementation issues
4. **Performance Best Practices** - Optimization techniques for marine apps

This implementation guide provides a complete foundation for building the Waves marine interface system. The modular architecture allows for incremental implementation while maintaining consistency and safety standards throughout the application.