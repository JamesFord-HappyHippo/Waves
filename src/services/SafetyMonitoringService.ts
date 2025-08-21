/**
 * Safety Monitoring Service - Backend integration for safety validation and monitoring
 * Handles real-time safety data processing, alert distribution, and emergency coordination
 */

import { Location, DepthReading } from '../types';
import SafetyValidationEngine, { ValidationResult } from '../utils/SafetyValidationEngine';
import SafetyAlertHierarchy, { SafetyAlert } from '../utils/SafetyAlertHierarchy';
import SafeRouteNavigation, { NavigationStatus } from '../utils/SafeRouteNavigation';
import EmergencyProtocolManager, { EmergencyIncident, PositionReport } from '../utils/EmergencyProtocolManager';
import MaritimeComplianceManager, { ComplianceCheck } from '../utils/MaritimeComplianceManager';

export interface SafetyMonitoringConfig {
  monitoringInterval: number; // milliseconds
  alertThresholds: {
    depth: number;
    confidence: number;
    deviation: number;
    speed: number;
  };
  autoEmergencyTriggers: {
    groundingTimeThreshold: number;
    collisionTimeThreshold: number;
    deepWaterThreshold: number;
  };
  dataQualityRequirements: {
    minConfidence: number;
    maxDataAge: number;
    minCoverage: number;
  };
  broadcastSettings: {
    enableAIS: boolean;
    enableVHF: boolean;
    enableCellular: boolean;
    emergencyChannels: number[];
  };
}

export interface SafetyMetrics {
  timestamp: number;
  vesselId: string;
  location: Location;
  safetyStatus: 'safe' | 'caution' | 'warning' | 'critical' | 'emergency';
  depthSafety: {
    currentDepth: number | null;
    requiredDepth: number;
    safetyMargin: number | null;
    confidence: number;
  };
  navigationSafety: {
    onRoute: boolean;
    routeDeviation: number;
    speedCompliance: boolean;
    eta: number | null;
  };
  environmentalFactors: {
    weather: 'good' | 'fair' | 'poor' | 'dangerous';
    visibility: number; // nautical miles
    seaState: number; // 0-9 scale
    windSpeed: number; // knots
  };
  complianceStatus: {
    overall: 'compliant' | 'warning' | 'non_compliant';
    issues: string[];
    nextCheckDue: number | null;
  };
  alerts: {
    active: number;
    critical: number;
    acknowledged: number;
    pending: number;
  };
  emergencyStatus: {
    hasActiveIncident: boolean;
    incidentType?: string;
    severity?: string;
    timeElapsed?: number;
  };
}

export interface SafetyRecommendation {
  id: string;
  type: 'route_adjustment' | 'speed_change' | 'equipment_check' | 'weather_delay' | 'emergency_action';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  reasoning: string;
  actions: Array<{
    action: string;
    timeframe: string;
    automatic: boolean;
  }>;
  validUntil: number;
  dependencies: string[];
}

export interface SafetyBroadcast {
  id: string;
  timestamp: number;
  type: 'position_report' | 'safety_alert' | 'emergency_call' | 'navigation_warning';
  severity: 'info' | 'warning' | 'urgent' | 'distress';
  vesselInfo: {
    name: string;
    mmsi?: string;
    callSign?: string;
    type: string;
  };
  position: Location;
  message: string;
  recipients: string[]; // Channel/service identifiers
  requiresAcknowledgment: boolean;
  retryCount: number;
  status: 'pending' | 'sent' | 'acknowledged' | 'failed';
}

export class SafetyMonitoringService {
  private validationEngine: SafetyValidationEngine;
  private alertHierarchy: SafetyAlertHierarchy;
  private routeNavigation: SafeRouteNavigation;
  private emergencyManager: EmergencyProtocolManager;
  private complianceManager: MaritimeComplianceManager;
  private config: SafetyMonitoringConfig;
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private currentMetrics: SafetyMetrics | null = null;
  private activeBroadcasts: Map<string, SafetyBroadcast> = new Map();
  private safetySubscribers: Array<(metrics: SafetyMetrics) => void> = [];
  private alertSubscribers: Array<(alert: SafetyAlert) => void> = [];
  private recommendationSubscribers: Array<(recommendations: SafetyRecommendation[]) => void> = [];

