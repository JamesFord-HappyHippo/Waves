/**
 * Safety System - Marine Navigation Safety Features
 * Handles grounding prevention, route safety analysis, and emergency protocols
 */

export interface Location {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export interface DepthReading {
  id: string;
  location: Location;
  depth: number;
  confidence: number;
  timestamp: Date;
  source: 'user' | 'official' | 'sensor';
  vesselDraft?: number;
}

export interface GroundingAlert {
  id: string;
  severity: 'info' | 'warning' | 'caution' | 'critical' | 'emergency';
  type: 'grounding' | 'shallow_water' | 'obstacle' | 'current' | 'weather';
  timeToImpact: number; // seconds
  location: Location;
  estimatedDepth: number;
  vesselClearance: number;
  avoidanceAction: AvoidanceAction;
  confidenceLevel: number;
  description: string;
  timestamp: Date;
}

export interface AvoidanceAction {
  type: 'course_change' | 'speed_reduction' | 'emergency_stop' | 'reverse';
  recommendedHeading?: number;
  recommendedSpeed?: number;
  priority: number; // 1-10, 10 being highest
  successProbability: number; // 0-1
  timeRequired: number; // seconds to execute
  description: string;
  visualIndicator: {
    color: string;
    icon: string;
    animation: 'pulse' | 'flash' | 'static';
  };
}

export interface SafetyZone {
  id: string;
  type: 'exclusion' | 'caution' | 'restricted' | 'anchor';
  geometry: {
    type: 'circle' | 'polygon';
    coordinates: Location[] | { center: Location; radius: number };
  };
  restrictions: {
    maxSpeed?: number;
    minDepth?: number;
    allowedVessels?: string[];
    timeRestrictions?: {
      start: string; // ISO time
      end: string;
    };
  };
  severity: 'info' | 'warning' | 'danger';
  description: string;
  authority: string; // Coast Guard, Harbor Master, etc.
}

export interface EmergencyContact {
  id: string;
  name: string;
  type: 'coast_guard' | 'harbor_master' | 'emergency' | 'tow_service' | 'marine_police';
  phoneNumbers: string[];
  vhfChannel?: number;
  gpsLocation?: Location;
  serviceArea: {
    center: Location;
    radiusKm: number;
  };
  available24h: boolean;
  languages: string[];
}

export interface VesselInfo {
  id: string;
  name: string;
  type: 'sailboat' | 'motorboat' | 'yacht' | 'fishing' | 'commercial' | 'other';
  length: number; // meters
  beam: number;   // meters
  draft: number;  // meters
  displacement: number; // tons
  maxSpeed: number; // knots
  fuelCapacity?: number; // liters
  waterCapacity?: number; // liters
  crew: number;
  passengers: number;
  mmsi?: string;
  callSign?: string;
}

export class GroundingPrevention {
  private alertHistory: Map<string, GroundingAlert> = new Map();
  private safetyZones: SafetyZone[] = [];
  private emergencyContacts: EmergencyContact[] = [];
  
  // Alert thresholds based on severity
  private readonly alertThresholds = {
    emergency: { depthRatio: 0.8, timeSeconds: 15 },  // 15 seconds to grounding
    critical: { depthRatio: 0.9, timeSeconds: 30 },   // 30 seconds to impact
    caution: { depthRatio: 1.2, timeSeconds: 120 },   // 2 minutes to impact
    warning: { depthRatio: 1.5, timeSeconds: 300 },   // 5 minutes to impact
    info: { depthRatio: 2.0, timeSeconds: 600 }       // 10 minutes to impact
  };

  /**
   * Calculate grounding risk for vessel's projected path
   */
  calculateGroundingRisk(
    currentPosition: Location,
    heading: number,
    speed: number, // knots
    vesselInfo: VesselInfo,
    depthData: DepthReading[]
  ): GroundingAlert[] {
    const alerts: GroundingAlert[] = [];
    const projectionTime = 600; // 10 minutes
    const projectedPath = this.calculateProjectedPath(
      currentPosition, 
      heading, 
      speed, 
      projectionTime
    );
    
    for (const pathPoint of projectedPath) {
      const estimatedDepth = this.interpolateDepth(pathPoint.position, depthData);
      
      if (estimatedDepth === null) continue;
      
      const vesselClearance = estimatedDepth - vesselInfo.draft;
      const alert = this.evaluateGroundingRisk(
        pathPoint,
        estimatedDepth,
        vesselClearance,
        vesselInfo,
        depthData
      );
      
      if (alert) {
        alerts.push(alert);
      }
    }
    
    // Sort by severity and time to impact
    return alerts.sort((a, b) => {
      const severityOrder = ['emergency', 'critical', 'caution', 'warning', 'info'];
      const aSeverityIndex = severityOrder.indexOf(a.severity);
      const bSeverityIndex = severityOrder.indexOf(b.severity);
      
      if (aSeverityIndex !== bSeverityIndex) {
        return aSeverityIndex - bSeverityIndex;
      }
      
      return a.timeToImpact - b.timeToImpact;
    });
  }
  
