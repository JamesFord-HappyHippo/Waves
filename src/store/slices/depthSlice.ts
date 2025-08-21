/**
 * Depth Data State Management for Marine Navigation
 * Enhanced with environmental data integration
 */

import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import { ProcessedDepthReading, TideCorrection, EnvironmentalFactors, QualityScore } from '../../services/environmental/DataProcessingService';

export interface DepthReading {
  id: string;
  latitude: number;
  longitude: number;
  depth: number;
  timestamp: number;
  vesselDraft: number;
  tideCorrection?: number;
  confidenceScore: number;
  source: 'crowdsource' | 'official' | 'predicted';
  userId?: string;
  
  // Enhanced environmental integration
  rawDepth?: number;
  environmentalCorrections?: EnvironmentalFactors;
  tideData?: TideCorrection;
  qualityAssessment?: QualityScore;
  safetyMargin?: number;
  reliability?: 'high' | 'medium' | 'low' | 'unreliable';
  processingMetadata?: any;
}

export interface DepthAlert {
  id: string;
  type: 'shallow_water' | 'depth_unknown' | 'data_quality' | 'environmental';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  location: { latitude: number; longitude: number };
  timestamp: number;
  acknowledged: boolean;
  autoAcknowledge?: boolean;
}

export interface DepthState {
  nearbyReadings: DepthReading[];
  userReadings: DepthReading[];
  processedReadings: ProcessedDepthReading[];
  currentDepth: number | null;
  correctedDepth: number | null;
  depthQuality: QualityScore | null;
  
  isReporting: boolean;
  reportingMode: 'manual' | 'automatic';
  vesselDraft: number;
  safetyMargin: number;
  depthAlerts: boolean;
  minSafeDepth: number;
  
  // Environmental integration settings
  enableTideCorrections: boolean;
  enableEnvironmentalCorrections: boolean;
  qualityThreshold: number; // Minimum quality score (0-1)
  displayMode: 'raw' | 'corrected' | 'both';
  
  // Active alerts
  activeAlerts: DepthAlert[];
  alertSettings: {
    shallowWaterThreshold: number;
    dataQualityThreshold: number;
    enableAudioAlerts: boolean;
    enableVibrationAlerts: boolean;
    autoAcknowledgeTimeout: number; // seconds
  };
  
  error: string | null;
  lastEnvironmentalUpdate: number | null;
}

const initialState: DepthState = {
  nearbyReadings: [],
  userReadings: [],
  processedReadings: [],
  currentDepth: null,
  correctedDepth: null,
  depthQuality: null,
  
  isReporting: false,
  reportingMode: 'manual',
  vesselDraft: 1.5, // Default 1.5 meters
  safetyMargin: 0.5, // Default 0.5 meter margin
  depthAlerts: true,
  minSafeDepth: 2.0, // Default minimum safe depth
  
  // Environmental integration defaults
  enableTideCorrections: true,
  enableEnvironmentalCorrections: true,
  qualityThreshold: 0.7, // 70% minimum quality
  displayMode: 'corrected',
  
  // Alert management
  activeAlerts: [],
  alertSettings: {
    shallowWaterThreshold: 0.5, // Alert when depth < draft + 0.5m
    dataQualityThreshold: 0.5, // Alert when quality < 50%
    enableAudioAlerts: true,
    enableVibrationAlerts: true,
    autoAcknowledgeTimeout: 30, // Auto-acknowledge after 30 seconds
  },
  
  error: null,
  lastEnvironmentalUpdate: null,
};

