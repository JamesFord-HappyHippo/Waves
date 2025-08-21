# Marine Interface Design System - Waves App

## Overview

This document defines the map view and 3D guidance interface system for the Waves app, featuring an intuitive depth color coding system optimized for marine safety. The design prioritizes safety, usability in marine conditions (sun glare, motion), and battery efficiency.

## 1. Depth Color Coding System

### Color Palette Specification

```typescript
// Color definitions optimized for marine conditions and accessibility
export const DepthColors = {
  // Primary safety colors
  SAFE_GREEN: '#00C851',        // Deep water - safe navigation
  CAUTION_YELLOW: '#FFB000',    // Minimal clearance - proceed with caution
  DANGER_RED: '#FF4444',        // Shallow water - avoid or extreme caution
  
  // Secondary indicators
  UNKNOWN_GRAY: '#6C757D',      // No data available
  LOW_CONFIDENCE: '#B0BEC5',    // Uncertain data quality
  
  // High contrast variants for sun glare
  SAFE_GREEN_HC: '#00A844',
  CAUTION_YELLOW_HC: '#E69500',
  DANGER_RED_HC: '#E53935',
  
  // Night mode variants
  SAFE_GREEN_NIGHT: '#26A69A',
  CAUTION_YELLOW_NIGHT: '#FFA726',
  DANGER_RED_NIGHT: '#EF5350'
};
```

### Depth Threshold Algorithm

```typescript
interface DepthThresholds {
  vesselDraft: number;          // User's vessel draft in meters
  safetyMargin: number;         // Additional safety clearance
  tideCorrection: number;       // Real-time tide adjustment
  confidenceThreshold: number;  // Minimum data confidence (0-1)
}

class DepthColorCalculator {
  calculateDepthColor(
    depth: number, 
    thresholds: DepthThresholds,
    confidence: number
  ): string {
    const minSafeDepth = thresholds.vesselDraft + thresholds.safetyMargin;
    const cautionDepth = minSafeDepth * 1.5;
    const tideAdjustedDepth = depth + thresholds.tideCorrection;
    
    // Apply confidence penalty
    if (confidence < thresholds.confidenceThreshold) {
      return DepthColors.LOW_CONFIDENCE;
    }
    
    if (tideAdjustedDepth >= cautionDepth) {
      return DepthColors.SAFE_GREEN;
    } else if (tideAdjustedDepth >= minSafeDepth) {
      return DepthColors.CAUTION_YELLOW;
    } else {
      return DepthColors.DANGER_RED;
    }
  }
}
```

### User Customization System

```typescript
interface UserDepthPreferences {
  vesselDraft: number;      // 0.5 - 15.0 meters
  safetyMargin: number;     // 0.5 - 5.0 meters  
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  displayMode: 'standard' | 'high_contrast' | 'night';
  confidenceFilter: number; // 0.3 - 0.9
}

const RiskProfiles = {
  conservative: { safetyMultiplier: 2.0, confidenceMin: 0.8 },
  moderate: { safetyMultiplier: 1.5, confidenceMin: 0.6 },
  aggressive: { safetyMultiplier: 1.2, confidenceMin: 0.4 }
};
```

## 2. Map View Design

### Component Architecture

```typescript
// MapView - Main container component
interface MapViewProps {
  userLocation: Location;
  depthData: DepthReading[];
  route: NavigationRoute | null;
  displayMode: 'standard' | '3d_preview';
  onDepthTap: (reading: DepthReading) => void;
  onRouteRequest: (destination: Location) => void;
}

// DepthOverlay - Renders depth color coding
interface DepthOverlayProps {
  depthReadings: DepthReading[];
  userPreferences: UserDepthPreferences;
  bounds: MapBounds;
  zoomLevel: number;
}

// RouteOverlay - Safe route visualization  
interface RouteOverlayProps {
  route: NavigationRoute;
  depthConstraints: DepthThresholds;
  alternativeRoutes: NavigationRoute[];
  currentPosition: Location;
}
```

### MapBox Integration Pattern

