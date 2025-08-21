/**
 * Mobile Testing Setup for Waves Marine Navigation App
 * Additional mocks and utilities for mobile-specific tests
 */

// Mock location services with more detailed responses
const mockLocationService = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  // Mock different location scenarios
  scenarios: {
    accurate: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 5,
      speed: 3.2,
      heading: 45,
      timestamp: Date.now(),
    },
    lowAccuracy: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 50,
      speed: 2.1,
      heading: 50,
      timestamp: Date.now(),
    },
    noGPS: null,
  },
};

// Enhanced mock for testing different battery states
const mockBatteryService = {
  level: 0.85,
  isCharging: false,
  optimizationEnabled: true,
  scenarios: {
    low: { level: 0.15, isCharging: false },
    charging: { level: 0.65, isCharging: true },
    full: { level: 1.0, isCharging: false },
  },
};

// Mock network states for offline testing
const mockNetworkService = {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi',
  scenarios: {
    offline: { isConnected: false, isInternetReachable: false },
    cellular: { isConnected: true, isInternetReachable: true, type: 'cellular' },
    wifi: { isConnected: true, isInternetReachable: true, type: 'wifi' },
    limited: { isConnected: true, isInternetReachable: false, type: 'wifi' },
  },
};

// Test utilities for marine navigation
export const testUtils = {
  // Generate mock GPS track
  generateGPSTrack: (
    startLat: number = 37.7749,
    startLon: number = -122.4194,
    points: number = 10,
    distance: number = 0.001, // degrees
  ) => {
    const track = [];
    for (let i = 0; i < points; i++) {
      track.push({
        latitude: startLat + (i * distance),
        longitude: startLon + (i * distance),
        accuracy: 5 + Math.random() * 10,
        speed: 2 + Math.random() * 3,
        heading: 45 + (Math.random() - 0.5) * 20,
        timestamp: Date.now() + (i * 5000), // 5 second intervals
      });
    }
    return track;
  },
  
  // Generate mock depth readings
  generateDepthReadings: (
    centerLat: number = 37.7749,
    centerLon: number = -122.4194,
    count: number = 5,
  ) => {
    const readings = [];
    for (let i = 0; i < count; i++) {
      readings.push({
        id: `test-depth-${i}`,
        latitude: centerLat + (Math.random() - 0.5) * 0.01,
        longitude: centerLon + (Math.random() - 0.5) * 0.01,
        depth: 5 + Math.random() * 15,
        timestamp: Date.now() - (i * 60000), // 1 minute intervals
        vesselDraft: 1.5,
        confidenceScore: 0.7 + Math.random() * 0.3,
        source: 'crowdsource' as const,
      });
    }
    return readings;
  },
  
  // Mock marine weather data
  generateWeatherData: () => ({
    temperature: 20 + Math.random() * 10,
    windSpeed: Math.random() * 20,
    windDirection: Math.random() * 360,
    waveHeight: Math.random() * 3,
    visibility: 5 + Math.random() * 15,
    conditions: 'partly-cloudy',
    seaState: Math.floor(Math.random() * 6),
    barometricPressure: 1010 + (Math.random() - 0.5) * 20,
  }),
  
  // Calculate distance between two points (rough approximation)
  calculateDistance: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },
};

// Setup mobile-specific mocks
beforeEach(() => {
  // Reset location mock
  jest.clearAllMocks();
  
  // Setup default location behavior
  mockLocationService.getCurrentPosition.mockImplementation((success) => {
    setTimeout(() => success({
      coords: mockLocationService.scenarios.accurate,
      timestamp: Date.now(),
    }), 100);
  });
  
  mockLocationService.watchPosition.mockImplementation((success) => {
    const watchId = Math.random();
    setTimeout(() => success({
      coords: mockLocationService.scenarios.accurate,
      timestamp: Date.now(),
    }), 100);
    return watchId;
  });
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

// Export mocks for use in tests
export { mockLocationService, mockBatteryService, mockNetworkService };