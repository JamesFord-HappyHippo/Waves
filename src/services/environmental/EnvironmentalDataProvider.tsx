/**
 * Environmental Data Provider for React Native
 * Integrates environmental services with mobile app context
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Location } from '../../types';
import { noaaClient, NoaaStation, TidePrediction, WaterLevel } from './NoaaApiClient';
import { weatherClient, MarineWeatherExtended, WeatherForecast, MarineAlert } from './WeatherApiClient';
import { dataProcessingService, ProcessedDepthReading } from './DataProcessingService';
import { cachingService } from './CachingService';
import { realtimeUpdateService, RealtimeSubscription, RealtimeUpdate } from './RealtimeUpdateService';
import { useAppSelector } from '../../store/hooks';
import { selectCurrentLocation } from '../../store/slices/locationSlice';

export interface EnvironmentalData {
  weather: MarineWeatherExtended | null;
  forecast: WeatherForecast[];
  tides: {
    station: NoaaStation | null;
    predictions: TidePrediction[];
    currentLevel: WaterLevel | null;
  };
  alerts: MarineAlert[];
  isLoading: boolean;
  lastUpdated: number | null;
  error: string | null;
  connectionStatus: 'connected' | 'offline' | 'error';
}

export interface EnvironmentalContextValue {
  data: EnvironmentalData;
  refreshData: () => Promise<void>;
  subscribeToLocation: (location: Location, radius?: number) => string;
  unsubscribeFromLocation: (subscriptionId: string) => void;
  getProcessedDepthReading: (reading: any) => Promise<ProcessedDepthReading | null>;
  enableRealtimeUpdates: (enabled: boolean) => void;
  isRealtimeEnabled: boolean;
  batteryOptimization: boolean;
  setBatteryOptimization: (enabled: boolean) => void;
}

const EnvironmentalContext = createContext<EnvironmentalContextValue | null>(null);

interface EnvironmentalDataProviderProps {
  children: ReactNode;
  enableAutoUpdates?: boolean;
  updateInterval?: number; // minutes
}

export const EnvironmentalDataProvider: React.FC<EnvironmentalDataProviderProps> = ({
  children,
  enableAutoUpdates = true,
  updateInterval = 10
}) => {
  const currentLocation = useAppSelector(selectCurrentLocation);
  
  const [data, setData] = useState<EnvironmentalData>({
    weather: null,
    forecast: [],
    tides: {
      station: null,
      predictions: [],
      currentLevel: null
    },
    alerts: [],
    isLoading: false,
    lastUpdated: null,
    error: null,
    connectionStatus: 'offline'
  });

  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false);
  const [batteryOptimization, setBatteryOptimizationState] = useState(true);
  const [activeSubscriptions, setActiveSubscriptions] = useState<Map<string, string>>(new Map());
  const [updateTimer, setUpdateTimer] = useState<NodeJS.Timeout | null>(null);

  // Initialize services
  useEffect(() => {
    initializeServices();
    setupAppStateListener();
    
    return () => {
      cleanup();
    };
  }, []);

  // Auto-refresh data when location changes
  useEffect(() => {
    if (currentLocation && enableAutoUpdates) {
      refreshData();
    }
  }, [currentLocation, enableAutoUpdates]);

  // Setup periodic updates
  useEffect(() => {
    if (enableAutoUpdates && updateInterval > 0) {
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') {
          refreshData();
        }
      }, updateInterval * 60 * 1000);

      setUpdateTimer(timer);

      return () => {
        if (timer) clearInterval(timer);
      };
    }
  }, [enableAutoUpdates, updateInterval]);

  const initializeServices = async () => {
    try {
      // Configure weather providers with API keys
      // In production, these would come from secure configuration
      weatherClient.configureProvider('stormglass', process.env.STORMGLASS_API_KEY || '');
      weatherClient.configureProvider('openweather', process.env.OPENWEATHER_API_KEY || '');
      
      // Initialize realtime service
      setupRealtimeService();
      
      setData(prev => ({ ...prev, connectionStatus: 'connected' }));
    } catch (error) {
      console.error('Failed to initialize environmental services:', error);
      setData(prev => ({ 
        ...prev, 
        error: 'Failed to initialize environmental services',
        connectionStatus: 'error'
      }));
    }
  };

  const setupRealtimeService = () => {
    realtimeUpdateService.on('connected', () => {
      setData(prev => ({ ...prev, connectionStatus: 'connected' }));
    });

    realtimeUpdateService.on('disconnected', () => {
      setData(prev => ({ ...prev, connectionStatus: 'offline' }));
    });

    realtimeUpdateService.on('dataUpdate', (update: RealtimeUpdate) => {
      handleRealtimeUpdate(update);
    });

    realtimeUpdateService.on('alertReceived', (alert: RealtimeUpdate) => {
      if (alert.type === 'alerts') {
        setData(prev => ({
          ...prev,
          alerts: [...prev.alerts, alert.data]
        }));
      }
    });

    realtimeUpdateService.on('emergencyReceived', (emergency: RealtimeUpdate) => {
      // Handle emergency updates with high priority
      console.warn('Emergency update received:', emergency);
      // Trigger immediate data refresh
      refreshData();
    });
  };

  const setupAppStateListener = () => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && data.lastUpdated) {
        const timeSinceUpdate = Date.now() - data.lastUpdated;
        const fiveMinutes = 5 * 60 * 1000;
        
        // Refresh if data is older than 5 minutes when app becomes active
        if (timeSinceUpdate > fiveMinutes) {
          refreshData();
        }
      } else if (nextAppState === 'background') {
        // Optimize for battery when in background
        realtimeUpdateService.enableBatteryOptimization(true);
      } else if (nextAppState === 'active') {
        // Restore normal operation when active
        realtimeUpdateService.enableBatteryOptimization(batteryOptimization);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  };

  const refreshData = useCallback(async () => {
    if (!currentLocation || data.isLoading) return;

    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Try to get cached data first
      let weather = await cachingService.getCachedWeatherData(currentLocation);
      let stations = await cachingService.getCachedStations(currentLocation);
      
      // If no cached data, fetch from APIs
      if (!weather || stations.length === 0) {
        const [fetchedWeather, fetchedStations] = await Promise.allSettled([
          weatherClient.getCurrentWeather(currentLocation),
          noaaClient.findNearestStations({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            maxStations: 3
          })
        ]);

        if (fetchedWeather.status === 'fulfilled') {
          weather = fetchedWeather.value;
          await cachingService.cacheWeatherData(currentLocation, weather, 'primary', 30);
        }

        if (fetchedStations.status === 'fulfilled') {
          stations = fetchedStations.value;
          await cachingService.cacheStations(stations);
        }
      }

      // Get tide data for nearest station
      let tideData = {
        station: null as NoaaStation | null,
        predictions: [] as TidePrediction[],
        currentLevel: null as WaterLevel | null
      };

      if (stations.length > 0) {
        const nearestStation = stations[0];
        tideData.station = nearestStation;

        // Try cached tide predictions first
        let predictions = await cachingService.getCachedTidePredictions(nearestStation.id);
        
        if (predictions.length === 0) {
          try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            predictions = await noaaClient.getTidePredictions({
              stationId: nearestStation.id,
              product: 'predictions',
              beginDate: now.toISOString().slice(0, 10).replace(/-/g, ''),
              endDate: tomorrow.toISOString().slice(0, 10).replace(/-/g, '')
            });

            await cachingService.cacheTidePredictions(nearestStation.id, predictions);
          } catch (error) {
            console.warn('Failed to fetch tide predictions:', error);
          }
        }

        tideData.predictions = predictions;

        // Get current water level
        try {
          const waterLevels = await noaaClient.getWaterLevels({
            stationId: nearestStation.id,
            product: 'water_level',
            beginDate: new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', ' ')
          });

          tideData.currentLevel = waterLevels.length > 0 ? waterLevels[waterLevels.length - 1] : null;
        } catch (error) {
          console.warn('Failed to fetch current water level:', error);
        }
      }

      // Get weather forecast
      let forecast: WeatherForecast[] = [];
      try {
        forecast = await weatherClient.getWeatherForecast(currentLocation, 24);
      } catch (error) {
        console.warn('Failed to fetch weather forecast:', error);
      }

      // Get marine alerts
      let alerts: MarineAlert[] = [];
      try {
        alerts = await weatherClient.getMarineAlerts(currentLocation);
        await cachingService.cacheMarineAlerts(alerts);
      } catch (error) {
        console.warn('Failed to fetch marine alerts:', error);
        // Try cached alerts as fallback
        alerts = await cachingService.getCachedMarineAlerts();
      }

      setData(prev => ({
        ...prev,
        weather,
        forecast,
        tides: tideData,
        alerts,
        isLoading: false,
        lastUpdated: Date.now(),
        error: null
      }));

    } catch (error) {
      console.error('Failed to refresh environmental data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  }, [currentLocation, data.isLoading]);

  const subscribeToLocation = useCallback((location: Location, radius: number = 5000): string => {
    if (!isRealtimeEnabled) {
      throw new Error('Realtime updates are not enabled');
    }

    const subscriptionId = realtimeUpdateService.subscribe({
      location,
      radius,
      dataTypes: ['weather', 'tides', 'alerts', 'conditions'],
      updateInterval: batteryOptimization ? 60 : 30, // Adjust based on battery optimization
      priority: 'medium',
      callback: handleRealtimeUpdate
    });

    const locationKey = `${location.latitude}_${location.longitude}`;
    setActiveSubscriptions(prev => new Map(prev.set(locationKey, subscriptionId)));

    return subscriptionId;
  }, [isRealtimeEnabled, batteryOptimization]);

  const unsubscribeFromLocation = useCallback((subscriptionId: string) => {
    realtimeUpdateService.unsubscribe(subscriptionId);
    
    // Remove from active subscriptions
    setActiveSubscriptions(prev => {
      const newMap = new Map(prev);
      for (const [key, value] of newMap.entries()) {
        if (value === subscriptionId) {
          newMap.delete(key);
          break;
        }
      }
      return newMap;
    });
  }, []);

  const handleRealtimeUpdate = useCallback((update: RealtimeUpdate) => {
    setData(prev => {
      const newData = { ...prev };

      switch (update.type) {
        case 'weather':
          newData.weather = update.data;
          break;
        case 'tides':
          if (update.data.predictions) {
            newData.tides.predictions = update.data.predictions;
          }
          if (update.data.currentLevel) {
            newData.tides.currentLevel = update.data.currentLevel;
          }
          break;
        case 'alerts':
          // Add new alert if not already present
          const alertExists = newData.alerts.some(alert => alert.id === update.data.id);
          if (!alertExists) {
            newData.alerts = [...newData.alerts, update.data];
          }
          break;
        case 'conditions':
          // Update environmental conditions
          if (newData.weather) {
            Object.assign(newData.weather, update.data);
          }
          break;
      }

      newData.lastUpdated = update.timestamp;
      return newData;
    });
  }, []);

  const getProcessedDepthReading = useCallback(async (reading: any): Promise<ProcessedDepthReading | null> => {
    if (!data.weather || !data.tides.station) {
      return null;
    }

    try {
      return await dataProcessingService.processDepthReading(
        reading,
        data.tides.station,
        data.tides.predictions,
        data.weather,
        data.tides.currentLevel || undefined
      );
    } catch (error) {
      console.error('Failed to process depth reading:', error);
      return null;
    }
  }, [data.weather, data.tides]);

  const enableRealtimeUpdates = useCallback(async (enabled: boolean) => {
    setIsRealtimeEnabled(enabled);

    if (enabled) {
      try {
        await realtimeUpdateService.connect();
        
        // Subscribe to current location if available
        if (currentLocation) {
          subscribeToLocation(currentLocation);
        }
      } catch (error) {
        console.error('Failed to enable realtime updates:', error);
        setIsRealtimeEnabled(false);
      }
    } else {
      // Unsubscribe from all locations
      activeSubscriptions.forEach(subscriptionId => {
        realtimeUpdateService.unsubscribe(subscriptionId);
      });
      setActiveSubscriptions(new Map());
      
      realtimeUpdateService.disconnect();
    }
  }, [currentLocation, subscribeToLocation, activeSubscriptions]);

  const setBatteryOptimization = useCallback((enabled: boolean) => {
    setBatteryOptimizationState(enabled);
    realtimeUpdateService.enableBatteryOptimization(enabled);
    
    // Update subscription intervals if realtime is enabled
    if (isRealtimeEnabled) {
      activeSubscriptions.forEach(subscriptionId => {
        realtimeUpdateService.updateSubscription(subscriptionId, {
          updateInterval: enabled ? 60 : 30
        });
      });
    }
  }, [isRealtimeEnabled, activeSubscriptions]);

  const cleanup = () => {
    if (updateTimer) {
      clearInterval(updateTimer);
    }
    
    realtimeUpdateService.disconnect();
    realtimeUpdateService.destroy();
  };

  const contextValue: EnvironmentalContextValue = {
    data,
    refreshData,
    subscribeToLocation,
    unsubscribeFromLocation,
    getProcessedDepthReading,
    enableRealtimeUpdates,
    isRealtimeEnabled,
    batteryOptimization,
    setBatteryOptimization
  };

  return (
    <EnvironmentalContext.Provider value={contextValue}>
      {children}
    </EnvironmentalContext.Provider>
  );
};

export const useEnvironmentalData = (): EnvironmentalContextValue => {
  const context = useContext(EnvironmentalContext);
  if (!context) {
    throw new Error('useEnvironmentalData must be used within an EnvironmentalDataProvider');
  }
  return context;
};

// Convenience hooks for specific data types
export const useWeatherData = () => {
  const { data } = useEnvironmentalData();
  return {
    weather: data.weather,
    forecast: data.forecast,
    isLoading: data.isLoading,
    error: data.error
  };
};

export const useTideData = () => {
  const { data } = useEnvironmentalData();
  return {
    station: data.tides.station,
    predictions: data.tides.predictions,
    currentLevel: data.tides.currentLevel,
    isLoading: data.isLoading,
    error: data.error
  };
};

export const useMarineAlerts = () => {
  const { data } = useEnvironmentalData();
  return {
    alerts: data.alerts,
    criticalAlerts: data.alerts.filter(alert => alert.severity === 'extreme' || alert.severity === 'severe'),
    isLoading: data.isLoading,
    error: data.error
  };
};