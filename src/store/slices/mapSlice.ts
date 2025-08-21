/**
 * Map State Management for Marine Navigation
 */

import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface MapBounds {
  northEast: {latitude: number; longitude: number};
  southWest: {latitude: number; longitude: number};
}

export interface MapState {
  center: {latitude: number; longitude: number};
  zoom: number;
  bearing: number;
  pitch: number;
  bounds: MapBounds | null;
  followUser: boolean;
  mapStyle: 'marine' | 'satellite' | 'hybrid';
  showDepthReadings: boolean;
  showDepthContours: boolean;
  showNavigationAids: boolean;
  showWeatherOverlay: boolean;
  showTideInformation: boolean;
  offlineRegions: OfflineRegion[];
  isDownloadingOfflineMap: boolean;
  downloadProgress: number;
}

export interface OfflineRegion {
  id: string;
  name: string;
  bounds: MapBounds;
  minZoom: number;
  maxZoom: number;
  downloadedAt: number;
  size: number; // in MB
  includesDepthData: boolean;
}

const initialState: MapState = {
  center: {latitude: 37.7749, longitude: -122.4194}, // Default to San Francisco Bay
  zoom: 10,
  bearing: 0,
  pitch: 0,
  bounds: null,
  followUser: true,
  mapStyle: 'marine',
  showDepthReadings: true,
  showDepthContours: true,
  showNavigationAids: true,
  showWeatherOverlay: false,
  showTideInformation: true,
  offlineRegions: [],
  isDownloadingOfflineMap: false,
  downloadProgress: 0,
};

export const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    updateMapCenter: (
      state,
      action: PayloadAction<{latitude: number; longitude: number}>,
    ) => {
      state.center = action.payload;
    },
    
    updateMapCamera: (
      state,
      action: PayloadAction<{
        center?: {latitude: number; longitude: number};
        zoom?: number;
        bearing?: number;
        pitch?: number;
      }>,
    ) => {
      if (action.payload.center) {
        state.center = action.payload.center;
      }
      if (action.payload.zoom !== undefined) {
        state.zoom = action.payload.zoom;
      }
      if (action.payload.bearing !== undefined) {
        state.bearing = action.payload.bearing;
      }
      if (action.payload.pitch !== undefined) {
        state.pitch = action.payload.pitch;
      }
    },
    
    updateMapBounds: (state, action: PayloadAction<MapBounds>) => {
      state.bounds = action.payload;
    },
    
    setFollowUser: (state, action: PayloadAction<boolean>) => {
      state.followUser = action.payload;
    },
    
    setMapStyle: (state, action: PayloadAction<'marine' | 'satellite' | 'hybrid'>) => {
      state.mapStyle = action.payload;
    },
    
    toggleDepthReadings: (state) => {
      state.showDepthReadings = !state.showDepthReadings;
    },
    
    toggleDepthContours: (state) => {
      state.showDepthContours = !state.showDepthContours;
    },
    
    toggleNavigationAids: (state) => {
      state.showNavigationAids = !state.showNavigationAids;
    },
    
    toggleWeatherOverlay: (state) => {
      state.showWeatherOverlay = !state.showWeatherOverlay;
    },
    
    toggleTideInformation: (state) => {
      state.showTideInformation = !state.showTideInformation;
    },
    
    addOfflineRegion: (state, action: PayloadAction<OfflineRegion>) => {
      state.offlineRegions.push(action.payload);
    },
    
    removeOfflineRegion: (state, action: PayloadAction<string>) => {
      state.offlineRegions = state.offlineRegions.filter(
        region => region.id !== action.payload,
      );
    },
    
    startOfflineMapDownload: (state) => {
      state.isDownloadingOfflineMap = true;
      state.downloadProgress = 0;
    },
    
    updateDownloadProgress: (state, action: PayloadAction<number>) => {
      state.downloadProgress = action.payload;
    },
    
    completeOfflineMapDownload: (state) => {
      state.isDownloadingOfflineMap = false;
      state.downloadProgress = 100;
    },
  },
});

export const {
  updateMapCenter,
  updateMapCamera,
  updateMapBounds,
  setFollowUser,
  setMapStyle,
  toggleDepthReadings,
  toggleDepthContours,
  toggleNavigationAids,
  toggleWeatherOverlay,
  toggleTideInformation,
  addOfflineRegion,
  removeOfflineRegion,
  startOfflineMapDownload,
  updateDownloadProgress,
  completeOfflineMapDownload,
} = mapSlice.actions;