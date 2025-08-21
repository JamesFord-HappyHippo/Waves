/**
 * MapBox Service Provider for Marine Charts
 * Handles offline map caching and marine-specific map layers
 */

import React, {createContext, useContext, useEffect, useState} from 'react';
import {Platform} from 'react-native';
import MapboxGL from '@react-native-mapbox-gl/maps';
import Config from 'react-native-config';

import {useAppDispatch, useAppSelector} from '@/store';
import {
  addOfflineRegion,
  removeOfflineRegion,
  startOfflineMapDownload,
  updateDownloadProgress,
  completeOfflineMapDownload,
} from '@/store/slices/mapSlice';

// Initialize MapBox
MapboxGL.setAccessToken(Config.REACT_NATIVE_MAPBOX_ACCESS_TOKEN || '');

// Set telemetry off for privacy
MapboxGL.setTelemetryEnabled(false);

interface MapboxContextType {
  isMapReady: boolean;
  downloadOfflineRegion: (bounds: MapBounds, name: string) => Promise<void>;
  removeOfflineRegion: (regionId: string) => Promise<void>;
  getOfflineRegions: () => Promise<MapboxOfflineRegion[]>;
  setMapStyle: (style: string) => void;
}

interface MapBounds {
  northEast: [number, number]; // [longitude, latitude]
  southWest: [number, number]; // [longitude, latitude]
}

interface MapboxOfflineRegion {
  id: string;
  name: string;
  bounds: MapBounds;
  minZoom: number;
  maxZoom: number;
  size: number;
}

const MapboxContext = createContext<MapboxContextType | null>(null);

export const useMapbox = () => {
  const context = useContext(MapboxContext);
  if (!context) {
    throw new Error('useMapbox must be used within MapboxProvider');
  }
  return context;
};

interface MapboxProviderProps {
  children: React.ReactNode;
}

// Marine chart style URLs
export const MARINE_STYLES = {
  marine: 'mapbox://styles/mapbox/light-v11', // Light base with marine overlays
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  hybrid: 'mapbox://styles/mapbox/satellite-v9',
  navigation: 'mapbox://styles/mapbox/navigation-day-v1',
};

export const MapboxProvider: React.FC<MapboxProviderProps> = ({children}) => {
  const dispatch = useAppDispatch();
  const {offlineRegions} = useAppSelector(state => state.map);
  
  const [isMapReady, setIsMapReady] = useState(false);
  const [currentMapStyle, setCurrentMapStyle] = useState(MARINE_STYLES.marine);

  useEffect(() => {
    // Initialize MapBox when component mounts
    const initializeMapbox = async () => {
      try {
        // Check if we have a valid access token
        if (!Config.REACT_NATIVE_MAPBOX_ACCESS_TOKEN) {
          console.warn('MapBox access token not configured');
          return;
        }

        // Set connected status
        MapboxGL.setConnected(true);
        
        // Load existing offline regions
        await loadOfflineRegions();
        
        setIsMapReady(true);
      } catch (error) {
        console.error('MapBox initialization error:', error);
      }
    };

    initializeMapbox();
  }, []);

  const loadOfflineRegions = async () => {
    try {
      const regions = await MapboxGL.offlineManager.getPacks();
      regions.forEach(region => {
        const metadata = JSON.parse(region.metadata);
        dispatch(addOfflineRegion({
          id: region.name,
          name: metadata.name || region.name,
          bounds: metadata.bounds,
          minZoom: metadata.minZoom,
          maxZoom: metadata.maxZoom,
          downloadedAt: metadata.downloadedAt || Date.now(),
          size: region.size / (1024 * 1024), // Convert to MB
          includesDepthData: metadata.includesDepthData || false,
        }));
      });
    } catch (error) {
      console.error('Error loading offline regions:', error);
    }
  };

  const downloadOfflineRegion = async (bounds: MapBounds, name: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        dispatch(startOfflineMapDownload());

        const packOptions = {
          name: name,
          styleURL: currentMapStyle,
          bounds: bounds,
          minZoom: 8,
          maxZoom: 16,
          metadata: JSON.stringify({
            name: name,
            bounds: bounds,
            minZoom: 8,
            maxZoom: 16,
            downloadedAt: Date.now(),
            includesDepthData: true,
          }),
        };

        // Create offline pack
        const pack = await MapboxGL.offlineManager.createPack(packOptions);

        // Listen for progress updates
        pack.on('progress', (progress) => {
          const percentage = (progress.completedResourceCount / progress.requiredResourceCount) * 100;
          dispatch(updateDownloadProgress(percentage));
        });

        pack.on('complete', () => {
          dispatch(completeOfflineMapDownload());
          dispatch(addOfflineRegion({
            id: name,
            name: name,
            bounds: {
              northEast: {
                latitude: bounds.northEast[1],
                longitude: bounds.northEast[0],
              },
              southWest: {
                latitude: bounds.southWest[1],
                longitude: bounds.southWest[0],
              },
            },
            minZoom: 8,
            maxZoom: 16,
            downloadedAt: Date.now(),
            size: 0, // Will be updated when we get actual size
            includesDepthData: true,
          }));
          resolve();
        });

        pack.on('error', (error) => {
          console.error('Offline pack download error:', error);
          reject(error);
        });

        // Start the download
        pack.resume();

      } catch (error) {
        console.error('Error creating offline pack:', error);
        reject(error);
      }
    });
  };

  const removeOfflineRegionById = async (regionId: string): Promise<void> => {
    try {
      await MapboxGL.offlineManager.deletePack(regionId);
      dispatch(removeOfflineRegion(regionId));
    } catch (error) {
      console.error('Error removing offline region:', error);
      throw error;
    }
  };

  const getOfflineRegions = async (): Promise<MapboxOfflineRegion[]> => {
    try {
      const packs = await MapboxGL.offlineManager.getPacks();
      return packs.map(pack => {
        const metadata = JSON.parse(pack.metadata);
        return {
          id: pack.name,
          name: metadata.name || pack.name,
          bounds: metadata.bounds,
          minZoom: metadata.minZoom,
          maxZoom: metadata.maxZoom,
          size: pack.size,
        };
      });
    } catch (error) {
      console.error('Error getting offline regions:', error);
      return [];
    }
  };

  const setMapStyle = (style: string) => {
    setCurrentMapStyle(style);
  };

  const contextValue: MapboxContextType = {
    isMapReady,
    downloadOfflineRegion,
    removeOfflineRegion: removeOfflineRegionById,
    getOfflineRegions,
    setMapStyle,
  };

  return (
    <MapboxContext.Provider value={contextValue}>
      {children}
    </MapboxContext.Provider>
  );
};