```typescript
import MapboxGL from '@react-native-mapbox-gl/maps';

const WavesMapView: React.FC<MapViewProps> = ({
  userLocation,
  depthData,
  route,
  displayMode,
  onDepthTap,
  onRouteRequest
}) => {
  const [mapRef, setMapRef] = useState<MapboxGL.MapView | null>(null);
  const [viewState, setViewState] = useState({
    zoom: 14,
    pitch: displayMode === '3d_preview' ? 60 : 0,
    bearing: 0
  });

  // Optimize rendering for marine conditions
  const mapStyle = useMemo(() => ({
    version: 8,
    sources: {
      'depth-heatmap': {
        type: 'geojson',
        data: generateDepthGeoJSON(depthData),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      },
      'nautical-charts': {
        type: 'raster',
        tiles: ['https://seamlessrnc.nauticalcharts.noaa.gov/...'],
        tileSize: 256
      }
    },
    layers: [
      // Base nautical chart layer
      {
        id: 'nautical-base',
        type: 'raster',
        source: 'nautical-charts',
        layout: { visibility: 'visible' }
      },
      // Depth heatmap layer
      {
        id: 'depth-heatmap',
        type: 'heatmap',
        source: 'depth-heatmap',
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'confidence'],
            0.3, 0.5,
            1.0, 1.0
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.3, DepthColors.DANGER_RED,
            0.6, DepthColors.CAUTION_YELLOW,
            1, DepthColors.SAFE_GREEN
          ]
        }
      }
    ]
  }), [depthData]);

  return (
    <MapboxGL.MapView
      ref={setMapRef}
      style={styles.map}
      styleURL={mapStyle}
      compassEnabled={true}
      rotateEnabled={true}
      pitchEnabled={displayMode === '3d_preview'}
      onPress={handleMapPress}
    >
      <MapboxGL.Camera
        zoomLevel={viewState.zoom}
        pitch={viewState.pitch}
        bearing={viewState.bearing}
        centerCoordinate={[userLocation.longitude, userLocation.latitude]}
      />
      
      <DepthOverlay 
        depthReadings={depthData}
        userPreferences={userPreferences}
        bounds={mapBounds}
        zoomLevel={viewState.zoom}
      />
      
      {route && (
        <RouteOverlay 
          route={route}
          depthConstraints={depthConstraints}
          alternativeRoutes={alternativeRoutes}
          currentPosition={userLocation}
        />
      )}
      
      <UserLocationIndicator location={userLocation} />
      <SafetyAlertsOverlay alerts={safetyAlerts} />
    </MapboxGL.MapView>
  );
};
```

### Confidence Indicator System

```typescript
interface ConfidenceIndicator {
  value: number;        // 0.0 - 1.0
  sampleSize: number;   // Number of readings
  lastUpdate: Date;     // Freshness indicator
  sources: string[];    // Data sources (user, official, sensor)
}

const ConfidenceVisualization = {
  // Point size based on confidence
  getPointRadius: (confidence: number) => 
    Math.max(4, confidence * 12),
    
  // Opacity based on confidence
  getOpacity: (confidence: number) => 
    Math.max(0.3, confidence * 0.8),
    
  // Border styling
  getBorderStyle: (confidence: number) => ({
    width: confidence > 0.7 ? 2 : 1,
    color: confidence > 0.7 ? '#FFFFFF' : '#CCCCCC'
  })
};
```

## 3. 3D Guidance View Design

### Component Structure