  constructor(config: Partial<SafetyMonitoringConfig> = {}) {
    this.config = {
      monitoringInterval: 10000, // 10 seconds
      alertThresholds: {
        depth: 0.5, // Alert when safety margin < 50% of draft
        confidence: 0.6, // Alert when confidence < 60%
        deviation: 100, // Alert when > 100m off route
        speed: 2, // Alert when speed varies > 2 knots from recommended
      },
      autoEmergencyTriggers: {
        groundingTimeThreshold: 30, // Seconds to grounding
        collisionTimeThreshold: 60, // Seconds to collision
        deepWaterThreshold: 200, // Meters - unexpected deep water
      },
      dataQualityRequirements: {
        minConfidence: 0.7,
        maxDataAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        minCoverage: 0.3, // 30% coverage
      },
      broadcastSettings: {
        enableAIS: true,
        enableVHF: true,
        enableCellular: true,
        emergencyChannels: [16, 70], // VHF channels
      },
      ...config
    };

    this.initializeServices();
  }

  private initializeServices(): void {
    this.validationEngine = new SafetyValidationEngine({
      confidenceThreshold: this.config.dataQualityRequirements.minConfidence,
      maxDataAge: this.config.dataQualityRequirements.maxDataAge,
    });

    this.alertHierarchy = new SafetyAlertHierarchy();
    this.emergencyManager = new EmergencyProtocolManager();
    this.complianceManager = new MaritimeComplianceManager();
    
    this.routeNavigation = new SafeRouteNavigation(
      this.validationEngine,
      this.alertHierarchy
    );

    // Subscribe to emergency incidents
    this.emergencyManager.subscribeToIncidents((incident) => {
      this.handleEmergencyIncident(incident);
    });

    // Subscribe to alerts
    this.alertHierarchy.subscribeToAlerts((alert) => {
      this.handleSafetyAlert(alert);
    });
  }

  /**
   * Start continuous safety monitoring
   */
  startMonitoring(vesselId: string): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    console.log(`[SAFETY MONITORING] Starting monitoring for vessel ${vesselId}`);
    
