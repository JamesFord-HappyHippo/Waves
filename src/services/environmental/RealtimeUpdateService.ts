/**
 * Real-time Environmental Data Update Service
 * WebSocket streaming for live environmental data updates
 */

import { EventEmitter } from 'events';
import { Location } from '../../types';
import { MarineWeatherExtended, MarineAlert } from './WeatherApiClient';
import { TidePrediction, WaterLevel } from './NoaaApiClient';
import { ProcessedDepthReading } from './DataProcessingService';

export interface RealtimeSubscription {
  id: string;
  location: Location;
  radius: number; // meters
  dataTypes: Array<'weather' | 'tides' | 'alerts' | 'depths' | 'conditions'>;
  updateInterval: number; // seconds
  priority: 'low' | 'medium' | 'high' | 'critical';
  callback: (update: RealtimeUpdate) => void;
  isActive: boolean;
  lastUpdate: number;
}

export interface RealtimeUpdate {
  type: 'weather' | 'tides' | 'alerts' | 'depths' | 'conditions' | 'emergency';
  timestamp: number;
  location: Location;
  data: any;
  source: string;
  severity?: 'info' | 'warning' | 'critical' | 'emergency';
  requiresAcknowledgment?: boolean;
}

export interface ConnectionStatus {
  isConnected: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  latency: number;
  reconnectAttempts: number;
  lastConnected: number;
  activeSubscriptions: number;
  dataTransferred: number; // bytes
}

export interface StreamingOptions {
  reconnectInterval: number; // ms
  maxReconnectAttempts: number;
  heartbeatInterval: number; // ms
  compressionEnabled: boolean;
  batteryOptimization: boolean;
  dataThrottling: boolean;
}

