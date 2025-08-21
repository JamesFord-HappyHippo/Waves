/**
 * Location State Management for Marine Navigation
 */

import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface LocationState {
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
    heading?: number;
    speed?: number;
    altitude?: number;
    timestamp: number;
  } | null;
  isTracking: boolean;
  trackingMode: 'passive' | 'active' | 'navigation';
  trackingHistory: LocationPoint[];
  permissionStatus: 'granted' | 'denied' | 'restricted' | 'undetermined';
  error: string | null;
  batteryOptimization: boolean;
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  depth?: number;
}

const initialState: LocationState = {
  currentLocation: null,
  isTracking: false,
  trackingMode: 'passive',
  trackingHistory: [],
  permissionStatus: 'undetermined',
  error: null,
  batteryOptimization: true,
};

export const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    updateLocation: (state, action: PayloadAction<LocationPoint>) => {
      state.currentLocation = action.payload;
      state.error = null;
      
      // Add to tracking history if actively tracking
      if (state.isTracking) {
        state.trackingHistory.push(action.payload);
        
        // Limit history to last 1000 points for battery optimization
        if (state.trackingHistory.length > 1000) {
          state.trackingHistory = state.trackingHistory.slice(-1000);
        }
      }
    },
    
    startTracking: (state, action: PayloadAction<'passive' | 'active' | 'navigation'>) => {
      state.isTracking = true;
      state.trackingMode = action.payload;
      state.error = null;
    },
    
    stopTracking: (state) => {
      state.isTracking = false;
      state.trackingMode = 'passive';
    },
    
    setPermissionStatus: (state, action: PayloadAction<LocationState['permissionStatus']>) => {
      state.permissionStatus = action.payload;
    },
    
    setLocationError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    
    clearTrackingHistory: (state) => {
      state.trackingHistory = [];
    },
    
    setBatteryOptimization: (state, action: PayloadAction<boolean>) => {
      state.batteryOptimization = action.payload;
    },
  },
});

export const {
  updateLocation,
  startTracking,
  stopTracking,
  setPermissionStatus,
  setLocationError,
  clearTrackingHistory,
  setBatteryOptimization,
} = locationSlice.actions;