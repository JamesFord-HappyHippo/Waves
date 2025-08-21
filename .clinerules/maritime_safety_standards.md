# Maritime Safety Standards - Navigation Software

**Domain**: Marine navigation software safety requirements  
**Regulatory Context**: Recreational navigation aid (not certified marine equipment)  
**Last Updated**: 2025-08-20T00:00:00Z

## Core Safety Principles

### 1. Navigation Software Classification
**Important**: This application is a **navigation aid**, not certified marine navigation equipment:
- **Supplemental Use Only**: Must not be sole source of navigation information
- **Official Chart Integration**: Always reference authoritative nautical charts
- **Backup Systems**: Encourage use of traditional navigation methods
- **Liability Limitations**: Clear disclaimers about data accuracy and limitations

### 2. Mandatory Safety Disclaimers

#### Primary Navigation Disclaimer ✅
```typescript
export const NAVIGATION_DISCLAIMER = `
⚠️ NAVIGATION AID ONLY - FOR REFERENCE USE
This application provides crowdsourced depth data and should NOT be used as the sole source for marine navigation. 

ALWAYS:
• Consult official nautical charts and NOTAMs
• Use proper marine navigation equipment
• Verify water depth with lead line or depth sounder
• Consider tide, weather, and current conditions
• Exercise proper seamanship and caution

LIMITATIONS:
• Crowdsourced data accuracy cannot be guaranteed
• Water depths change due to storms, sedimentation, and tides
• Equipment malfunctions may occur
• GPS accuracy varies with conditions

The developers and operators of this application accept no responsibility for navigation decisions made using this data.
`;

// Context-specific safety messages
export const SAFETY_MESSAGES = {
  SHALLOW_WATER: "⚠️ SHALLOW WATER INDICATED - Reduce speed, post lookout, verify depth manually",
  NO_DATA: "❓ NO DEPTH DATA - Unknown conditions ahead, navigate with extreme caution",
  OLD_DATA: "⏰ OUTDATED DATA - Information may not reflect current conditions",
  LOW_CONFIDENCE: "❌ UNVERIFIED DATA - Low reliability, confirm with official sources",
  EQUIPMENT_ERROR: "🔧 EQUIPMENT ERROR - GPS or sensor malfunction, use backup navigation",
  EMERGENCY: "🚨 FOR EMERGENCIES - Contact Coast Guard on VHF Channel 16 (156.8 MHz)"
};
```

#### User Agreement Requirements ✅
```typescript
export const SAFETY_ACKNOWLEDGMENTS = [
  {
    id: 'primary_disclaimer',
    title: 'Navigation Aid Only',
    text: 'I understand this app is a navigation aid only and will not use it as my sole source of navigation information.',
    required: true
  },
  {
    id: 'official_charts',
    title: 'Official Charts Required',
    text: 'I will always consult official nautical charts and use proper marine navigation equipment.',
    required: true
  },
  {
    id: 'data_limitations',
    title: 'Data Limitations',
    text: 'I understand that crowdsourced data may be inaccurate, incomplete, or outdated.',
    required: true
  },
  {
    id: 'local_conditions',
    title: 'Local Conditions',
    text: 'I will consider local tide, weather, and current conditions that may affect navigation.',
    required: true
  },
  {
    id: 'emergency_procedures',
    title: 'Emergency Procedures',
    text: 'I know how to contact emergency services (Coast Guard VHF Channel 16) in case of distress.',
    required: true
  }
];
```

### 3. Data Accuracy & Validation Requirements

