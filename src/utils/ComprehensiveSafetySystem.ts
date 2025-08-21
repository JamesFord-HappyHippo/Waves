/**
 * Comprehensive Safety System Integration - Main orchestrator for all safety components
 * Coordinates safety validation, alerts, emergency protocols, and compliance management
 */

import { Location, VesselProfile } from '../types';
import SafetyValidationEngine from './SafetyValidationEngine';
import SafetyAlertHierarchy from './SafetyAlertHierarchy';
import SafeRouteNavigation from './SafeRouteNavigation';
import EmergencyProtocolManager from './EmergencyProtocolManager';
import MaritimeComplianceManager from './MaritimeComplianceManager';
import SafetyMonitoringService from '../services/SafetyMonitoringService';

export interface SafetySystemConfig {
  validation: {
    minDataPoints: number;
    confidenceThreshold: number;
    safetyMarginRatio: number;
  };
  alerts: {
    audioEnabled: boolean;
    hapticEnabled: boolean;
    autoEscalation: boolean;
  };
  navigation: {
    autoCorrectMinorDeviations: boolean;
    routeDeviationThreshold: number;
    speedVarianceThreshold: number;
  };
  emergency: {
    autoLocationSharing: boolean;
    emergencyContactsRequired: number;
    autoMayDayThreshold: number;
  };
  compliance: {
    autoComplianceChecks: boolean;
    complianceCheckInterval: number;
    enforceDisclaimers: boolean;
  };
  monitoring: {
    realTimeMonitoring: boolean;
    monitoringInterval: number;
    dataQualityRequirements: {
      minConfidence: number;
      maxDataAge: number;
    };
  };
}

export interface SafetySystemStatus {
  overall: 'safe' | 'caution' | 'warning' | 'critical' | 'emergency';
  components: {
    validation: 'active' | 'warning' | 'error';
    alerts: 'normal' | 'active' | 'critical';
    navigation: 'inactive' | 'monitoring' | 'warning';
    emergency: 'standby' | 'active' | 'incident';
    compliance: 'compliant' | 'warning' | 'non_compliant';
    monitoring: 'active' | 'degraded' | 'offline';
  };
  metrics: {
    activeAlerts: number;
    emergencyIncidents: number;
    complianceIssues: number;
    dataQuality: number;
    systemUptime: number;
  };
  lastUpdate: number;
}

export class ComprehensiveSafetySystem {
  private validationEngine: SafetyValidationEngine;
  private alertHierarchy: SafetyAlertHierarchy;
  private routeNavigation: SafeRouteNavigation;
  private emergencyManager: EmergencyProtocolManager;
  private complianceManager: MaritimeComplianceManager;
  private monitoringService: SafetyMonitoringService;
  
  private config: SafetySystemConfig;
  private systemStatus: SafetySystemStatus;
  private isInitialized: boolean = false;
  private startTime: number = Date.now();

  constructor(config: Partial<SafetySystemConfig> = {}) {
    this.config = {
      validation: {
        minDataPoints: 3,
        confidenceThreshold: 0.6,
        safetyMarginRatio: 1.5,
      },
      alerts: {
        audioEnabled: true,
        hapticEnabled: true,
        autoEscalation: true,
      },
      navigation: {
        autoCorrectMinorDeviations: false,
        routeDeviationThreshold: 50,
        speedVarianceThreshold: 2,
      },
      emergency: {
        autoLocationSharing: true,
        emergencyContactsRequired: 2,
        autoMayDayThreshold: 30, // seconds
      },
      compliance: {
        autoComplianceChecks: true,
        complianceCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
        enforceDisclaimers: true,
      },
      monitoring: {
        realTimeMonitoring: true,
        monitoringInterval: 10000, // 10 seconds
        dataQualityRequirements: {
          minConfidence: 0.7,
          maxDataAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        },
      },
      ...config
    };

    this.initializeSystemStatus();
    this.initializeComponents();
  }