    this.monitoringInterval = setInterval(() => {
      this.performSafetyCheck(vesselId);
    }, this.config.monitoringInterval);
  }

  /**
   * Stop safety monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[SAFETY MONITORING] Monitoring stopped');
    }
  }

  /**
   * Perform comprehensive safety check
   */
  private async performSafetyCheck(vesselId: string): Promise<void> {
    try {
      // Get current vessel state (would come from vessel sensors/GPS)
      const vesselState = await this.getVesselState(vesselId);
      if (!vesselState) return;

      // Get relevant depth data
      const depthData = await this.getDepthData(vesselState.location);

      // Validate current safety status
      const validation = await this.validationEngine.validateDepthData(
        vesselState.location,
        vesselState.vesselProfile.draft,
        depthData
      );

      // Check navigation status
      const navigationStatus = this.routeNavigation.getNavigationStatus();

      // Get compliance status
      const complianceCheck = await this.complianceManager.performComplianceCheck(
        vesselState.vesselProfile,
        vesselState.location,
        'recreational'
      );

      // Generate safety metrics
      const metrics = this.generateSafetyMetrics(
        vesselId,
        vesselState,
        validation,
        navigationStatus,
        complianceCheck
      );

      // Check for automatic emergency triggers
      await this.checkEmergencyTriggers(metrics, vesselState);

      // Generate recommendations
      const recommendations = this.generateSafetyRecommendations(metrics, vesselState);

      // Update current metrics and notify subscribers
      this.currentMetrics = metrics;
      this.notifySafetySubscribers(metrics);

      if (recommendations.length > 0) {
        this.notifyRecommendationSubscribers(recommendations);
      }

      // Send position report if required
      await this.sendPositionReport(vesselState);

    } catch (error) {
      console.error('[SAFETY MONITORING] Error during safety check:', error);
    }
  }

  /**
   * Generate comprehensive safety metrics
   */
  private generateSafetyMetrics(
    vesselId: string,
    vesselState: any,
    validation: ValidationResult,
    navigationStatus: NavigationStatus | null,
    complianceCheck: ComplianceCheck
  ): SafetyMetrics {
    // Determine overall safety status
    let safetyStatus: SafetyMetrics['safetyStatus'] = 'safe';
    
    const activeAlerts = this.alertHierarchy.getActiveAlerts();
    const emergencyIncidents = this.emergencyManager.getActiveIncidents();

    if (emergencyIncidents.length > 0) {
      safetyStatus = 'emergency';
    } else if (activeAlerts.some(a => a.severity === 'critical')) {
      safetyStatus = 'critical';
    } else if (activeAlerts.some(a => a.severity === 'warning')) {
      safetyStatus = 'warning';
    } else if (activeAlerts.some(a => a.severity === 'caution')) {
      safetyStatus = 'caution';
    }

    return {
      timestamp: Date.now(),
      vesselId,
      location: vesselState.location,
      safetyStatus,
      depthSafety: {
        currentDepth: validation.estimatedDepth,
        requiredDepth: vesselState.vesselProfile.draft + (vesselState.vesselProfile.draft * 0.5),
        safetyMargin: validation.safetyMargin,
        confidence: validation.confidence,
      },
      navigationSafety: {
        onRoute: navigationStatus ? navigationStatus.routeDeviation < 50 : true,
        routeDeviation: navigationStatus?.routeDeviation || 0,
        speedCompliance: navigationStatus ? navigationStatus.speedVariance < 2 : true,
        eta: navigationStatus?.timeToWaypoint || null,
      },
      environmentalFactors: {
        weather: this.assessWeatherConditions(vesselState.environmental),
        visibility: vesselState.environmental?.visibility || 10,
        seaState: vesselState.environmental?.seaState || 2,
        windSpeed: vesselState.environmental?.windSpeed || 5,
      },
      complianceStatus: {
        overall: complianceCheck.overallStatus,
        issues: complianceCheck.requiredActions.map(a => a.title),
        nextCheckDue: complianceCheck.nextCheckRequired,
      },
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical' || a.severity === 'emergency').length,
        acknowledged: activeAlerts.filter(a => a.metadata?.acknowledgedAt).length,
        pending: activeAlerts.filter(a => !a.metadata?.acknowledgedAt).length,
      },
      emergencyStatus: {
        hasActiveIncident: emergencyIncidents.length > 0,
        incidentType: emergencyIncidents[0]?.type,
        severity: emergencyIncidents[0]?.severity,
        timeElapsed: emergencyIncidents[0] ? Date.now() - emergencyIncidents[0].reportedAt : undefined,
      },
    };
  }

  /**
   * Check for conditions that should trigger automatic emergency procedures
   */
  private async checkEmergencyTriggers(metrics: SafetyMetrics, vesselState: any): Promise<void> {
    const { autoEmergencyTriggers } = this.config;

    // Check for imminent grounding
    if (metrics.depthSafety.safetyMargin !== null && 
        metrics.depthSafety.safetyMargin < 0.5 && 
        vesselState.speed > 2) {
      
      const timeToImpact = this.calculateTimeToImpact(vesselState);
      if (timeToImpact < autoEmergencyTriggers.groundingTimeThreshold) {
        await this.triggerAutomaticEmergency('grounding', 'critical', vesselState);
      }
    }

    // Check for unexpected deep water (possible navigation error)
    if (metrics.depthSafety.currentDepth && 
        metrics.depthSafety.currentDepth > autoEmergencyTriggers.deepWaterThreshold) {
      
      const lastKnownDepth = await this.getLastKnownDepth(vesselState.location);
      if (lastKnownDepth && lastKnownDepth < 50) { // Was in shallow water
        this.alertHierarchy.createAlert(
          'warning',
          'navigation',
          'Unexpected Deep Water',
          'Depth increased significantly - verify position',
          vesselState.location
        );
      }
    }

    // Check for severe weather conditions
    if (metrics.environmentalFactors.weather === 'dangerous') {
      this.alertHierarchy.createAlert(
        'critical',
        'weather',
        'Dangerous Weather Conditions',
        'Seek immediate shelter or safe harbor',
        vesselState.location
      );
    }
  }

  /**
   * Trigger automatic emergency procedures
   */
  private async triggerAutomaticEmergency(
    type: 'grounding' | 'collision' | 'weather',
    severity: 'critical' | 'emergency',
    vesselState: any
  ): Promise<void> {
    console.log(`[AUTO EMERGENCY] Triggering ${type} emergency - ${severity}`);

    // Create emergency incident
    await this.emergencyManager.reportEmergencyIncident(
      type,
      severity === 'emergency' ? 'mayday' : 'critical',
      vesselState.location,
      vesselState.vesselProfile,
      `Automatic emergency triggered: ${type}`,
      {
        personOnBoard: vesselState.crew || 1,
        immediateDanger: severity === 'emergency'
      }
    );

    // Create critical alert
    this.alertHierarchy.createAlert(
      severity,
      type,
      `${type.toUpperCase()} EMERGENCY`,
      `Automatic emergency procedures activated`,
      vesselState.location,
      { automaticResponse: true }
    );

    // Broadcast emergency if configured
    if (this.config.broadcastSettings.enableVHF) {
      await this.broadcastEmergencyMessage(type, vesselState);
    }
  }

  /**
   * Generate safety recommendations based on current conditions
   */
  private generateSafetyRecommendations(
    metrics: SafetyMetrics,
    vesselState: any
  ): SafetyRecommendation[] {
    const recommendations: SafetyRecommendation[] = [];

    // Depth safety recommendations
    if (metrics.depthSafety.safetyMargin !== null && metrics.depthSafety.safetyMargin < 2) {
      recommendations.push({
        id: `depth_safety_${Date.now()}`,
        type: 'speed_change',
        priority: metrics.depthSafety.safetyMargin < 1 ? 'critical' : 'high',
        title: 'Reduce Speed in Shallow Water',
        description: 'Current depth provides limited safety margin',
        reasoning: `Safety margin: ${metrics.depthSafety.safetyMargin.toFixed(1)}m`,
        actions: [
          { action: 'Reduce speed to 3 knots', timeframe: 'Immediately', automatic: false },
          { action: 'Deploy depth sounder', timeframe: 'Now', automatic: false },
          { action: 'Post lookout', timeframe: 'Now', automatic: false }
        ],
        validUntil: Date.now() + 600000, // 10 minutes
        dependencies: []
      });
    }

    // Data quality recommendations
    if (metrics.depthSafety.confidence < this.config.dataQualityRequirements.minConfidence) {
      recommendations.push({
        id: `data_quality_${Date.now()}`,
        type: 'equipment_check',
        priority: 'medium',
        title: 'Verify Depth Readings',
        description: 'Low confidence in depth data quality',
        reasoning: `Data confidence: ${(metrics.depthSafety.confidence * 100).toFixed(0)}%`,
        actions: [
          { action: 'Use depth sounder for verification', timeframe: 'Now', automatic: false },
          { action: 'Cross-check with charts', timeframe: 'Now', automatic: false },
          { action: 'Reduce speed until verified', timeframe: 'Now', automatic: false }
        ],
        validUntil: Date.now() + 1800000, // 30 minutes
        dependencies: []
      });
    }

    // Navigation recommendations
    if (!metrics.navigationSafety.onRoute && metrics.navigationSafety.routeDeviation > 100) {
      recommendations.push({
        id: `route_deviation_${Date.now()}`,
        type: 'route_adjustment',
        priority: 'medium',
        title: 'Return to Planned Route',
        description: 'Vessel has deviated significantly from planned route',
        reasoning: `Route deviation: ${metrics.navigationSafety.routeDeviation.toFixed(0)}m`,
        actions: [
          { action: 'Adjust course to return to route', timeframe: 'Within 5 minutes', automatic: false },
          { action: 'Verify GPS accuracy', timeframe: 'Now', automatic: false }
        ],
        validUntil: Date.now() + 900000, // 15 minutes
        dependencies: []
      });
    }

    // Weather recommendations
    if (metrics.environmentalFactors.weather === 'poor' || metrics.environmentalFactors.weather === 'dangerous') {
      recommendations.push({
        id: `weather_safety_${Date.now()}`,
        type: 'weather_delay',
        priority: metrics.environmentalFactors.weather === 'dangerous' ? 'critical' : 'high',
        title: 'Weather Safety Measures',
        description: 'Current weather conditions require additional precautions',
        reasoning: `Weather: ${metrics.environmentalFactors.weather}, Wind: ${metrics.environmentalFactors.windSpeed} knots`,
        actions: [
          { action: 'Consider seeking shelter', timeframe: 'As soon as practical', automatic: false },
          { action: 'Monitor weather updates', timeframe: 'Continuously', automatic: true },
          { action: 'Reduce speed and increase vigilance', timeframe: 'Now', automatic: false }
        ],
        validUntil: Date.now() + 3600000, // 1 hour
        dependencies: []
      });
    }

    // Compliance recommendations
    if (metrics.complianceStatus.overall === 'non_compliant') {
      recommendations.push({
        id: `compliance_${Date.now()}`,
        type: 'equipment_check',
        priority: 'high',
        title: 'Address Compliance Issues',
        description: 'Vessel is not in compliance with safety regulations',
        reasoning: `Issues: ${metrics.complianceStatus.issues.join(', ')}`,
        actions: metrics.complianceStatus.issues.map(issue => ({
          action: `Resolve: ${issue}`,
          timeframe: 'Before next voyage',
          automatic: false
        })),
        validUntil: Date.now() + 86400000, // 24 hours
        dependencies: []
      });
    }

    return recommendations;
  }

  /**
   * Handle safety alert generation and distribution
   */
  private handleSafetyAlert(alert: SafetyAlert): void {
    console.log(`[SAFETY ALERT] ${alert.severity}: ${alert.title}`);
    
    // Notify alert subscribers
    this.alertSubscribers.forEach(subscriber => {
      try {
        subscriber(alert);
      } catch (error) {
        console.error('Error notifying alert subscriber:', error);
      }
    });

    // Broadcast critical alerts if configured
    if ((alert.severity === 'critical' || alert.severity === 'emergency') && 
        alert.broadcastRequired) {
      this.broadcastSafetyAlert(alert);
    }
  }

  /**
   * Handle emergency incident escalation
   */
  private handleEmergencyIncident(incident: EmergencyIncident): void {
    console.log(`[EMERGENCY INCIDENT] ${incident.type} - ${incident.severity}`);
    
    // Auto-broadcast Mayday or emergency calls
    if (incident.severity === 'mayday' || incident.severity === 'critical') {
      this.broadcastEmergencyCall(incident);
    }

    // Start emergency location sharing
    if (incident.severity === 'mayday' || incident.severity === 'critical') {
      this.emergencyManager.startEmergencyLocationSharing(incident);
    }
  }

  /**
   * Broadcast safety alert to configured channels
   */
  private async broadcastSafetyAlert(alert: SafetyAlert): Promise<void> {
    const broadcast: SafetyBroadcast = {
      id: `alert_broadcast_${Date.now()}`,
      timestamp: Date.now(),
      type: 'safety_alert',
      severity: alert.severity === 'emergency' ? 'distress' : 'urgent',
      vesselInfo: {
        name: 'Current Vessel', // Would get from vessel state
        type: 'recreational'
      },
      position: alert.location,
      message: `${alert.severity.toUpperCase()}: ${alert.title} - ${alert.message}`,
      recipients: this.config.broadcastSettings.emergencyChannels.map(ch => `VHF_${ch}`),
      requiresAcknowledgment: alert.severity === 'emergency',
      retryCount: 0,
      status: 'pending'
    };

    this.activeBroadcasts.set(broadcast.id, broadcast);
    await this.transmitBroadcast(broadcast);
  }

  /**
   * Broadcast emergency call
   */
  private async broadcastEmergencyCall(incident: EmergencyIncident): Promise<void> {
    const broadcast: SafetyBroadcast = {
      id: `emergency_broadcast_${Date.now()}`,
      timestamp: Date.now(),
      type: 'emergency_call',
      severity: 'distress',
      vesselInfo: {
        name: incident.vesselInfo.name || 'Unknown Vessel',
        type: incident.vesselInfo.type
      },
      position: incident.location,
      message: this.formatEmergencyMessage(incident),
      recipients: ['VHF_16', 'COAST_GUARD', 'EMERGENCY_SERVICES'],
      requiresAcknowledgment: true,
      retryCount: 0,
      status: 'pending'
    };

    this.activeBroadcasts.set(broadcast.id, broadcast);
    await this.transmitBroadcast(broadcast);
  }

  /**
   * Send position report for location sharing
   */
  private async sendPositionReport(vesselState: any): Promise<void> {
    const positionReport: PositionReport = {
      vesselId: vesselState.vesselId,
      timestamp: Date.now(),
      location: vesselState.location,
      course: vesselState.heading || 0,
      speed: vesselState.speed || 0,
      status: this.getVesselStatus(vesselState),
      vesselData: {
        draft: vesselState.vesselProfile.draft,
        crew: vesselState.crew || 1,
        fuel: vesselState.fuel || 75,
        water: vesselState.water || 50
      },
      environmental: vesselState.environmental
    };

    this.emergencyManager.sendPositionReport(positionReport);
  }

  // Helper methods

  private async getVesselState(vesselId: string): Promise<any> {
    // This would integrate with vessel sensors, GPS, etc.
    // Returning mock data for implementation
    return {
      vesselId,
      location: { latitude: 40.7128, longitude: -74.0060, accuracy: 5, timestamp: Date.now() },
      vesselProfile: { name: 'Test Vessel', type: 'sailboat', length: 10, draft: 1.5, beam: 3 },
      speed: 6,
      heading: 90,
      crew: 2,
      fuel: 75,
      water: 50,
      environmental: {
        windSpeed: 10,
        windDirection: 180,
        visibility: 8,
        seaState: 2
      }
    };
  }

  private async getDepthData(location: Location): Promise<DepthReading[]> {
    // This would fetch from depth data API
    // Returning mock data for implementation
    return [];
  }

  private async getLastKnownDepth(location: Location): Promise<number | null> {
    // This would query historical depth data
    return null;
  }

  private calculateTimeToImpact(vesselState: any): number {
    // Simplified calculation - would use actual grounding prediction
    return 45; // seconds
  }

  private assessWeatherConditions(environmental: any): 'good' | 'fair' | 'poor' | 'dangerous' {
    if (!environmental) return 'good';
    
    const windSpeed = environmental.windSpeed || 0;
    const visibility = environmental.visibility || 10;
    const seaState = environmental.seaState || 0;

    if (windSpeed > 35 || visibility < 1 || seaState > 6) return 'dangerous';
    if (windSpeed > 25 || visibility < 3 || seaState > 4) return 'poor';
    if (windSpeed > 15 || visibility < 5 || seaState > 2) return 'fair';
    return 'good';
  }

  private getVesselStatus(vesselState: any): PositionReport['status'] {
    if (vesselState.speed < 0.5) return 'anchored';
    if (vesselState.speed < 2) return 'moored';
    return 'underway';
  }

  private formatEmergencyMessage(incident: EmergencyIncident): string {
    const severity = incident.severity === 'mayday' ? 'MAYDAY MAYDAY MAYDAY' : 'PAN PAN PAN PAN';
    const vessel = incident.vesselInfo.name || 'Unknown Vessel';
    const position = `${incident.location.latitude.toFixed(4)}N ${incident.location.longitude.toFixed(4)}W`;
    const pob = incident.personOnBoard;
    
    return `${severity} - ${vessel} at position ${position} - ${incident.description} - ${pob} persons on board`;
  }

  private async transmitBroadcast(broadcast: SafetyBroadcast): Promise<void> {
    console.log(`[BROADCAST] Transmitting ${broadcast.type}: ${broadcast.message}`);
    
    // This would integrate with actual communication systems
    // For now, simulate successful transmission
    broadcast.status = 'sent';
    
    // Schedule retry for critical messages
    if (broadcast.severity === 'distress' && broadcast.requiresAcknowledgment) {
      setTimeout(() => {
        if (broadcast.status !== 'acknowledged' && broadcast.retryCount < 3) {
          broadcast.retryCount++;
          this.transmitBroadcast(broadcast);
        }
      }, 120000); // Retry in 2 minutes
    }
  }

  private async broadcastEmergencyMessage(type: string, vesselState: any): Promise<void> {
    const message = `${type.toUpperCase()} EMERGENCY - Automatic alert from ${vesselState.vesselId}`;
    console.log(`[EMERGENCY BROADCAST] ${message}`);
  }

  // Public API methods

  /**
   * Get current safety metrics
   */
  getCurrentMetrics(): SafetyMetrics | null {
    return this.currentMetrics;
  }

  /**
   * Subscribe to safety metrics updates
   */
  subscribeToSafetyMetrics(callback: (metrics: SafetyMetrics) => void): () => void {
    this.safetySubscribers.push(callback);
    return () => {
      const index = this.safetySubscribers.indexOf(callback);
      if (index > -1) this.safetySubscribers.splice(index, 1);
    };
  }

  /**
   * Subscribe to safety alerts
   */
  subscribeToAlerts(callback: (alert: SafetyAlert) => void): () => void {
    this.alertSubscribers.push(callback);
    return () => {
      const index = this.alertSubscribers.indexOf(callback);
      if (index > -1) this.alertSubscribers.splice(index, 1);
    };
  }

  /**
   * Subscribe to safety recommendations
   */
  subscribeToRecommendations(callback: (recommendations: SafetyRecommendation[]) => void): () => void {
    this.recommendationSubscribers.push(callback);
    return () => {
      const index = this.recommendationSubscribers.indexOf(callback);
      if (index > -1) this.recommendationSubscribers.splice(index, 1);
    };
  }

  /**
   * Force safety check
   */
  async performManualSafetyCheck(vesselId: string): Promise<SafetyMetrics> {
    await this.performSafetyCheck(vesselId);
    return this.currentMetrics!;
  }

  /**
   * Update monitoring configuration
   */
  updateConfiguration(updates: Partial<SafetyMonitoringConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('[SAFETY MONITORING] Configuration updated');
  }

  private notifySafetySubscribers(metrics: SafetyMetrics): void {
    this.safetySubscribers.forEach(subscriber => {
      try {
        subscriber(metrics);
      } catch (error) {
        console.error('Error notifying safety subscriber:', error);
      }
    });
  }

  private notifyRecommendationSubscribers(recommendations: SafetyRecommendation[]): void {
    this.recommendationSubscribers.forEach(subscriber => {
      try {
        subscriber(recommendations);
      } catch (error) {
        console.error('Error notifying recommendation subscriber:', error);
      }
    });
  }
}

export default SafetyMonitoringService;