#### Multi-Source Validation ✅
```typescript
export interface DataValidationRules {
  // Minimum readings required for navigation decisions
  minReadingsRequired: number;
  
  // Maximum age of data for navigation use  
  maxDataAgeHours: number;
  
  // Minimum confidence threshold for safety decisions
  minConfidenceForNavigation: number;
  
  // Required agreement between readings
  maxDepthVariance: number; // meters
}

export const NAVIGATION_VALIDATION_RULES: DataValidationRules = {
  minReadingsRequired: 3,        // At least 3 independent readings
  maxDataAgeHours: 72,          // Data no older than 3 days for navigation
  minConfidenceForNavigation: 0.7, // 70% confidence minimum
  maxDepthVariance: 1.0         // Readings must agree within 1 meter
};

export const validateNavigationData = (readings: DepthReading[]): NavigationValidation => {
  const validation: NavigationValidation = {
    isSafeForNavigation: false,
    warnings: [],
    recommendedAction: 'VERIFY_MANUALLY',
    qualityScore: 0
  };

  // Check minimum readings requirement
  if (readings.length < NAVIGATION_VALIDATION_RULES.minReadingsRequired) {
    validation.warnings.push(`Insufficient data: Only ${readings.length} readings available, ${NAVIGATION_VALIDATION_RULES.minReadingsRequired} required`);
    return validation;
  }

  // Check data freshness
  const now = Date.now();
  const maxAge = NAVIGATION_VALIDATION_RULES.maxDataAgeHours * 60 * 60 * 1000;
  const freshReadings = readings.filter(r => (now - r.timestamp.getTime()) <= maxAge);
  
  if (freshReadings.length < NAVIGATION_VALIDATION_RULES.minReadingsRequired) {
    validation.warnings.push(`Outdated data: Only ${freshReadings.length} recent readings available`);
    return validation;
  }

  // Check confidence scores
  const highConfidenceReadings = freshReadings.filter(r => r.confidence >= NAVIGATION_VALIDATION_RULES.minConfidenceForNavigation);
  
  if (highConfidenceReadings.length < NAVIGATION_VALIDATION_RULES.minReadingsRequired) {
    validation.warnings.push(`Low confidence data: Only ${highConfidenceReadings.length} reliable readings`);
    return validation;
  }

  // Check consistency between readings
  const depths = highConfidenceReadings.map(r => r.depth);
  const maxDepth = Math.max(...depths);
  const minDepth = Math.min(...depths);
  
  if ((maxDepth - minDepth) > NAVIGATION_VALIDATION_RULES.maxDepthVariance) {
    validation.warnings.push(`Inconsistent readings: Depth variance of ${(maxDepth - minDepth).toFixed(1)}m exceeds ${NAVIGATION_VALIDATION_RULES.maxDepthVariance}m threshold`);
    validation.recommendedAction = 'VERIFY_WITH_SONAR';
    return validation;
  }

  // Calculate quality score
  const avgConfidence = highConfidenceReadings.reduce((sum, r) => sum + r.confidence, 0) / highConfidenceReadings.length;
  const dataFreshness = Math.min(1, maxAge / (now - Math.min(...freshReadings.map(r => r.timestamp.getTime()))));
  validation.qualityScore = (avgConfidence * 0.6) + (dataFreshness * 0.4);

  // Determine if safe for navigation
  validation.isSafeForNavigation = validation.qualityScore > 0.8 && validation.warnings.length === 0;
  validation.recommendedAction = validation.isSafeForNavigation ? 'PROCEED_WITH_CAUTION' : 'VERIFY_MANUALLY';

  return validation;
};
```

### 4. Emergency & Safety Features

#### Emergency Communication Integration ✅
```typescript
export interface EmergencyContact {
  name: string;
  channel: string;
  frequency?: string;
  phone?: string;
  coverage: string;
}

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    name: 'US Coast Guard',
    channel: 'VHF Channel 16',
    frequency: '156.8 MHz',
    phone: '*CG (*24)',
    coverage: 'US Waters'
  },
  {
    name: 'Canadian Coast Guard',
    channel: 'VHF Channel 16',
    frequency: '156.8 MHz', 
    phone: 'TTY 1-800-567-5803',
    coverage: 'Canadian Waters'
  },
  {
    name: 'Sea Tow',
    channel: 'VHF Channel 24/25',
    phone: '1-800-4SEATOW',
    coverage: 'US Commercial Assistance'
  },
  {
    name: 'Vessel Assist',
    channel: 'VHF Channel 24/25',
    phone: '1-800-399-1921', 
    coverage: 'US Commercial Assistance'
  }
];

export const EmergencyButton = ({ location }: { location: GPSCoordinate }) => {
  const handleEmergencyPress = () => {
    Alert.alert(
      '🚨 EMERGENCY ASSISTANCE',
      'For immediate assistance:\n\n' +
      '• VHF RADIO: Channel 16 (156.8 MHz)\n' +
      '• PHONE: Call Coast Guard\n' +
      '• POSITION: Share current GPS coordinates\n\n' +
      `Current Position:\n${formatCoordinates(location)}`,
      [
        {
          text: 'Share Position',
          onPress: () => shareEmergencyLocation(location),
          style: 'default'
        },
        {
          text: 'Call Coast Guard',
          onPress: () => initiateEmergencyCall(),
          style: 'destructive'
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  return (
    <TouchableOpacity 
      style={styles.emergencyButton} 
      onPress={handleEmergencyPress}
      onLongPress={() => initiateEmergencyCall()} // Long press for immediate call
    >
      <Text style={styles.emergencyText}>🚨 EMERGENCY</Text>
    </TouchableOpacity>
  );
};
```

