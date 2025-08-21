/**
 * Safety Alert Hierarchy System - Manages escalating safety alerts and emergency protocols
 * Handles critical alerts, warning hierarchy, and emergency response coordination
 */

import { Location, NavigationAlert } from '../types';
import { GroundingAlert, EmergencyContact } from './SafetySystem';

export type AlertSeverity = 'info' | 'caution' | 'warning' | 'critical' | 'emergency';
export type AlertCategory = 'grounding' | 'navigation' | 'weather' | 'mechanical' | 'collision' | 'emergency';

export interface SafetyAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  location: Location;
  timestamp: number;
  timeToImpact?: number; // seconds until potential incident
  automaticResponse?: boolean;
  acknowledgmentRequired: boolean;
  escalationLevel: number; // 0-5, 5 being highest
  audioAlert: AudioAlertConfig;
  visualAlert: VisualAlertConfig;
  hapticAlert: HapticAlertConfig;
  broadcastRequired: boolean; // Should alert be broadcast to nearby vessels
  emergencyContacts: string[]; // IDs of relevant emergency contacts
  actionItems: AlertAction[];
  dismissible: boolean;
  autoExpiry?: number; // Auto-dismiss after this many seconds
  metadata: Record<string, any>;
}

export interface AudioAlertConfig {
  enabled: boolean;
  soundType: 'beep' | 'alarm' | 'voice' | 'horn' | 'bell' | 'siren';
  volume: number; // 0-1
  frequency: 'once' | 'repeating' | 'continuous';
  interval?: number; // seconds between repeats
  duration?: number; // seconds for continuous alerts
  priority: number; // 1-10, higher numbers override lower priority sounds
}

export interface VisualAlertConfig {
  enabled: boolean;
  color: string;
  animation: 'static' | 'pulse' | 'flash' | 'slide' | 'bounce';
  icon: string;
  position: 'top' | 'center' | 'bottom' | 'overlay' | 'banner';
  opacity: number;
  fullScreen: boolean;
  overlay: boolean; // Blocks other UI interactions
}

export interface HapticAlertConfig {
  enabled: boolean;
  pattern: 'light' | 'medium' | 'heavy' | 'pulse' | 'emergency';
  duration: number; // milliseconds
  repeats: number;
  interval?: number; // milliseconds between repeats
}

export interface AlertAction {
  id: string;
  type: 'navigate' | 'call' | 'broadcast' | 'log' | 'stop' | 'reduce_speed' | 'change_course';
  label: string;
  description: string;
  automatic: boolean;
  priority: number;
  parameters: Record<string, any>;
  confirmationRequired: boolean;
  emergencyAction: boolean;
}

export interface AlertEscalationRule {
  alertCategory: AlertCategory;
  severity: AlertSeverity;
  timeThreshold: number; // seconds before escalation
  escalateTo: AlertSeverity;
  conditions: Array<{
    type: 'acknowledgment_timeout' | 'proximity_increase' | 'speed_increase' | 'manual_override';
    parameters: Record<string, any>;
  }>;
  actions: string[]; // Action IDs to trigger on escalation
}

export interface EmergencyProtocol {
  id: string;
  name: string;
  triggerConditions: Array<{
    severity: AlertSeverity;
    category: AlertCategory;
    timeConstraint?: number;
  }>;
  activationSequence: Array<{
    step: number;
    action: string;
    automatic: boolean;
    timeout: number;
    fallback?: string;
  }>;
  emergencyContacts: EmergencyContact[];
  broadcastMessage: string;
  locationSharing: boolean;
  vessselInformation: boolean;
  coordinationMode: 'automatic' | 'manual' | 'hybrid';
}

export interface AlertMetrics {
  totalAlerts: number;
  alertsByCategory: Record<AlertCategory, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  averageResponseTime: number;
  escalationRate: number;
  falsePositiveRate: number;
  userSatisfactionScore: number;
}

export class SafetyAlertHierarchy {
  private activeAlerts: Map<string, SafetyAlert> = new Map();
  private alertHistory: SafetyAlert[] = [];
  private escalationRules: AlertEscalationRule[] = [];
  private emergencyProtocols: EmergencyProtocol[] = [];
  private alertSubscribers: Array<(alert: SafetyAlert) => void> = [];
  private emergencySubscribers: Array<(protocol: EmergencyProtocol) => void> = [];
  private metrics: AlertMetrics;

