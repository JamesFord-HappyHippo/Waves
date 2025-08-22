import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import MarineTestingFramework from '../src/components/marine-testing/MarineTestingFramework';
import EnhancedMarineTestingFramework from '../src/components/marine-testing/EnhancedMarineTestingFramework';
import MarineRegistration from '../src/components/auth/MarineRegistration';
import { MarineSocialAuth } from '../src/auth/marineSocialAuth';

const { width, height } = Dimensions.get('window');

// Real API configuration
const API_BASE_URL = 'https://api-dev.seawater.io';
const DEMO_USER_TOKEN = 'demo-user-token'; // In real app, this comes from Cognito

interface DepthPoint {
  x: number;
  y: number;
  depth: number;
  confidence: number;
  id?: string;
  timestamp?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface MarineWeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  waveHeight?: number;
  conditions: string;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'map' | '3d' | 'depth' | 'settings' | 'profile' | 'testing' | 'emergency-testing'>('map');
  const [currentDepth, setCurrentDepth] = useState(18.5);
  const [vesselDraft, setVesselDraft] = useState(3.2);
  const [gpsAccuracy, setGpsAccuracy] = useState(2.1);
  const [pulseAnim] = useState(new Animated.Value(0));

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = checking
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Real data states
  const [depthPoints, setDepthPoints] = useState<DepthPoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [weatherData, setWeatherData] = useState<MarineWeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Initialize authentication and app
  useEffect(() => {
    initializeAuth();
  }, []);

  // Initialize location and data fetching (only after auth)
  useEffect(() => {
    if (isAuthenticated) {
      initializeApp();
    }
  }, [isAuthenticated]);

  /**
   * Initialize authentication check
   */
  const initializeAuth = async () => {
    try {
      console.log('🔐 Checking authentication status...');
      
      // Check if user is returning from auth callback
      if (MarineSocialAuth.checkSocialRedirect()) {
        console.log('🔄 Processing authentication callback...');
        const result = await MarineSocialAuth.handleMarineAuthCallback();
        
        if (result.success && result.user) {
          setCurrentUser(result.user);
          setIsAuthenticated(true);
          console.log('✅ Authentication completed via callback');
          return;
        }
      }

      // Check existing authentication
      const authenticated = await MarineSocialAuth.isAuthenticated();
      if (authenticated) {
        const user = await MarineSocialAuth.getCurrentUser();
        setCurrentUser(user);
        setIsAuthenticated(true);
        console.log('✅ User already authenticated');
      } else {
        setIsAuthenticated(false);
        console.log('🚪 User not authenticated');
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      setIsAuthenticated(false);
    }
  };

  /**
   * Handle successful registration completion
   */
  const handleRegistrationComplete = async (user: any) => {
    try {
      console.log('🎉 Registration completed for user:', user);
      setCurrentUser(user);
      setIsAuthenticated(true);
      
      // Initialize the app after successful registration
      setTimeout(() => {
        initializeApp();
      }, 1000);
    } catch (error) {
      console.error('Error handling registration completion:', error);
    }
  };
    
    // Pulse animation for GPS indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Real-time depth updates
    const interval = setInterval(() => {
      if (currentLocation) {
        fetchNearbyDepthReadings(currentLocation.latitude, currentLocation.longitude);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [currentLocation]);

  /**
   * Initialize app with location services and data fetching
   */
  const initializeApp = async () => {
    try {
      setIsLoading(true);
      setApiError(null);
      
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setApiError('Location permission is required for marine navigation');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
      };

      setCurrentLocation(locationData);
      setGpsAccuracy(locationData.accuracy / 1000); // Convert to km

      // Fetch initial data
      await Promise.all([
        fetchNearbyDepthReadings(locationData.latitude, locationData.longitude),
        fetchMarineWeather(locationData.latitude, locationData.longitude),
      ]);

    } catch (error) {
      console.error('App initialization error:', error);
      setApiError('Failed to initialize app. Using demo mode.');
      // Fallback to demo data
      loadDemoData();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetch nearby depth readings from real API
   */
  const fetchNearbyDepthReadings = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/depth/readings?latitude=${latitude}&longitude=${longitude}&radius=2000`,
        {
          headers: {
            'Authorization': `Bearer ${DEMO_USER_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data.readings) {
        // Convert API readings to screen coordinates
        const points = data.data.readings.slice(0, 20).map((reading: any, index: number) => ({
          id: reading.id,
          x: 20 + (index % 5) * 15 + Math.random() * 10,
          y: 20 + Math.floor(index / 5) * 20 + Math.random() * 10,
          depth: reading.depth,
          confidence: reading.confidence,
          timestamp: reading.timestamp,
        }));
        
        setDepthPoints(points);
        
        // Update current depth with average of nearby readings
        const avgDepth = data.data.readings.reduce((sum: number, r: any) => sum + r.depth, 0) / data.data.readings.length;
        setCurrentDepth(avgDepth);
      }
    } catch (error) {
      console.error('Failed to fetch depth readings:', error);
      // Keep existing data or load demo data
      if (depthPoints.length === 0) {
        loadDemoData();
      }
    }
  };

  /**
   * Fetch marine weather from real API
   */
  const fetchMarineWeather = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/weather/marine?latitude=${latitude}&longitude=${longitude}&includeTides=true`,
        {
          headers: {
            'Authorization': `Bearer ${DEMO_USER_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Weather API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data.weather) {
        const weather = data.data.weather;
        setWeatherData({
          temperature: weather.current.temperature || 22,
          windSpeed: weather.current.windSpeed || 5,
          windDirection: weather.current.windDirection || 180,
          waveHeight: weather.marine.waveHeight || 1.2,
          conditions: weather.current.conditions || 'Partly cloudy',
        });
      }
    } catch (error) {
      console.error('Failed to fetch weather data:', error);
      // Use default weather data
      setWeatherData({
        temperature: 22,
        windSpeed: 5,
        windDirection: 180,
        waveHeight: 1.2,
        conditions: 'Unknown',
      });
    }
  };