  /**
   * Initialize all safety system components
   */
  private initializeComponents(): void {
    try {
      // Initialize core validation engine
      this.validationEngine = new SafetyValidationEngine({
        minDataPoints: this.config.validation.minDataPoints,
        confidenceThreshold: this.config.validation.confidenceThreshold,
        safetyMarginRatio: this.config.validation.safetyMarginRatio,
      });

      // Initialize alert hierarchy
      this.alertHierarchy = new SafetyAlertHierarchy();

      // Initialize emergency protocol manager
      this.emergencyManager = new EmergencyProtocolManager();

      // Initialize compliance manager
      this.complianceManager = new MaritimeComplianceManager();

      // Initialize route navigation with dependencies
      this.routeNavigation = new SafeRouteNavigation(
        this.validationEngine,
        this.alertHierarchy,
        {
          routeDeviationThreshold: this.config.navigation.routeDeviationThreshold,
          speedVarianceThreshold: this.config.navigation.speedVarianceThreshold,
          autoCorrectMinorDeviations: this.config.navigation.autoCorrectMinorDeviations,
        }
      );

      // Initialize monitoring service
      this.monitoringService = new SafetyMonitoringService({
        monitoringInterval: this.config.monitoring.monitoringInterval,
        dataQualityRequirements: this.config.monitoring.dataQualityRequirements,
      });

      this.setupEventHandlers();
      this.isInitialized = true;
      
      console.log('[SAFETY SYSTEM] All components initialized successfully');
      this.updateSystemStatus();

    } catch (error) {
      console.error('[SAFETY SYSTEM] Initialization failed:', error);
      this.systemStatus.components.validation = 'error';
      this.updateSystemStatus();
    }
  }

  /**
   * Set up event handlers between components
   */
  private setupEventHandlers(): void {
    // Subscribe to alerts and handle emergency escalation
    this.alertHierarchy.subscribeToAlerts((alert) => {
      if (alert.severity === 'emergency' && this.config.emergency.autoLocationSharing) {
        this.handleEmergencyAlert(alert);
      }
    });

    // Subscribe to emergency protocol activations
    this.emergencyManager.subscribeToIncidents((incident) => {
      console.log(`[SAFETY SYSTEM] Emergency incident activated: ${incident.type}`);
      this.updateSystemStatus();
    });

    // Subscribe to monitoring service metrics
    this.monitoringService.subscribeToSafetyMetrics((metrics) => {
      this.updateMetricsFromMonitoring(metrics);
    });

    // Subscribe to safety recommendations
    this.monitoringService.subscribeToRecommendations((recommendations) => {
      console.log(`[SAFETY SYSTEM] ${recommendations.length} safety recommendations generated`);
    });
  }