  constructor() {
    this.metrics = {
      totalAlerts: 0,
      alertsByCategory: {} as Record<AlertCategory, number>,
      alertsBySeverity: {} as Record<AlertSeverity, number>,
      averageResponseTime: 0,
      escalationRate: 0,
      falsePositiveRate: 0,
      userSatisfactionScore: 0
    };

    this.initializeDefaultEscalationRules();
    this.initializeEmergencyProtocols();
  }

  /**
   * Create and process a new safety alert
   */
  createAlert(
    severity: AlertSeverity,
    category: AlertCategory,
    title: string,
    message: string,
    location: Location,
    options: Partial<SafetyAlert> = {}
  ): SafetyAlert {
    const alert: SafetyAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity,
      category,
      title,
      message,
      location,
      timestamp: Date.now(),
      automaticResponse: false,
      acknowledgmentRequired: severity === 'critical' || severity === 'emergency',
      escalationLevel: this.getSeverityLevel(severity),
      audioAlert: this.getDefaultAudioConfig(severity),
      visualAlert: this.getDefaultVisualConfig(severity),
      hapticAlert: this.getDefaultHapticConfig(severity),
      broadcastRequired: severity === 'emergency' || severity === 'critical',
      emergencyContacts: [],
      actionItems: this.getDefaultActions(category, severity),
      dismissible: severity !== 'emergency' && severity !== 'critical',
      metadata: {},
      ...options
    };

    // Process the alert
    this.processAlert(alert);
    
