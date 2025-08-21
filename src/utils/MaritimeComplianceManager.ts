/**
 * Maritime Compliance Manager - Handles regulatory compliance, disclaimers, and safety documentation
 * Ensures adherence to maritime safety regulations and proper user acknowledgment of limitations
 */

import { Location, VesselProfile } from '../types';

export interface MaritimeRegulation {
  id: string;
  name: string;
  authority: 'IMO' | 'USCG' | 'state' | 'local' | 'international';
  type: 'safety' | 'navigation' | 'environmental' | 'communication' | 'equipment';
  jurisdiction: Jurisdiction;
  applicability: RegulationApplicability;
  requirements: RegulationRequirement[];
  penalties: RegulationPenalty[];
  lastUpdated: number;
  effectiveDate: number;
  expirationDate?: number;
  references: string[];
}

export interface Jurisdiction {
  areas: GeographicArea[];
  vesselTypes: string[];
  operationTypes: string[];
  waterTypes: Array<'territorial' | 'international' | 'inland' | 'coastal'>;
  exemptions: string[];
}

export interface GeographicArea {
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  coordinates?: Location[]; // For complex polygonal areas
  depth?: {
    min?: number;
    max?: number;
  };
}

export interface RegulationApplicability {
  vesselLength: { min?: number; max?: number };
  vesselType: string[];
  operation: string[];
  timeOfDay: { start?: string; end?: string };
  season: { start?: string; end?: string };
  weatherConditions: string[];
  cargoTypes?: string[];
  passengerCount?: { min?: number; max?: number };
}

export interface RegulationRequirement {
  id: string;
  category: 'equipment' | 'procedure' | 'certification' | 'reporting' | 'monitoring';
  title: string;
  description: string;
  mandatory: boolean;
  deadline?: number; // Timestamp for time-sensitive requirements
  verificationMethod: 'inspection' | 'documentation' | 'self_certification' | 'third_party';
  consequences: string[];
}

export interface RegulationPenalty {
  violationType: string;
  severity: 'minor' | 'major' | 'severe' | 'critical';
  fineRange: { min: number; max: number; currency: string };
  otherPenalties: string[];
  enforcement: string[];
}

export interface SafetyDisclaimer {
  id: string;
  type: 'data_limitation' | 'navigation_warning' | 'emergency_procedure' | 'liability' | 'usage_terms';
  title: string;
  content: string;
  severity: 'info' | 'warning' | 'critical';
  displayRequirement: 'always' | 'first_use' | 'before_navigation' | 'emergency_only';
  acknowledgmentRequired: boolean;
  legallyRequired: boolean;
  lastUpdated: number;
  applicableRegions: string[];
  translations: Record<string, string>; // Language code -> translated content
}

export interface UserAcknowledgment {
  userId: string;
  disclaimerId: string;
  acknowledgedAt: number;
  ipAddress?: string;
  location?: Location;
  version: string; // Version of disclaimer acknowledged
  method: 'digital_signature' | 'checkbox' | 'verbal' | 'written';
  witness?: string;
  expiresAt?: number; // For time-limited acknowledgments
}

export interface ComplianceCheck {
  id: string;
  vesselProfile: VesselProfile;
  location: Location;
  operationType: string;
  timestamp: number;
  regulations: ComplianceCheckResult[];
  overallStatus: 'compliant' | 'non_compliant' | 'warning' | 'unknown';
  requiredActions: ComplianceAction[];
  recommendations: string[];
  nextCheckRequired?: number; // Timestamp for next required check
}