```typescript
// 3D rendering using react-native-3d-model-view or WebGL
interface Guidance3DViewProps {
  userLocation: Location;
  vesselHeading: number;
  vesselSpeed: number;
  depthData: DepthReading[];
  lookAheadDistance: number;
  renderQuality: 'low' | 'medium' | 'high';
}

const Guidance3DView: React.FC<Guidance3DViewProps> = ({
  userLocation,
  vesselHeading,
  vesselSpeed,
  depthData,
  lookAheadDistance,
  renderQuality
}) => {
  const [terrainMesh, setTerrainMesh] = useState<TerrainMesh | null>(null);
  const [cameraPosition, setCameraPosition] = useState({
    x: userLocation.longitude,
    y: userLocation.latitude,
    z: 20, // Height above water
    pitch: -30,
    yaw: vesselHeading
  });

  // Generate underwater terrain from depth data
  useEffect(() => {
    const mesh = generateUnderwaterTerrain(depthData, {
      resolution: renderQuality === 'high' ? 1 : renderQuality === 'medium' ? 2 : 4,
      bounds: calculateViewBounds(userLocation, lookAheadDistance),
      smoothing: true
    });
    setTerrainMesh(mesh);
  }, [depthData, renderQuality, lookAheadDistance]);

  return (
    <View style={styles.guidance3d}>
      <WebGL3DRenderer
        scene={scene3D}
        camera={cameraPosition}
        quality={renderQuality}
        onFrame={handleFrameUpdate}
      >
        {/* Underwater terrain */}
        <TerrainMesh 
          geometry={terrainMesh}
          material={depthBasedMaterial}
          wireframe={false}
        />
        
        {/* Vessel representation */}
        <VesselModel 
          position={[0, 0, 0]}
          rotation={[0, vesselHeading, 0]}
          scale={vesselScale}
          draftIndicator={true}
        />
        
        {/* Forward projection path */}
        <ProjectionPath 
          startPosition={userLocation}
          heading={vesselHeading}
          speed={vesselSpeed}
          distance={lookAheadDistance}
          depthAlongPath={projectedDepths}
        />
        
        {/* Hazard markers */}
        {hazards.map(hazard => (
          <HazardMarker 
            key={hazard.id}
            position={hazard.location}
            type={hazard.type}
            severity={hazard.severity}
          />
        ))}
        
        {/* Depth grid overlay */}
        <DepthGrid 
          bounds={viewBounds}
          spacing={50} // meters
          colorCoding={depthColors}
        />
      </WebGL3DRenderer>
      
      {/* 2D overlay elements */}
      <View style={styles.overlay}>
        <CompassIndicator heading={vesselHeading} />
        <DepthGauge currentDepth={currentDepth} />
        <SpeedIndicator speed={vesselSpeed} />
        <SafetyStatus status={safetyStatus} />
      </View>
    </View>
  );
};
```

### Forward-Looking Depth Projection

```typescript
class DepthProjectionSystem {
  calculateForwardDepths(
    currentPosition: Location,
    heading: number,
    speed: number,
    timeHorizon: number,
    depthData: DepthReading[]
  ): ProjectedDepth[] {
    const projections: ProjectedDepth[] = [];
    const distanceIncrement = speed * 0.1; // Check every 0.1 seconds
    
    for (let t = 0; t <= timeHorizon; t += 0.1) {
      const distance = speed * t;
      const projectedPosition = this.calculatePosition(
        currentPosition, 
        heading, 
        distance
      );
      
      const estimatedDepth = this.interpolateDepth(
        projectedPosition, 
        depthData
      );
      
      projections.push({
        time: t,
        position: projectedPosition,
        estimatedDepth,
        confidence: this.calculateConfidence(projectedPosition, depthData),
        safetyStatus: this.evaluateSafety(estimatedDepth)
      });
    }
    
    return projections;
  }

  private interpolateDepth(
    position: Location, 
    depthData: DepthReading[]
  ): number {
    // Use inverse distance weighting for depth interpolation
    const nearbyReadings = this.findNearbyReadings(position, depthData, 500);
    
    if (nearbyReadings.length === 0) {
      return null; // No data available
    }
    
    let totalWeight = 0;
    let weightedSum = 0;
    
    nearbyReadings.forEach(reading => {
      const distance = this.calculateDistance(position, reading.location);
      const weight = 1 / Math.pow(distance, 2);
      totalWeight += weight;
      weightedSum += reading.depth * weight;
    });
    
    return weightedSum / totalWeight;
  }
}
```

## 4. Transition System Design

### Mode Switching Architecture