#### Grounding Prevention System ✅
```typescript
export class GroundingPreventionSystem {
  private alertThresholds = {
    critical: 0.5,  // 0.5m under keel
    warning: 1.0,   // 1.0m under keel  
    caution: 2.0    // 2.0m under keel
  };

  checkGroundingRisk(
    vesselDraft: number,
    currentDepth: number,
    depthConfidence: number,
    vesselSpeed: number
  ): GroundingAlert | null {
    
    const underKeelClearance = currentDepth - vesselDraft;
    
    // Critical danger - immediate stop required
    if (underKeelClearance <= this.alertThresholds.critical) {
      return {
        severity: 'critical',
        title: '🚨 CRITICAL - GROUNDING IMMINENT',
        message: `Only ${underKeelClearance.toFixed(1)}m under keel. STOP IMMEDIATELY.`,
        recommendedAction: 'ALL_STOP',
        audioAlert: true,
        vibrationPattern: [100, 200, 100, 200, 100, 200] // Urgent pattern
      };
    }
    
    // Warning - reduce speed
    if (underKeelClearance <= this.alertThresholds.warning) {
      return {
        severity: 'warning',
        title: '⚠️ WARNING - SHALLOW WATER',
        message: `${underKeelClearance.toFixed(1)}m under keel. Reduce speed and post lookout.`,
        recommendedAction: 'REDUCE_SPEED',
        audioAlert: vesselSpeed > 5, // Alert if moving too fast
        vibrationPattern: [200, 100, 200] // Standard warning
      };
    }
    
    // Caution - awareness only
    if (underKeelClearance <= this.alertThresholds.caution) {
      return {
        severity: 'caution',
        title: '💛 CAUTION - LIMITED DEPTH',
        message: `${underKeelClearance.toFixed(1)}m under keel. Monitor depth closely.`,
        recommendedAction: 'MONITOR_DEPTH',
        audioAlert: false,
        vibrationPattern: [100] // Single pulse
      };
    }
    
    return null; // No alert needed
  }

  // Predictive grounding alerts based on course and speed
  predictGroundingRisk(
    vesselPosition: GPSCoordinate,
    vesselCourse: number,
    vesselSpeed: number,
    vesselDraft: number,
    depthData: DepthReading[]
  ): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];
    const timeHorizons = [2, 5, 10]; // Look ahead 2, 5, 10 minutes
    
    for (const minutes of timeHorizons) {
      const futurePosition = this.calculateFuturePosition(
        vesselPosition, 
        vesselCourse, 
        vesselSpeed, 
        minutes
      );
      
      const nearbyDepths = this.findNearbyDepths(futurePosition, depthData, 200);
      if (nearbyDepths.length > 0) {
        const minDepth = Math.min(...nearbyDepths.map(d => d.depth));
        const underKeel = minDepth - vesselDraft;
        
        if (underKeel < this.alertThresholds.warning) {
          alerts.push({
            timeToImpact: minutes,
            location: futurePosition,
            predictedDepth: minDepth,
            underKeelClearance: underKeel,
            severity: underKeel < this.alertThresholds.critical ? 'critical' : 'warning',
            message: `Shallow water in ${minutes} minutes at current course and speed`
          });
        }
      }
    }
    
    return alerts;
  }
}
```

### 5. Legal & Regulatory Compliance