export interface ComplianceCheckResult {
  regulationId: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable' | 'unknown';
  details: string;
  requirements: RequirementStatus[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  deadline?: number;
}

export interface RequirementStatus {
  requirementId: string;
  met: boolean;
  evidence?: string;
  deadline?: number;
  exemption?: string;
}

export interface ComplianceAction {
  id: string;
  type: 'obtain_permit' | 'install_equipment' | 'complete_training' | 'file_report' | 'schedule_inspection';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: number;
  estimatedCost?: { amount: number; currency: string };
  provider?: string; // Who can help complete this action
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

export interface DataSourceDisclaimer {
  source: 'crowdsource' | 'official' | 'predicted' | 'historical';
  limitations: string[];
  accuracy: {
    typical: number; // Typical accuracy in meters/percentage
    worstCase: number;
    conditions: string[]; // Conditions affecting accuracy
  };
  coverage: {
    geographic: string[];
    temporal: string; // How often data is updated
    gaps: string[]; // Known areas/times with limited coverage
  };
  validation: {
    method: string;
    lastVerified: number;
    verificationSource: string;
  };
  usageGuidelines: string[];
  warningThresholds: {
    age: number; // Warn if data older than this (milliseconds)
    confidence: number; // Warn if confidence below this
    coverage: number; // Warn if coverage below this percentage
  };
}

export interface NavigationWarning {
  id: string;
  type: 'depth_uncertainty' | 'chart_discrepancy' | 'weather_impact' | 'regulatory_change' | 'hazard';
  severity: 'advisory' | 'caution' | 'warning' | 'danger';
  title: string;
  message: string;
  area: GeographicArea;
  effectiveDate: number;
  expirationDate?: number;
  conditions: string[];
  recommendations: string[];
  officialReference?: string;
  autoGenerated: boolean;
}

export class MaritimeComplianceManager {
  private regulations: Map<string, MaritimeRegulation> = new Map();
  private disclaimers: Map<string, SafetyDisclaimer> = new Map();
  private userAcknowledgments: Map<string, UserAcknowledgment[]> = new Map();
  private dataSourceDisclaimers: Map<string, DataSourceDisclaimer> = new Map();
  private navigationWarnings: Map<string, NavigationWarning> = new Map();
  private complianceChecks: Map<string, ComplianceCheck> = new Map();

  constructor() {
    this.initializeRegulations();
    this.initializeDisclaimers();
    this.initializeDataSourceDisclaimers();
  }