export class RealtimeUpdateService extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, RealtimeSubscription>();
  private connectionStatus: ConnectionStatus;
  private options: StreamingOptions;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private messageQueue: any[] = [];
  private lastHeartbeat = 0;

  constructor(options: Partial<StreamingOptions> = {}) {
    super();

    this.options = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      compressionEnabled: true,
      batteryOptimization: true,
      dataThrottling: true,
      ...options
    };

    this.connectionStatus = {
      isConnected: false,
      connectionQuality: 'disconnected',
      latency: 0,
      reconnectAttempts: 0,
      lastConnected: 0,
      activeSubscriptions: 0,
      dataTransferred: 0
    };
  }

  /**
   * Connect to real-time data stream
   */
  async connect(serverUrl?: string): Promise<void> {
    const wsUrl = serverUrl || this.getWebSocketUrl();
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws!.onopen = () => {
          clearTimeout(timeout);
          this.onConnected();
          resolve();
        };

        this.ws!.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
    } catch (error) {
      console.error('Failed to connect to real-time service:', error);
      throw error;
    }
  }

  /**
   * Disconnect from real-time data stream
   */
  disconnect(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    this.connectionStatus.isConnected = false;
    this.connectionStatus.connectionQuality = 'disconnected';
    this.emit('disconnected');
  }

  /**
   * Subscribe to real-time updates for a location
   */
  subscribe(subscription: Omit<RealtimeSubscription, 'id' | 'isActive' | 'lastUpdate'>): string {
    const id = this.generateSubscriptionId();
    const fullSubscription: RealtimeSubscription = {
      ...subscription,
      id,
      isActive: true,
      lastUpdate: Date.now()
    };

    this.subscriptions.set(id, fullSubscription);
    this.connectionStatus.activeSubscriptions = this.subscriptions.size;

    // Send subscription to server if connected
    if (this.connectionStatus.isConnected && this.ws) {
      this.sendMessage('subscribe', {
        subscriptionId: id,
        location: subscription.location,
        radius: subscription.radius,
        dataTypes: subscription.dataTypes,
        updateInterval: subscription.updateInterval,
        priority: subscription.priority
      });
    }

    this.emit('subscribed', { subscriptionId: id });
    return id;
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    subscription.isActive = false;
    this.subscriptions.delete(subscriptionId);
    this.connectionStatus.activeSubscriptions = this.subscriptions.size;

    // Send unsubscribe to server if connected
    if (this.connectionStatus.isConnected && this.ws) {
      this.sendMessage('unsubscribe', { subscriptionId });
    }

    this.emit('unsubscribed', { subscriptionId });
  }

  /**
   * Update subscription parameters
   */
  updateSubscription(subscriptionId: string, updates: Partial<RealtimeSubscription>): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    Object.assign(subscription, updates);

    // Send update to server if connected
    if (this.connectionStatus.isConnected && this.ws) {
      this.sendMessage('updateSubscription', {
        subscriptionId,
        updates
      });
    }

    this.emit('subscriptionUpdated', { subscriptionId, updates });
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): RealtimeSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.isActive);
  }

  /**
   * Optimize connection for battery life
   */
  enableBatteryOptimization(enabled: boolean = true): void {
    this.options.batteryOptimization = enabled;
    
    if (enabled) {
      // Reduce update frequency for low-priority subscriptions
      this.subscriptions.forEach(subscription => {
        if (subscription.priority === 'low') {
          subscription.updateInterval = Math.max(subscription.updateInterval, 60); // Min 1 minute
        }
      });

      // Enable data throttling
      this.options.dataThrottling = true;
    }

    this.emit('batteryOptimizationChanged', { enabled });
  }

  /**
   * Request emergency updates for critical situations
   */
  requestEmergencyUpdates(location: Location, emergencyType: 'distress' | 'medical' | 'fire' | 'collision'): string {
    const subscriptionId = this.subscribe({
      location,
      radius: 5000, // 5km for emergency
      dataTypes: ['weather', 'alerts', 'conditions'],
      updateInterval: 10, // 10 second updates
      priority: 'critical',
      callback: (update) => {
        this.emit('emergencyUpdate', { update, emergencyType });
      }
    });

    // Notify server of emergency
    if (this.connectionStatus.isConnected && this.ws) {
      this.sendMessage('emergency', {
        type: emergencyType,
        location,
        subscriptionId,
        timestamp: Date.now()
      });
    }

    return subscriptionId;
  }

  // Private methods

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.onConnected();
    };

    this.ws.onmessage = (event) => {
      this.onMessage(event);
    };

    this.ws.onclose = (event) => {
      this.onDisconnected(event);
    };

    this.ws.onerror = (error) => {
      this.onError(error);
    };
  }

  private onConnected(): void {
    this.connectionStatus.isConnected = true;
    this.connectionStatus.connectionQuality = 'excellent';
    this.connectionStatus.lastConnected = Date.now();
    this.connectionStatus.reconnectAttempts = 0;
    this.isReconnecting = false;

    // Start heartbeat
    this.startHeartbeat();

    // Resubscribe to active subscriptions
    this.resubscribeAll();

    // Process queued messages
    this.processMessageQueue();

    this.emit('connected', this.connectionStatus);
  }

  private onMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      this.connectionStatus.dataTransferred += event.data.length;
      
      switch (message.type) {
        case 'update':
          this.handleDataUpdate(message);
          break;
        case 'heartbeat':
          this.handleHeartbeat(message);
          break;
        case 'alert':
          this.handleAlert(message);
          break;
        case 'emergency':
          this.handleEmergency(message);
          break;
        case 'error':
          this.handleServerError(message);
          break;
        case 'subscriptionConfirmed':
          this.handleSubscriptionConfirmed(message);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private onDisconnected(event: CloseEvent): void {
    this.connectionStatus.isConnected = false;
    this.connectionStatus.connectionQuality = 'disconnected';

    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.emit('disconnected', { code: event.code, reason: event.reason });

    // Attempt to reconnect if not a normal closure
    if (event.code !== 1000 && !this.isReconnecting) {
      this.attemptReconnect();
    }
  }

  private onError(error: Event): void {
    console.error('WebSocket error:', error);
    this.connectionStatus.connectionQuality = 'poor';
    this.emit('error', error);
  }

  private handleDataUpdate(message: any): void {
    const update: RealtimeUpdate = {
      type: message.dataType,
      timestamp: message.timestamp,
      location: message.location,
      data: message.data,
      source: message.source,
      severity: message.severity
    };

    // Find subscriptions that match this update
    const matchingSubscriptions = this.findMatchingSubscriptions(update);
    
    matchingSubscriptions.forEach(subscription => {
      if (this.shouldDeliverUpdate(subscription, update)) {
        subscription.lastUpdate = Date.now();
        subscription.callback(update);
      }
    });

    this.emit('dataUpdate', update);
  }

  private handleHeartbeat(message: any): void {
    this.lastHeartbeat = Date.now();
    const latency = this.lastHeartbeat - message.timestamp;
    this.connectionStatus.latency = latency;

    // Update connection quality based on latency
    if (latency < 100) {
      this.connectionStatus.connectionQuality = 'excellent';
    } else if (latency < 300) {
      this.connectionStatus.connectionQuality = 'good';
    } else {
      this.connectionStatus.connectionQuality = 'poor';
    }

    // Send heartbeat response
    this.sendMessage('heartbeatResponse', { timestamp: Date.now() });
  }

  private handleAlert(message: any): void {
    const alert: RealtimeUpdate = {
      type: 'alerts',
      timestamp: message.timestamp,
      location: message.location,
      data: message.alert,
      source: message.source,
      severity: message.severity,
      requiresAcknowledgment: message.requiresAcknowledgment
    };

    this.emit('alertReceived', alert);

    // Deliver to relevant subscriptions
    const matchingSubscriptions = this.findMatchingSubscriptions(alert);
    matchingSubscriptions.forEach(subscription => {
      subscription.callback(alert);
    });
  }

  private handleEmergency(message: any): void {
    const emergency: RealtimeUpdate = {
      type: 'emergency',
      timestamp: message.timestamp,
      location: message.location,
      data: message.emergency,
      source: message.source,
      severity: 'emergency',
      requiresAcknowledgment: true
    };

    this.emit('emergencyReceived', emergency);
  }

  private handleServerError(message: any): void {
    console.error('Server error:', message.error);
    this.emit('serverError', message.error);
  }

  private handleSubscriptionConfirmed(message: any): void {
    this.emit('subscriptionConfirmed', {
      subscriptionId: message.subscriptionId,
      status: message.status
    });
  }

  private findMatchingSubscriptions(update: RealtimeUpdate): RealtimeSubscription[] {
    return Array.from(this.subscriptions.values()).filter(subscription => {
      if (!subscription.isActive) return false;
      if (!subscription.dataTypes.includes(update.type as any)) return false;
      
      // Check if update location is within subscription radius
      const distance = this.calculateDistance(
        subscription.location.latitude, subscription.location.longitude,
        update.location.latitude, update.location.longitude
      );
      
      return distance <= subscription.radius;
    });
  }

  private shouldDeliverUpdate(subscription: RealtimeSubscription, update: RealtimeUpdate): boolean {
    // Check update interval throttling
    const timeSinceLastUpdate = Date.now() - subscription.lastUpdate;
    const minInterval = subscription.updateInterval * 1000;
    
    if (this.options.dataThrottling && timeSinceLastUpdate < minInterval) {
      // Allow critical updates through throttling
      if (update.severity === 'critical' || update.severity === 'emergency') {
        return true;
      }
      return false;
    }

    // Battery optimization checks
    if (this.options.batteryOptimization && subscription.priority === 'low') {
      // Reduce low-priority updates when on battery
      return Math.random() > 0.5; // 50% chance for low priority
    }

    return true;
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionStatus.isConnected && this.ws) {
        this.sendMessage('heartbeat', { timestamp: Date.now() });
      }
    }, this.options.heartbeatInterval);
  }

  private sendMessage(type: string, data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message for later
      this.messageQueue.push({ type, data });
      return;
    }

    try {
      const message = JSON.stringify({ type, ...data });
      this.ws.send(message);
      this.connectionStatus.dataTransferred += message.length;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message.type, message.data);
      }
    }
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach(subscription => {
      if (subscription.isActive) {
        this.sendMessage('subscribe', {
          subscriptionId: subscription.id,
          location: subscription.location,
          radius: subscription.radius,
          dataTypes: subscription.dataTypes,
          updateInterval: subscription.updateInterval,
          priority: subscription.priority
        });
      }
    });
  }

  private attemptReconnect(): void {
    if (this.isReconnecting || this.connectionStatus.reconnectAttempts >= this.options.maxReconnectAttempts) {
      return;
    }

    this.isReconnecting = true;
    this.connectionStatus.reconnectAttempts++;

    const delay = this.options.reconnectInterval * Math.pow(2, this.connectionStatus.reconnectAttempts - 1);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.emit('reconnected', this.connectionStatus);
      } catch (error) {
        console.error('Reconnection attempt failed:', error);
        this.isReconnecting = false;
        
        if (this.connectionStatus.reconnectAttempts < this.options.maxReconnectAttempts) {
          this.attemptReconnect();
        } else {
          this.emit('reconnectionFailed');
        }
      }
    }, delay);
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getWebSocketUrl(): string {
    // In production, this would come from configuration
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/api/realtime`;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.disconnect();
    this.subscriptions.clear();
    this.messageQueue = [];
    this.removeAllListeners();
  }
}

export const realtimeUpdateService = new RealtimeUpdateService();