```typescript
interface ViewModeManager {
  currentMode: 'map' | '3d' | 'split';
  transitionState: 'stable' | 'transitioning';
  userPreference: ViewModePreference;
}

class ViewModeController {
  private contextAnalyzer = new ContextAnalyzer();
  private transitionAnimator = new TransitionAnimator();
  
  async suggestOptimalMode(context: NavigationContext): Promise<ViewMode> {
    const analysis = await this.contextAnalyzer.analyze({
      speed: context.vesselSpeed,
      proximity: context.proximityToHazards,
      visibility: context.visibility,
      complexity: context.navigationComplexity,
      userExperience: context.userSkillLevel
    });
    
    // Decision matrix for mode selection
    if (analysis.immediateHazard || context.vesselSpeed < 2) {
      return '3d'; // 3D for detailed hazard assessment
    } else if (analysis.routePlanning || context.vesselSpeed > 15) {
      return 'map'; // Map for route overview
    } else {
      return context.userPreference || 'map';
    }
  }

  async executeTransition(
    fromMode: ViewMode, 
    toMode: ViewMode,
    animated: boolean = true
  ): Promise<void> {
    if (!animated) {
      return this.instantSwitch(toMode);
    }

    // Smooth transition with camera interpolation
    await this.transitionAnimator.animate({
      from: this.getModeConfiguration(fromMode),
      to: this.getModeConfiguration(toMode),
      duration: 800,
      easing: 'ease-out',
      onProgress: this.handleTransitionProgress
    });
  }
}
```

### Context-Aware Suggestions

```typescript
interface NavigationContext {
  vesselSpeed: number;
  proximityToHazards: number;
  navigationComplexity: 'low' | 'medium' | 'high';
  visibility: 'excellent' | 'good' | 'poor';
  userSkillLevel: 'novice' | 'experienced' | 'expert';
  batteryLevel: number;
  connectionQuality: 'offline' | 'poor' | 'good' | 'excellent';
}

class ContextAnalyzer {
  analyzeOptimalMode(context: NavigationContext): ViewModeRecommendation {
    const scores = {
      map: 0,
      '3d': 0,
      split: 0
    };
    
    // Speed-based scoring
    if (context.vesselSpeed > 10) {
      scores.map += 30; // Fast navigation prefers overview
    } else if (context.vesselSpeed < 3) {
      scores['3d'] += 25; // Slow navigation allows detailed inspection
    }
    
    // Hazard proximity scoring
    if (context.proximityToHazards < 100) {
      scores['3d'] += 40; // Close hazards need 3D visualization
    }
    
    // Complexity scoring
    if (context.navigationComplexity === 'high') {
      scores['3d'] += 20;
      scores.split += 15;
    } else if (context.navigationComplexity === 'low') {
      scores.map += 20;
    }
    
    // Battery optimization
    if (context.batteryLevel < 0.3) {
      scores.map += 25; // Map view is more battery efficient
      scores['3d'] -= 20;
    }
    
    // Connection quality
    if (context.connectionQuality === 'poor' || context.connectionQuality === 'offline') {
      scores.map += 15; // Map handles offline better
    }
    
    const recommendedMode = Object.entries(scores)
      .reduce((best, [mode, score]) => score > best.score ? { mode, score } : best, 
              { mode: 'map', score: -1 });
    
    return {
      recommended: recommendedMode.mode as ViewMode,
      confidence: this.calculateConfidence(scores),
      reasoning: this.generateReasoning(context, scores)
    };
  }
}
```

### User Preference Learning

```typescript
interface UserBehaviorPattern {
  preferredMode: ViewMode;
  contextTriggers: NavigationContext[];
  switchingFrequency: number;
  sessionDuration: number;
  performanceMetrics: {
    navigationAccuracy: number;
    safetyIncidents: number;
    userSatisfaction: number;
  };
}

class PreferenceLearningSystem {
  private behaviorHistory: UserBehaviorPattern[] = [];
  
  recordUserInteraction(interaction: {
    context: NavigationContext;
    userChoice: ViewMode;
    systemSuggestion: ViewMode;
    outcome: 'accepted' | 'rejected' | 'modified';
    sessionMetrics: SessionMetrics;
  }): void {
    this.behaviorHistory.push({
      preferredMode: interaction.userChoice,
      contextTriggers: [interaction.context],
      switchingFrequency: this.calculateSwitchingRate(),
      sessionDuration: interaction.sessionMetrics.duration,
      performanceMetrics: interaction.sessionMetrics.performance
    });
    
    // Update user profile
    this.updateUserProfile(interaction);
  }
  
  predictUserPreference(context: NavigationContext): ViewModePreference {
    const similarContexts = this.findSimilarContexts(context);
    const weightedPreferences = this.calculateWeightedPreferences(similarContexts);
    
    return {
      primaryMode: weightedPreferences[0].mode,
      confidence: weightedPreferences[0].confidence,
      alternatives: weightedPreferences.slice(1, 3)
    };
  }
}
```

