/**
 * Offline Data State Management for Marine Navigation
 */

import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface OfflineData {
  id: string;
  type: 'depthData' | 'mapTiles' | 'weatherData' | 'tideData';
  region: {
    name: string;
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  };
  downloadedAt: number;
  expiresAt: number;
  size: number; // bytes
  version: string;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncAt: number;
  pendingUploads: string[];
  syncInProgress: boolean;
  autoSync: boolean;
}

export interface OfflineState {
  isOfflineMode: boolean;
  offlineData: OfflineData[];
  syncStatus: SyncStatus;
  storageUsed: number; // bytes
  storageLimit: number; // bytes
  cacheSize: number; // bytes
  pendingDepthReports: any[];
  queuedRequests: any[];
  error: string | null;
}

const initialState: OfflineState = {
  isOfflineMode: false,
  offlineData: [],
  syncStatus: {
    isOnline: true,
    lastSyncAt: 0,
    pendingUploads: [],
    syncInProgress: false,
    autoSync: true,
  },
  storageUsed: 0,
  storageLimit: 1024 * 1024 * 1024, // 1GB default
  cacheSize: 0,
  pendingDepthReports: [],
  queuedRequests: [],
  error: null,
};

export const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    setOfflineMode: (state, action: PayloadAction<boolean>) => {
      state.isOfflineMode = action.payload;
    },
    
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.syncStatus.isOnline = action.payload;
      
      // Auto-trigger sync when coming back online
      if (action.payload && state.syncStatus.autoSync && !state.syncStatus.syncInProgress) {
        state.syncStatus.syncInProgress = true;
      }
    },
    
    addOfflineData: (state, action: PayloadAction<OfflineData>) => {
      const existingIndex = state.offlineData.findIndex(
        data => data.id === action.payload.id,
      );
      
      if (existingIndex !== -1) {
        state.offlineData[existingIndex] = action.payload;
      } else {
        state.offlineData.push(action.payload);
      }
      
      // Update storage usage
      state.storageUsed += action.payload.size;
    },
    
    removeOfflineData: (state, action: PayloadAction<string>) => {
      const dataToRemove = state.offlineData.find(data => data.id === action.payload);
      if (dataToRemove) {
        state.storageUsed -= dataToRemove.size;
        state.offlineData = state.offlineData.filter(data => data.id !== action.payload);
      }
    },
    
    updateStorageUsage: (state, action: PayloadAction<{used: number; cache: number}>) => {
      state.storageUsed = action.payload.used;
      state.cacheSize = action.payload.cache;
    },
    
    setStorageLimit: (state, action: PayloadAction<number>) => {
      state.storageLimit = action.payload;
    },
    
    addPendingDepthReport: (state, action: PayloadAction<any>) => {
      state.pendingDepthReports.push(action.payload);
      state.syncStatus.pendingUploads.push(action.payload.id);
    },
    
    removePendingDepthReport: (state, action: PayloadAction<string>) => {
      state.pendingDepthReports = state.pendingDepthReports.filter(
        report => report.id !== action.payload,
      );
      state.syncStatus.pendingUploads = state.syncStatus.pendingUploads.filter(
        id => id !== action.payload,
      );
    },
    
    addQueuedRequest: (state, action: PayloadAction<any>) => {
      state.queuedRequests.push(action.payload);
    },
    
    removeQueuedRequest: (state, action: PayloadAction<string>) => {
      state.queuedRequests = state.queuedRequests.filter(
        request => request.id !== action.payload,
      );
    },
    
    startSync: (state) => {
      state.syncStatus.syncInProgress = true;
      state.error = null;
    },
    
    completeSync: (state) => {
      state.syncStatus.syncInProgress = false;
      state.syncStatus.lastSyncAt = Date.now();
      state.pendingDepthReports = [];
      state.queuedRequests = [];
      state.syncStatus.pendingUploads = [];
    },
    
    setSyncError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.syncStatus.syncInProgress = false;
    },
    
    setAutoSync: (state, action: PayloadAction<boolean>) => {
      state.syncStatus.autoSync = action.payload;
    },
    
    clearOfflineData: (state) => {
      state.offlineData = [];
      state.storageUsed = 0;
      state.cacheSize = 0;
    },
    
    cleanupExpiredData: (state) => {
      const now = Date.now();
      const expiredData = state.offlineData.filter(data => data.expiresAt < now);
      
      // Remove expired data and update storage usage
      expiredData.forEach(data => {
        state.storageUsed -= data.size;
      });
      
      state.offlineData = state.offlineData.filter(data => data.expiresAt >= now);
    },
  },
});

export const {
  setOfflineMode,
  setOnlineStatus,
  addOfflineData,
  removeOfflineData,
  updateStorageUsage,
  setStorageLimit,
  addPendingDepthReport,
  removePendingDepthReport,
  addQueuedRequest,
  removeQueuedRequest,
  startSync,
  completeSync,
  setSyncError,
  setAutoSync,
  clearOfflineData,
  cleanupExpiredData,
} = offlineSlice.actions;