    return alert;
  }

  /**
   * Process and route a safety alert through the system
   */
  private processAlert(alert: SafetyAlert): void {
    // Store active alert
    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Update metrics
    this.updateMetrics(alert);

    // Check for emergency protocol activation
    if (alert.severity === 'emergency') {
      this.activateEmergencyProtocol(alert);
    }

    // Notify subscribers
    this.notifyAlertSubscribers(alert);

    // Schedule escalation check if applicable
    this.scheduleEscalationCheck(alert);

    // Handle automatic responses
    if (alert.automaticResponse) {
      this.executeAutomaticActions(alert);
    }

    // Set auto-expiry if configured
    if (alert.autoExpiry) {
      setTimeout(() => {
        this.dismissAlert(alert.id);
      }, alert.autoExpiry * 1000);
    }

    console.log(`[SAFETY ALERT] ${alert.severity.toUpperCase()}: ${alert.title}`);
  }

  /**
   * Acknowledge an alert and stop escalation
   */
  acknowledgeAlert(alertId: string, userId?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.metadata.acknowledgedAt = Date.now();
    alert.metadata.acknowledgedBy = userId;

    // Stop audio/haptic alerts for acknowledged non-emergency alerts
    if (alert.severity !== 'emergency') {
      alert.audioAlert.enabled = false;
      alert.hapticAlert.enabled = false;
    }

    console.log(`[ALERT ACK] Alert ${alertId} acknowledged by ${userId || 'system'}`);
    return true;
  }

  /**
   * Dismiss an alert if it's dismissible
   */
  dismissAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert || !alert.dismissible) return false;

    alert.metadata.dismissedAt = Date.now();
    this.activeAlerts.delete(alertId);

    console.log(`[ALERT DISMISS] Alert ${alertId} dismissed`);
    return true;
  }

  /**
   * Escalate an alert to higher severity
   */
  escalateAlert(alertId: string, newSeverity: AlertSeverity, reason: string): SafetyAlert | null {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return null;

    const oldSeverity = alert.severity;
    alert.severity = newSeverity;
    alert.escalationLevel = this.getSeverityLevel(newSeverity);
    alert.metadata.escalatedFrom = oldSeverity;
    alert.metadata.escalationReason = reason;
    alert.metadata.escalatedAt = Date.now();

    // Update alert configurations for new severity
    alert.audioAlert = this.getDefaultAudioConfig(newSeverity);
    alert.visualAlert = this.getDefaultVisualConfig(newSeverity);
    alert.hapticAlert = this.getDefaultHapticConfig(newSeverity);

    // Add emergency actions if escalated to emergency
    if (newSeverity === 'emergency') {
      alert.actionItems.push(...this.getEmergencyActions());
      this.activateEmergencyProtocol(alert);
    }

    // Re-process escalated alert
    this.notifyAlertSubscribers(alert);

    console.log(`[ALERT ESCALATION] Alert ${alertId} escalated from ${oldSeverity} to ${newSeverity}: ${reason}`);
    return alert;
  }

  /**
   * Activate emergency protocol
   */
  private activateEmergencyProtocol(alert: SafetyAlert): void {
    const applicableProtocols = this.emergencyProtocols.filter(protocol =>
      protocol.triggerConditions.some(condition =>
        condition.severity === alert.severity && condition.category === alert.category
      )
    );

    for (const protocol of applicableProtocols) {
      this.executeEmergencyProtocol(protocol, alert);
    }
  }

  /**
   * Execute emergency protocol sequence
   */
  private executeEmergencyProtocol(protocol: EmergencyProtocol, triggerAlert: SafetyAlert): void {
    console.log(`[EMERGENCY PROTOCOL] Activating protocol: ${protocol.name}`);

    // Notify emergency subscribers
    this.emergencySubscribers.forEach(subscriber => subscriber(protocol));

    // Execute activation sequence
    for (const step of protocol.activationSequence) {
      if (step.automatic) {
        this.executeEmergencyStep(step, triggerAlert, protocol);
      }
    }

    // Start location sharing if enabled
    if (protocol.locationSharing) {
      this.startEmergencyLocationSharing(triggerAlert);
    }

    // Broadcast emergency message
    if (protocol.broadcastMessage) {
      this.broadcastEmergencyMessage(protocol.broadcastMessage, triggerAlert);
    }
  }

  /**
   * Execute a specific emergency protocol step
   */
  private executeEmergencyStep(
    step: any,
    alert: SafetyAlert,
    protocol: EmergencyProtocol
  ): void {
    console.log(`[EMERGENCY STEP] Executing step ${step.step}: ${step.action}`);

    switch (step.action) {
      case 'contact_coast_guard':
        this.contactEmergencyServices(alert, 'coast_guard');
        break;
      case 'broadcast_mayday':
        this.broadcastMayDay(alert);
        break;
      case 'activate_locator_beacon':
        this.activateLocatorBeacon(alert);
        break;
      case 'notify_emergency_contacts':
        this.notifyEmergencyContacts(alert);
        break;
      default:
        console.warn(`Unknown emergency step action: ${step.action}`);
    }

    // Set timeout for fallback action
    if (step.timeout && step.fallback) {
      setTimeout(() => {
        this.executeEmergencyStep({ ...step, action: step.fallback }, alert, protocol);
      }, step.timeout * 1000);
    }
  }

  /**
   * Schedule escalation check based on rules
   */
  private scheduleEscalationCheck(alert: SafetyAlert): void {
    const applicableRules = this.escalationRules.filter(rule =>
      rule.alertCategory === alert.category && rule.severity === alert.severity
    );

    for (const rule of applicableRules) {
      setTimeout(() => {
        this.checkEscalationConditions(alert, rule);
      }, rule.timeThreshold * 1000);
    }
  }

  /**
   * Check if escalation conditions are met
   */
  private checkEscalationConditions(alert: SafetyAlert, rule: AlertEscalationRule): void {
    const currentAlert = this.activeAlerts.get(alert.id);
    if (!currentAlert) return; // Alert was dismissed

    let shouldEscalate = false;

    for (const condition of rule.conditions) {
      switch (condition.type) {
        case 'acknowledgment_timeout':
          if (!currentAlert.metadata.acknowledgedAt) {
            shouldEscalate = true;
          }
          break;
        case 'proximity_increase':
          // Would check if vessel is getting closer to hazard
          break;
        case 'speed_increase':
          // Would check if vessel speed has increased
          break;
      }
    }

    if (shouldEscalate) {
      this.escalateAlert(alert.id, rule.escalateTo, 'Automatic escalation due to unmet conditions');
    }
  }

  /**
   * Execute automatic actions for an alert
   */
  private executeAutomaticActions(alert: SafetyAlert): void {
    const automaticActions = alert.actionItems.filter(action => action.automatic);

    for (const action of automaticActions) {
      this.executeAction(action, alert);
    }
  }

  /**
   * Execute a specific alert action
   */
  private executeAction(action: AlertAction, alert: SafetyAlert): void {
    console.log(`[ACTION] Executing ${action.type}: ${action.label}`);

    switch (action.type) {
      case 'stop':
        this.executeEmergencyStop(alert);
        break;
      case 'reduce_speed':
        this.executeSpeedReduction(action.parameters.targetSpeed, alert);
        break;
      case 'change_course':
        this.executeCourseChange(action.parameters.newHeading, alert);
        break;
      case 'call':
        this.initiateEmergencyCall(action.parameters.contactId, alert);
        break;
      case 'broadcast':
        this.broadcastAlert(action.parameters.message, alert);
        break;
      case 'log':
        this.logIncident(alert, action.parameters);
        break;
    }
  }

  /**
   * Get all active alerts sorted by priority
   */
  getActiveAlerts(): SafetyAlert[] {
    return Array.from(this.activeAlerts.values())
      .sort((a, b) => {
        // Sort by escalation level (highest first), then by timestamp (newest first)
        if (a.escalationLevel !== b.escalationLevel) {
          return b.escalationLevel - a.escalationLevel;
        }
        return b.timestamp - a.timestamp;
      });
  }

  /**
   * Get alerts by category and severity
   */
  getAlertsByCategory(category: AlertCategory, severity?: AlertSeverity): SafetyAlert[] {
    return this.getActiveAlerts().filter(alert => {
      const categoryMatch = alert.category === category;
      const severityMatch = !severity || alert.severity === severity;
      return categoryMatch && severityMatch;
    });
  }

  /**
   * Subscribe to alert notifications
   */
  subscribeToAlerts(callback: (alert: SafetyAlert) => void): () => void {
    this.alertSubscribers.push(callback);
    return () => {
      const index = this.alertSubscribers.indexOf(callback);
      if (index > -1) this.alertSubscribers.splice(index, 1);
    };
  }

  /**
   * Subscribe to emergency protocol activations
   */
  subscribeToEmergencyProtocols(callback: (protocol: EmergencyProtocol) => void): () => void {
    this.emergencySubscribers.push(callback);
    return () => {
      const index = this.emergencySubscribers.indexOf(callback);
      if (index > -1) this.emergencySubscribers.splice(index, 1);
    };
  }

  /**
   * Initialize default escalation rules
   */
  private initializeDefaultEscalationRules(): void {
    this.escalationRules = [
      {
        alertCategory: 'grounding',
        severity: 'warning',
        timeThreshold: 60, // 1 minute
        escalateTo: 'critical',
        conditions: [
          { type: 'acknowledgment_timeout', parameters: {} },
          { type: 'proximity_increase', parameters: { threshold: 0.8 } }
        ],
        actions: ['reduce_speed', 'alert_crew']
      },
      {
        alertCategory: 'grounding',
        severity: 'critical',
        timeThreshold: 30, // 30 seconds
        escalateTo: 'emergency',
        conditions: [
          { type: 'acknowledgment_timeout', parameters: {} }
        ],
        actions: ['emergency_stop', 'broadcast_mayday']
      },
      {
        alertCategory: 'collision',
        severity: 'warning',
        timeThreshold: 45, // 45 seconds
        escalateTo: 'critical',
        conditions: [
          { type: 'proximity_increase', parameters: { threshold: 0.5 } }
        ],
        actions: ['change_course', 'reduce_speed']
      }
    ];
  }

  /**
   * Initialize emergency protocols
   */
  private initializeEmergencyProtocols(): void {
    this.emergencyProtocols = [
      {
        id: 'grounding_emergency',
        name: 'Grounding Emergency Protocol',
        triggerConditions: [
          { severity: 'emergency', category: 'grounding' }
        ],
        activationSequence: [
          { step: 1, action: 'emergency_stop', automatic: true, timeout: 10 },
          { step: 2, action: 'assess_damage', automatic: false, timeout: 30 },
          { step: 3, action: 'contact_coast_guard', automatic: true, timeout: 60 },
          { step: 4, action: 'broadcast_mayday', automatic: true, timeout: 120 }
        ],
        emergencyContacts: [],
        broadcastMessage: 'MAYDAY MAYDAY MAYDAY - Vessel aground, requesting immediate assistance',
        locationSharing: true,
        vessselInformation: true,
        coordinationMode: 'automatic'
      },
      {
        id: 'collision_emergency',
        name: 'Collision Avoidance Emergency',
        triggerConditions: [
          { severity: 'emergency', category: 'collision' }
        ],
        activationSequence: [
          { step: 1, action: 'emergency_maneuver', automatic: true, timeout: 5 },
          { step: 2, action: 'sound_horn', automatic: true, timeout: 0 },
          { step: 3, action: 'contact_vessel', automatic: false, timeout: 30 }
        ],
        emergencyContacts: [],
        broadcastMessage: 'SECURITÉ SECURITÉ SECURITÉ - Collision risk, taking evasive action',
        locationSharing: true,
        vessselInformation: true,
        coordinationMode: 'manual'
      }
    ];
  }

  // Helper methods for default configurations
  private getSeverityLevel(severity: AlertSeverity): number {
    const levels = { info: 1, caution: 2, warning: 3, critical: 4, emergency: 5 };
    return levels[severity] || 1;
  }

  private getDefaultAudioConfig(severity: AlertSeverity): AudioAlertConfig {
    const configs: Record<AlertSeverity, AudioAlertConfig> = {
      info: { enabled: true, soundType: 'beep', volume: 0.3, frequency: 'once', priority: 1 },
      caution: { enabled: true, soundType: 'beep', volume: 0.5, frequency: 'once', priority: 2 },
      warning: { enabled: true, soundType: 'alarm', volume: 0.7, frequency: 'repeating', interval: 5, priority: 4 },
      critical: { enabled: true, soundType: 'siren', volume: 0.9, frequency: 'repeating', interval: 2, priority: 7 },
      emergency: { enabled: true, soundType: 'horn', volume: 1.0, frequency: 'continuous', duration: 10, priority: 10 }
    };
    return configs[severity];
  }

  private getDefaultVisualConfig(severity: AlertSeverity): VisualAlertConfig {
    const configs: Record<AlertSeverity, VisualAlertConfig> = {
      info: { enabled: true, color: '#00C851', animation: 'static', icon: 'info', position: 'top', opacity: 0.9, fullScreen: false, overlay: false },
      caution: { enabled: true, color: '#FFB000', animation: 'pulse', icon: 'warning', position: 'top', opacity: 0.9, fullScreen: false, overlay: false },
      warning: { enabled: true, color: '#FF8800', animation: 'flash', icon: 'alert', position: 'center', opacity: 0.95, fullScreen: false, overlay: false },
      critical: { enabled: true, color: '#FF4444', animation: 'flash', icon: 'danger', position: 'center', opacity: 1.0, fullScreen: true, overlay: true },
      emergency: { enabled: true, color: '#CC0000', animation: 'flash', icon: 'emergency', position: 'overlay', opacity: 1.0, fullScreen: true, overlay: true }
    };
    return configs[severity];
  }

  private getDefaultHapticConfig(severity: AlertSeverity): HapticAlertConfig {
    const configs: Record<AlertSeverity, HapticAlertConfig> = {
      info: { enabled: true, pattern: 'light', duration: 100, repeats: 1 },
      caution: { enabled: true, pattern: 'medium', duration: 200, repeats: 1 },
      warning: { enabled: true, pattern: 'heavy', duration: 300, repeats: 2, interval: 500 },
      critical: { enabled: true, pattern: 'pulse', duration: 500, repeats: 3, interval: 300 },
      emergency: { enabled: true, pattern: 'emergency', duration: 1000, repeats: 5, interval: 200 }
    };
    return configs[severity];
  }

  private getDefaultActions(category: AlertCategory, severity: AlertSeverity): AlertAction[] {
    const actions: AlertAction[] = [];

    // Add category-specific actions
    switch (category) {
      case 'grounding':
        actions.push(
          { id: 'reduce_speed', type: 'reduce_speed', label: 'Reduce Speed', description: 'Reduce vessel speed to minimize impact', automatic: severity === 'critical', priority: 8, parameters: { targetSpeed: 2 }, confirmationRequired: false, emergencyAction: false },
          { id: 'check_depth', type: 'log', label: 'Check Depth', description: 'Verify current depth with depth sounder', automatic: false, priority: 6, parameters: {}, confirmationRequired: false, emergencyAction: false }
        );
        break;
      case 'collision':
        actions.push(
          { id: 'sound_horn', type: 'broadcast', label: 'Sound Horn', description: 'Alert other vessels with horn signal', automatic: true, priority: 9, parameters: { signal: 'five_short' }, confirmationRequired: false, emergencyAction: false },
          { id: 'change_course', type: 'change_course', label: 'Take Evasive Action', description: 'Execute collision avoidance maneuver', automatic: severity === 'emergency', priority: 10, parameters: {}, confirmationRequired: false, emergencyAction: true }
        );
        break;
    }

    // Add severity-specific actions
    if (severity === 'emergency') {
      actions.push(...this.getEmergencyActions());
    }

    return actions;
  }

  private getEmergencyActions(): AlertAction[] {
    return [
      { id: 'emergency_stop', type: 'stop', label: 'Emergency Stop', description: 'Stop all engines immediately', automatic: false, priority: 10, parameters: {}, confirmationRequired: true, emergencyAction: true },
      { id: 'mayday_call', type: 'call', label: 'Mayday Call', description: 'Initiate Mayday distress call', automatic: false, priority: 10, parameters: { contactType: 'coast_guard' }, confirmationRequired: true, emergencyAction: true },
      { id: 'location_broadcast', type: 'broadcast', label: 'Broadcast Location', description: 'Broadcast current position to nearby vessels', automatic: true, priority: 9, parameters: {}, confirmationRequired: false, emergencyAction: true }
    ];
  }

  // Placeholder implementations for emergency actions
  private executeEmergencyStop(alert: SafetyAlert): void {
    console.log('[EMERGENCY STOP] Executing emergency stop procedure');
  }

  private executeSpeedReduction(targetSpeed: number, alert: SafetyAlert): void {
    console.log(`[SPEED REDUCTION] Reducing speed to ${targetSpeed} knots`);
  }

  private executeCourseChange(newHeading: number, alert: SafetyAlert): void {
    console.log(`[COURSE CHANGE] Changing course to ${newHeading}°`);
  }

  private contactEmergencyServices(alert: SafetyAlert, serviceType: string): void {
    console.log(`[EMERGENCY CONTACT] Contacting ${serviceType} for alert ${alert.id}`);
  }

  private broadcastMayDay(alert: SafetyAlert): void {
    console.log('[MAYDAY BROADCAST] Broadcasting Mayday distress call');
  }

  private activateLocatorBeacon(alert: SafetyAlert): void {
    console.log('[LOCATOR BEACON] Activating emergency position beacon');
  }

  private notifyEmergencyContacts(alert: SafetyAlert): void {
    console.log('[EMERGENCY CONTACTS] Notifying emergency contacts');
  }

  private initiateEmergencyCall(contactId: string, alert: SafetyAlert): void {
    console.log(`[EMERGENCY CALL] Initiating call to contact ${contactId}`);
  }

  private broadcastAlert(message: string, alert: SafetyAlert): void {
    console.log(`[BROADCAST] Broadcasting: ${message}`);
  }

  private broadcastEmergencyMessage(message: string, alert: SafetyAlert): void {
    console.log(`[EMERGENCY BROADCAST] ${message}`);
  }

  private startEmergencyLocationSharing(alert: SafetyAlert): void {
    console.log('[LOCATION SHARING] Starting emergency location sharing');
  }

  private logIncident(alert: SafetyAlert, parameters: any): void {
    console.log(`[INCIDENT LOG] Logging incident for alert ${alert.id}`);
  }

  private notifyAlertSubscribers(alert: SafetyAlert): void {
    this.alertSubscribers.forEach(subscriber => {
      try {
        subscriber(alert);
      } catch (error) {
        console.error('Error notifying alert subscriber:', error);
      }
    });
  }

  private updateMetrics(alert: SafetyAlert): void {
    this.metrics.totalAlerts++;
    this.metrics.alertsByCategory[alert.category] = (this.metrics.alertsByCategory[alert.category] || 0) + 1;
    this.metrics.alertsBySeverity[alert.severity] = (this.metrics.alertsBySeverity[alert.severity] || 0) + 1;
  }

  /**
   * Get current alert metrics
   */
  getMetrics(): AlertMetrics {
    return { ...this.metrics };
  }
}

export default SafetyAlertHierarchy;