  /**
   * Evaluate grounding risk for a specific point
   */
  private evaluateGroundingRisk(
    pathPoint: { position: Location; time: number; speed: number },
    estimatedDepth: number,
    vesselClearance: number,
    vesselInfo: VesselInfo,
    depthData: DepthReading[]
  ): GroundingAlert | null {
    const depthRatio = estimatedDepth / vesselInfo.draft;
    
    // Determine severity level
    let severity: GroundingAlert['severity'] = 'info';
    let threshold = this.alertThresholds.info;
    
    for (const [level, thresholds] of Object.entries(this.alertThresholds)) {
      if (depthRatio <= thresholds.depthRatio && pathPoint.time <= thresholds.timeSeconds) {
        severity = level as GroundingAlert['severity'];
        threshold = thresholds;
        break;
      }
    }
    
    if (severity === 'info' && vesselClearance > vesselInfo.draft * 0.5) {
      return null; // No significant risk
    }
    
    // Calculate avoidance actions
    const avoidanceAction = this.calculateAvoidanceAction(
      pathPoint,
      estimatedDepth,
      vesselInfo,
      depthData
    );
    
    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(pathPoint.position, depthData);
    
    return {
      id: `grounding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity,
      type: 'grounding',
      timeToImpact: pathPoint.time,
      location: pathPoint.position,
      estimatedDepth,
      vesselClearance,
      avoidanceAction,
      confidenceLevel: confidence,
      description: this.generateAlertDescription(
        severity,
        estimatedDepth,
        vesselClearance,
        pathPoint.time
      ),
      timestamp: new Date()
    };
  }
  
  /**
   * Calculate optimal avoidance actions
   */
  private calculateAvoidanceAction(
    pathPoint: { position: Location; time: number; speed: number },
    depth: number,
    vesselInfo: VesselInfo,
    depthData: DepthReading[]
  ): AvoidanceAction {
    const currentHeading = pathPoint.position.heading || 0;
    const currentSpeed = pathPoint.speed;
    
    // Evaluate different avoidance options
    const options: AvoidanceAction[] = [];
    
    // Course change options (port and starboard turns)
    for (const turnAngle of [30, 45, 60, 90]) {
      const portHeading = (currentHeading - turnAngle + 360) % 360;
      const starboardHeading = (currentHeading + turnAngle) % 360;
      
      const portOption = this.evaluateCourseChange(
        pathPoint, portHeading, currentSpeed, vesselInfo, depthData
      );
      const starboardOption = this.evaluateCourseChange(
        pathPoint, starboardHeading, currentSpeed, vesselInfo, depthData
      );
      
      if (portOption.successProbability > 0.5) options.push(portOption);
      if (starboardOption.successProbability > 0.5) options.push(starboardOption);
    }
    
    // Speed reduction options
    for (const speedReduction of [0.5, 0.3, 0.1]) {
      const reducedSpeed = currentSpeed * speedReduction;
      const speedOption = this.evaluateSpeedReduction(
        pathPoint, reducedSpeed, vesselInfo, depthData
      );
      
      if (speedOption.successProbability > 0.3) options.push(speedOption);
    }
    
    // Emergency stop option
    const stopOption = this.evaluateEmergencyStop(pathPoint, vesselInfo);
    options.push(stopOption);
    
    // Return the best option
    return options.sort((a, b) => b.successProbability - a.successProbability)[0] || stopOption;
  }
  
  /**
   * Evaluate course change effectiveness
   */
  private evaluateCourseChange(
    pathPoint: { position: Location; time: number; speed: number },
    newHeading: number,
    speed: number,
    vesselInfo: VesselInfo,
    depthData: DepthReading[]
  ): AvoidanceAction {
    // Calculate new path with changed heading
    const newPath = this.calculateProjectedPath(
      pathPoint.position,
      newHeading,
      speed,
      300 // 5 minutes ahead
    );
    
    // Check if new path avoids shallow water
    let successProbability = 0;
    let minDepth = Infinity;
    
    for (const point of newPath) {
      const depth = this.interpolateDepth(point.position, depthData);
      if (depth !== null) {
        minDepth = Math.min(minDepth, depth);
        if (depth > vesselInfo.draft * 1.5) {
          successProbability += 0.1;
        }
      }
    }
    
    successProbability = Math.min(1, successProbability);
    
    const turnDirection = ((newHeading - (pathPoint.position.heading || 0) + 360) % 360) < 180 ? 'starboard' : 'port';
    
    return {
      type: 'course_change',
      recommendedHeading: newHeading,
      recommendedSpeed: speed,
      priority: successProbability > 0.7 ? 8 : 6,
      successProbability,
      timeRequired: this.calculateTurnTime(vesselInfo, Math.abs(newHeading - (pathPoint.position.heading || 0))),
      description: `Turn ${Math.round(Math.abs(newHeading - (pathPoint.position.heading || 0)))}° to ${turnDirection}`,
      visualIndicator: {
        color: successProbability > 0.7 ? '#00C851' : '#FFB000',
        icon: turnDirection === 'port' ? 'arrow-left' : 'arrow-right',
        animation: 'pulse'
      }
    };
  }
  
  /**
   * Evaluate speed reduction effectiveness
   */
  private evaluateSpeedReduction(
    pathPoint: { position: Location; time: number; speed: number },
    newSpeed: number,
    vesselInfo: VesselInfo,
    depthData: DepthReading[]
  ): AvoidanceAction {
    // Calculate new stopping distance
    const stoppingDistance = this.calculateStoppingDistance(newSpeed, vesselInfo);
    const timeToStop = this.calculateStoppingTime(newSpeed, vesselInfo);
    
    // Check if we can stop before hazard
    const distanceToHazard = pathPoint.time * (pathPoint.speed * 0.514444); // Convert knots to m/s
    const successProbability = stoppingDistance < distanceToHazard ? 0.9 : 0.3;
    
    return {
      type: 'speed_reduction',
      recommendedSpeed: newSpeed,
      priority: successProbability > 0.7 ? 7 : 4,
      successProbability,
      timeRequired: timeToStop,
      description: `Reduce speed to ${newSpeed.toFixed(1)} knots`,
      visualIndicator: {
        color: successProbability > 0.7 ? '#00C851' : '#FF4444',
        icon: 'speed-reduction',
        animation: 'flash'
      }
    };
  }
  
  /**
   * Evaluate emergency stop
   */
  private evaluateEmergencyStop(
    pathPoint: { position: Location; time: number; speed: number },
    vesselInfo: VesselInfo
  ): AvoidanceAction {
    const stoppingDistance = this.calculateStoppingDistance(pathPoint.speed, vesselInfo);
    const stoppingTime = this.calculateStoppingTime(pathPoint.speed, vesselInfo);
    const distanceToHazard = pathPoint.time * (pathPoint.speed * 0.514444);
    
    const successProbability = stoppingDistance < distanceToHazard * 0.8 ? 0.8 : 0.2;
    
    return {
      type: 'emergency_stop',
      recommendedSpeed: 0,
      priority: 10, // Always highest priority
      successProbability,
      timeRequired: stoppingTime,
      description: 'Emergency stop - all stop',
      visualIndicator: {
        color: '#FF4444',
        icon: 'stop',
        animation: 'flash'
      }
    };
  }
  
  /**
   * Calculate vessel stopping distance
   */
  private calculateStoppingDistance(speed: number, vesselInfo: VesselInfo): number {
    // Simplified calculation - would use actual vessel performance data
    const displacement = vesselInfo.displacement || 10; // tons
    const speedMs = speed * 0.514444; // Convert knots to m/s
    
    // Base formula: d = v²/(2×deceleration)
    // Deceleration varies by vessel type and displacement
    const deceleration = Math.max(0.5, 5 / Math.sqrt(displacement)); // m/s²
    
    return Math.pow(speedMs, 2) / (2 * deceleration);
  }
  
  /**
   * Calculate time to stop
   */
  private calculateStoppingTime(speed: number, vesselInfo: VesselInfo): number {
    const displacement = vesselInfo.displacement || 10;
    const deceleration = Math.max(0.5, 5 / Math.sqrt(displacement));
    const speedMs = speed * 0.514444;
    
    return speedMs / deceleration;
  }
  
  /**
   * Calculate time required for turn
   */
  private calculateTurnTime(vesselInfo: VesselInfo, turnAngle: number): number {
    // Simplified calculation - actual would depend on rudder effectiveness, speed, etc.
    const baseRate = vesselInfo.type === 'sailboat' ? 2 : 5; // degrees per second
    return Math.abs(turnAngle) / baseRate;
  }
  
  /**
   * Generate human-readable alert description
   */
  private generateAlertDescription(
    severity: string,
    depth: number,
    clearance: number,
    timeToImpact: number
  ): string {
    const minutes = Math.floor(timeToImpact / 60);
    const seconds = timeToImpact % 60;
    
    let timeString = '';
    if (minutes > 0) {
      timeString = `${minutes}m ${seconds}s`;
    } else {
      timeString = `${seconds}s`;
    }
    
    switch (severity) {
      case 'emergency':
        return `EMERGENCY: Grounding imminent in ${timeString}! Depth ${depth.toFixed(1)}m, clearance ${clearance.toFixed(1)}m`;
      case 'critical':
        return `CRITICAL: Shallow water in ${timeString}. Depth ${depth.toFixed(1)}m, clearance ${clearance.toFixed(1)}m`;
      case 'caution':
        return `CAUTION: Shallow water ahead in ${timeString}. Depth ${depth.toFixed(1)}m, clearance ${clearance.toFixed(1)}m`;
      case 'warning':
        return `WARNING: Shallow water in path. ${timeString} to hazard. Depth ${depth.toFixed(1)}m`;
      default:
        return `INFO: Shallow water noted ahead. Depth ${depth.toFixed(1)}m in ${timeString}`;
    }
  }
  
  /**
   * Calculate projected vessel path
   */
  private calculateProjectedPath(
    startPosition: Location,
    heading: number,
    speed: number,
    timeSeconds: number
  ): Array<{ position: Location; time: number; speed: number }> {
    const path = [];
    const speedMs = speed * 0.514444; // Convert knots to m/s
    const timeStep = 10; // 10 second intervals
    
    for (let t = 0; t <= timeSeconds; t += timeStep) {
      const distance = speedMs * t;
      const newPosition = this.calculatePositionFromBearing(
        startPosition,
        heading,
        distance
      );
      
      path.push({
        position: newPosition,
        time: t,
        speed
      });
    }
    
    return path;
  }
  
  /**
   * Calculate position from bearing and distance
   */
  private calculatePositionFromBearing(
    start: Location,
    bearing: number,
    distance: number
  ): Location {
    const R = 6371000; // Earth's radius in meters
    const bearingRad = bearing * Math.PI / 180;
    const lat1 = start.latitude * Math.PI / 180;
    const lng1 = start.longitude * Math.PI / 180;
    
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distance / R) +
      Math.cos(lat1) * Math.sin(distance / R) * Math.cos(bearingRad)
    );
    
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(lat1),
      Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2)
    );
    
    return {
      latitude: lat2 * 180 / Math.PI,
      longitude: lng2 * 180 / Math.PI,
      heading: bearing,
      speed: start.speed
    };
  }
  
  /**
   * Interpolate depth at a specific location
   */
  private interpolateDepth(position: Location, depthData: DepthReading[]): number | null {
    const nearbyReadings = this.findNearbyReadings(position, depthData, 1000); // 1km radius
    
    if (nearbyReadings.length === 0) return null;
    
    // Use inverse distance weighting
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const reading of nearbyReadings) {
      const distance = this.calculateDistance(position, reading.location);
      const weight = 1 / Math.pow(Math.max(distance, 1), 2); // Avoid division by zero
      
      totalWeight += weight * reading.confidence;
      weightedSum += reading.depth * weight * reading.confidence;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : null;
  }
  
  /**
   * Find nearby depth readings
   */
  private findNearbyReadings(
    position: Location,
    depthData: DepthReading[],
    radiusMeters: number
  ): DepthReading[] {
    return depthData.filter(reading => {
      const distance = this.calculateDistance(position, reading.location);
      return distance <= radiusMeters && reading.confidence > 0.3;
    });
  }
  
  /**
   * Calculate distance between two points
   */
  private calculateDistance(point1: Location, point2: Location): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1.latitude * Math.PI / 180;
    const φ2 = point2.latitude * Math.PI / 180;
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }
  
  /**
   * Calculate confidence based on data quality and coverage
   */
  private calculateConfidence(position: Location, depthData: DepthReading[]): number {
    const nearbyReadings = this.findNearbyReadings(position, depthData, 500);
    
    if (nearbyReadings.length === 0) return 0;
    
    // Base confidence on number of readings and their individual confidence
    const avgConfidence = nearbyReadings.reduce((sum, reading) => 
      sum + reading.confidence, 0) / nearbyReadings.length;
    
    const coverageBonus = Math.min(0.3, nearbyReadings.length * 0.1);
    
    return Math.min(1, avgConfidence + coverageBonus);
  }
  
  /**
   * Load safety zones from various authorities
   */
  async loadSafetyZones(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): Promise<SafetyZone[]> {
    // Implementation would fetch from Coast Guard, harbor authorities, etc.
    return this.safetyZones.filter(zone => {
      // Simple bounds check - would be more sophisticated
      return true; // Placeholder
    });
  }
  
  /**
   * Get emergency contacts for current location
   */
  getEmergencyContacts(location: Location): EmergencyContact[] {
    return this.emergencyContacts.filter(contact => {
      const distance = this.calculateDistance(location, contact.serviceArea.center);
      return distance <= contact.serviceArea.radiusKm * 1000;
    }).sort((a, b) => {
      const distanceA = this.calculateDistance(location, a.serviceArea.center);
      const distanceB = this.calculateDistance(location, b.serviceArea.center);
      return distanceA - distanceB;
    });
  }
}

export default GroundingPrevention;