#### Terms of Service Requirements ✅
```typescript
export const MARITIME_TERMS_OF_SERVICE = {
  sections: [
    {
      title: 'Navigation Aid Classification',
      content: `This application is classified as a recreational navigation aid and is NOT:
        • Certified marine navigation equipment
        • A replacement for official nautical charts
        • Suitable as a sole source of navigation information
        • Approved for commercial maritime operations`
    },
    {
      title: 'User Responsibilities', 
      content: `Users must:
        • Maintain proper marine navigation equipment
        • Consult official charts and NOTAMs
        • Exercise proper seamanship and caution
        • Verify depth information independently
        • Consider environmental conditions (tide, weather, current)`
    },
    {
      title: 'Data Limitations',
      content: `Crowdsourced depth data:
        • May be inaccurate, incomplete, or outdated
        • Is not validated by maritime authorities
        • Can change due to weather, tides, and sedimentation
        • Should be verified with independent depth measurements`
    },
    {
      title: 'Liability Limitations',
      content: `Users acknowledge and accept that:
        • Navigation decisions are made at user's sole risk
        • Developers are not liable for navigation incidents
        • Insurance may not cover damages from app-based navigation
        • Users should maintain appropriate marine insurance coverage`
    }
  ]
};
```

#### Privacy & Data Protection ✅
```typescript
export const MARITIME_PRIVACY_POLICY = {
  dataCollection: {
    location: 'GPS coordinates collected for navigation and depth data aggregation',
    vessel: 'Vessel characteristics (draft, type) for safety calculations',
    usage: 'App usage patterns for safety feature improvement',
    optional: 'Emergency contact information (user-provided only)'
  },
  
  dataSharing: {
    anonymized: 'Location and depth data anonymized and aggregated',
    noPersonal: 'No personal information shared without explicit consent',
    research: 'Anonymized data may be used for maritime safety research',
    authorities: 'Data may be shared with authorities if required by law'
  },
  
  dataRetention: {
    gps: 'GPS tracks deleted after 30 days unless user opts for longer retention',
    depth: 'Depth readings retained indefinitely for navigation safety',
    personal: 'Personal account data retained until account deletion',
    emergency: 'Emergency contact data encrypted and stored locally only'
  }
};
```

### 6. Testing & Validation Requirements

#### Safety Feature Testing ✅
```typescript
export const SafetyTestSuite = {
  
  testGroundingAlerts: async () => {
    const testScenarios = [
      {
        name: 'Critical Grounding Risk',
        vesselDraft: 2.0,
        currentDepth: 2.3, // Only 0.3m clearance
        expectedAlert: 'critical'
      },
      {
        name: 'Warning Depth',
        vesselDraft: 2.0,
        currentDepth: 2.8, // 0.8m clearance
        expectedAlert: 'warning'
      },
      {
        name: 'Safe Depth',
        vesselDraft: 2.0,
        currentDepth: 5.0, // 3.0m clearance
        expectedAlert: null
      }
    ];

    const gps = new GroundingPreventionSystem();
    
    for (const scenario of testScenarios) {
      const alert = gps.checkGroundingRisk(
        scenario.vesselDraft,
        scenario.currentDepth,
        0.8, // 80% confidence
        10   // 10 knot speed
      );
      
      expect(alert?.severity).toBe(scenario.expectedAlert);
    }
  },

  testDataValidation: async () => {
    const insufficientData: DepthReading[] = [
      { depth: 5.0, confidence: 0.9, timestamp: new Date(), location: {lat: 40, lng: -74} }
    ]; // Only 1 reading, need 3
    
    const validation = validateNavigationData(insufficientData);
    expect(validation.isSafeForNavigation).toBe(false);
    expect(validation.warnings).toContain('Insufficient data');
  },

  testEmergencyFeatures: async () => {
    // Test emergency contact availability
    expect(EMERGENCY_CONTACTS.length).toBeGreaterThan(0);
    expect(EMERGENCY_CONTACTS[0].channel).toBe('VHF Channel 16');
    
    // Test emergency position formatting
    const testLocation = { latitude: 40.7128, longitude: -74.0060 };
    const formatted = formatCoordinates(testLocation);
    expect(formatted).toMatch(/40°.*N.*74°.*W/);
  }
};
```

## Best Practices Summary

1. **Clear Disclaimers**: Navigation aid only, not certified equipment
2. **Multiple Validation**: Require multiple independent depth readings
3. **Age Limitations**: Restrict navigation decisions to recent, high-confidence data
4. **Emergency Integration**: Provide clear emergency communication guidance
5. **Grounding Prevention**: Active monitoring and predictive alerts for shallow water
6. **Legal Protection**: Comprehensive terms of service and liability limitations
7. **Privacy Compliance**: Anonymize tracking data while preserving navigational utility
8. **Continuous Testing**: Regular validation of safety-critical features

---

**⚓ Ensuring safe and responsible marine navigation software development** 🧭