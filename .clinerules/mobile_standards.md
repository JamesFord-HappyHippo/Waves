# Mobile Development Standards - Marine Navigation

**Domain**: Marine navigation mobile applications  
**Platform**: React Native with TypeScript  
**Last Updated**: 2025-08-20T00:00:00Z

## Core Mobile Principles

### 1. Safety-Critical Mobile Design
Marine navigation apps have unique safety requirements:
- **Offline-First**: Core navigation features must work without connectivity
- **Battery Optimization**: Extended GPS tracking without draining battery
- **Clear Visual Hierarchy**: Critical safety information must be immediately visible
- **Large Touch Targets**: Usable with wet hands and marine gloves
- **High Contrast**: Readable in bright sunlight and low-light conditions

### 2. React Native Architecture Standards

#### Project Structure ✅
```
src/
├── components/
│   ├── navigation/          # Navigation-specific components
│   │   ├── DepthDisplay.tsx
│   │   ├── RouteViewer.tsx
│   │   └── SafetyAlerts.tsx
│   ├── maps/                # Map and geospatial components
│   └── common/              # Reusable UI components
├── screens/
│   ├── NavigationScreen.tsx
│   ├── VesselSetupScreen.tsx
│   └── SettingsScreen.tsx
├── services/
│   ├── LocationService.ts   # GPS and location handling
│   ├── DepthDataService.ts  # Marine data processing
│   └── OfflineService.ts    # Offline data management
├── utils/
│   ├── marineCalculations.ts
│   └── safetyValidation.ts
└── types/
    ├── navigation.ts
    └── marine.ts
```

#### Core Component Patterns ✅
```typescript
// Marine navigation component template
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { MarineLocation, SafetyStatus } from '../types/navigation';

interface MarineNavigationComponentProps {
  location: MarineLocation;
  vesselDraft: number;
  onSafetyAlert: (alert: SafetyAlert) => void;
}

export const MarineNavigationComponent: React.FC<MarineNavigationComponentProps> = ({
  location,
  vesselDraft,
  onSafetyAlert
}) => {
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus>('unknown');
  
  // Memoize safety calculations for performance
  const calculateSafety = useCallback((loc: MarineLocation, draft: number) => {
    const minDepth = draft + 0.5; // Safety margin
    const estimatedDepth = loc.estimatedDepth;
    
    if (!estimatedDepth) return 'unknown';
    if (estimatedDepth < minDepth) return 'danger';
    if (estimatedDepth < minDepth + 1) return 'caution';
    return 'safe';
  }, []);

  useEffect(() => {
    const status = calculateSafety(location, vesselDraft);
    setSafetyStatus(status);
    
    // Trigger safety alerts for critical conditions
    if (status === 'danger') {
      onSafetyAlert({
        type: 'shallow_water',
        severity: 'critical',
        message: 'SHALLOW WATER - Reduce speed immediately',
        location: location
      });
    }
  }, [location, vesselDraft, calculateSafety, onSafetyAlert]);

  return (
    <View style={[styles.container, styles[`status_${safetyStatus}`]]}>
      <Text style={styles.depthText}>
        {location.estimatedDepth ? `${location.estimatedDepth.toFixed(1)}m` : 'No Data'}
      </Text>
      <Text style={styles.statusText}>{safetyStatus.toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 80,
  },
  status_safe: {
    backgroundColor: '#10B981', // Green
  },
  status_caution: {
    backgroundColor: '#F59E0B', // Amber
  },
  status_danger: {
    backgroundColor: '#EF4444', // Red
  },
  status_unknown: {
    backgroundColor: '#6B7280', // Gray
  },
  depthText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginTop: 4,
  },
});
```

### 3. Location Services & GPS Optimization