  /**
   * Load demo data when API is unavailable
   */
  const loadDemoData = () => {
    const demoDepthPoints: DepthPoint[] = [
      { x: 20, y: 30, depth: 25, confidence: 0.9, id: 'demo-1' },
      { x: 60, y: 20, depth: 8, confidence: 0.7, id: 'demo-2' },
      { x: 80, y: 60, depth: 32, confidence: 0.95, id: 'demo-3' },
      { x: 30, y: 70, depth: 5, confidence: 0.8, id: 'demo-4' },
      { x: 70, y: 80, depth: 18, confidence: 0.85, id: 'demo-5' },
    ];
    
    setDepthPoints(demoDepthPoints);
    setCurrentDepth(18.5);
    
    setWeatherData({
      temperature: 22,
      windSpeed: 5,
      windDirection: 180,
      waveHeight: 1.2,
      conditions: 'Demo Mode',
    });
  };

  /**
   * Submit new depth reading to API
   */
  const submitDepthReading = async () => {
    if (!currentLocation) {
      Alert.alert('Error', 'Location not available');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/depth/readings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEMO_USER_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          depth: currentDepth,
          confidence: Math.min(0.9, 1.0 - (gpsAccuracy / 10)), // Confidence based on GPS accuracy
          vesselDraft: vesselDraft,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Submit Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Success', 'Depth reading submitted successfully!');
        // Refresh nearby readings
        await fetchNearbyDepthReadings(currentLocation.latitude, currentLocation.longitude);
      } else {
        throw new Error(data.error || 'Submission failed');
      }
    } catch (error) {
      console.error('Failed to submit depth reading:', error);
      Alert.alert('Error', 'Failed to submit depth reading. Please try again.');
    }
  };

  const getDepthColor = (depth: number): string => {
    if (depth > 20) return '#22c55e'; // Green - safe
    if (depth > 10) return '#f59e0b'; // Yellow - caution
    return '#ef4444'; // Red - shallow
  };

  const formatDepth = (depth: number): string => {
    return `${depth.toFixed(1)} ft`;
  };

  const formatCoordinate = (coord: number, type: 'lat' | 'lng'): string => {
    const direction = type === 'lat' ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
    return `${Math.abs(coord).toFixed(6)}° ${direction}`;
  };

  const TabButton: React.FC<{ icon: string; label: string; view: string; active: boolean }> = ({
    icon, label, view, active
  }) => (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={() => setCurrentView(view as any)}
    >
      <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderMapView = () => (
    <View style={styles.mapContainer}>
      {/* Background */}
      <View style={styles.waterBackground} />
      
      {/* Depth points */}
      {depthPoints.map((point, index) => (
        <Animated.View
          key={index}
          style={[
            styles.depthPoint,
            {
              left: `${point.x}%`,
              top: `${point.y}%`,
              backgroundColor: getDepthColor(point.depth),
              opacity: point.confidence,
            }
          ]}
        />
      ))}

      {/* Vessel position */}
      <View style={styles.vesselContainer}>
        <Animated.View
          style={[
            styles.vesselPulse,
            {
              opacity: pulseAnim,
              transform: [{
                scale: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.5]
                })
              }]
            }
          ]}
        />
        <View style={styles.vessel}>
          <Text style={styles.vesselIcon}>⛵</Text>
        </View>
      </View>

      {/* Current depth display */}
      <View style={[styles.depthDisplay, { backgroundColor: getDepthColor(currentDepth) }]}>
        <Text style={styles.depthValue}>{currentDepth.toFixed(1)} ft</Text>
        <Text style={styles.depthLabel}>Current Depth</Text>
      </View>

      {/* Status panel */}
      <View style={styles.statusPanel}>
        <Text style={styles.statusTitle}>⚓ Navigation Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>🚢 Vessel Draft:</Text>
          <Text style={styles.statusValue}>{vesselDraft.toFixed(1)} ft</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>📏 Clearance:</Text>
          <Text style={[
            styles.statusValue,
            { color: (currentDepth - vesselDraft) < 5 ? '#ef4444' : '#22c55e' }
          ]}>
            {(currentDepth - vesselDraft).toFixed(1)} ft
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>🎯 GPS Accuracy:</Text>
          <Text style={[
            styles.statusValue,
            { color: gpsAccuracy > 5 ? '#ef4444' : '#22c55e' }
          ]}>
            ±{gpsAccuracy.toFixed(1)} m
          </Text>
        </View>
      </View>
    </View>
  );

  const renderDepthReporting = () => (
    <ScrollView style={styles.contentContainer}>
      <Text style={styles.screenTitle}>📊 Depth Reporting</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📡 GPS Status</Text>
        <View style={styles.gpsStatus}>
          <View style={[styles.gpsIndicator, { backgroundColor: gpsAccuracy < 3 ? '#22c55e' : '#f59e0b' }]} />
          <Text style={styles.gpsText}>
            GPS {gpsAccuracy < 3 ? 'GOOD' : 'POOR'} - ±{gpsAccuracy.toFixed(1)}m
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🌊 Recent Reports</Text>
        {[
          { depth: '18.5 ft', time: '2 min ago', confidence: 'High' },
          { depth: '22.1 ft', time: '5 min ago', confidence: 'High' },
          { depth: '15.8 ft', time: '8 min ago', confidence: 'Medium' },
        ].map((report, index) => (
          <View key={index} style={styles.reportItem}>
            <View>
              <Text style={styles.reportDepth}>{report.depth}</Text>
              <Text style={styles.reportTime}>{report.time}</Text>
            </View>
            <View style={[
              styles.confidenceBadge,
              { backgroundColor: report.confidence === 'High' ? '#22c55e' : '#f59e0b' }
            ]}>
              <Text style={styles.confidenceText}>{report.confidence}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📈 Your Contributions</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>127</Text>
            <Text style={styles.statLabel}>Total Reports</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>92%</Text>
            <Text style={styles.statLabel}>Accuracy Rating</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderProfileView = () => (
    <ScrollView style={styles.contentContainer}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>SC</Text>
        </View>
        <Text style={styles.profileName}>Captain Sarah</Text>
        <Text style={styles.profileMember}>Member since March 2024</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📈 Navigation Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>127</Text>
            <Text style={styles.statLabel}>Depth Reports</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>92%</Text>
            <Text style={styles.statLabel}>Accuracy Rating</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>8</Text>
            <Text style={styles.statLabel}>Areas Explored</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>1247</Text>
            <Text style={styles.statLabel}>Miles Navigated</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>⛵ Serenity</Text>
        <View style={styles.vesselInfo}>
          <View style={styles.vesselRow}>
            <Text style={styles.vesselLabel}>Length:</Text>
            <Text style={styles.vesselValue}>32 ft</Text>
          </View>
          <View style={styles.vesselRow}>
            <Text style={styles.vesselLabel}>Draft:</Text>
            <Text style={styles.vesselValue}>3.2 ft</Text>
          </View>
          <View style={styles.vesselRow}>
            <Text style={styles.vesselLabel}>Type:</Text>
            <Text style={styles.vesselValue}>Sport Fishing</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'map':
        return renderMapView();
      case 'depth':
        return renderDepthReporting();
      case 'profile':
        return renderProfileView();
      case 'testing':
        return <MarineTestingFramework />;
      case 'emergency-testing':
        return <EnhancedMarineTestingFramework />;
      case '3d':
        return (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderIcon}>🔮</Text>
            <Text style={styles.placeholderTitle}>3D Navigation</Text>
            <Text style={styles.placeholderText}>Underwater terrain visualization</Text>
          </View>
        );
      case 'settings':
        return (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderIcon}>⚙️</Text>
            <Text style={styles.placeholderTitle}>Settings</Text>
            <Text style={styles.placeholderText}>Marine navigation preferences</Text>
          </View>
        );
      default:
        return renderMapView();
    }
  };

  // Show loading screen while checking authentication
  if (isAuthenticated === null) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <StatusBar barStyle="light-content" backgroundColor="#0369a1" />
        <View style={styles.loadingContent}>
          <Text style={styles.loadingTitle}>🌊 Waves</Text>
          <Text style={styles.loadingText}>Initializing marine platform...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show registration flow for unauthenticated users
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0369a1" />
        <MarineRegistration onRegistrationComplete={handleRegistrationComplete} />
      </SafeAreaView>
    );
  }

  // Show main app for authenticated users
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0369a1" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🌊 Waves Marine Navigation</Text>
        <Text style={styles.headerSubtitle}>
          {currentUser?.email ? `Welcome back, ${currentUser.given_name || currentUser.email}` : 'Safe Boating Through Community Intelligence'}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TabButton icon="🗺️" label="Map" view="map" active={currentView === 'map'} />
        <TabButton icon="🔮" label="3D Nav" view="3d" active={currentView === '3d'} />
        <TabButton icon="📊" label="Depth" view="depth" active={currentView === 'depth'} />
        <TabButton icon="🧪" label="Testing" view="testing" active={currentView === 'testing'} />
        <TabButton icon="🆘" label="Emergency" view="emergency-testing" active={currentView === 'emergency-testing'} />
        <TabButton icon="👤" label="Profile" view="profile" active={currentView === 'profile'} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0ea5e9',
  },
  header: {
    backgroundColor: '#0369a1',
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 20,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  waterBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#87ceeb',
  },
  depthPoint: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  vesselContainer: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
  },
  vesselPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
  },
  vessel: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    borderWidth: 3,
    borderColor: 'white',
    top: 8,
    left: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vesselIcon: {
    fontSize: 12,
  },
  depthDisplay: {
    position: 'absolute',
    top: 60,
    right: 20,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  depthValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  depthLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  statusPanel: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    color: '#64748b',
    fontSize: 14,
  },
  statusValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 12,
  },
  gpsStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  gpsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  reportItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  reportDepth: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  reportTime: {
    fontSize: 12,
    color: '#64748b',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  profileMember: {
    fontSize: 14,
    color: '#64748b',
  },
  vesselInfo: {
    marginTop: 8,
  },
  vesselRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vesselLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  vesselValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingBottom: 34, // Safe area padding for iPhone
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  tabButtonActive: {
    backgroundColor: '#f0f9ff',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabIconActive: {
    color: '#0ea5e9',
  },
  tabLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#0ea5e9',
  },
  
  // Loading styles
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 40,
  },
  loadingTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#0ea5e9',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default App;
