/**
 * 3D Navigation Screen for Marine Navigation
 * Features: 3D map view, route guidance, compass, navigation instruments
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import MapboxGL from '@react-native-mapbox-gl/maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useAppSelector, useAppDispatch} from '@/store';
import {useLocation} from '@/services/location/LocationProvider';
import {
  setNavigationMode,
  startNavigation,
  stopNavigation,
  updateNavigationData,
} from '@/store/slices/navigationSlice';

export const Navigation3DScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useAppSelector(state => state.location);
  const navigation = useAppSelector(state => state.navigation);
  const map = useAppSelector(state => state.map);
  
  const {startLocationTracking} = useLocation();
  
  const [compassHeading, setCompassHeading] = useState(0);
  const [is3DMode, setIs3DMode] = useState(true);

  useEffect(() => {
    // Start high-precision tracking for navigation
    startLocationTracking('navigation');
    dispatch(setNavigationMode('3d'));
  }, []);

  useEffect(() => {
    // Update compass heading from location data
    if (location.currentLocation?.heading) {
      setCompassHeading(location.currentLocation.heading);
    }
  }, [location.currentLocation]);

  const toggle3DMode = () => {
    setIs3DMode(!is3DMode);
    dispatch(setNavigationMode(is3DMode ? '2d' : '3d'));
  };

  const handleStartNavigation = () => {
    Alert.alert(
      'Start Navigation',
      'Select a route to begin navigation',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Demo Route', onPress: startDemoNavigation},
        {text: 'Create Route', onPress: () => console.log('Create route')},
      ],
    );
  };

  const startDemoNavigation = () => {
    // Create a demo route for testing
    const demoRoute = {
      id: 'demo-route-1',
      name: 'Demo Marine Route',
      waypoints: [
        {
          id: 'wp-1',
          latitude: 37.7749,
          longitude: -122.4194,
          name: 'Start Point',
          timestamp: Date.now(),
        },
        {
          id: 'wp-2',
          latitude: 37.8049,
          longitude: -122.4094,
          name: 'Waypoint 1',
          timestamp: Date.now(),
        },
        {
          id: 'wp-3',
          latitude: 37.8249,
          longitude: -122.3994,
          name: 'Destination',
          timestamp: Date.now(),
        },
      ],
      totalDistance: 5.2, // km
      estimatedTime: 2400, // seconds (40 minutes)
      created: Date.now(),
    };

    dispatch(startNavigation(demoRoute));
  };

  const handleStopNavigation = () => {
    Alert.alert(
      'Stop Navigation',
      'Are you sure you want to stop navigation?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Stop', style: 'destructive', onPress: () => dispatch(stopNavigation())},
      ],
    );
  };

  const renderCompass = () => (
    <View style={styles.compassContainer}>
      <View style={[styles.compass, {transform: [{rotate: `-${compassHeading}deg`}]}]}>
        <Icon name="navigation" size={30} color="#FF0000" />
        <Text style={styles.compassText}>N</Text>
      </View>
      <Text style={styles.headingText}>{Math.round(compassHeading)}°</Text>
    </View>
  );

  const renderNavigationInstruments = () => {
    if (!navigation.isNavigating) return null;

    return (
      <View style={styles.instrumentPanel}>
        <View style={styles.instrumentRow}>
          <View style={styles.instrument}>
            <Icon name="crosshairs" size={20} color="#007AFF" />
            <Text style={styles.instrumentLabel}>Distance</Text>
            <Text style={styles.instrumentValue}>
              {navigation.distanceToWaypoint?.toFixed(2) || '--'} nm
            </Text>
          </View>
          
          <View style={styles.instrument}>
            <Icon name="compass-outline" size={20} color="#007AFF" />
            <Text style={styles.instrumentLabel}>Bearing</Text>
            <Text style={styles.instrumentValue}>
              {navigation.bearingToWaypoint ? Math.round(navigation.bearingToWaypoint) : '--'}°
            </Text>
          </View>
        </View>

        <View style={styles.instrumentRow}>
          <View style={styles.instrument}>
            <Icon name="clock-outline" size={20} color="#007AFF" />
            <Text style={styles.instrumentLabel}>ETA</Text>
            <Text style={styles.instrumentValue}>
              {navigation.estimatedTimeToArrival 
                ? new Date(Date.now() + navigation.estimatedTimeToArrival * 1000).toLocaleTimeString()
                : '--:--'
              }
            </Text>
          </View>
          
          <View style={styles.instrument}>
            <Icon name="speedometer" size={20} color="#007AFF" />
            <Text style={styles.instrumentLabel}>SOG</Text>
            <Text style={styles.instrumentValue}>
              {navigation.speedOverGround?.toFixed(1) || '0.0'} kts
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderRoute = () => {
    if (!navigation.activeRoute) return null;

    return (
      <MapboxGL.ShapeSource
        id="routeSource"
        shape={{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: navigation.activeRoute.waypoints.map(wp => [wp.longitude, wp.latitude]),
          },
        }}
      >
        <MapboxGL.LineLayer
          id="routeLine"
          style={{
            lineColor: '#007AFF',
            lineWidth: 4,
            lineOpacity: 0.8,
          }}
        />
      </MapboxGL.ShapeSource>
    );
  };

  const renderWaypoints = () => {
    if (!navigation.activeRoute) return null;

    return (
      <MapboxGL.ShapeSource
        id="waypointsSource"
        shape={{
          type: 'FeatureCollection',
          features: navigation.activeRoute.waypoints.map((wp, index) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [wp.longitude, wp.latitude],
            },
            properties: {
              name: wp.name,
              isActive: wp.id === navigation.currentWaypoint?.id,
              index: index,
            },
          })),
        }}
      >
        <MapboxGL.CircleLayer
          id="waypoints"
          style={{
            circleRadius: 8,
            circleColor: ['case', ['get', 'isActive'], '#FF0000', '#007AFF'],
            circleOpacity: 0.9,
            circleStrokeWidth: 2,
            circleStrokeColor: '#FFFFFF',
          }}
        />
      </MapboxGL.ShapeSource>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 3D Map */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL="mapbox://styles/mapbox/navigation-day-v1"
        showUserLocation={true}
        userTrackingMode={MapboxGL.UserTrackingModes.FollowWithHeading}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        pitchEnabled={is3DMode}
        rotateEnabled={true}
      >
        {location.currentLocation && (
          <MapboxGL.Camera
            centerCoordinate={[
              location.currentLocation.longitude,
              location.currentLocation.latitude,
            ]}
            zoomLevel={16}
            pitch={is3DMode ? 60 : 0}
            heading={compassHeading}
            animationDuration={1000}
          />
        )}
        
        {renderRoute()}
        {renderWaypoints()}
        
        <MapboxGL.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
          minDisplacement={1}
        />
      </MapboxGL.MapView>

      {/* Header with compass */}
      <View style={styles.header}>
        {renderCompass()}
        <View style={styles.headerInfo}>
          <Text style={styles.title}>3D Navigation</Text>
          {navigation.currentWaypoint && (
            <Text style={styles.subtitle}>
              To: {navigation.currentWaypoint.name}
            </Text>
          )}
        </View>
      </View>

      {/* Navigation instruments */}
      {renderNavigationInstruments()}

      {/* Control buttons */}
      <View style={styles.controlBar}>
        <TouchableOpacity
          style={[styles.controlButton, is3DMode && styles.activeButton]}
          onPress={toggle3DMode}
        >
          <Icon name={is3DMode ? "rotate-3d" : "map-outline"} size={24} color="#FFFFFF" />
          <Text style={styles.controlButtonText}>
            {is3DMode ? '3D' : '2D'}
          </Text>
        </TouchableOpacity>

        {navigation.isNavigating ? (
          <TouchableOpacity
            style={[styles.controlButton, styles.stopButton]}
            onPress={handleStopNavigation}
          >
            <Icon name="stop" size={24} color="#FFFFFF" />
            <Text style={styles.controlButtonText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.controlButton, styles.startButton]}
            onPress={handleStartNavigation}
          >
            <Icon name="play" size={24} color="#FFFFFF" />
            <Text style={styles.controlButtonText}>Start</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.controlButton}>
          <Icon name="routes" size={24} color="#FFFFFF" />
          <Text style={styles.controlButtonText}>Routes</Text>
        </TouchableOpacity>
      </View>
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
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 31, 63, 0.9)',
    borderRadius: 10,
    padding: 15,
  },
  compassContainer: {
    alignItems: 'center',
    marginRight: 15,
  },
  compass: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  compassText: {
    position: 'absolute',
    top: 2,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  headingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#B0B0B0',
    fontSize: 14,
    marginTop: 2,
  },
  instrumentPanel: {
    position: 'absolute',
    top: 140,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 31, 63, 0.9)',
    borderRadius: 10,
    padding: 15,
  },
  instrumentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  instrument: {
    alignItems: 'center',
    flex: 1,
  },
  instrumentLabel: {
    color: '#B0B0B0',
    fontSize: 12,
    marginTop: 2,
  },
  instrumentValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  controlBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    backgroundColor: 'rgba(0, 31, 63, 0.9)',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    minWidth: 80,
  },
  activeButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
  },
  startButton: {
    backgroundColor: 'rgba(0, 200, 0, 0.8)',
  },
  stopButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});