#### Efficient Location Tracking ✅
```typescript
// LocationService.ts - Battery-optimized GPS tracking
import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';

export class LocationService {
  private watchId: number | null = null;
  private isTracking = false;
  
  // Adaptive tracking based on speed and conditions
  private getTrackingConfig(speed: number): LocationConfig {
    if (speed > 10) { // High speed (>10 knots)
      return {
        enableHighAccuracy: true,
        distanceFilter: 25,     // Update every 25m
        interval: 3000,         // 3 second intervals
        fastestInterval: 1000,  // Max 1 second
      };
    } else if (speed > 2) { // Normal speed (2-10 knots)
      return {
        enableHighAccuracy: true,
        distanceFilter: 10,     // Update every 10m
        interval: 5000,         // 5 second intervals
        fastestInterval: 2000,  // Max 2 seconds
      };
    } else { // Slow/anchored (< 2 knots)
      return {
        enableHighAccuracy: false, // Save battery when stationary
        distanceFilter: 5,         // Update every 5m
        interval: 10000,           // 10 second intervals
        fastestInterval: 5000,     // Max 5 seconds
      };
    }
  }

  async startTracking(callback: LocationCallback): Promise<void> {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) {
      throw new Error('Location permission denied');
    }

    let lastSpeed = 0;
    let currentConfig = this.getTrackingConfig(0);

    this.watchId = Geolocation.watchPosition(
      (position) => {
        const speed = position.coords.speed || 0;
        
        // Adapt tracking frequency based on speed
        if (Math.abs(speed - lastSpeed) > 2) {
          const newConfig = this.getTrackingConfig(speed);
          if (JSON.stringify(newConfig) !== JSON.stringify(currentConfig)) {
            this.restartTracking(newConfig, callback);
            currentConfig = newConfig;
          }
          lastSpeed = speed;
        }

        // Process location update
        const marineLocation: MarineLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: speed,
          heading: position.coords.heading,
          timestamp: position.timestamp,
          estimatedDepth: this.estimateDepthAtLocation(position.coords),
        };

        callback(marineLocation);
      },
      (error) => {
        console.error('Location error:', error);
        callback(null, error);
      },
      currentConfig
    );

    this.isTracking = true;
  }

  stopTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
  }

  private async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        Geolocation.requestAuthorization('whenInUse').then(resolve);
      });
    }

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Marine Navigation Location Permission',
          message: 'Waves needs location access for safe navigation guidance',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    return false;
  }
}
```

### 4. Offline Data Management

#### Critical Data Caching ✅
```typescript
// OfflineService.ts - Marine data for offline use
import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'react-native-sqlite-storage';

export class OfflineMarineDataService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    this.db = await SQLite.openDatabase({
      name: 'marine_offline.db',
      location: 'default',
    });

    await this.createTables();
  }

  private async createTables(): Promise<void> {
    const createDepthTable = `
      CREATE TABLE IF NOT EXISTS depth_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        depth REAL NOT NULL,
        confidence REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        grid_key TEXT NOT NULL,
        UNIQUE(grid_key)
      );
    `;

    const createRouteTable = `
      CREATE TABLE IF NOT EXISTS cached_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_key TEXT NOT NULL UNIQUE,
        waypoints TEXT NOT NULL,
        safety_score REAL NOT NULL,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `;

    await this.db!.executeSql(createDepthTable);
    await this.db!.executeSql(createRouteTable);
  }

  // Cache depth data in grid cells for efficient querying
  async cacheDepthData(readings: DepthReading[]): Promise<void> {
    const transaction = await this.db!.transaction();
    
    for (const reading of readings) {
      const gridKey = this.generateGridKey(reading.location, 100); // 100m grid
      
      await transaction.executeSql(
        'INSERT OR REPLACE INTO depth_cache (latitude, longitude, depth, confidence, timestamp, grid_key) VALUES (?, ?, ?, ?, ?, ?)',
        [
          reading.location.latitude,
          reading.location.longitude,
          reading.depth,
          reading.confidence,
          reading.timestamp.getTime(),
          gridKey
        ]
      );
    }
  }

  async getCachedDepthData(location: GPSCoordinate, radius: number = 1000): Promise<DepthReading[]> {
    const gridKeys = this.getGridKeysInRadius(location, radius);
    const placeholders = gridKeys.map(() => '?').join(',');
    
    const results = await this.db!.executeSql(
      `SELECT * FROM depth_cache WHERE grid_key IN (${placeholders}) AND timestamp > ?`,
      [...gridKeys, Date.now() - 24 * 60 * 60 * 1000] // Last 24 hours
    );

    return this.formatDepthResults(results[0]);
  }

  private generateGridKey(location: GPSCoordinate, cellSize: number): string {
    // Snap to grid to enable efficient spatial queries
    const lat = Math.floor(location.latitude * 1000000 / cellSize) * cellSize / 1000000;
    const lng = Math.floor(location.longitude * 1000000 / cellSize) * cellSize / 1000000;
    return `${lat.toFixed(6)},${lng.toFixed(6)}`;
  }

  // Prioritize safety-critical data for offline storage
  async ensureSafetyDataCached(location: GPSCoordinate): Promise<void> {
    const priorities = [
      { radius: 500, maxAge: 6 * 60 * 60 * 1000 },   // 500m, 6 hours (immediate area)
      { radius: 2000, maxAge: 12 * 60 * 60 * 1000 }, // 2km, 12 hours (navigation area)
      { radius: 5000, maxAge: 24 * 60 * 60 * 1000 }, // 5km, 24 hours (planning area)
    ];

    for (const priority of priorities) {
      await this.cacheDataInRadius(location, priority.radius, priority.maxAge);
    }
  }
}
```

