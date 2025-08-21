/**
 * Offline Data Service Provider for Marine Navigation
 * Handles offline data storage, sync, and management
 */

import React, {createContext, useContext, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import SQLite from 'react-native-sqlite-storage';

import {useAppDispatch, useAppSelector} from '@/store';
import {
  setOnlineStatus,
  addPendingDepthReport,
  startSync,
  completeSync,
  setSyncError,
  updateStorageUsage,
} from '@/store/slices/offlineSlice';

interface OfflineDataContextType {
  saveOfflineData: (key: string, data: any) => Promise<void>;
  getOfflineData: (key: string) => Promise<any | null>;
  removeOfflineData: (key: string) => Promise<void>;
  syncPendingData: () => Promise<void>;
  getStorageInfo: () => Promise<{used: number; available: number}>;
  initializeOfflineDatabase: () => Promise<void>;
}

const OfflineDataContext = createContext<OfflineDataContextType | null>(null);

export const useOfflineData = () => {
  const context = useContext(OfflineDataContext);
  if (!context) {
    throw new Error('useOfflineData must be used within OfflineDataProvider');
  }
  return context;
};

interface OfflineDataProviderProps {
  children: React.ReactNode;
}

// SQLite database instance
let db: SQLite.SQLiteDatabase | null = null;

// Storage keys for different data types
const STORAGE_KEYS = {
  DEPTH_READINGS: 'depth_readings',
  TRACKING_DATA: 'tracking_data',
  MAP_TILES: 'map_tiles',
  WEATHER_DATA: 'weather_data',
  USER_SETTINGS: 'user_settings',
  PENDING_SYNC: 'pending_sync',
};

export const OfflineDataProvider: React.FC<OfflineDataProviderProps> = ({children}) => {
  const dispatch = useAppDispatch();
  const {syncStatus} = useAppSelector(state => state.offline);

  useEffect(() => {
    // Initialize offline services
    initializeOfflineServices();

    // Set up network status monitoring
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected && state.isInternetReachable;
      dispatch(setOnlineStatus(isConnected || false));

      // Auto-sync when coming back online
      if (isConnected && syncStatus.autoSync && !syncStatus.syncInProgress) {
        syncPendingData();
      }
    });

    return () => {
      unsubscribe();
      if (db) {
        db.close();
      }
    };
  }, []);

  const initializeOfflineServices = async () => {
    try {
      await initializeOfflineDatabase();
      await updateStorageInformation();
    } catch (error) {
      console.error('Error initializing offline services:', error);
    }
  };

  const initializeOfflineDatabase = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      db = SQLite.openDatabase(
        {
          name: 'WavesOffline.db',
          location: 'default',
        },
        () => {
          console.log('SQLite database opened successfully');
          createTables().then(resolve).catch(reject);
        },
        (error) => {
          console.error('Error opening SQLite database:', error);
          reject(error);
        },
      );
    });
  };

  const createTables = async (): Promise<void> => {
    if (!db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      db!.transaction((tx) => {
        // Depth readings table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS depth_readings (
            id TEXT PRIMARY KEY,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            depth REAL NOT NULL,
            timestamp INTEGER NOT NULL,
            vessel_draft REAL,
            tide_correction REAL,
            confidence_score REAL,
            source TEXT,
            user_id TEXT,
            synced INTEGER DEFAULT 0
          )`,
        );

        // Location tracking table
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS location_tracks (
            id TEXT PRIMARY KEY,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            timestamp INTEGER NOT NULL,
            accuracy REAL,
            speed REAL,
            heading REAL,
            altitude REAL,
            synced INTEGER DEFAULT 0
          )`,
        );

        // Offline map tiles metadata
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS map_tiles (
            id TEXT PRIMARY KEY,
            z INTEGER NOT NULL,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            data BLOB,
            expires_at INTEGER,
            size INTEGER
          )`,
        );

        // Weather data cache
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS weather_cache (
            id TEXT PRIMARY KEY,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            data TEXT NOT NULL,
            cached_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
          )`,
        );
      }, 
      (error) => {
        console.error('Error creating tables:', error);
        reject(error);
      },
      () => {
        console.log('Tables created successfully');
        resolve();
      });
    });
  };

  const saveOfflineData = async (key: string, data: any): Promise<void> => {
    try {
      const jsonData = JSON.stringify(data);
      await AsyncStorage.setItem(key, jsonData);
      await updateStorageInformation();
    } catch (error) {
      console.error('Error saving offline data:', error);
      throw error;
    }
  };

  const getOfflineData = async (key: string): Promise<any | null> => {
    try {
      const jsonData = await AsyncStorage.getItem(key);
      return jsonData ? JSON.parse(jsonData) : null;
    } catch (error) {
      console.error('Error getting offline data:', error);
      return null;
    }
  };

  const removeOfflineData = async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
      await updateStorageInformation();
    } catch (error) {
      console.error('Error removing offline data:', error);
      throw error;
    }
  };

  const syncPendingData = async (): Promise<void> => {
    if (!syncStatus.isOnline || syncStatus.syncInProgress) {
      return;
    }

    try {
      dispatch(startSync());

      // Get pending depth readings from SQLite
      const pendingDepthReadings = await getPendingDepthReadings();
      
      // Get pending tracking data
      const pendingTrackingData = await getPendingTrackingData();

      if (pendingDepthReadings.length > 0 || pendingTrackingData.length > 0) {
        // Here you would make API calls to sync the data
        // For now, we'll simulate the sync
        console.log('Syncing data:', {
          depthReadings: pendingDepthReadings.length,
          trackingData: pendingTrackingData.length,
        });

        // Mark as synced in the database
        await markDataAsSynced(pendingDepthReadings, pendingTrackingData);
      }

      dispatch(completeSync());
    } catch (error) {
      console.error('Error syncing data:', error);
      dispatch(setSyncError(`Sync error: ${error}`));
    }
  };

  const getPendingDepthReadings = async (): Promise<any[]> => {
    if (!db) return [];

    return new Promise((resolve) => {
      db!.readTransaction((tx) => {
        tx.executeSql(
          'SELECT * FROM depth_readings WHERE synced = 0',
          [],
          (_, result) => {
            const readings = [];
            for (let i = 0; i < result.rows.length; i++) {
              readings.push(result.rows.item(i));
            }
            resolve(readings);
          },
          (_, error) => {
            console.error('Error getting pending depth readings:', error);
            resolve([]);
            return false;
          },
        );
      });
    });
  };

  const getPendingTrackingData = async (): Promise<any[]> => {
    if (!db) return [];

    return new Promise((resolve) => {
      db!.readTransaction((tx) => {
        tx.executeSql(
          'SELECT * FROM location_tracks WHERE synced = 0',
          [],
          (_, result) => {
            const tracks = [];
            for (let i = 0; i < result.rows.length; i++) {
              tracks.push(result.rows.item(i));
            }
            resolve(tracks);
          },
          (_, error) => {
            console.error('Error getting pending tracking data:', error);
            resolve([]);
            return false;
          },
        );
      });
    });
  };

  const markDataAsSynced = async (depthReadings: any[], trackingData: any[]): Promise<void> => {
    if (!db) return;

    return new Promise((resolve, reject) => {
      db!.transaction((tx) => {
        // Mark depth readings as synced
        depthReadings.forEach(reading => {
          tx.executeSql(
            'UPDATE depth_readings SET synced = 1 WHERE id = ?',
            [reading.id],
          );
        });

        // Mark tracking data as synced
        trackingData.forEach(track => {
          tx.executeSql(
            'UPDATE location_tracks SET synced = 1 WHERE id = ?',
            [track.id],
          );
        });
      },
      (error) => {
        console.error('Error marking data as synced:', error);
        reject(error);
      },
      () => {
        resolve();
      });
    });
  };

  const getStorageInfo = async (): Promise<{used: number; available: number}> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            totalSize += value.length;
          }
        } catch (error) {
          console.error(`Error getting size for key ${key}:`, error);
        }
      }

      // Rough estimate - actual available storage would need native module
      const estimatedAvailable = 1024 * 1024 * 1024; // 1GB estimate

      return {
        used: totalSize,
        available: estimatedAvailable,
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return {used: 0, available: 0};
    }
  };

  const updateStorageInformation = async () => {
    try {
      const storageInfo = await getStorageInfo();
      dispatch(updateStorageUsage({
        used: storageInfo.used,
        cache: storageInfo.used, // For now, treat as same
      }));
    } catch (error) {
      console.error('Error updating storage information:', error);
    }
  };

  const contextValue: OfflineDataContextType = {
    saveOfflineData,
    getOfflineData,
    removeOfflineData,
    syncPendingData,
    getStorageInfo,
    initializeOfflineDatabase,
  };

  return (
    <OfflineDataContext.Provider value={contextValue}>
      {children}
    </OfflineDataContext.Provider>
  );
};