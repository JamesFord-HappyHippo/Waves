/**
 * Offline Queue Service for Marine Navigation Data
 * Handles offline storage and synchronization of depth readings
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';
import { DepthReading } from '@/store/slices/depthSlice';
import { wavesApi } from '@/store/api/wavesApi';

export interface QueuedReading extends DepthReading {
  queuedAt: number;
  retryCount: number;
  syncStatus: 'pending' | 'syncing' | 'failed' | 'synced';
  lastError?: string;
}

export interface OfflineQueueConfig {
  maxRetries: number;
  retryDelays: number[];
  maxQueueSize: number;
  syncInterval: number;
  batchSize: number;
}

export class OfflineQueue {
  private static readonly STORAGE_KEY = '@waves_offline_depth_readings';
  private static readonly CONFIG_KEY = '@waves_offline_config';
  
  private static readonly DEFAULT_CONFIG: OfflineQueueConfig = {
    maxRetries: 3,
    retryDelays: [5000, 15000, 60000], // 5s, 15s, 1min
    maxQueueSize: 1000,
    syncInterval: 30000, // 30 seconds
    batchSize: 10,
  };

  private static config: OfflineQueueConfig = this.DEFAULT_CONFIG;
  private static syncTimer: NodeJS.Timeout | null = null;
  private static isSyncing = false;
  private static listeners: Array<(count: number) => void> = [];

  /**
   * Initialize the offline queue system
   */
  static async initialize(): Promise<void> {
    try {
      // Load configuration
      const savedConfig = await AsyncStorage.getItem(this.CONFIG_KEY);
      if (savedConfig) {
        this.config = { ...this.DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
      }

      // Start automatic sync when network is available
      const networkState = await NetInfo.fetch();
      if (networkState.isConnected) {
        this.startAutoSync();
      }

      // Listen for network state changes
      NetInfo.addEventListener(state => {
        if (state.isConnected && !this.syncTimer) {
          this.startAutoSync();
        } else if (!state.isConnected && this.syncTimer) {
          this.stopAutoSync();
        }
      });

    } catch (error) {
      console.error('Failed to initialize offline queue:', error);
    }
  }

  /**
   * Add a depth reading to the offline queue
   */
  static async addDepthReading(reading: DepthReading): Promise<void> {
    try {
      const queuedReading: QueuedReading = {
        ...reading,
        queuedAt: Date.now(),
        retryCount: 0,
        syncStatus: 'pending',
      };

      const queue = await this.getQueue();
      queue.push(queuedReading);

      // Enforce max queue size
      if (queue.length > this.config.maxQueueSize) {
        // Remove oldest entries (FIFO)
        queue.splice(0, queue.length - this.config.maxQueueSize);
      }

      await this.saveQueue(queue);
      this.notifyListeners(queue.length);

      // Try immediate sync if connected
      const networkState = await NetInfo.fetch();
      if (networkState.isConnected && !this.isSyncing) {
        this.syncPendingReadings();
      }

    } catch (error) {
      console.error('Failed to add reading to offline queue:', error);
      throw error;
    }
  }

  /**
   * Get pending readings count
   */
  static async getPendingCount(): Promise<number> {
    try {
      const queue = await this.getQueue();
      return queue.filter(r => r.syncStatus === 'pending' || r.syncStatus === 'failed').length;
    } catch (error) {
      console.error('Failed to get pending count:', error);
      return 0;
    }
  }

  /**
   * Get all queued readings
   */
  static async getQueuedReadings(): Promise<QueuedReading[]> {
    return this.getQueue();
  }

  /**
   * Sync pending readings to the server
   */
  static async syncPendingReadings(): Promise<number> {
    if (this.isSyncing) {
      return 0;
    }

    this.isSyncing = true;
    let syncedCount = 0;

    try {
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        throw new Error('No network connection');
      }

      const queue = await this.getQueue();
      const pendingReadings = queue.filter(
        r => r.syncStatus === 'pending' || r.syncStatus === 'failed'
      );

      if (pendingReadings.length === 0) {
        return 0;
      }

      // Process in batches
      for (let i = 0; i < pendingReadings.length; i += this.config.batchSize) {
        const batch = pendingReadings.slice(i, i + this.config.batchSize);
        
        for (const reading of batch) {
          try {
            // Mark as syncing
            reading.syncStatus = 'syncing';
            await this.saveQueue(queue);

            // Attempt to sync
            await this.syncSingleReading(reading);
            
            // Mark as synced
            reading.syncStatus = 'synced';
            syncedCount++;

          } catch (error) {
            console.error('Failed to sync reading:', error);
            
            reading.retryCount++;
            reading.lastError = error instanceof Error ? error.message : 'Unknown error';
            
            if (reading.retryCount >= this.config.maxRetries) {
              reading.syncStatus = 'failed';
            } else {
              reading.syncStatus = 'pending';
            }
          }
        }

        await this.saveQueue(queue);
      }

      // Clean up synced readings older than 24 hours
      await this.cleanupSyncedReadings();
      
      const remainingCount = await this.getPendingCount();
      this.notifyListeners(remainingCount);

      return syncedCount;

    } catch (error) {
      console.error('Sync operation failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single reading to the server
   */
  private static async syncSingleReading(reading: QueuedReading): Promise<void> {
    // In a real implementation, this would use the actual API endpoint
    // For now, we'll simulate the API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 10% failure rate for testing
        if (Math.random() < 0.1) {
          reject(new Error('Network timeout'));
        } else {
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * Start automatic synchronization
   */
  private static startAutoSync(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(async () => {
      try {
        await this.syncPendingReadings();
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    }, this.config.syncInterval);
  }

  /**
   * Stop automatic synchronization
   */
  private static stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Get queue from storage
   */
  private static async getQueue(): Promise<QueuedReading[]> {
    try {
      const queueData = await AsyncStorage.getItem(this.STORAGE_KEY);
      return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
      console.error('Failed to load queue from storage:', error);
      return [];
    }
  }

  /**
   * Save queue to storage
   */
  private static async saveQueue(queue: QueuedReading[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save queue to storage:', error);
      throw error;
    }
  }

  /**
   * Clean up old synced readings
   */
  private static async cleanupSyncedReadings(): Promise<void> {
    try {
      const queue = await this.getQueue();
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      
      const cleanedQueue = queue.filter(reading => {
        return reading.syncStatus !== 'synced' || reading.queuedAt > oneDayAgo;
      });

      if (cleanedQueue.length !== queue.length) {
        await this.saveQueue(cleanedQueue);
      }
    } catch (error) {
      console.error('Failed to cleanup synced readings:', error);
    }
  }

  /**
   * Add listener for queue changes
   */
  static addListener(callback: (count: number) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of queue changes
   */
  private static notifyListeners(count: number): void {
    this.listeners.forEach(callback => {
      try {
        callback(count);
      } catch (error) {
        console.error('Listener callback error:', error);
      }
    });
  }

  /**
   * Clear all queued readings (use with caution)
   */
  static async clearQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      this.notifyListeners(0);
    } catch (error) {
      console.error('Failed to clear queue:', error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  static async updateConfig(newConfig: Partial<OfflineQueueConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...newConfig };
      await AsyncStorage.setItem(this.CONFIG_KEY, JSON.stringify(this.config));
      
      // Restart auto-sync with new interval if changed
      if (newConfig.syncInterval && this.syncTimer) {
        this.stopAutoSync();
        this.startAutoSync();
      }
    } catch (error) {
      console.error('Failed to update config:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  static getConfig(): OfflineQueueConfig {
    return { ...this.config };
  }

  /**
   * Get queue statistics
   */
  static async getStatistics(): Promise<{
    total: number;
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
    oldestPending?: number;
  }> {
    try {
      const queue = await this.getQueue();
      
      const stats = {
        total: queue.length,
        pending: queue.filter(r => r.syncStatus === 'pending').length,
        syncing: queue.filter(r => r.syncStatus === 'syncing').length,
        synced: queue.filter(r => r.syncStatus === 'synced').length,
        failed: queue.filter(r => r.syncStatus === 'failed').length,
        oldestPending: undefined as number | undefined,
      };

      const pendingReadings = queue.filter(r => r.syncStatus === 'pending');
      if (pendingReadings.length > 0) {
        stats.oldestPending = Math.min(...pendingReadings.map(r => r.queuedAt));
      }

      return stats;
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        total: 0,
        pending: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
      };
    }
  }

  /**
   * Force retry failed readings
   */
  static async retryFailedReadings(): Promise<void> {
    try {
      const queue = await this.getQueue();
      const failedReadings = queue.filter(r => r.syncStatus === 'failed');
      
      failedReadings.forEach(reading => {
        reading.syncStatus = 'pending';
        reading.retryCount = 0;
        reading.lastError = undefined;
      });

      await this.saveQueue(queue);
      
      // Trigger immediate sync
      if (failedReadings.length > 0) {
        this.syncPendingReadings();
      }
    } catch (error) {
      console.error('Failed to retry failed readings:', error);
      throw error;
    }
  }
}