### 5. Performance Optimization Patterns

#### React Native Performance ✅
```typescript
// Optimized marine components with React.memo and useMemo
import React, { memo, useMemo, useCallback } from 'react';

interface DepthDisplayProps {
  depthReadings: DepthReading[];
  vesselDraft: number;
  location: GPSCoordinate;
}

export const DepthDisplay = memo<DepthDisplayProps>(({
  depthReadings,
  vesselDraft,
  location
}) => {
  // Expensive calculations memoized
  const safetyAnalysis = useMemo(() => {
    return calculateDepthSafety(depthReadings, vesselDraft, location);
  }, [depthReadings, vesselDraft, location]);

  const formattedDepth = useMemo(() => {
    const nearestReading = findNearestDepthReading(depthReadings, location);
    return nearestReading ? `${nearestReading.depth.toFixed(1)}m` : 'No Data';
  }, [depthReadings, location]);

  const safetyColor = useMemo(() => {
    return getSafetyColor(safetyAnalysis.status);
  }, [safetyAnalysis.status]);

  return (
    <View style={[styles.container, { backgroundColor: safetyColor }]}>
      <Text style={styles.depthText}>{formattedDepth}</Text>
      <Text style={styles.safetyText}>{safetyAnalysis.status}</Text>
    </View>
  );
});

// Virtualized lists for large datasets
import { FlatList } from 'react-native';

const renderDepthReading = ({ item }: { item: DepthReading }) => (
  <DepthReadingItem
    reading={item}
    onPress={() => navigateToLocation(item.location)}
  />
);

const keyExtractor = (item: DepthReading) => 
  `${item.location.latitude}-${item.location.longitude}-${item.timestamp.getTime()}`;

export const DepthReadingsList = ({ readings }: { readings: DepthReading[] }) => (
  <FlatList
    data={readings}
    renderItem={renderDepthReading}
    keyExtractor={keyExtractor}
    getItemLayout={(data, index) => ({
      length: 80, // Fixed item height for performance
      offset: 80 * index,
      index,
    })}
    removeClippedSubviews
    maxToRenderPerBatch={10}
    windowSize={10}
    initialNumToRender={20}
  />
);
```

### 6. Safety & User Experience Standards