## 5. Safety Features

### Grounding Alert System

```typescript
interface GroundingAlert {
  severity: 'warning' | 'caution' | 'critical';
  timeToImpact: number; // seconds
  avoidanceAction: AvoidanceAction;
  confidenceLevel: number;
  location: Location;
}

class GroundingPrevention {
  private alertThresholds = {
    critical: { depth: 0.5, time: 30 },  // 30 seconds to impact
    warning: { depth: 1.0, time: 120 },  // 2 minutes to impact
    caution: { depth: 2.0, time: 300 }   // 5 minutes to impact
  };

  calculateGroundingRisk(
    currentPosition: Location,
    heading: number,
    speed: number,
    vesselDraft: number,
    depthData: DepthReading[]
  ): GroundingAlert | null {
    const projectedPath = this.calculateProjectedPath(
      currentPosition, heading, speed, 600 // 10 minute lookahead
    );
    
    for (const point of projectedPath) {
      const estimatedDepth = this.interpolateDepth(point.position, depthData);
      const clearance = estimatedDepth - vesselDraft;
      
      if (clearance < this.alertThresholds.critical.depth) {
        return {
          severity: 'critical',
          timeToImpact: point.time,
          avoidanceAction: this.calculateAvoidanceAction(point, heading, speed),
          confidenceLevel: this.calculateConfidence(point.position, depthData),
          location: point.position
        };
      }
    }
    
    return null;
  }
  
  private calculateAvoidanceAction(
    hazardPoint: PathPoint,
    currentHeading: number,
    currentSpeed: number
  ): AvoidanceAction {
    // Calculate multiple avoidance options
    const portTurn = this.evaluateTurn(currentHeading - 45, currentSpeed);
    const starboardTurn = this.evaluateTurn(currentHeading + 45, currentSpeed);
    const slowDown = this.evaluateSpeedReduction(currentSpeed * 0.5);
    const stop = this.evaluateEmergencyStop();
    
    // Return the safest option with highest success probability
    return [portTurn, starboardTurn, slowDown, stop]
      .sort((a, b) => b.successProbability - a.successProbability)[0];
  }
}
```

### Safe Route Planning

```typescript
interface RouteConstraints {
  maxDraft: number;
  safetyMargin: number;
  preferredDepth: number;
  avoidanceZones: GeographicZone[];
  weatherConstraints: WeatherLimits;
}

class SafeRouteCalculator {
  calculateOptimalRoute(
    start: Location,
    destination: Location,
    constraints: RouteConstraints,
    depthData: DepthReading[]
  ): NavigationRoute {
    // Use A* algorithm with depth-weighted costs
    const graph = this.buildNavigationGraph(depthData, constraints);
    const route = this.findPath(start, destination, graph);
    
    return {
      waypoints: route.waypoints,
      totalDistance: route.distance,
      estimatedTime: route.duration,
      safetyScore: this.calculateSafetyScore(route, depthData),
      alternatives: this.generateAlternatives(start, destination, constraints),
      hazardWarnings: this.identifyHazards(route, depthData),
      confidenceLevel: this.calculateRouteConfidence(route, depthData)
    };
  }
  
  private buildNavigationGraph(
    depthData: DepthReading[],
    constraints: RouteConstraints
  ): NavigationGraph {
    const graph = new NavigationGraph();
    const gridSpacing = 100; // 100m grid
    
    // Create grid points and evaluate navigability
    for (let lat = minLat; lat <= maxLat; lat += gridSpacing / 111000) {
      for (let lng = minLng; lng <= maxLng; lng += gridSpacing / 111000) {
        const point = { latitude: lat, longitude: lng };
        const depth = this.interpolateDepth(point, depthData);
        const navigable = depth > (constraints.maxDraft + constraints.safetyMargin);
        
        if (navigable) {
          graph.addNode(point, {
            depth,
            safetyScore: this.calculatePointSafety(point, depthData),
            confidence: this.calculatePointConfidence(point, depthData)
          });
        }
      }
    }
    
    return graph;
  }
}
```

