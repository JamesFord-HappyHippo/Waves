/**
 * Storage utilities for offline data management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
export const STORAGE_KEYS = {
  USER_SETTINGS: 'user_settings',
  OFFLINE_MAPS: 'offline_maps',
  DEPTH_READINGS: 'depth_readings',
  ROUTES: 'routes',
  WAYPOINTS: 'waypoints',
  TRACKING_HISTORY: 'tracking_history',
  WEATHER_CACHE: 'weather_cache',
  TIDE_CACHE: 'tide_cache',
} as const;

/**
 * Safely store JSON data
 */
export const storeData = async <T>(key: string, data: T): Promise<void> => {
  try {
    const jsonData = JSON.stringify(data);
    await AsyncStorage.setItem(key, jsonData);
  } catch (error) {
    console.error('Error storing data:', error);
    throw new Error(`Failed to store data for key: ${key}`);
  }
};

/**
 * Safely retrieve and parse JSON data
 */
export const getData = async <T>(key: string): Promise<T | null> => {
  try {
    const jsonData = await AsyncStorage.getItem(key);
    return jsonData ? JSON.parse(jsonData) : null;
  } catch (error) {
    console.error('Error getting data:', error);
    return null;
  }
};

/**
 * Remove data by key
 */
export const removeData = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing data:', error);
    throw new Error(`Failed to remove data for key: ${key}`);
  }
};

/**
 * Clear all app data
 */
export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    console.error('Error clearing all data:', error);
    throw new Error('Failed to clear all data');
  }
};

/**
 * Get storage usage information
 */
export const getStorageInfo = async (): Promise<{
  keys: string[];
  totalSize: number;
}> => {
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

    return { keys, totalSize };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return { keys: [], totalSize: 0 };
  }
};

/**
 * Batch operations for better performance
 */
export const batchStore = async <T>(items: Array<{key: string; data: T}>): Promise<void> => {
  try {
    const keyValuePairs = items.map(({key, data}) => [key, JSON.stringify(data)]);
    await AsyncStorage.multiSet(keyValuePairs as string[][]);
  } catch (error) {
    console.error('Error in batch store:', error);
    throw new Error('Failed to batch store data');
  }
};

/**
 * Batch retrieve operations
 */
export const batchGet = async <T>(keys: string[]): Promise<Array<{key: string; data: T | null}>> => {
  try {
    const keyValuePairs = await AsyncStorage.multiGet(keys);
    return keyValuePairs.map(([key, value]) => ({
      key,
      data: value ? JSON.parse(value) : null,
    }));
  } catch (error) {
    console.error('Error in batch get:', error);
    return keys.map(key => ({key, data: null}));
  }
};

/**
 * Cache data with expiration
 */
export const cacheData = async <T>(
  key: string,
  data: T,
  ttlMs: number = 30 * 60 * 1000, // 30 minutes default
): Promise<void> => {
  const cacheItem = {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  };
  
  await storeData(key, cacheItem);
};

/**
 * Get cached data if not expired
 */
export const getCachedData = async <T>(key: string): Promise<T | null> => {
  try {
    const cacheItem = await getData<{
      data: T;
      timestamp: number;
      ttl: number;
    }>(key);
    
    if (!cacheItem) return null;
    
    const now = Date.now();
    const isExpired = (now - cacheItem.timestamp) > cacheItem.ttl;
    
    if (isExpired) {
      await removeData(key);
      return null;
    }
    
    return cacheItem.data;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
};

/**
 * Clean up expired cache entries
 */
export const cleanupExpiredCache = async (): Promise<number> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    let cleanedCount = 0;
    
    for (const key of keys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value);
          if (parsed.timestamp && parsed.ttl) {
            const now = Date.now();
            const isExpired = (now - parsed.timestamp) > parsed.ttl;
            if (isExpired) {
              await AsyncStorage.removeItem(key);
              cleanedCount++;
            }
          }
        }
      } catch (error) {
        // Skip invalid cache entries
        continue;
      }
    }
    
    return cleanedCount;
  } catch (error) {
    console.error('Error cleaning up cache:', error);
    return 0;
  }
};

/**
 * Migrate data between versions
 */
export const migrateData = async (
  fromVersion: string,
  toVersion: string,
  migrations: Record<string, (data: any) => any>,
): Promise<void> => {
  try {
    const versionKey = 'data_version';
    const currentVersion = await getData<string>(versionKey);
    
    if (currentVersion !== fromVersion) return;
    
    const migrationKey = `${fromVersion}_to_${toVersion}`;
    const migration = migrations[migrationKey];
    
    if (migration) {
      // Get all data, migrate, and store back
      const keys = await AsyncStorage.getAllKeys();
      const keyValuePairs = await AsyncStorage.multiGet(keys);
      
      const migratedData = keyValuePairs
        .filter(([key]) => key !== versionKey)
        .map(([key, value]) => {
          try {
            const parsedData = value ? JSON.parse(value) : null;
            const migratedData = parsedData ? migration(parsedData) : null;
            return [key, migratedData ? JSON.stringify(migratedData) : null];
          } catch (error) {
            console.error(`Error migrating data for key ${key}:`, error);
            return [key, value]; // Keep original if migration fails
          }
        })
        .filter(([, value]) => value !== null) as string[][];
      
      // Store migrated data
      await AsyncStorage.multiSet(migratedData);
      
      // Update version
      await storeData(versionKey, toVersion);
    }
  } catch (error) {
    console.error('Error migrating data:', error);
    throw new Error('Data migration failed');
  }
};