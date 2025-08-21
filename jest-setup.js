/**
 * Jest Setup for Waves Marine Navigation App
 * Mocks for React Native components and marine-specific services
 */

import 'react-native-gesture-handler/jestSetup';

// Mock react-native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'ios',
      select: jest.fn((config) => config.ios),
    },
    Dimensions: {
      get: jest.fn().mockReturnValue({width: 375, height: 812}),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    Alert: {
      alert: jest.fn(),
    },
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Mock React Native Config
jest.mock('react-native-config', () => ({
  API_BASE_URL: 'http://localhost:8080',
  REACT_NATIVE_MAPBOX_ACCESS_TOKEN: 'test-token',
  NODE_ENV: 'test',
}));

// Mock MapBox
jest.mock('@react-native-mapbox-gl/maps', () => ({
  setAccessToken: jest.fn(),
  setTelemetryEnabled: jest.fn(),
  setConnected: jest.fn(),
  MapView: 'MapView',
  Camera: 'Camera',
  UserLocation: 'UserLocation',
  ShapeSource: 'ShapeSource',
  LineLayer: 'LineLayer',
  CircleLayer: 'CircleLayer',
  offlineManager: {
    getPacks: jest.fn().mockResolvedValue([]),
    createPack: jest.fn().mockResolvedValue({
      on: jest.fn(),
      resume: jest.fn(),
    }),
    deletePack: jest.fn().mockResolvedValue(true),
  },
  UserTrackingModes: {
    None: 0,
    Follow: 1,
    FollowWithHeading: 2,
  },
}));

// Mock Geolocation Service
jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  requestAuthorization: jest.fn(),
  PERMISSIONS: {
    ACCESS_FINE_LOCATION: 'ACCESS_FINE_LOCATION',
    ACCESS_COARSE_LOCATION: 'ACCESS_COARSE_LOCATION',
  },
  RESULTS: {
    GRANTED: 'GRANTED',
    DENIED: 'DENIED',
    BLOCKED: 'BLOCKED',
    UNAVAILABLE: 'UNAVAILABLE',
  },
}));

// Mock Permissions
jest.mock('react-native-permissions', () => ({
  request: jest.fn().mockResolvedValue('granted'),
  check: jest.fn().mockResolvedValue('granted'),
  openSettings: jest.fn().mockResolvedValue(true),
  PERMISSIONS: {
    ANDROID: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
    IOS: {
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
    },
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    GRANTED: 'granted',
    BLOCKED: 'blocked',
  },
}));

// Mock SQLite Storage
jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn().mockReturnValue({
    transaction: jest.fn(),
    readTransaction: jest.fn(),
    close: jest.fn(),
  }),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn().mockReturnValue(() => {}),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
}));

// Mock Vector Icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }) => children,
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: ({ children }) => children,
  }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: ({ children }) => children,
  }),
}));

// Mock React Native Safe Area Context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Mock React Native Gesture Handler
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }) => children,
  PanGestureHandler: ({ children }) => children,
  TapGestureHandler: ({ children }) => children,
  State: {},
  Directions: {},
}));

// Mock React Native Reanimated
jest.mock('react-native-reanimated', () => ({
  default: {
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
    event: jest.fn(),
    add: jest.fn(),
    eq: jest.fn(),
    set: jest.fn(),
    cond: jest.fn(),
    interpolate: jest.fn(),
  },
  useSharedValue: jest.fn(),
  useAnimatedStyle: jest.fn(),
  withSpring: jest.fn(),
  withTiming: jest.fn(),
  runOnJS: jest.fn(),
}));

// Mock Device Info
jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn().mockReturnValue('1.0.0'),
  getBuildNumber: jest.fn().mockReturnValue('1'),
  getSystemName: jest.fn().mockReturnValue('iOS'),
  getSystemVersion: jest.fn().mockReturnValue('14.0'),
  getBatteryLevel: jest.fn().mockResolvedValue(0.85),
}));

// Global mocks for marine navigation
global.__DEV__ = true;

// Mock console.warn for cleaner test output
global.console.warn = jest.fn();
global.console.error = jest.fn();

// Mock location data for testing
export const mockLocation = {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10,
  timestamp: Date.now(),
  speed: 5.2,
  heading: 45,
};

// Mock depth reading for testing
export const mockDepthReading = {
  id: 'test-depth-1',
  latitude: 37.7749,
  longitude: -122.4194,
  depth: 8.5,
  timestamp: Date.now(),
  vesselDraft: 1.5,
  confidenceScore: 0.85,
  source: 'crowdsource',
};

// Setup fake timers
jest.useFakeTimers();