### Emergency Protocols

```typescript
interface EmergencyProtocol {
  type: 'grounding' | 'collision' | 'weather' | 'mechanical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  immediateActions: string[];
  contactInfo: EmergencyContact[];
  locationSharing: LocationSharingConfig;
}

class EmergencySystem {
  triggerEmergencyMode(
    emergencyType: EmergencyProtocol['type'],
    userLocation: Location,
    vesselInfo: VesselInfo
  ): void {
    // Immediate actions
    this.enableEmergencyMode();
    this.startLocationBroadcast();
    this.activateDistressBeacon();
    
    // Send emergency alert
    const emergencyData = {
      timestamp: new Date(),
      location: userLocation,
      vessel: vesselInfo,
      emergency: emergencyType,
      userID: this.getUserID()
    };
    
    this.broadcastEmergency(emergencyData);
    
    // Switch to emergency UI mode
    this.activateEmergencyUI({
      highContrast: true,
      largeButtons: true,
      essentialOnly: true,
      batteryConservation: true
    });
  }
  
  private activateEmergencyUI(config: EmergencyUIConfig): void {
    // Simplified interface for emergency situations
    this.showOnlyEssentialElements([
      'current-location',
      'emergency-contacts',
      'distress-signal',
      'battery-status',
      'communication-status'
    ]);
    
    // Reduce screen brightness and processing to conserve battery
    this.enableBatteryConservationMode();
  }
}
```

## Performance Optimizations

### Battery Efficiency

```typescript
class BatteryOptimizer {
  private renderingLevel: 'minimal' | 'standard' | 'high' = 'standard';
  private updateFrequency: number = 1000; // ms
  
  optimizeForBatteryLevel(batteryLevel: number): void {
    if (batteryLevel < 0.2) {
      this.renderingLevel = 'minimal';
      this.updateFrequency = 5000;
      this.disableNonEssentialFeatures();
    } else if (batteryLevel < 0.5) {
      this.renderingLevel = 'standard';
      this.updateFrequency = 2000;
      this.reduceAnimations();
    }
  }
  
  private disableNonEssentialFeatures(): void {
    // Disable 3D rendering
    // Reduce map tile quality
    // Disable real-time animations
    // Lower GPS update frequency
    // Reduce depth data processing
  }
}
```

### Marine Condition Adaptations

```typescript
interface MarineConditions {
  sunGlare: 'none' | 'moderate' | 'severe';
  motion: 'calm' | 'moderate' | 'rough';
  visibility: 'excellent' | 'good' | 'poor';
  spray: boolean;
}

class MarineUIAdapter {
  adaptForConditions(conditions: MarineConditions): void {
    // Sun glare adaptation
    if (conditions.sunGlare === 'severe') {
      this.activateHighContrastMode();
      this.increaseBrightness();
      this.enlargeUIElements();
    }
    
    // Motion adaptation
    if (conditions.motion === 'rough') {
      this.enableMotionCompensation();
      this.enlargeTargets();
      this.reduceScrollSensitivity();
      this.enableHapticFeedback();
    }
    
    // Visibility adaptation
    if (conditions.visibility === 'poor') {
      this.emphasizeSafetyIndicators();
      this.reduceVisualClutter();
      this.activateAudioAlerts();
    }
  }
}
```

This comprehensive design specification provides a robust foundation for implementing the Waves app's marine interface system. The design prioritizes safety through intuitive depth visualization, supports both 2D and 3D navigation modes, and adapts to challenging marine conditions while optimizing for mobile device constraints.

The modular architecture allows for incremental implementation while maintaining consistency across all interface components. Each system is designed to work independently while integrating seamlessly with the overall navigation experience.