/**
 * Location Service Provider for Marine Navigation
 * Optimized for battery efficiency and marine use cases
 */

import React, {createContext, useContext, useEffect, useRef} from 'react';
import Geolocation from 'react-native-geolocation-service';
import {AppState, AppStateStatus, Platform} from 'react-native';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';

import {useAppDispatch, useAppSelector} from '@/store';
import {
  updateLocation,
  setPermissionStatus,
  setLocationError,
  startTracking,
  stopTracking,
} from '@/store/slices/locationSlice';

interface LocationContextType {
  requestLocationPermission: () => Promise<boolean>;
  startLocationTracking: (mode: 'passive' | 'active' | 'navigation') => void;
  stopLocationTracking: () => void;
  getCurrentLocation: () => Promise<GeolocationResponse | null>;
}

const LocationContext = createContext<LocationContextType | null>(null);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
};

interface GeolocationResponse {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  altitude?: number;
  timestamp: number;
}

interface LocationProviderProps {
  children: React.ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({children}) => {
  const dispatch = useAppDispatch();
  const {isTracking, trackingMode, batteryOptimization} = useAppSelector(
    state => state.location,
  );

  const watchIdRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');

  // Request location permissions
  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      const permission = Platform.select({
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      });

      if (!permission) return false;

      const result = await request(permission);
      
      switch (result) {
        case RESULTS.GRANTED:
          dispatch(setPermissionStatus('granted'));
          return true;
        case RESULTS.DENIED:
          dispatch(setPermissionStatus('denied'));
          return false;
        case RESULTS.BLOCKED:
          dispatch(setPermissionStatus('restricted'));
          return false;
        default:
          dispatch(setPermissionStatus('undetermined'));
          return false;
      }
    } catch (error) {
      dispatch(setLocationError(`Permission error: ${error}`));
      return false;
    }
  };

  // Get current location once
  const getCurrentLocation = async (): Promise<GeolocationResponse | null> => {
    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const locationData: GeolocationResponse = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            altitude: position.coords.altitude || undefined,
            timestamp: position.timestamp,
          };
          resolve(locationData);
        },
        (error) => {
          dispatch(setLocationError(`Location error: ${error.message}`));
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        },
      );
    });
  };

  // Start location tracking with marine-optimized settings
  const startLocationTracking = (mode: 'passive' | 'active' | 'navigation') => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
    }

    // Different settings based on tracking mode and battery optimization
    const getTrackingOptions = () => {
      const baseOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: batteryOptimization ? 5000 : 1000,
      };

      switch (mode) {
        case 'passive':
          return {
            ...baseOptions,
            distanceFilter: batteryOptimization ? 50 : 25, // Update every 50m or 25m
            interval: batteryOptimization ? 30000 : 15000, // Every 30s or 15s
          };
        case 'active':
          return {
            ...baseOptions,
            distanceFilter: batteryOptimization ? 25 : 10, // Update every 25m or 10m
            interval: batteryOptimization ? 10000 : 5000, // Every 10s or 5s
          };
        case 'navigation':
          return {
            ...baseOptions,
            enableHighAccuracy: true,
            distanceFilter: 5, // High precision for navigation
            interval: 2000, // Every 2 seconds
            maximumAge: 1000,
          };
        default:
          return baseOptions;
      }
    };

    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          altitude: position.coords.altitude || undefined,
          timestamp: position.timestamp,
        };

        dispatch(updateLocation(locationData));
      },
      (error) => {
        dispatch(setLocationError(`Location tracking error: ${error.message}`));
      },
      getTrackingOptions(),
    );

    dispatch(startTracking(mode));
  };

  // Stop location tracking
  const stopLocationTracking = () => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    dispatch(stopTracking());
  };

  // Handle app state changes for battery optimization
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground - resume tracking if was tracking
        if (isTracking && batteryOptimization) {
          startLocationTracking(trackingMode);
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App is going to background - reduce tracking frequency
        if (isTracking && batteryOptimization && trackingMode !== 'navigation') {
          // Reduce frequency in background, but keep navigation mode active
          stopLocationTracking();
          startLocationTracking('passive');
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [isTracking, trackingMode, batteryOptimization]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const contextValue: LocationContextType = {
    requestLocationPermission,
    startLocationTracking,
    stopLocationTracking,
    getCurrentLocation,
  };

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};