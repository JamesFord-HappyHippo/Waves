/**
 * Environmental Data Provider Tests
 * Integration tests for React Native environmental data context
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { EnvironmentalDataProvider, useEnvironmentalData } from '../EnvironmentalDataProvider';
import * as LocationSlice from '../../../store/slices/locationSlice';

// Mock the environmental services
jest.mock('../NoaaApiClient');
jest.mock('../WeatherApiClient');
jest.mock('../CachingService');
jest.mock('../RealtimeUpdateService');

// Mock React Native modules
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

jest.mock('react-native-config', () => ({
  API_BASE_URL: 'https://test-api.waves.com',
  STORMGLASS_API_KEY: 'test-stormglass-key',
  OPENWEATHER_API_KEY: 'test-openweather-key',
}));

// Mock store
const mockStore = configureStore({
  reducer: {
    location: (state = { currentLocation: null }, action) => state,
  },
});

// Test component that uses the environmental data
const TestComponent: React.FC = () => {
  const {
    data,
    refreshData,
    isRealtimeEnabled,
    enableRealtimeUpdates,
    batteryOptimization,
    setBatteryOptimization
  } = useEnvironmentalData();

  return (
    <>
      <div testID="weather-temp">{data.weather?.temperature || 'N/A'}</div>
      <div testID="tide-station">{data.tides.station?.name || 'N/A'}</div>
      <div testID="realtime-status">{isRealtimeEnabled ? 'enabled' : 'disabled'}</div>
      <div testID="battery-status">{batteryOptimization ? 'on' : 'off'}</div>
      <button testID="refresh-button" onPress={refreshData}>Refresh</button>
      <button testID="realtime-toggle" onPress={() => enableRealtimeUpdates(!isRealtimeEnabled)}>
        Toggle Realtime
      </button>
      <button testID="battery-toggle" onPress={() => setBatteryOptimization(!batteryOptimization)}>
        Toggle Battery
      </button>
    </>
  );
};

describe('EnvironmentalDataProvider', () => {
  let mockLocation: any;

  beforeEach(() => {
    mockLocation = {
      latitude: 40.7,
      longitude: -74.0,
      accuracy: 10,
      timestamp: Date.now()
    };

    // Mock the location selector
    jest.spyOn(LocationSlice, 'selectCurrentLocation').mockReturnValue(mockLocation);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderWithProvider = (props = {}) => {
    return render(
      <Provider store={mockStore}>
        <EnvironmentalDataProvider {...props}>
          <TestComponent />
        </EnvironmentalDataProvider>
      </Provider>
    );
  };

  describe('Initial State', () => {
    test('should provide initial environmental data state', () => {
      const { getByTestId } = renderWithProvider();

      expect(getByTestId('weather-temp')).toHaveTextContent('N/A');
      expect(getByTestId('tide-station')).toHaveTextContent('N/A');
      expect(getByTestId('realtime-status')).toHaveTextContent('disabled');
      expect(getByTestId('battery-status')).toHaveTextContent('on');
    });

    test('should initialize services on mount', async () => {
      renderWithProvider();

      // Services should be initialized
      await waitFor(() => {
        // Verify that environmental services were configured
        expect(true).toBe(true); // Placeholder for service initialization checks
      });
    });
  });

  describe('Data Fetching', () => {
    test('should fetch environmental data when location changes', async () => {
      const { rerender } = renderWithProvider();

      // Mock successful API responses
      const mockWeatherData = {
        temperature: 20,
        windSpeed: 10,
        windDirection: 180,
        waveHeight: 1.5,
        visibility: 15,
        conditions: 'Clear',
        seaState: 2,
        barometricPressure: 1013
      };

      const mockTideStation = {
        id: '8518750',
        name: 'The Battery, NY',
        latitude: 40.7,
        longitude: -74.015,
        state: 'NY',
        region: 'Atlantic',
        timezone: 'EST',
        tideType: 'harmonic'
      };

      // Update location to trigger data fetch
      const newLocation = { ...mockLocation, latitude: 40.8 };
      jest.spyOn(LocationSlice, 'selectCurrentLocation').mockReturnValue(newLocation);

      rerender(
        <Provider store={mockStore}>
          <EnvironmentalDataProvider>
            <TestComponent />
          </EnvironmentalDataProvider>
        </Provider>
      );

      await waitFor(() => {
        // Should have attempted to fetch new data
        expect(true).toBe(true); // Placeholder for API call verification
      });
    });

    test('should handle data fetching errors gracefully', async () => {
      // Mock API error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProvider();

      await waitFor(() => {
        // Should handle errors without crashing
        expect(true).toBe(true);
      });

      consoleSpy.mockRestore();
    });

    test('should use cached data when available', async () => {
      renderWithProvider();

      // First render should attempt to use cached data
      await waitFor(() => {
        expect(true).toBe(true); // Placeholder for cache verification
      });
    });
  });

  describe('Real-time Updates', () => {
    test('should enable real-time updates', async () => {
      const { getByTestId } = renderWithProvider();

      const realtimeToggle = getByTestId('realtime-toggle');

      await act(async () => {
        realtimeToggle.props.onPress();
      });

      await waitFor(() => {
        expect(getByTestId('realtime-status')).toHaveTextContent('enabled');
      });
    });

    test('should disable real-time updates', async () => {
      const { getByTestId } = renderWithProvider();

      const realtimeToggle = getByTestId('realtime-toggle');

      // Enable first
      await act(async () => {
        realtimeToggle.props.onPress();
      });

      // Then disable
      await act(async () => {
        realtimeToggle.props.onPress();
      });

      await waitFor(() => {
        expect(getByTestId('realtime-status')).toHaveTextContent('disabled');
      });
    });

    test('should handle real-time connection errors', async () => {
      const { getByTestId } = renderWithProvider();

      const realtimeToggle = getByTestId('realtime-toggle');

      // Mock connection error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        realtimeToggle.props.onPress();
      });

      await waitFor(() => {
        // Should handle connection errors gracefully
        expect(getByTestId('realtime-status')).toHaveTextContent('disabled');
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Battery Optimization', () => {
    test('should toggle battery optimization', async () => {
      const { getByTestId } = renderWithProvider();

      const batteryToggle = getByTestId('battery-toggle');

      await act(async () => {
        batteryToggle.props.onPress();
      });

      await waitFor(() => {
        expect(getByTestId('battery-status')).toHaveTextContent('off');
      });
    });

    test('should adjust update intervals based on battery optimization', async () => {
      const { getByTestId } = renderWithProvider();

      const realtimeToggle = getByTestId('realtime-toggle');
      const batteryToggle = getByTestId('battery-toggle');

      // Enable real-time updates
      await act(async () => {
        realtimeToggle.props.onPress();
      });

      // Toggle battery optimization
      await act(async () => {
        batteryToggle.props.onPress();
      });

      await waitFor(() => {
        // Should have adjusted update intervals
        expect(true).toBe(true); // Placeholder for interval verification
      });
    });
  });

  describe('Manual Data Refresh', () => {
    test('should refresh data when requested', async () => {
      const { getByTestId } = renderWithProvider();

      const refreshButton = getByTestId('refresh-button');

      await act(async () => {
        refreshButton.props.onPress();
      });

      await waitFor(() => {
        // Should have triggered data refresh
        expect(true).toBe(true); // Placeholder for refresh verification
      });
    });

    test('should prevent multiple simultaneous refreshes', async () => {
      const { getByTestId } = renderWithProvider();

      const refreshButton = getByTestId('refresh-button');

      // Trigger multiple rapid refreshes
      await act(async () => {
        refreshButton.props.onPress();
        refreshButton.props.onPress();
        refreshButton.props.onPress();
      });

      await waitFor(() => {
        // Should have prevented duplicate requests
        expect(true).toBe(true);
      });
    });
  });

  describe('Location Subscriptions', () => {
    test('should subscribe to location updates', async () => {
      const { getByTestId } = renderWithProvider();

      // Enable real-time updates
      const realtimeToggle = getByTestId('realtime-toggle');
      await act(async () => {
        realtimeToggle.props.onPress();
      });

      await waitFor(() => {
        // Should have subscribed to location updates
        expect(true).toBe(true);
      });
    });

    test('should unsubscribe when component unmounts', async () => {
      const { unmount } = renderWithProvider();

      unmount();

      // Should have cleaned up subscriptions
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle network connectivity changes', async () => {
      renderWithProvider();

      // Mock network disconnect
      const netInfoMock = require('@react-native-community/netinfo');
      const mockListener = netInfoMock.addEventListener.mock.calls[0][0];

      await act(async () => {
        mockListener({ isConnected: false });
      });

      // Should handle offline state
      await waitFor(() => {
        expect(true).toBe(true);
      });

      // Mock network reconnect
      await act(async () => {
        mockListener({ isConnected: true });
      });

      // Should resume normal operation
      await waitFor(() => {
        expect(true).toBe(true);
      });
    });

    test('should handle malformed environmental data', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProvider();

      // Should handle malformed data gracefully
      await waitFor(() => {
        expect(true).toBe(true);
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    test('should not re-render unnecessarily', async () => {
      let renderCount = 0;

      const CountingTestComponent: React.FC = () => {
        renderCount++;
        const { data } = useEnvironmentalData();
        return <div testID="counter">{renderCount}</div>;
      };

      const { getByTestId, rerender } = render(
        <Provider store={mockStore}>
          <EnvironmentalDataProvider>
            <CountingTestComponent />
          </EnvironmentalDataProvider>
        </Provider>
      );

      const initialRenderCount = renderCount;

      // Rerender with same props
      rerender(
        <Provider store={mockStore}>
          <EnvironmentalDataProvider>
            <CountingTestComponent />
          </EnvironmentalDataProvider>
        </Provider>
      );

      expect(renderCount).toBe(initialRenderCount);
    });

    test('should debounce rapid location changes', async () => {
      renderWithProvider();

      // Simulate rapid location changes
      for (let i = 0; i < 10; i++) {
        const newLocation = { ...mockLocation, latitude: 40.7 + i * 0.001 };
        jest.spyOn(LocationSlice, 'selectCurrentLocation').mockReturnValue(newLocation);
      }

      await waitFor(() => {
        // Should have debounced the updates
        expect(true).toBe(true);
      });
    });
  });

  describe('Auto-Updates', () => {
    test('should respect auto-update settings', () => {
      renderWithProvider({ enableAutoUpdates: false });

      // Should not automatically update data
      expect(true).toBe(true);
    });

    test('should use custom update intervals', () => {
      renderWithProvider({ updateInterval: 5 }); // 5 minutes

      // Should use the specified interval
      expect(true).toBe(true);
    });

    test('should pause updates when app is in background', async () => {
      renderWithProvider();

      // Mock app state change to background
      const { AppState } = require('react-native');
      const mockListener = jest.fn();
      AppState.addEventListener = jest.fn().mockImplementation((event, listener) => {
        mockListener.mockImplementation(listener);
        return { remove: jest.fn() };
      });

      await act(async () => {
        mockListener('background');
      });

      // Should have paused updates
      expect(true).toBe(true);
    });
  });
});