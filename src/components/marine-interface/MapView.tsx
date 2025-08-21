/**
 * MapView Component - 2D Marine Navigation Interface
 * Optimized for marine conditions with depth color coding
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, Dimensions, Alert, Platform } from 'react-native';
import MapboxGL from '@react-native-mapbox-gl/maps';
import { useSelector, useDispatch } from 'react-redux';

import { DepthColors, DepthColorCalculator } from '../../utils/DepthColorSystem';
import { MarineUIAdapter } from '../../utils/MarineUIAdapter';
import { BatteryOptimizer } from '../../utils/BatteryOptimizer';
import DepthOverlay from './DepthOverlay';
import RouteOverlay from './RouteOverlay';
import UserLocationIndicator from './UserLocationIndicator';
import SafetyAlertsOverlay from './SafetyAlertsOverlay';
import NavigationControls from './NavigationControls';

interface MapViewProps {
  userLocation: Location;
  depthData: DepthReading[];
  route: NavigationRoute | null;
  displayMode: 'standard' | '3d_preview';
  onDepthTap: (reading: DepthReading) => void;
  onRouteRequest: (destination: Location) => void;
  onModeSwitch: (mode: 'map' | '3d' | 'split') => void;
}

interface Location {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

interface DepthReading {
  id: string;
  location: Location;
  depth: number;
  confidence: number;
  timestamp: Date;
  source: 'user' | 'official' | 'sensor';
  vesselDraft?: number;
}

interface NavigationRoute {
  id: string;
  waypoints: Location[];
  distance: number;
  estimatedTime: number;
  safetyScore: number;
  hazardWarnings: HazardWarning[];
  confidenceLevel: number;
}

interface HazardWarning {
  id: string;
  type: 'shallow' | 'obstacle' | 'current' | 'weather';
  location: Location;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

const { width, height } = Dimensions.get('window');

const WavesMapView: React.FC<MapViewProps> = ({
  userLocation,
  depthData,
  route,
  displayMode,
  onDepthTap,
  onRouteRequest,
  onModeSwitch
}) => {
  const dispatch = useDispatch();
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  
  // Redux state
  const userPreferences = useSelector((state: any) => state.user.depthPreferences);
  const marineConditions = useSelector((state: any) => state.environment.conditions);
  const batteryLevel = useSelector((state: any) => state.device.batteryLevel);
  const safetyAlerts = useSelector((state: any) => state.safety.alerts);

  // Component state
  const [viewState, setViewState] = useState({
    zoom: 14,
    pitch: displayMode === '3d_preview' ? 45 : 0,
    bearing: userLocation.heading || 0
  });
  const [mapBounds, setMapBounds] = useState<number[]>([]);
  const [isFollowingUser, setIsFollowingUser] = useState(true);

  // Utility classes
  const depthCalculator = useMemo(() => new DepthColorCalculator(), []);
  const uiAdapter = useMemo(() => new MarineUIAdapter(), []);
  const batteryOptimizer = useMemo(() => new BatteryOptimizer(), []);

  // Adapt UI for marine conditions
  useEffect(() => {
    uiAdapter.adaptForConditions(marineConditions);
  }, [marineConditions, uiAdapter]);

  // Optimize for battery level
  useEffect(() => {
    batteryOptimizer.optimizeForBatteryLevel(batteryLevel);
  }, [batteryLevel, batteryOptimizer]);

  // Generate depth-colored GeoJSON
  const depthGeoJSON = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: depthData.map(reading => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [reading.location.longitude, reading.location.latitude]
        },
        properties: {
          depth: reading.depth,
          confidence: reading.confidence,
          color: depthCalculator.calculateDepthColor(
            reading.depth,
            {
              vesselDraft: userPreferences.vesselDraft,
              safetyMargin: userPreferences.safetyMargin,
              tideCorrection: 0, // TODO: Get from tide service
              confidenceThreshold: userPreferences.confidenceFilter
            },
            reading.confidence
          ),
          timestamp: reading.timestamp.getTime(),
          source: reading.source
        }
      }))
    };
  }, [depthData, userPreferences, depthCalculator]);

  // MapBox style configuration
  const mapStyle = useMemo(() => {
    const baseStyle = displayMode === '3d_preview' ? 'mapbox://styles/mapbox/satellite-v9' : 'mapbox://styles/mapbox/outdoors-v11';
    
    return {
      version: 8,
      sources: {
        'mapbox-style': {
          type: 'raster',
          url: baseStyle
        },
        'depth-data': {
          type: 'geojson',
          data: depthGeoJSON,
          cluster: viewState.zoom < 12,
          clusterMaxZoom: 14,
          clusterRadius: 50,
          clusterProperties: {
            'avg_depth': ['/', ['+', ['get', 'depth']], ['get', 'point_count']],
            'avg_confidence': ['/', ['+', ['get', 'confidence']], ['get', 'point_count']]
          }
        },
        'nautical-charts': {
          type: 'raster',
          tiles: ['https://seamlessrnc.nauticalcharts.noaa.gov/arcgis/services/RNC/NOAA_RNC/MapServer/WMSServer?bbox={bbox-epsg-3857}&format=image/png&service=WMS&version=1.1.1&request=GetMap&srs=EPSG:3857&transparent=true&width=256&height=256&layers=0'],
          tileSize: 256
        }
      },
      layers: [
        // Base layer
        {
          id: 'base',
          type: 'raster',
          source: 'mapbox-style'
        },
        // Nautical charts overlay
        {
          id: 'nautical-overlay',
          type: 'raster',
          source: 'nautical-charts',
          layout: {
            visibility: userPreferences.showOfficialCharts ? 'visible' : 'none'
          },
          paint: {
            'raster-opacity': 0.6
          }
        },
        // Depth clusters
        {
          id: 'depth-clusters',
          type: 'circle',
          source: 'depth-data',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'avg_depth'],
              DepthColors.DANGER_RED,
              userPreferences.vesselDraft + userPreferences.safetyMargin,
              DepthColors.CAUTION_YELLOW,
              (userPreferences.vesselDraft + userPreferences.safetyMargin) * 1.5,
              DepthColors.SAFE_GREEN
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              15,
              10, 20,
              30, 25,
              100, 30
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
            'circle-opacity': 0.8
          }
        },
        // Individual depth points
        {
          id: 'depth-points',
          type: 'circle',
          source: 'depth-data',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'confidence'],
              0.3, 4,
              1.0, 12
            ],
            'circle-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'confidence'],
              0.3, 0.4,
              1.0, 0.8
            ],
            'circle-stroke-width': [
              'case',
              ['>', ['get', 'confidence'], 0.7],
              2,
              1
            ],
            'circle-stroke-color': [
              'case',
              ['>', ['get', 'confidence'], 0.7],
              '#FFFFFF',
              '#CCCCCC'
            ]
          }
        },
        // Depth labels for high zoom
        {
          id: 'depth-labels',
          type: 'symbol',
          source: 'depth-data',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'text-field': [
              'format',
              ['round', ['get', 'depth'], 1], 'm'
            ],
            'text-font': ['Arial Bold', 'sans-serif'],
            'text-size': 10,
            'text-offset': [0, 2],
            'text-anchor': 'top'
          },
          paint: {
            'text-color': '#FFFFFF',
            'text-halo-color': '#000000',
            'text-halo-width': 1
          },
          minzoom: 16
        }
      ]
    };
  }, [depthGeoJSON, displayMode, viewState.zoom, userPreferences]);

  // Handle map press events
  const handleMapPress = useCallback((event: any) => {
    const { geometry, properties } = event;
    
    if (properties && properties.cluster) {
      // Zoom to cluster
      cameraRef.current?.setCamera({
        centerCoordinate: geometry.coordinates,
        zoomLevel: viewState.zoom + 2,
        animationDuration: 500
      });
    } else if (properties && properties.depth) {
      // Show depth details
      onDepthTap({
        id: properties.id || 'unknown',
        location: {
          latitude: geometry.coordinates[1],
          longitude: geometry.coordinates[0]
        },
        depth: properties.depth,
        confidence: properties.confidence,
        timestamp: new Date(properties.timestamp),
        source: properties.source
      });
    } else {
      // Request route to this location
      onRouteRequest({
        latitude: geometry.coordinates[1],
        longitude: geometry.coordinates[0]
      });
    }
  }, [viewState.zoom, onDepthTap, onRouteRequest]);

  // Handle camera changes
  const handleCameraChanged = useCallback((state: any) => {
    setViewState({
      zoom: state.zoomLevel,
      pitch: state.pitch,
      bearing: state.heading
    });
    
    // Update map bounds for overlay components
    if (state.bounds) {
      setMapBounds([
        state.bounds.ne[0], state.bounds.ne[1],
        state.bounds.sw[0], state.bounds.sw[1]
      ]);
    }
    
    // Disable following if user manually moves map
    if (!state.isUserInteraction) {
      setIsFollowingUser(false);
    }
  }, []);

  // Center on user location
  const centerOnUser = useCallback(() => {
    cameraRef.current?.setCamera({
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      zoomLevel: 16,
      bearing: userLocation.heading || 0,
      animationDuration: 1000
    });
    setIsFollowingUser(true);
  }, [userLocation]);

  // Auto-follow user if enabled
  useEffect(() => {
    if (isFollowingUser && userLocation) {
      cameraRef.current?.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        bearing: userLocation.heading || viewState.bearing,
        animationDuration: 500
      });
    }
  }, [userLocation, isFollowingUser, viewState.bearing]);

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        onPress={handleMapPress}
        onCameraChanged={handleCameraChanged}
        compassEnabled={true}
        rotateEnabled={true}
        pitchEnabled={displayMode === '3d_preview'}
        scrollEnabled={true}
        zoomEnabled={true}
        showUserLocation={false} // We handle this with custom component
        userTrackingMode={MapboxGL.UserTrackingModes.None}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={viewState.zoom}
          pitch={viewState.pitch}
          heading={viewState.bearing}
          centerCoordinate={[userLocation.longitude, userLocation.latitude]}
        />
        
        {/* Custom map style with depth layers */}
        <MapboxGL.StyleSheet style={mapStyle} />
        
        {/* Depth data overlay */}
        <DepthOverlay 
          depthReadings={depthData}
          userPreferences={userPreferences}
          bounds={mapBounds}
          zoomLevel={viewState.zoom}
        />
        
        {/* Route visualization */}
        {route && (
          <RouteOverlay 
            route={route}
            depthConstraints={{
              vesselDraft: userPreferences.vesselDraft,
              safetyMargin: userPreferences.safetyMargin,
              tideCorrection: 0,
              confidenceThreshold: userPreferences.confidenceFilter
            }}
            currentPosition={userLocation}
          />
        )}
        
        {/* User location and heading indicator */}
        <UserLocationIndicator 
          location={userLocation}
          isFollowing={isFollowingUser}
          vesselDraft={userPreferences.vesselDraft}
        />
        
        {/* Safety alerts overlay */}
        <SafetyAlertsOverlay 
          alerts={safetyAlerts}
          userLocation={userLocation}
          onAlertPress={(alert) => {
            Alert.alert(
              `${alert.severity.toUpperCase()} Alert`,
              alert.description,
              [
                { text: 'Dismiss', style: 'cancel' },
                { text: 'Navigate Away', onPress: () => onRouteRequest(alert.suggestedLocation) }
              ]
            );
          }}
        />
      </MapboxGL.MapView>
      
      {/* Navigation controls overlay */}
      <NavigationControls
        style={styles.controls}
        onCenterUser={centerOnUser}
        onModeSwitch={onModeSwitch}
        onZoomIn={() => cameraRef.current?.setCamera({ zoomLevel: viewState.zoom + 1 })}
        onZoomOut={() => cameraRef.current?.setCamera({ zoomLevel: viewState.zoom - 1 })}
        currentMode="map"
        isFollowingUser={isFollowingUser}
        batteryLevel={batteryLevel}
        signalStrength={0.8} // TODO: Get from device
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a'
  },
  map: {
    flex: 1
  },
  controls: {
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 50 : 30,
    bottom: 100
  }
});

export default WavesMapView;