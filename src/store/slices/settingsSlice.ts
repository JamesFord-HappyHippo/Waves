/**
 * Settings State Management for Marine Navigation
 */

import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  vesselName?: string;
  vesselType?: 'sailboat' | 'powerboat' | 'kayak' | 'other';
  vesselLength?: number;
  vesselDraft?: number;
  experience?: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  preferredUnits: 'metric' | 'imperial' | 'nautical';
}

export interface SettingsState {
  user: UserProfile | null;
  units: 'metric' | 'imperial' | 'nautical';
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    depthAlerts: boolean;
    weatherAlerts: boolean;
    navigationAlerts: boolean;
    batteryOptimization: boolean;
    offlineMode: boolean;
  };
  privacy: {
    shareLocation: boolean;
    shareDepthData: boolean;
    anonymousMode: boolean;
    dataSharingConsent: boolean;
  };
  navigation: {
    autoFollowGPS: boolean;
    showCompass: boolean;
    showSpeed: boolean;
    voiceGuidance: boolean;
    nightMode: boolean;
  };
  safety: {
    safetyMargin: number;
    minimumDepthAlert: boolean;
    weatherWarnings: boolean;
    emergencyContacts: string[];
  };
}

const initialState: SettingsState = {
  user: null,
  units: 'nautical',
  theme: 'auto',
  language: 'en',
  notifications: {
    depthAlerts: true,
    weatherAlerts: true,
    navigationAlerts: true,
    batteryOptimization: true,
    offlineMode: false,
  },
  privacy: {
    shareLocation: false,
    shareDepthData: true,
    anonymousMode: false,
    dataSharingConsent: false,
  },
  navigation: {
    autoFollowGPS: true,
    showCompass: true,
    showSpeed: true,
    voiceGuidance: false,
    nightMode: false,
  },
  safety: {
    safetyMargin: 0.5,
    minimumDepthAlert: true,
    weatherWarnings: true,
    emergencyContacts: [],
  },
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateUserProfile: (state, action: PayloadAction<Partial<UserProfile>>) => {
      if (state.user) {
        state.user = {...state.user, ...action.payload};
      } else {
        state.user = action.payload as UserProfile;
      }
    },
    
    setUnits: (state, action: PayloadAction<'metric' | 'imperial' | 'nautical'>) => {
      state.units = action.payload;
      if (state.user) {
        state.user.preferredUnits = action.payload;
      }
    },
    
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'auto'>) => {
      state.theme = action.payload;
    },
    
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    
    updateNotificationSettings: (
      state,
      action: PayloadAction<Partial<SettingsState['notifications']>>,
    ) => {
      state.notifications = {...state.notifications, ...action.payload};
    },
    
    updatePrivacySettings: (
      state,
      action: PayloadAction<Partial<SettingsState['privacy']>>,
    ) => {
      state.privacy = {...state.privacy, ...action.payload};
    },
    
    updateNavigationSettings: (
      state,
      action: PayloadAction<Partial<SettingsState['navigation']>>,
    ) => {
      state.navigation = {...state.navigation, ...action.payload};
    },
    
    updateSafetySettings: (
      state,
      action: PayloadAction<Partial<SettingsState['safety']>>,
    ) => {
      state.safety = {...state.safety, ...action.payload};
    },
    
    addEmergencyContact: (state, action: PayloadAction<string>) => {
      state.safety.emergencyContacts.push(action.payload);
    },
    
    removeEmergencyContact: (state, action: PayloadAction<number>) => {
      state.safety.emergencyContacts.splice(action.payload, 1);
    },
    
    resetSettings: (state) => {
      // Reset to defaults but preserve user profile
      const user = state.user;
      Object.assign(state, initialState);
      state.user = user;
    },
  },
});

export const {
  updateUserProfile,
  setUnits,
  setTheme,
  setLanguage,
  updateNotificationSettings,
  updatePrivacySettings,
  updateNavigationSettings,
  updateSafetySettings,
  addEmergencyContact,
  removeEmergencyContact,
  resetSettings,
} = settingsSlice.actions;