  /**
   * Start the comprehensive safety monitoring system
   */
  async startSafetyMonitoring(vesselId: string, vesselProfile: VesselProfile): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Safety system not initialized');
    }

    console.log(`[SAFETY SYSTEM] Starting comprehensive safety monitoring for vessel ${vesselId}`);

    // Perform initial compliance check
    if (this.config.compliance.autoComplianceChecks) {
      await this.performInitialComplianceCheck(vesselProfile);
    }

    // Start real-time monitoring
    if (this.config.monitoring.realTimeMonitoring) {
      this.monitoringService.startMonitoring(vesselId);
    }

    this.systemStatus.components.monitoring = 'active';
    this.updateSystemStatus();
  }

  /**
   * Stop safety monitoring
   */
  stopSafetyMonitoring(): void {
    console.log('[SAFETY SYSTEM] Stopping safety monitoring');
    
    this.monitoringService.stopMonitoring();
    this.routeNavigation.stopNavigationMonitoring();
    
    this.systemStatus.components.monitoring = 'offline';
    this.systemStatus.components.navigation = 'inactive';
    this.updateSystemStatus();
  }

  /**
   * Perform comprehensive safety validation for current position
   */
  async validateCurrentSafety(
    location: Location,
    vesselProfile: VesselProfile,
    depthData: any[]
  ): Promise<{
    validation: any;
    alerts: any[];
    warnings: any[];
    recommendations: string[];
  }> {
    console.log('[SAFETY SYSTEM] Performing comprehensive safety validation');

    // Validate depth data
    const validation = await this.validationEngine.validateDepthData(
      location,
      vesselProfile.draft,
      depthData
    );

    // Generate navigation warnings
    const warnings = this.complianceManager.generateNavigationWarnings(
      location,
      vesselProfile,
      {
        depthConfidence: validation.confidence,
        dataAge: Date.now() - Math.min(...depthData.map(d => d.timestamp)),
        coverage: depthData.length / 10, // Simplified coverage calculation
        sources: [...new Set(depthData.map(d => d.source))]
      }
    );

    // Get active alerts
    const alerts = this.alertHierarchy.getActiveAlerts();

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (!validation.isValid) {
      recommendations.push(...validation.recommendations);
    }

    if (validation.confidence < this.config.validation.confidenceThreshold) {
      recommendations.push('Use depth sounder for verification');
      recommendations.push('Reduce speed and increase vigilance');
    }

    if (warnings.length > 0) {
      recommendations.push('Review all navigation warnings carefully');
    }

    return {
      validation,
      alerts,
      warnings,
      recommendations
    };
  }

  /**
   * Plan and start safe route navigation
   */
  async startSafeNavigation(
    startLocation: Location,
    endLocation: Location,
    vesselProfile: VesselProfile,
    depthData: any[]
  ): Promise<any> {
    console.log('[SAFETY SYSTEM] Starting safe route navigation');

    // Plan safe route
    const route = await this.routeNavigation.planSafeRoute(
      startLocation,
      endLocation,
      vesselProfile,
      depthData,
      {
        prioritizeSafety: true,
        avoidShallowWater: true,
        considerWeather: true,
      }
    );

    // Start navigation monitoring
    this.routeNavigation.startNavigationMonitoring(route, startLocation);

    this.systemStatus.components.navigation = 'monitoring';
    this.updateSystemStatus();

    return route;
  }

  /**
   * Handle emergency alert escalation
   */
  private async handleEmergencyAlert(alert: any): Promise<void> {
    console.log(`[SAFETY SYSTEM] Handling emergency alert: ${alert.title}`);

    // Auto-report emergency incident
    await this.emergencyManager.reportEmergencyIncident(
      alert.category,
      alert.severity === 'emergency' ? 'mayday' : 'critical',
      alert.location,
      { name: 'Current Vessel', type: 'recreational', length: 10, draft: 1.5 } as VesselProfile,
      alert.message,
      {
        immediateDanger: alert.severity === 'emergency'
      }
    );

    this.systemStatus.components.emergency = 'incident';
    this.updateSystemStatus();
  }

  /**
   * Perform initial compliance check
   */
  private async performInitialComplianceCheck(vesselProfile: VesselProfile): Promise<void> {
    console.log('[SAFETY SYSTEM] Performing initial compliance check');

    const mockLocation: Location = { latitude: 40.7128, longitude: -74.0060, accuracy: 5, timestamp: Date.now() };
    
    const complianceCheck = await this.complianceManager.performComplianceCheck(
      vesselProfile,
      mockLocation,
      'recreational'
    );

    if (complianceCheck.overallStatus === 'non_compliant') {
      this.alertHierarchy.createAlert(
        'warning',
        'navigation',
        'Compliance Issues Detected',
        `${complianceCheck.requiredActions.length} compliance issues require attention`,
        mockLocation
      );
    }

    this.systemStatus.components.compliance = complianceCheck.overallStatus;
    this.updateSystemStatus();
  }

  /**
   * Initialize system status
   */
  private initializeSystemStatus(): void {
    this.systemStatus = {
      overall: 'safe',
      components: {
        validation: 'active',
        alerts: 'normal',
        navigation: 'inactive',
        emergency: 'standby',
        compliance: 'compliant',
        monitoring: 'offline',
      },
      metrics: {
        activeAlerts: 0,
        emergencyIncidents: 0,
        complianceIssues: 0,
        dataQuality: 1.0,
        systemUptime: 0,
      },
      lastUpdate: Date.now(),
    };
  }

  /**
   * Update system status based on component states
   */
  private updateSystemStatus(): void {
    // Calculate overall status
    const componentStates = Object.values(this.systemStatus.components);
    
    if (componentStates.includes('error') || this.systemStatus.components.emergency === 'incident') {
      this.systemStatus.overall = 'emergency';
    } else if (componentStates.includes('critical') || this.systemStatus.components.alerts === 'critical') {
      this.systemStatus.overall = 'critical';
    } else if (componentStates.includes('warning')) {
      this.systemStatus.overall = 'warning';
    } else if (componentStates.includes('degraded')) {
      this.systemStatus.overall = 'caution';
    } else {
      this.systemStatus.overall = 'safe';
    }

    // Update metrics
    this.systemStatus.metrics.activeAlerts = this.alertHierarchy.getActiveAlerts().length;
    this.systemStatus.metrics.emergencyIncidents = this.emergencyManager.getActiveIncidents().length;
    this.systemStatus.metrics.systemUptime = Date.now() - this.startTime;
    this.systemStatus.lastUpdate = Date.now();

    console.log(`[SAFETY SYSTEM] Status updated: ${this.systemStatus.overall}`);
  }

  /**
   * Update metrics from monitoring service
   */
  private updateMetricsFromMonitoring(metrics: any): void {
    this.systemStatus.metrics.dataQuality = metrics.depthSafety.confidence;
    
    // Update alert status based on active alerts
    if (metrics.alerts.critical > 0) {
      this.systemStatus.components.alerts = 'critical';
    } else if (metrics.alerts.active > 0) {
      this.systemStatus.components.alerts = 'active';
    } else {
      this.systemStatus.components.alerts = 'normal';
    }

    this.updateSystemStatus();
  }

  /**
   * Get current system status
   */
  getSystemStatus(): SafetySystemStatus {
    return { ...this.systemStatus };
  }

  /**
   * Get individual component instances for advanced use
   */
  getComponents() {
    return {
      validationEngine: this.validationEngine,
      alertHierarchy: this.alertHierarchy,
      routeNavigation: this.routeNavigation,
      emergencyManager: this.emergencyManager,
      complianceManager: this.complianceManager,
      monitoringService: this.monitoringService,
    };
  }

  /**
   * Update system configuration
   */
  updateConfiguration(updates: Partial<SafetySystemConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Apply configuration changes to components
    if (updates.monitoring) {
      this.monitoringService.updateConfiguration(updates.monitoring);
    }

    console.log('[SAFETY SYSTEM] Configuration updated');
  }

  /**
   * Perform emergency test of all systems
   */
  async performSystemTest(): Promise<{
    passed: boolean;
    results: Record<string, boolean>;
    errors: string[];
  }> {
    console.log('[SAFETY SYSTEM] Performing comprehensive system test');

    const results: Record<string, boolean> = {};
    const errors: string[] = [];

    try {
      // Test validation engine
      results.validation = this.validationEngine !== null;

      // Test alert hierarchy
      const testAlert = this.alertHierarchy.createAlert(
        'info',
        'navigation',
        'System Test',
        'Testing alert system',
        { latitude: 0, longitude: 0, accuracy: 1, timestamp: Date.now() }
      );
      results.alerts = testAlert !== null;
      
      // Dismiss test alert
      this.alertHierarchy.dismissAlert(testAlert.id);

      // Test emergency manager
      results.emergency = this.emergencyManager.getActiveIncidents().length >= 0;

      // Test compliance manager
      results.compliance = this.complianceManager !== null;

      // Test monitoring service
      results.monitoring = this.monitoringService !== null;

      const passed = Object.values(results).every(result => result);

      console.log(`[SAFETY SYSTEM] System test ${passed ? 'PASSED' : 'FAILED'}`);

      return { passed, results, errors };

    } catch (error) {
      errors.push(`System test failed: ${error.message}`);
      return { passed: false, results, errors };
    }
  }
}

export default ComprehensiveSafetySystem;