#### Navigation Safety UI ✅
```typescript
// Safety-focused UI components
export const SafetyAlertModal = ({ alert, onDismiss }: SafetyAlertProps) => {
  const alertStyles = useMemo(() => ({
    backgroundColor: alert.severity === 'critical' ? '#DC2626' : '#F59E0B',
    borderColor: alert.severity === 'critical' ? '#B91C1C' : '#D97706',
  }), [alert.severity]);

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.alertContainer, alertStyles]}>
          <Icon 
            name={alert.severity === 'critical' ? 'warning' : 'info'} 
            size={32} 
            color="white" 
          />
          <Text style={styles.alertTitle}>
            {alert.severity === 'critical' ? 'NAVIGATION ALERT' : 'CAUTION'}
          </Text>
          <Text style={styles.alertMessage}>{alert.message}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.acknowledgeButton} 
              onPress={onDismiss}
            >
              <Text style={styles.buttonText}>ACKNOWLEDGED</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.disclaimer}>
            {NAVIGATION_DISCLAIMER}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

// Large, marine-friendly touch targets
const styles = StyleSheet.create({
  alertContainer: {
    margin: 20,
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  acknowledgeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 32,
    paddingVertical: 16,  // Large touch target for marine use
    borderRadius: 8,
    minWidth: 200,        // Ensure button is large enough
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,         // Large, readable text
    fontWeight: 'bold',
  },
});
```

### 7. Testing Standards

#### Marine-Specific Testing ✅
```typescript
// Testing marine navigation components
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LocationService } from '../services/LocationService';

describe('Marine Navigation Components', () => {
  describe('DepthDisplay', () => {
    it('should show danger status for shallow water', () => {
      const shallowReading: DepthReading = {
        location: { latitude: 40.7128, longitude: -74.0060 },
        depth: 1.5,  // Shallow water
        confidence: 0.8,
        timestamp: new Date(),
        source: 'crowdsourced'
      };

      const { getByText } = render(
        <DepthDisplay 
          depthReadings={[shallowReading]} 
          vesselDraft={2.0}  // Draft deeper than available water
          location={shallowReading.location}
        />
      );

      expect(getByText('DANGER')).toBeTruthy();
    });

    it('should handle offline mode gracefully', async () => {
      const offlineService = new OfflineMarineDataService();
      await offlineService.initialize();
      
      // Simulate network failure
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
      
      const { getByText } = render(
        <DepthDisplay 
          depthReadings={[]} 
          vesselDraft={2.0}
          location={{ latitude: 40.7128, longitude: -74.0060 }}
        />
      );

      await waitFor(() => {
        expect(getByText('No Data')).toBeTruthy();
      });
    });
  });

  describe('LocationService', () => {
    it('should optimize tracking based on vessel speed', async () => {
      const locationService = new LocationService();
      const mockCallback = jest.fn();
      
      // Mock fast-moving vessel
      const fastPosition = {
        coords: { 
          latitude: 40.7128, 
          longitude: -74.0060, 
          speed: 15 // 15 knots - fast
        }
      };
      
      jest.spyOn(Geolocation, 'watchPosition').mockImplementation((callback) => {
        callback(fastPosition);
        return 1;
      });

      await locationService.startTracking(mockCallback);
      
      // Should use high-frequency tracking for fast speeds
      expect(Geolocation.watchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          interval: 3000, // 3 second intervals for high speed
        })
      );
    });
  });
});
```

## Best Practices Summary

1. **Safety-Critical Design**: Navigation accuracy and safety warnings are paramount
2. **Battery Optimization**: Adaptive GPS tracking based on vessel speed and conditions  
3. **Offline-First**: Critical navigation data cached locally for areas without connectivity
4. **Performance**: Memoization, virtualization, and efficient data structures
5. **User Experience**: Large touch targets, high contrast, clear visual hierarchy
6. **Error Handling**: Graceful degradation with clear user guidance
7. **Testing**: Comprehensive testing for safety-critical functionality
8. **Compliance**: Navigation disclaimers and proper data validation

---

**📱 Optimized for marine navigation mobile development** ⚓