  /**
   * Perform comprehensive compliance check for vessel and operation
   */
  async performComplianceCheck(
    vesselProfile: VesselProfile,
    location: Location,
    operationType: string,
    userId?: string
  ): Promise<ComplianceCheck> {
    const checkId = `compliance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Find applicable regulations
    const applicableRegulations = this.findApplicableRegulations(
      vesselProfile,
      location,
      operationType
    );

    // Check each regulation
    const regulationResults: ComplianceCheckResult[] = [];
    const requiredActions: ComplianceAction[] = [];

    for (const regulation of applicableRegulations) {
      const result = await this.checkRegulationCompliance(
        regulation,
        vesselProfile,
        location,
        operationType
      );
      
      regulationResults.push(result);

      // Generate required actions for non-compliant items
      if (result.status === 'non_compliant' || result.status === 'partial') {
        const actions = this.generateComplianceActions(regulation, result);
        requiredActions.push(...actions);
      }
    }

    // Determine overall compliance status
    const overallStatus = this.determineOverallStatus(regulationResults);
    
    // Generate recommendations
    const recommendations = this.generateComplianceRecommendations(
      regulationResults,
      vesselProfile,
      location
    );

    const complianceCheck: ComplianceCheck = {
      id: checkId,
      vesselProfile,
      location,
      operationType,
      timestamp: Date.now(),
      regulations: regulationResults,
      overallStatus,
      requiredActions,
      recommendations,
      nextCheckRequired: this.calculateNextCheckDate(regulationResults)
    };

    this.complianceChecks.set(checkId, complianceCheck);

    console.log(`[COMPLIANCE CHECK] ${overallStatus} - ${applicableRegulations.length} regulations checked`);
    return complianceCheck;
  }

  /**
   * Get required disclaimers for specific context
   */
  getRequiredDisclaimers(
    context: {
      location?: Location;
      operationType?: string;
      dataSource?: string;
      severity?: 'info' | 'warning' | 'critical';
    }
  ): SafetyDisclaimer[] {
    return Array.from(this.disclaimers.values())
      .filter(disclaimer => {
        // Filter by context
        if (context.severity && disclaimer.severity !== context.severity) {
          return disclaimer.severity === 'critical'; // Always include critical
        }

        if (context.location && disclaimer.applicableRegions.length > 0) {
          // Check if location is in applicable regions
          const isApplicable = disclaimer.applicableRegions.some(region =>
            this.isLocationInRegion(context.location!, region)
          );
          if (!isApplicable) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by severity and display requirement
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        const displayOrder = { always: 4, before_navigation: 3, first_use: 2, emergency_only: 1 };
        
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        
        return displayOrder[b.displayRequirement] - displayOrder[a.displayRequirement];
      });
  }

  /**
   * Check if user has acknowledged required disclaimers
   */
  checkDisclaimerAcknowledgment(
    userId: string,
    disclaimerIds: string[]
  ): {
    acknowledged: string[];
    pending: string[];
    expired: string[];
  } {
    const userAcks = this.userAcknowledgments.get(userId) || [];
    const result = {
      acknowledged: [] as string[],
      pending: [] as string[],
      expired: [] as string[]
    };

    for (const disclaimerId of disclaimerIds) {
      const ack = userAcks.find(a => a.disclaimerId === disclaimerId);
      
      if (!ack) {
        result.pending.push(disclaimerId);
      } else if (ack.expiresAt && Date.now() > ack.expiresAt) {
        result.expired.push(disclaimerId);
      } else {
        result.acknowledged.push(disclaimerId);
      }
    }

    return result;
  }

  /**
   * Record user acknowledgment of disclaimer
   */
  recordDisclaimerAcknowledgment(
    userId: string,
    disclaimerId: string,
    method: UserAcknowledgment['method'],
    metadata: {
      ipAddress?: string;
      location?: Location;
      witness?: string;
    } = {}
  ): UserAcknowledgment {
    const disclaimer = this.disclaimers.get(disclaimerId);
    if (!disclaimer) {
      throw new Error(`Disclaimer not found: ${disclaimerId}`);
    }

    const acknowledgment: UserAcknowledgment = {
      userId,
      disclaimerId,
      acknowledgedAt: Date.now(),
      version: disclaimer.lastUpdated.toString(),
      method,
      ...metadata
    };

    // Set expiration for time-limited disclaimers
    if (disclaimer.type === 'navigation_warning') {
      acknowledgment.expiresAt = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 year
    } else if (disclaimer.type === 'usage_terms') {
      acknowledgment.expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
    }

    // Store acknowledgment
    if (!this.userAcknowledgments.has(userId)) {
      this.userAcknowledgments.set(userId, []);
    }
    this.userAcknowledgments.get(userId)!.push(acknowledgment);

    console.log(`[DISCLAIMER ACK] User ${userId} acknowledged ${disclaimerId} via ${method}`);
    return acknowledgment;
  }

  /**
   * Generate navigation warnings based on data quality and conditions
   */
  generateNavigationWarnings(
    location: Location,
    vesselProfile: VesselProfile,
    dataQuality: {
      depthConfidence: number;
      dataAge: number;
      coverage: number;
      sources: string[];
    }
  ): NavigationWarning[] {
    const warnings: NavigationWarning[] = [];

    // Data quality warnings
    if (dataQuality.depthConfidence < 0.6) {
      warnings.push({
        id: `warning_depth_confidence_${Date.now()}`,
        type: 'depth_uncertainty',
        severity: 'caution',
        title: 'Low Depth Data Confidence',
        message: `Depth data confidence is ${(dataQuality.depthConfidence * 100).toFixed(0)}%. Use caution and verify with depth sounder.`,
        area: {
          name: 'Current Area',
          bounds: {
            north: location.latitude + 0.01,
            south: location.latitude - 0.01,
            east: location.longitude + 0.01,
            west: location.longitude - 0.01
          }
        },
        effectiveDate: Date.now(),
        expirationDate: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        conditions: ['Low data confidence'],
        recommendations: [
          'Use depth sounder for verification',
          'Reduce speed in shallow areas',
          'Monitor depth continuously'
        ],
        autoGenerated: true
      });
    }

    // Outdated data warning
    if (dataQuality.dataAge > 30 * 24 * 60 * 60 * 1000) { // 30 days
      warnings.push({
        id: `warning_data_age_${Date.now()}`,
        type: 'depth_uncertainty',
        severity: 'advisory',
        title: 'Outdated Depth Data',
        message: `Depth data is ${Math.floor(dataQuality.dataAge / (24 * 60 * 60 * 1000))} days old. Conditions may have changed.`,
        area: {
          name: 'Current Area',
          bounds: {
            north: location.latitude + 0.01,
            south: location.latitude - 0.01,
            east: location.longitude + 0.01,
            west: location.longitude - 0.01
          }
        },
        effectiveDate: Date.now(),
        conditions: ['Outdated data'],
        recommendations: [
          'Consider environmental factors that may affect depth',
          'Use multiple data sources for verification',
          'Report current depth readings to help others'
        ],
        autoGenerated: true
      });
    }

    // Coverage warning
    if (dataQuality.coverage < 0.3) {
      warnings.push({
        id: `warning_coverage_${Date.now()}`,
        type: 'depth_uncertainty',
        severity: 'warning',
        title: 'Limited Depth Data Coverage',
        message: `Only ${(dataQuality.coverage * 100).toFixed(0)}% data coverage in this area. Navigate with extreme caution.`,
        area: {
          name: 'Current Area',
          bounds: {
            north: location.latitude + 0.01,
            south: location.latitude - 0.01,
            east: location.longitude + 0.01,
            west: location.longitude - 0.01
          }
        },
        effectiveDate: Date.now(),
        conditions: ['Limited data coverage'],
        recommendations: [
          'Use official charts for primary navigation',
          'Deploy depth sounder',
          'Consider alternative route with better data coverage'
        ],
        autoGenerated: true
      });
    }

    // Crowdsourced data only warning
    if (dataQuality.sources.length > 0 && !dataQuality.sources.includes('official')) {
      warnings.push({
        id: `warning_crowdsource_only_${Date.now()}`,
        type: 'depth_uncertainty',
        severity: 'caution',
        title: 'Crowdsourced Data Only',
        message: 'Navigation relies on crowdsourced depth data. Verify with official charts and depth sounder.',
        area: {
          name: 'Current Area',
          bounds: {
            north: location.latitude + 0.01,
            south: location.latitude - 0.01,
            east: location.longitude + 0.01,
            west: location.longitude - 0.01
          }
        },
        effectiveDate: Date.now(),
        conditions: ['No official chart data'],
        recommendations: [
          'Cross-reference with official nautical charts',
          'Use depth sounder for verification',
          'Proceed with caution'
        ],
        autoGenerated: true
      });
    }

    return warnings;
  }

  /**
   * Get data source disclaimer for specific source
   */
  getDataSourceDisclaimer(source: string): DataSourceDisclaimer | undefined {
    return this.dataSourceDisclaimers.get(source);
  }

  /**
   * Check if data meets warning thresholds
   */
  checkDataWarningThresholds(
    source: string,
    dataAge: number,
    confidence: number,
    coverage: number
  ): string[] {
    const disclaimer = this.dataSourceDisclaimers.get(source);
    if (!disclaimer) return [];

    const warnings: string[] = [];

    if (dataAge > disclaimer.warningThresholds.age) {
      warnings.push(`Data age exceeds recommended threshold (${Math.floor(dataAge / (24 * 60 * 60 * 1000))} days)`);
    }

    if (confidence < disclaimer.warningThresholds.confidence) {
      warnings.push(`Data confidence below recommended threshold (${(confidence * 100).toFixed(0)}%)`);
    }

    if (coverage < disclaimer.warningThresholds.coverage) {
      warnings.push(`Data coverage below recommended threshold (${(coverage * 100).toFixed(0)}%)`);
    }

    return warnings;
  }

  /**
   * Find applicable regulations for vessel and operation
   */
  private findApplicableRegulations(
    vesselProfile: VesselProfile,
    location: Location,
    operationType: string
  ): MaritimeRegulation[] {
    return Array.from(this.regulations.values())
      .filter(regulation => {
        // Check jurisdiction
        const inJurisdiction = regulation.jurisdiction.areas.some(area =>
          this.isLocationInArea(location, area)
        );
        if (!inJurisdiction) return false;

        // Check vessel type
        if (regulation.jurisdiction.vesselTypes.length > 0) {
          if (!regulation.jurisdiction.vesselTypes.includes(vesselProfile.type)) {
            return false;
          }
        }

        // Check operation type
        if (regulation.jurisdiction.operationTypes.length > 0) {
          if (!regulation.jurisdiction.operationTypes.includes(operationType)) {
            return false;
          }
        }

        // Check applicability criteria
        const app = regulation.applicability;
        
        // Vessel length
        if (app.vesselLength.min && vesselProfile.length < app.vesselLength.min) return false;
        if (app.vesselLength.max && vesselProfile.length > app.vesselLength.max) return false;

        // Vessel type (more specific check)
        if (app.vesselType.length > 0 && !app.vesselType.includes(vesselProfile.type)) {
          return false;
        }

        // Operation type (more specific check)
        if (app.operation.length > 0 && !app.operation.includes(operationType)) {
          return false;
        }

        return true;
      });
  }

  /**
   * Check compliance with a specific regulation
   */
  private async checkRegulationCompliance(
    regulation: MaritimeRegulation,
    vesselProfile: VesselProfile,
    location: Location,
    operationType: string
  ): Promise<ComplianceCheckResult> {
    const requirements: RequirementStatus[] = [];
    let compliantCount = 0;

    for (const requirement of regulation.requirements) {
      const status = await this.checkRequirementCompliance(
        requirement,
        vesselProfile,
        location
      );
      
      requirements.push(status);
      if (status.met) compliantCount++;
    }

    // Determine overall status
    let status: ComplianceCheckResult['status'];
    if (compliantCount === requirements.length) {
      status = 'compliant';
    } else if (compliantCount === 0) {
      status = 'non_compliant';
    } else {
      status = 'partial';
    }

    // Assess risk level
    const nonCompliantMandatory = requirements.filter(r => !r.met).length;
    const riskLevel = nonCompliantMandatory === 0 ? 'low' :
                     nonCompliantMandatory <= 2 ? 'medium' :
                     nonCompliantMandatory <= 4 ? 'high' : 'critical';

    return {
      regulationId: regulation.id,
      status,
      details: `${compliantCount}/${requirements.length} requirements met`,
      requirements,
      riskLevel,
      deadline: this.getEarliestDeadline(requirements)
    };
  }

  /**
   * Check compliance with a specific requirement
   */
  private async checkRequirementCompliance(
    requirement: RegulationRequirement,
    vesselProfile: VesselProfile,
    location: Location
  ): Promise<RequirementStatus> {
    // This would integrate with vessel equipment databases, certification systems, etc.
    // For now, return placeholder implementation
    
    return {
      requirementId: requirement.id,
      met: Math.random() > 0.3, // Simulate 70% compliance rate
      evidence: 'Simulated compliance check',
      deadline: requirement.deadline
    };
  }

  /**
   * Generate compliance actions for non-compliant regulations
   */
  private generateComplianceActions(
    regulation: MaritimeRegulation,
    result: ComplianceCheckResult
  ): ComplianceAction[] {
    const actions: ComplianceAction[] = [];

    for (const reqStatus of result.requirements) {
      if (!reqStatus.met) {
        const requirement = regulation.requirements.find(r => r.id === reqStatus.requirementId);
        if (!requirement) continue;

        actions.push({
          id: `action_${requirement.id}_${Date.now()}`,
          type: this.mapRequirementToActionType(requirement.category),
          title: `Address: ${requirement.title}`,
          description: requirement.description,
          priority: requirement.mandatory ? 'high' : 'medium',
          deadline: reqStatus.deadline,
          status: 'pending'
        });
      }
    }

    return actions;
  }

  /**
   * Map requirement category to action type
   */
  private mapRequirementToActionType(category: string): ComplianceAction['type'] {
    const mapping: Record<string, ComplianceAction['type']> = {
      equipment: 'install_equipment',
      certification: 'complete_training',
      reporting: 'file_report',
      procedure: 'complete_training',
      monitoring: 'schedule_inspection'
    };
    
    return mapping[category] || 'complete_training';
  }

  /**
   * Helper methods
   */
  private determineOverallStatus(results: ComplianceCheckResult[]): ComplianceCheck['overallStatus'] {
    if (results.every(r => r.status === 'compliant' || r.status === 'not_applicable')) {
      return 'compliant';
    }
    
    if (results.some(r => r.riskLevel === 'critical' || r.riskLevel === 'high')) {
      return 'non_compliant';
    }
    
    if (results.some(r => r.status === 'non_compliant' || r.status === 'partial')) {
      return 'warning';
    }
    
    return 'unknown';
  }

  private generateComplianceRecommendations(
    results: ComplianceCheckResult[],
    vesselProfile: VesselProfile,
    location: Location
  ): string[] {
    const recommendations: string[] = [];

    // Generic recommendations based on compliance status
    const nonCompliantCount = results.filter(r => r.status === 'non_compliant').length;
    if (nonCompliantCount > 0) {
      recommendations.push('Address non-compliant regulations before operating');
      recommendations.push('Consult with marine safety professionals for guidance');
    }

    const highRiskCount = results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length;
    if (highRiskCount > 0) {
      recommendations.push('Prioritize high-risk compliance issues immediately');
    }

    // Add vessel-specific recommendations
    if (vesselProfile.length > 12) {
      recommendations.push('Ensure commercial vessel documentation is current');
    }

    return recommendations;
  }

  private calculateNextCheckDate(results: ComplianceCheckResult[]): number | undefined {
    const deadlines = results
      .map(r => r.deadline)
      .filter(d => d !== undefined) as number[];
    
    if (deadlines.length === 0) return undefined;
    
    return Math.min(...deadlines);
  }

  private getEarliestDeadline(requirements: RequirementStatus[]): number | undefined {
    const deadlines = requirements
      .map(r => r.deadline)
      .filter(d => d !== undefined) as number[];
    
    return deadlines.length > 0 ? Math.min(...deadlines) : undefined;
  }

  private isLocationInArea(location: Location, area: GeographicArea): boolean {
    return location.latitude >= area.bounds.south &&
           location.latitude <= area.bounds.north &&
           location.longitude >= area.bounds.west &&
           location.longitude <= area.bounds.east;
  }

  private isLocationInRegion(location: Location, region: string): boolean {
    // Simplified region check - would implement proper geographic lookup
    return true;
  }

  /**
   * Initialize default regulations
   */
  private initializeRegulations(): void {
    // Example: US recreational vessel safety regulation
    this.regulations.set('uscg_recreational_safety', {
      id: 'uscg_recreational_safety',
      name: 'USCG Recreational Vessel Safety Requirements',
      authority: 'USCG',
      type: 'safety',
      jurisdiction: {
        areas: [{
          name: 'US Waters',
          bounds: { north: 49, south: 24, east: -66, west: -180 }
        }],
        vesselTypes: ['sailboat', 'motorboat', 'yacht'],
        operationTypes: ['recreational'],
        waterTypes: ['territorial', 'coastal'],
        exemptions: []
      },
      applicability: {
        vesselLength: { min: 0, max: 65 },
        vesselType: ['sailboat', 'motorboat', 'yacht'],
        operation: ['recreational'],
        timeOfDay: {},
        season: {},
        weatherConditions: []
      },
      requirements: [
        {
          id: 'life_jackets',
          category: 'equipment',
          title: 'Personal Flotation Devices',
          description: 'One USCG-approved life jacket for each person on board',
          mandatory: true,
          verificationMethod: 'inspection',
          consequences: ['Fine', 'Vessel detention']
        },
        {
          id: 'sound_signals',
          category: 'equipment',
          title: 'Sound Signaling Devices',
          description: 'Horn or whistle for vessels over 12 feet',
          mandatory: true,
          verificationMethod: 'inspection',
          consequences: ['Fine']
        }
      ],
      penalties: [
        {
          violationType: 'Missing safety equipment',
          severity: 'major',
          fineRange: { min: 100, max: 1000, currency: 'USD' },
          otherPenalties: ['Vessel detention until compliance'],
          enforcement: ['Coast Guard', 'Marine Police']
        }
      ],
      lastUpdated: Date.now(),
      effectiveDate: Date.now() - (365 * 24 * 60 * 60 * 1000),
      references: ['33 CFR 175', 'Navigation Rules']
    });
  }

  /**
   * Initialize default disclaimers
   */
  private initializeDisclaimers(): void {
    this.disclaimers.set('crowdsource_data_limitation', {
      id: 'crowdsource_data_limitation',
      type: 'data_limitation',
      title: 'Crowdsourced Data Limitations',
      content: `IMPORTANT: This application uses crowdsourced depth data contributed by users. This data:

• May not be accurate or current
• Should not be used as the sole source for navigation
• Must be verified with official nautical charts
• May contain errors or be deliberately false
• Is provided without warranty or guarantee

ALWAYS use official nautical charts and proper navigation equipment for safe marine navigation. The accuracy and completeness of crowdsourced data cannot be guaranteed.`,
      severity: 'critical',
      displayRequirement: 'before_navigation',
      acknowledgmentRequired: true,
      legallyRequired: true,
      lastUpdated: Date.now(),
      applicableRegions: ['global'],
      translations: {}
    });

    this.disclaimers.set('navigation_responsibility', {
      id: 'navigation_responsibility',
      type: 'navigation_warning',
      title: 'Navigation Responsibility',
      content: `The captain/operator is solely responsible for safe navigation. This application is a navigation aid only and does not replace:

• Proper seamanship and navigation skills
• Official nautical charts and publications
• Depth sounders and navigation equipment
• Weather monitoring and route planning
• Maritime safety regulations compliance

Use this application as supplementary information only. Always maintain proper lookout and follow rules of the road.`,
      severity: 'warning',
      displayRequirement: 'first_use',
      acknowledgmentRequired: true,
      legallyRequired: true,
      lastUpdated: Date.now(),
      applicableRegions: ['global'],
      translations: {}
    });

    this.disclaimers.set('emergency_limitations', {
      id: 'emergency_limitations',
      title: 'Emergency Response Limitations',
      type: 'emergency_procedure',
      content: `Emergency features in this application have limitations:

• Cellular/internet connectivity may not be available
• GPS accuracy may be affected by weather/equipment
• Emergency contacts may not be immediately available
• Response times vary by location and conditions

In emergency situations:
• Use VHF Channel 16 for immediate assistance
• Activate EPIRB or satellite emergency beacons if available
• Follow proper emergency procedures for your vessel
• Do not rely solely on this application for emergency communication`,
      severity: 'critical',
      displayRequirement: 'first_use',
      acknowledgmentRequired: true,
      legallyRequired: false,
      lastUpdated: Date.now(),
      applicableRegions: ['global'],
      translations: {}
    });
  }

  /**
   * Initialize data source disclaimers
   */
  private initializeDataSourceDisclaimers(): void {
    this.dataSourceDisclaimers.set('crowdsource', {
      source: 'crowdsource',
      limitations: [
        'Accuracy depends on contributor equipment and skill',
        'May contain measurement errors or false data',
        'Coverage varies by location and user activity',
        'Not independently verified by maritime authorities'
      ],
      accuracy: {
        typical: 1.0, // ±1 meter typical
        worstCase: 10.0, // ±10 meters worst case
        conditions: ['GPS accuracy', 'Depth sounder calibration', 'Vessel motion', 'User error']
      },
      coverage: {
        geographic: ['Popular boating areas', 'Crowdsourced coverage varies'],
        temporal: 'Updated as users contribute data',
        gaps: ['Remote areas', 'Restricted waters', 'Deep ocean', 'Recently changed conditions']
      },
      validation: {
        method: 'Statistical analysis and user reputation scoring',
        lastVerified: Date.now(),
        verificationSource: 'Automated algorithms'
      },
      usageGuidelines: [
        'Use as supplementary information only',
        'Verify with official charts and depth sounder',
        'Consider data age and confidence scores',
        'Report inconsistencies to improve data quality'
      ],
      warningThresholds: {
        age: 30 * 24 * 60 * 60 * 1000, // 30 days
        confidence: 0.6, // 60%
        coverage: 0.3 // 30%
      }
    });

    this.dataSourceDisclaimers.set('official', {
      source: 'official',
      limitations: [
        'Based on historical surveys that may be outdated',
        'May not reflect recent changes to seabed',
        'Survey density varies by area importance',
        'Chart datum may differ from GPS datum'
      ],
      accuracy: {
        typical: 0.5, // ±0.5 meters typical for modern charts
        worstCase: 5.0, // ±5 meters for older charts
        conditions: ['Survey age', 'Survey methods', 'Chart datum', 'Tidal corrections']
      },
      coverage: {
        geographic: ['Commercially important waterways', 'Harbor approaches', 'Major shipping lanes'],
        temporal: 'Updated periodically by hydrographic offices',
        gaps: ['Remote areas', 'Shallow recreational waters', 'Rapidly changing areas']
      },
      validation: {
        method: 'Professional hydrographic surveys',
        lastVerified: Date.now() - (365 * 24 * 60 * 60 * 1000), // 1 year ago
        verificationSource: 'National Hydrographic Office'
      },
      usageGuidelines: [
        'Primary source for navigation planning',
        'Check chart edition date and corrections',
        'Consider chart datum relative to GPS',
        'Supplement with local knowledge and depth sounder'
      ],
      warningThresholds: {
        age: 5 * 365 * 24 * 60 * 60 * 1000, // 5 years
        confidence: 0.8, // 80%
        coverage: 0.7 // 70%
      }
    });
  }

  /**
   * Get user's compliance history
   */
  getUserComplianceHistory(userId: string): ComplianceCheck[] {
    return Array.from(this.complianceChecks.values())
      .filter(check => check.vesselProfile.name?.includes(userId)) // Simplified user matching
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get active navigation warnings for area
   */
  getActiveNavigationWarnings(location: Location, radiusKm: number = 10): NavigationWarning[] {
    const now = Date.now();
    
    return Array.from(this.navigationWarnings.values())
      .filter(warning => {
        // Check if warning is active
        if (warning.expirationDate && now > warning.expirationDate) return false;
        if (now < warning.effectiveDate) return false;

        // Check if location is within warning area
        return this.isLocationInArea(location, warning.area);
      })
      .sort((a, b) => {
        // Sort by severity
        const severityOrder = { danger: 4, warning: 3, caution: 2, advisory: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
  }
}

export default MaritimeComplianceManager;