export const depthSlice = createSlice({
  name: 'depth',
  initialState,
  reducers: {
    updateNearbyReadings: (state, action: PayloadAction<DepthReading[]>) => {
      state.nearbyReadings = action.payload;
      state.error = null;
    },
    
    addDepthReading: (state, action: PayloadAction<DepthReading>) => {
      state.userReadings.push(action.payload);
      state.nearbyReadings.push(action.payload);
    },
    
    updateProcessedReadings: (state, action: PayloadAction<ProcessedDepthReading[]>) => {
      state.processedReadings = action.payload;
      state.lastEnvironmentalUpdate = Date.now();
    },
    
    addProcessedReading: (state, action: PayloadAction<ProcessedDepthReading>) => {
      state.processedReadings.push(action.payload);
      state.lastEnvironmentalUpdate = Date.now();
    },
    
    updateCurrentDepth: (state, action: PayloadAction<{ 
      raw: number; 
      corrected?: number; 
      quality?: QualityScore 
    }>) => {
      state.currentDepth = action.payload.raw;
      state.correctedDepth = action.payload.corrected || null;
      state.depthQuality = action.payload.quality || null;
    },
    
    updateDepthCorrections: (state, action: PayloadAction<{
      tideCorrection?: TideCorrection;
      environmentalFactors?: EnvironmentalFactors;
      quality?: QualityScore;
    }>) => {
      // Update the current depth reading with corrections
      if (state.currentDepth !== null) {
        const { tideCorrection, environmentalFactors, quality } = action.payload;
        
        let correctedDepth = state.currentDepth;
        if (tideCorrection && state.enableTideCorrections) {
          correctedDepth = tideCorrection.correctedDepth;
        }
        if (environmentalFactors && state.enableEnvironmentalCorrections) {
          correctedDepth += environmentalFactors.totalCorrection;
        }
        
        state.correctedDepth = correctedDepth;
        state.depthQuality = quality || null;
        state.lastEnvironmentalUpdate = Date.now();
      }
    },
    
    setReportingMode: (state, action: PayloadAction<'manual' | 'automatic'>) => {
      state.reportingMode = action.payload;
    },
    
    startDepthReporting: (state) => {
      state.isReporting = true;
      state.error = null;
    },
    
    stopDepthReporting: (state) => {
      state.isReporting = false;
    },
    
    updateVesselDraft: (state, action: PayloadAction<number>) => {
      state.vesselDraft = action.payload;
      // Recalculate minimum safe depth
      state.minSafeDepth = action.payload + state.safetyMargin;
      // Update shallow water alert threshold
      state.alertSettings.shallowWaterThreshold = action.payload + state.safetyMargin;
    },
    
    updateSafetyMargin: (state, action: PayloadAction<number>) => {
      state.safetyMargin = action.payload;
      // Recalculate minimum safe depth
      state.minSafeDepth = state.vesselDraft + action.payload;
      // Update shallow water alert threshold
      state.alertSettings.shallowWaterThreshold = state.vesselDraft + action.payload;
    },
    
    toggleDepthAlerts: (state) => {
      state.depthAlerts = !state.depthAlerts;
    },
    
    // Environmental integration settings
    toggleTideCorrections: (state) => {
      state.enableTideCorrections = !state.enableTideCorrections;
    },
    
    toggleEnvironmentalCorrections: (state) => {
      state.enableEnvironmentalCorrections = !state.enableEnvironmentalCorrections;
    },
    
    setQualityThreshold: (state, action: PayloadAction<number>) => {
      state.qualityThreshold = Math.max(0, Math.min(1, action.payload));
    },
    
    setDisplayMode: (state, action: PayloadAction<'raw' | 'corrected' | 'both'>) => {
      state.displayMode = action.payload;
    },
    
    // Alert management
    addDepthAlert: (state, action: PayloadAction<DepthAlert>) => {
      // Avoid duplicate alerts
      const existingAlert = state.activeAlerts.find(
        alert => alert.type === action.payload.type && !alert.acknowledged
      );
      
      if (!existingAlert) {
        state.activeAlerts.push(action.payload);
      }
    },
    
    acknowledgeAlert: (state, action: PayloadAction<string>) => {
      const alert = state.activeAlerts.find(a => a.id === action.payload);
      if (alert) {
        alert.acknowledged = true;
      }
    },
    
    dismissAlert: (state, action: PayloadAction<string>) => {
      state.activeAlerts = state.activeAlerts.filter(a => a.id !== action.payload);
    },
    
    clearAcknowledgedAlerts: (state) => {
      state.activeAlerts = state.activeAlerts.filter(a => !a.acknowledged);
    },
    
    updateAlertSettings: (state, action: PayloadAction<Partial<typeof initialState.alertSettings>>) => {
      state.alertSettings = { ...state.alertSettings, ...action.payload };
    },
    
    // Auto-acknowledge expired alerts
    autoAcknowledgeExpiredAlerts: (state) => {
      const now = Date.now();
      const timeout = state.alertSettings.autoAcknowledgeTimeout * 1000;
      
      state.activeAlerts.forEach(alert => {
        if (alert.autoAcknowledge !== false && 
            !alert.acknowledged && 
            now - alert.timestamp > timeout) {
          alert.acknowledged = true;
        }
      });
    },
    
    setDepthError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    
    clearDepthData: (state) => {
      state.nearbyReadings = [];
      state.processedReadings = [];
      state.currentDepth = null;
      state.correctedDepth = null;
      state.depthQuality = null;
      state.error = null;
      state.lastEnvironmentalUpdate = null;
    },
    
    clearDepthError: (state) => {
      state.error = null;
    },
  },
});

