/**
 * Main Map Screen for Marine Navigation
 * Features: Live position, depth overlay, marine charts, weather data
 */

import React, {useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import MapboxGL from '@react-native-mapbox-gl/maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useAppSelector, useAppDispatch} from '@/store';
import {useLocation} from '@/services/location/LocationProvider';
import {useMapbox} from '@/services/maps/MapboxProvider';
import {
  setFollowUser,
  toggleDepthReadings,
  toggleWeatherOverlay,
  setMapStyle,
} from '@/store/slices/mapSlice';

export const MapScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useAppSelector(state => state.location);
  const map = useAppSelector(state => state.map);
  const depth = useAppSelector(state => state.depth);
  
  const {requestLocationPermission, startLocationTracking} = useLocation();
  const {isMapReady} = useMapbox();
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
    initializeMap();
  }, []);

  const initializeMap = async () => {
    try {
      // Request location permission
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        // Start location tracking in active mode for map
        startLocationTracking('active');
      } else {
        Alert.alert(
          'Location Permission Required',
          'Waves needs location access to show your position on the marine chart.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Request Again', onPress: initializeMap},
          ],
        );
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const handleMapLoad = () => {
    setIsMapLoaded(true);
  };

  const handleFollowUserPress = () => {
    dispatch(setFollowUser(!map.followUser));
  };

  const handleDepthToggle = () => {
    dispatch(toggleDepthReadings());
  };

  const handleWeatherToggle = () => {
    dispatch(toggleWeatherOverlay());
  };

  const handleMapStyleToggle = () => {
    const styles = ['marine', 'satellite', 'hybrid'] as const;
    const currentIndex = styles.indexOf(map.mapStyle);
    const nextStyle = styles[(currentIndex + 1) % styles.length];
    dispatch(setMapStyle(nextStyle));
  };

  const renderUserLocation = () => {
    if (!location.currentLocation) return null;

    return (
      <MapboxGL.UserLocation
        visible={true}
        showsUserHeadingIndicator={true}
        minDisplacement={5}
        androidRenderMode="gps"
        iosShowsUserLocation={false}
      />
    );
  };

  const renderDepthReadings = () => {
    if (!map.showDepthReadings || depth.nearbyReadings.length === 0) return null;

    return (
      <MapboxGL.ShapeSource
        id="depthReadingsSource"
        shape={{
          type: 'FeatureCollection',
          features: depth.nearbyReadings.map(reading => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [reading.longitude, reading.latitude],
            },
            properties: {
              depth: reading.depth,
              confidence: reading.confidenceScore,
              source: reading.source,
            },
          })),
        }}
      >
        <MapboxGL.CircleLayer
          id="depthReadings"
          style={{
            circleRadius: 6,
            circleColor: [
              'interpolate',
              ['linear'],
              ['get', 'depth'],
              0, '#FF0000', // Shallow - red
              2, '#FFA500', // Caution - orange
              5, '#FFFF00', // Moderate - yellow
              10, '#00FF00', // Safe - green
              20, '#0000FF', // Deep - blue
            ],
            circleOpacity: 0.8,
            circleStrokeWidth: 2,
            circleStrokeColor: '#FFFFFF',
          }}
        />
      </MapboxGL.ShapeSource>
    );
  };

  if (!isMapReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading Marine Charts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#001F3F" />
      
      {/* Map Container */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL={`mapbox://styles/mapbox/${
          map.mapStyle === 'marine' ? 'light-v11' :
          map.mapStyle === 'satellite' ? 'satellite-streets-v12' :
          'satellite-v9'
        }`}
        onDidFinishLoadingMap={handleMapLoad}
        showUserLocation={false} // We'll handle this manually
        userTrackingMode={map.followUser ? MapboxGL.UserTrackingModes.Follow : MapboxGL.UserTrackingModes.None}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        {renderUserLocation()}
        {renderDepthReadings()}
        
        {/* Current location camera */}
        {location.currentLocation && map.followUser && (
          <MapboxGL.Camera
            centerCoordinate={[
              location.currentLocation.longitude,
              location.currentLocation.latitude,
            ]}
            zoomLevel={map.zoom}
            animationDuration={1000}
          />
        )}
      </MapboxGL.MapView>

      {/* Header Overlay */}
      <View style={styles.headerOverlay}>
        <Text style={styles.headerTitle}>Marine Chart</Text>
        <View style={styles.headerStats}>
          {location.currentLocation && (
            <>
              <Text style={styles.statText}>
                Speed: {location.currentLocation.speed?.toFixed(1) || '0.0'} kts
              </Text>
              <Text style={styles.statText}>
                Depth: {depth.currentDepth?.toFixed(1) || '--'} m
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Control Panel */}
      <View style={styles.controlPanel}>
        <TouchableOpacity
          style={[styles.controlButton, map.followUser && styles.controlButtonActive]}
          onPress={handleFollowUserPress}
        >
          <Icon name="crosshairs-gps" size={24} color={map.followUser ? '#007AFF' : '#FFFFFF'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, map.showDepthReadings && styles.controlButtonActive]}
          onPress={handleDepthToggle}
        >
          <Icon name="waves" size={24} color={map.showDepthReadings ? '#007AFF' : '#FFFFFF'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, map.showWeatherOverlay && styles.controlButtonActive]}
          onPress={handleWeatherToggle}
        >
          <Icon name="weather-partly-cloudy" size={24} color={map.showWeatherOverlay ? '#007AFF' : '#FFFFFF'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleMapStyleToggle}
        >
          <Icon name="layers" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Safety Alert */}
      {depth.currentDepth !== null && depth.currentDepth < depth.minSafeDepth && (
        <View style={styles.safetyAlert}>
          <Icon name="alert" size={20} color="#FF0000" />
          <Text style={styles.alertText}>
            Shallow Water! Depth: {depth.currentDepth.toFixed(1)}m
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#001F3F',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 31, 63, 0.9)',
    borderRadius: 10,
    padding: 15,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  controlPanel: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: [{translateY: -100}],
  },
  controlButton: {
    backgroundColor: 'rgba(0, 31, 63, 0.9)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  controlButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
  },
  safetyAlert: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#FF0000',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});