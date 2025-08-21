/**
 * RTK Query API for Waves Marine Navigation App
 */

import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react';
import Config from 'react-native-config';
import {DepthReading} from '../slices/depthSlice';

export interface DepthDataQuery {
  latitude: number;
  longitude: number;
  radius?: number;
  draft?: number;
  minConfidence?: number;
}

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  waveHeight: number;
  visibility: number;
  conditions: string;
  forecast: Array<{
    time: number;
    temperature: number;
    windSpeed: number;
    windDirection: number;
    conditions: string;
  }>;
}

export interface TideData {
  currentLevel: number;
  nextHigh: {time: number; level: number};
  nextLow: {time: number; level: number};
  station: string;
  predictions: Array<{
    time: number;
    level: number;
    type: 'high' | 'low';
  }>;
}

// Enhanced environmental data interfaces
export interface EnvironmentalData {
  weather: {
    current: any; // MarineWeatherExtended
    forecast: any[]; // WeatherForecast[]
    source: string;
    lastUpdated: number;
  };
  tides: {
    station: any; // NoaaStation
    predictions: any[]; // TidePrediction[]
    currentLevel: any; // WaterLevel
    source: string;
    lastUpdated: number;
  };
  alerts: any[]; // MarineAlert[]
  processingMetadata: {
    dataAge: number;
    qualityScore: number;
    corrections: {
      tide: number;
      environmental: number;
      total: number;
    };
  };
}

export interface ProcessDepthRequest {
  depthReading: {
    id: string;
    latitude: number;
    longitude: number;
    depth: number;
    timestamp: number;
    vesselDraft: number;
    confidenceScore: number;
    source: string;
  };
  includeCorrections: boolean;
  includeTideData: boolean;
  includeWeatherData: boolean;
}

export const wavesApi = createApi({
  reducerPath: 'wavesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: Config.API_BASE_URL || 'https://api.wavesapp.com',
    prepareHeaders: (headers, {getState}) => {
      headers.set('Content-Type', 'application/json');
      
      // Add authorization if available
      // const token = (getState() as RootState).auth?.token;
      // if (token) {
      //   headers.set('Authorization', `Bearer ${token}`);
      // }
      
      return headers;
    },
  }),
  tagTypes: ['DepthData', 'WeatherData', 'TideData', 'UserData'],
  endpoints: (builder) => ({
    // Depth data endpoints
    getDepthData: builder.query<DepthReading[], DepthDataQuery>({
      query: ({latitude, longitude, radius = 1000, draft, minConfidence = 0.7}) =>
        `/depth?lat=${latitude}&lon=${longitude}&radius=${radius}&draft=${draft}&minConfidence=${minConfidence}`,
      providesTags: ['DepthData'],
      // Cache for 5 minutes
      keepUnusedDataFor: 300,
    }),
    
    submitDepthReading: builder.mutation<{success: boolean}, Partial<DepthReading>>({
      query: (depthReading) => ({
        url: '/depth',
        method: 'POST',
        body: depthReading,
      }),
      invalidatesTags: ['DepthData'],
    }),
    
    // Weather data endpoints
    getWeatherData: builder.query<WeatherData, {latitude: number; longitude: number}>({
      query: ({latitude, longitude}) => `/weather?lat=${latitude}&lon=${longitude}`,
      providesTags: ['WeatherData'],
      // Cache for 30 minutes
      keepUnusedDataFor: 1800,
    }),
    
    // Tide data endpoints
    getTideData: builder.query<TideData, {latitude: number; longitude: number}>({
      query: ({latitude, longitude}) => `/tides?lat=${latitude}&lon=${longitude}`,
      providesTags: ['TideData'],
      // Cache for 1 hour
      keepUnusedDataFor: 3600,
    }),
    
    // User profile endpoints
    getUserProfile: builder.query<any, string>({
      query: (userId) => `/users/${userId}`,
      providesTags: ['UserData'],
    }),
    
    updateUserProfile: builder.mutation<any, {userId: string; profile: any}>({
      query: ({userId, profile}) => ({
        url: `/users/${userId}`,
        method: 'PUT',
        body: profile,
      }),
      invalidatesTags: ['UserData'],
    }),
    
    // Emergency endpoints
    submitEmergencyAlert: builder.mutation<{success: boolean}, {
      latitude: number;
      longitude: number;
      message: string;
      type: 'distress' | 'pan-pan' | 'security';
    }>({
      query: (alert) => ({
        url: '/emergency',
        method: 'POST',
        body: alert,
      }),
    }),
    
    // Enhanced environmental data endpoints
    getEnvironmentalData: builder.query<EnvironmentalData, {
      latitude: number;
      longitude: number;
      includeWeather?: boolean;
      includeTides?: boolean;
      includeAlerts?: boolean;
    }>({
      query: ({latitude, longitude, includeWeather = true, includeTides = true, includeAlerts = true}) => {
        const params = new URLSearchParams({
          lat: latitude.toString(),
          lon: longitude.toString(),
          weather: includeWeather.toString(),
          tides: includeTides.toString(),
          alerts: includeAlerts.toString()
        });
        return `/environmental?${params.toString()}`;
      },
      providesTags: ['WeatherData', 'TideData'],
      keepUnusedDataFor: 900,
    }),

    processDepthReading: builder.mutation<any, ProcessDepthRequest>({
      query: (request) => ({
        url: '/depth/process',
        method: 'POST',
        body: request,
      }),
      invalidatesTags: ['DepthData'],
    }),

    getNearestStations: builder.query<any[], {
      latitude: number;
      longitude: number;
      maxDistance?: number;
    }>({
      query: ({latitude, longitude, maxDistance = 50}) => {
        const params = new URLSearchParams({
          lat: latitude.toString(),
          lon: longitude.toString(),
          maxDistance: maxDistance.toString()
        });
        return `/stations/nearest?${params.toString()}`;
      },
      providesTags: ['TideData'],
      keepUnusedDataFor: 86400,
    }),

    // Offline sync endpoint
    syncOfflineData: builder.mutation<{success: boolean}, {
      depthReadings: DepthReading[];
      trackingData: any[];
      environmentalData?: any[];
    }>({
      query: (data) => ({
        url: '/sync',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['DepthData', 'WeatherData', 'TideData'],
    }),
  }),
});

export const {
  useGetDepthDataQuery,
  useSubmitDepthReadingMutation,
  useGetWeatherDataQuery,
  useGetTideDataQuery,
  useGetUserProfileQuery,
  useUpdateUserProfileMutation,
  useSubmitEmergencyAlertMutation,
  useSyncOfflineDataMutation,
  // New environmental data hooks
  useGetEnvironmentalDataQuery,
  useProcessDepthReadingMutation,
  useGetNearestStationsQuery,
} = wavesApi;