export const {
  updateNearbyReadings,
  addDepthReading,
  updateProcessedReadings,
  addProcessedReading,
  updateCurrentDepth,
  updateDepthCorrections,
  setReportingMode,
  startDepthReporting,
  stopDepthReporting,
  updateVesselDraft,
  updateSafetyMargin,
  toggleDepthAlerts,
  toggleTideCorrections,
  toggleEnvironmentalCorrections,
  setQualityThreshold,
  setDisplayMode,
  addDepthAlert,
  acknowledgeAlert,
  dismissAlert,
  clearAcknowledgedAlerts,
  updateAlertSettings,
  autoAcknowledgeExpiredAlerts,
  setDepthError,
  clearDepthData,
  clearDepthError,
} = depthSlice.actions;

// Selectors for environmental integration
export const selectDepthState = (state: { depth: DepthState }) => state.depth;
export const selectNearbyReadings = (state: { depth: DepthState }) => state.depth.nearbyReadings;
export const selectProcessedReadings = (state: { depth: DepthState }) => state.depth.processedReadings;
export const selectCurrentDepth = (state: { depth: DepthState }) => state.depth.currentDepth;
export const selectCorrectedDepth = (state: { depth: DepthState }) => state.depth.correctedDepth;
export const selectDepthQuality = (state: { depth: DepthState }) => state.depth.depthQuality;
export const selectDisplayMode = (state: { depth: DepthState }) => state.depth.displayMode;
export const selectEnvironmentalSettings = (state: { depth: DepthState }) => ({
  enableTideCorrections: state.depth.enableTideCorrections,
  enableEnvironmentalCorrections: state.depth.enableEnvironmentalCorrections,
  qualityThreshold: state.depth.qualityThreshold,
  displayMode: state.depth.displayMode,
});
export const selectActiveAlerts = (state: { depth: DepthState }) => state.depth.activeAlerts;
export const selectCriticalAlerts = (state: { depth: DepthState }) => 
  state.depth.activeAlerts.filter(alert => alert.severity === 'critical' && !alert.acknowledged);
export const selectAlertSettings = (state: { depth: DepthState }) => state.depth.alertSettings;
export const selectVesselConfiguration = (state: { depth: DepthState }) => ({
  vesselDraft: state.depth.vesselDraft,
  safetyMargin: state.depth.safetyMargin,
  minSafeDepth: state.depth.minSafeDepth,
});

// Computed selectors
export const selectEffectiveDepth = (state: { depth: DepthState }) => {
  const { currentDepth, correctedDepth, displayMode } = state.depth;
  
  switch (displayMode) {
    case 'raw':
      return currentDepth;
    case 'corrected':
      return correctedDepth || currentDepth;
    case 'both':
      return { raw: currentDepth, corrected: correctedDepth };
    default:
      return correctedDepth || currentDepth;
  }
};

export const selectDepthSafety = (state: { depth: DepthState }) => {
  const { correctedDepth, currentDepth, vesselDraft, safetyMargin, depthQuality } = state.depth;
  const effectiveDepth = correctedDepth || currentDepth;
  
  if (effectiveDepth === null) {
    return { status: 'unknown', margin: null, quality: null };
  }
  
  const clearance = effectiveDepth - vesselDraft;
  const isSafe = clearance >= safetyMargin;
  const qualityScore = depthQuality?.score || 0;
  
  return {
    status: isSafe ? 'safe' : 'unsafe',
    clearance,
    margin: clearance - safetyMargin,
    quality: qualityScore,
    reliability: qualityScore > 0.8 ? 'high' : qualityScore > 0.6 ? 'medium' : 'low'
  };
};

export const selectLastEnvironmentalUpdate = (state: { depth: DepthState }) => state.depth.lastEnvironmentalUpdate;