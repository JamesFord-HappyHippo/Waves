/**
 * Navigation State Management for Marine Navigation
 */

import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface Waypoint {
  id: string;
  latitude: number;
  longitude: number;
  name?: string;
  description?: string;
  timestamp: number;
}

export interface Route {
  id: string;
  name: string;
  waypoints: Waypoint[];
  totalDistance: number;
  estimatedTime: number;
  created: number;
  lastUsed?: number;
}

export interface NavigationState {
  activeRoute: Route | null;
  currentWaypoint: Waypoint | null;
  nextWaypoint: Waypoint | null;
  distanceToWaypoint: number | null;
  bearingToWaypoint: number | null;
  estimatedTimeToArrival: number | null;
  isNavigating: boolean;
  navigationMode: '2d' | '3d';
  autoAdvanceWaypoints: boolean;
  routes: Route[];
  waypoints: Waypoint[];
  crossTrackError: number | null;
  courseOverGround: number | null;
  speedOverGround: number | null;
}

const initialState: NavigationState = {
  activeRoute: null,
  currentWaypoint: null,
  nextWaypoint: null,
  distanceToWaypoint: null,
  bearingToWaypoint: null,
  estimatedTimeToArrival: null,
  isNavigating: false,
  navigationMode: '2d',
  autoAdvanceWaypoints: true,
  routes: [],
  waypoints: [],
  crossTrackError: null,
  courseOverGround: null,
  speedOverGround: null,
};

export const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    startNavigation: (state, action: PayloadAction<Route>) => {
      state.activeRoute = action.payload;
      state.isNavigating = true;
      state.currentWaypoint = action.payload.waypoints[0] || null;
      state.nextWaypoint = action.payload.waypoints[1] || null;
    },
    
    stopNavigation: (state) => {
      state.activeRoute = null;
      state.currentWaypoint = null;
      state.nextWaypoint = null;
      state.isNavigating = false;
      state.distanceToWaypoint = null;
      state.bearingToWaypoint = null;
      state.estimatedTimeToArrival = null;
      state.crossTrackError = null;
    },
    
    updateNavigationData: (
      state,
      action: PayloadAction<{
        distanceToWaypoint: number;
        bearingToWaypoint: number;
        estimatedTimeToArrival: number;
        crossTrackError: number;
        courseOverGround: number;
        speedOverGround: number;
      }>,
    ) => {
      state.distanceToWaypoint = action.payload.distanceToWaypoint;
      state.bearingToWaypoint = action.payload.bearingToWaypoint;
      state.estimatedTimeToArrival = action.payload.estimatedTimeToArrival;
      state.crossTrackError = action.payload.crossTrackError;
      state.courseOverGround = action.payload.courseOverGround;
      state.speedOverGround = action.payload.speedOverGround;
    },
    
    advanceToNextWaypoint: (state) => {
      if (state.activeRoute && state.currentWaypoint) {
        const currentIndex = state.activeRoute.waypoints.findIndex(
          wp => wp.id === state.currentWaypoint!.id,
        );
        
        if (currentIndex !== -1 && currentIndex < state.activeRoute.waypoints.length - 1) {
          state.currentWaypoint = state.activeRoute.waypoints[currentIndex + 1];
          state.nextWaypoint = state.activeRoute.waypoints[currentIndex + 2] || null;
        } else {
          // Reached final waypoint
          state.currentWaypoint = null;
          state.nextWaypoint = null;
          state.isNavigating = false;
        }
      }
    },
    
    setNavigationMode: (state, action: PayloadAction<'2d' | '3d'>) => {
      state.navigationMode = action.payload;
    },
    
    toggleAutoAdvanceWaypoints: (state) => {
      state.autoAdvanceWaypoints = !state.autoAdvanceWaypoints;
    },
    
    addRoute: (state, action: PayloadAction<Route>) => {
      state.routes.push(action.payload);
    },
    
    removeRoute: (state, action: PayloadAction<string>) => {
      state.routes = state.routes.filter(route => route.id !== action.payload);
    },
    
    addWaypoint: (state, action: PayloadAction<Waypoint>) => {
      state.waypoints.push(action.payload);
    },
    
    removeWaypoint: (state, action: PayloadAction<string>) => {
      state.waypoints = state.waypoints.filter(wp => wp.id !== action.payload);
    },
  },
});

export const {
  startNavigation,
  stopNavigation,
  updateNavigationData,
  advanceToNextWaypoint,
  setNavigationMode,
  toggleAutoAdvanceWaypoints,
  addRoute,
  removeRoute,
  addWaypoint,
  removeWaypoint,
} = navigationSlice.actions;