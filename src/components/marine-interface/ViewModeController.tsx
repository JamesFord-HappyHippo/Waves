/**
 * View Mode Controller - Manages transitions between Map and 3D views
 * Provides context-aware mode suggestions and smooth transitions
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, PanResponder } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';

import WavesMapView from './MapView';
import Guidance3DView from './Guidance3DView';
import ModeTransitionOverlay from './ModeTransitionOverlay';
import ContextAnalyzer from '../../utils/ContextAnalyzer';
import PreferenceLearningSystem from '../../utils/PreferenceLearningSystem';

export type ViewMode = 'map' | '3d' | 'split';

interface ViewModeControllerProps {
  userLocation: Location;
  depthData: DepthReading[];
  route: NavigationRoute | null;
  onRouteRequest: (destination: Location) => void;
  onDepthTap: (reading: DepthReading) => void;
}

interface NavigationContext {
  vesselSpeed: number;
  proximityToHazards: number;
  navigationComplexity: 'low' | 'medium' | 'high';
  visibility: 'excellent' | 'good' | 'poor';
  userSkillLevel: 'novice' | 'experienced' | 'expert';
  batteryLevel: number;
  connectionQuality: 'offline' | 'poor' | 'good' | 'excellent';
  timeInSession: number;
  currentActivity: 'cruising' | 'anchoring' | 'docking' | 'navigating_hazards';
}

interface ViewModeRecommendation {
  recommended: ViewMode;
  confidence: number;
  reasoning: string[];
  alternatives: Array<{ mode: ViewMode; score: number }>;
}

interface TransitionState {
  isTransitioning: boolean;
  fromMode: ViewMode;
  toMode: ViewMode;
  progress: number;
  duration: number;
}

const { width, height } = Dimensions.get('window');

const ViewModeController: React.FC<ViewModeControllerProps> = ({
  userLocation,
  depthData,
  route,
  onRouteRequest,
  onDepthTap
}) => {
  const dispatch = useDispatch();
  
  // Redux state
  const userPreferences = useSelector((state: any) => state.user.preferences);
  const vesselData = useSelector((state: any) => state.vessel);
  const environmentData = useSelector((state: any) => state.environment);
  const batteryLevel = useSelector((state: any) => state.device.batteryLevel);
  const connectionQuality = useSelector((state: any) => state.device.connectionQuality);
  
  // Component state
  const [currentMode, setCurrentMode] = useState<ViewMode>(userPreferences.defaultViewMode || 'map');
  const [transitionState, setTransitionState] = useState<TransitionState>({
    isTransitioning: false,
    fromMode: 'map',
    toMode: 'map',
    progress: 0,
    duration: 0
  });
  const [lastModeSwitch, setLastModeSwitch] = useState<Date>(new Date());
  const [sessionStartTime] = useState<Date>(new Date());
  
  // Animation refs
  const mapOpacity = useRef(new Animated.Value(1)).current;
  const threeDOpacity = useRef(new Animated.Value(0)).current;
  const splitOffset = useRef(new Animated.Value(0)).current;
  
  // Utility classes
  const contextAnalyzer = useMemo(() => new ContextAnalyzer(), []);
  const preferenceLearning = useMemo(() => new PreferenceLearningSystem(), []);
  
  // Calculate current navigation context
  const navigationContext = useMemo((): NavigationContext => ({
    vesselSpeed: vesselData.speed || 0,
    proximityToHazards: calculateHazardProximity(userLocation, depthData),
    navigationComplexity: calculateNavigationComplexity(route, depthData),
    visibility: environmentData.visibility || 'good',
    userSkillLevel: userPreferences.skillLevel || 'experienced',
    batteryLevel,
    connectionQuality,
    timeInSession: Date.now() - sessionStartTime.getTime(),
    currentActivity: determineCurrentActivity(vesselData, route)
  }), [
    vesselData,
    userLocation,
    depthData,
    route,
    environmentData,
    userPreferences,
    batteryLevel,
    connectionQuality,
    sessionStartTime
  ]);
  
  // Get mode recommendation from context analyzer
  const modeRecommendation = useMemo(() => 
    contextAnalyzer.analyzeOptimalMode(navigationContext),
    [contextAnalyzer, navigationContext]
  );
  
  // Auto-switch mode based on context (with user override capability)
  useEffect(() => {
    const timeSinceLastSwitch = Date.now() - lastModeSwitch.getTime();
    const minTimeBetweenAutoSwitches = 30000; // 30 seconds
    
    // Only auto-switch if enough time has passed and confidence is high
    if (
      timeSinceLastSwitch > minTimeBetweenAutoSwitches &&
      modeRecommendation.confidence > 0.8 &&
      modeRecommendation.recommended !== currentMode &&
      userPreferences.allowAutoModeSwitch !== false
    ) {
      // Check if this matches user's historical preferences
      const userPreference = preferenceLearning.predictUserPreference(navigationContext);
      
      if (userPreference.primaryMode === modeRecommendation.recommended) {
        handleModeSwitch(modeRecommendation.recommended, true);
      }
    }
  }, [modeRecommendation, currentMode, navigationContext, userPreferences]);
  
  // Handle mode switching with animation
  const handleModeSwitch = useCallback(async (
    newMode: ViewMode,
    isAutomatic: boolean = false
  ) => {
    if (newMode === currentMode || transitionState.isTransitioning) {
      return;
    }
    
    // Record user interaction for learning
    preferenceLearning.recordUserInteraction({
      context: navigationContext,
      userChoice: newMode,
      systemSuggestion: modeRecommendation.recommended,
      outcome: isAutomatic ? 'accepted' : 'manual_override',
      sessionMetrics: {
        duration: Date.now() - sessionStartTime.getTime(),
        performance: calculateSessionPerformance()
      }
    });
    
    await executeTransition(currentMode, newMode, true);
    setCurrentMode(newMode);
    setLastModeSwitch(new Date());
  }, [currentMode, transitionState, navigationContext, modeRecommendation]);
  
  // Execute smooth transition between modes
  const executeTransition = useCallback(async (
    fromMode: ViewMode,
    toMode: ViewMode,
    animated: boolean = true
  ): Promise<void> => {
    if (!animated) {
      setCurrentMode(toMode);
      return;
    }
    
    const duration = calculateTransitionDuration(fromMode, toMode);
    
    setTransitionState({
      isTransitioning: true,
      fromMode,
      toMode,
      progress: 0,
      duration
    });
    
    // Create transition animations
    const animations = createTransitionAnimations(fromMode, toMode, duration);
    
    // Execute animations in parallel
    return new Promise((resolve) => {
      Animated.parallel(animations).start(() => {
        setTransitionState({
          isTransitioning: false,
          fromMode: toMode,
          toMode,
          progress: 1,
          duration: 0
        });
        resolve();
      });
    });
  }, []);
  
  // Create appropriate transition animations
  const createTransitionAnimations = useCallback((
    fromMode: ViewMode,
    toMode: ViewMode,
    duration: number
  ): Animated.CompositeAnimation[] => {
    const animations: Animated.CompositeAnimation[] = [];
    
    if (fromMode === 'map' && toMode === '3d') {
      animations.push(
        Animated.timing(mapOpacity, {
          toValue: 0,
          duration: duration / 2,
          useNativeDriver: true
        }),
        Animated.timing(threeDOpacity, {
          toValue: 1,
          duration: duration / 2,
          delay: duration / 4,
          useNativeDriver: true
        })
      );
    } else if (fromMode === '3d' && toMode === 'map') {
      animations.push(
        Animated.timing(threeDOpacity, {
          toValue: 0,
          duration: duration / 2,
          useNativeDriver: true
        }),
        Animated.timing(mapOpacity, {
          toValue: 1,
          duration: duration / 2,
          delay: duration / 4,
          useNativeDriver: true
        })
      );
    } else if (toMode === 'split') {
      animations.push(
        Animated.timing(splitOffset, {
          toValue: 1,
          duration,
          useNativeDriver: true
        }),
        Animated.timing(mapOpacity, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true
        }),
        Animated.timing(threeDOpacity, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true
        })
      );
    }
    
    return animations;
  }, [mapOpacity, threeDOpacity, splitOffset]);
  
  // Calculate transition duration based on mode change
  const calculateTransitionDuration = useCallback((
    fromMode: ViewMode,
    toMode: ViewMode
  ): number => {
    const baseDuration = 600;
    
    // Longer transitions for more complex mode changes
    if ((fromMode === 'map' && toMode === '3d') || (fromMode === '3d' && toMode === 'map')) {
      return baseDuration * 1.2;
    }
    
    if (toMode === 'split' || fromMode === 'split') {
      return baseDuration * 1.5;
    }
    
    return baseDuration;
  }, []);
  
  // Pan responder for gesture-based mode switching
  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Preview transition based on gesture
        const progress = Math.min(1, Math.abs(gestureState.dy) / 200);
        
        if (gestureState.dy > 0 && currentMode === 'map') {
          // Swipe down to switch to 3D
          threeDOpacity.setValue(progress);
          mapOpacity.setValue(1 - progress);
        } else if (gestureState.dy < 0 && currentMode === '3d') {
          // Swipe up to switch to map
          mapOpacity.setValue(progress);
          threeDOpacity.setValue(1 - progress);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const threshold = 100;
        
        if (Math.abs(gestureState.dy) > threshold) {
          const newMode = gestureState.dy > 0 ? 
            (currentMode === 'map' ? '3d' : currentMode) :
            (currentMode === '3d' ? 'map' : currentMode);
          
          if (newMode !== currentMode) {
            handleModeSwitch(newMode);
          }
        } else {
          // Snap back to current mode
          if (currentMode === 'map') {
            Animated.parallel([
              Animated.timing(mapOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
              Animated.timing(threeDOpacity, { toValue: 0, duration: 200, useNativeDriver: true })
            ]).start();
          } else {
            Animated.parallel([
              Animated.timing(mapOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
              Animated.timing(threeDOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
            ]).start();
          }
        }
      }
    }), [currentMode, handleModeSwitch]
  );
  
  // Render appropriate view based on current mode
  const renderCurrentView = useCallback(() => {
    const sharedProps = {
      userLocation,
      depthData,
      route,
      onDepthTap,
      onRouteRequest,
      onModeSwitch: handleModeSwitch
    };
    
    switch (currentMode) {
      case 'map':
        return (
          <Animated.View style={[styles.viewContainer, { opacity: mapOpacity }]}>
            <WavesMapView
              {...sharedProps}
              displayMode="standard"
            />
          </Animated.View>
        );
        
      case '3d':
        return (
          <Animated.View style={[styles.viewContainer, { opacity: threeDOpacity }]}>
            <Guidance3DView
              {...sharedProps}
              vesselHeading={vesselData.heading || 0}
              vesselSpeed={vesselData.speed || 0}
              vesselDraft={userPreferences.vesselDraft || 2}
              lookAheadDistance={calculateLookAheadDistance(vesselData.speed)}
              renderQuality={batteryLevel > 0.3 ? 'high' : 'medium'}
            />
          </Animated.View>
        );
        
      case 'split':
        return (
          <Animated.View 
            style={[
              styles.splitContainer,
              { 
                transform: [{ 
                  translateY: splitOffset.interpolate({
                    inputRange: [0, 1],
                    outputRange: [height, 0]
                  })
                }]
              }
            ]}
          >
            <View style={styles.splitTop}>
              <Animated.View style={{ opacity: mapOpacity }}>
                <WavesMapView
                  {...sharedProps}
                  displayMode="3d_preview"
                />
              </Animated.View>
            </View>
            <View style={styles.splitBottom}>
              <Animated.View style={{ opacity: threeDOpacity }}>
                <Guidance3DView
                  {...sharedProps}
                  vesselHeading={vesselData.heading || 0}
                  vesselSpeed={vesselData.speed || 0}
                  vesselDraft={userPreferences.vesselDraft || 2}
                  lookAheadDistance={calculateLookAheadDistance(vesselData.speed)}
                  renderQuality="medium"
                />
              </Animated.View>
            </View>
          </Animated.View>
        );
        
      default:
        return null;
    }
  }, [
    currentMode,
    userLocation,
    depthData,
    route,
    vesselData,
    userPreferences,
    batteryLevel,
    mapOpacity,
    threeDOpacity,
    splitOffset,
    onDepthTap,
    onRouteRequest,
    handleModeSwitch
  ]);
  
  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {renderCurrentView()}
      
      {/* Mode transition overlay */}
      {transitionState.isTransitioning && (
        <ModeTransitionOverlay
          fromMode={transitionState.fromMode}
          toMode={transitionState.toMode}
          progress={transitionState.progress}
          reasoning={modeRecommendation.reasoning}
        />
      )}
    </View>
  );
};

// Helper functions
const calculateHazardProximity = (userLocation: Location, depthData: DepthReading[]): number => {
  const nearbyHazards = depthData.filter(reading => {
    const distance = calculateDistance(userLocation, reading.location);
    return distance < 500 && reading.depth < 3; // Shallow water within 500m
  });
  
  return nearbyHazards.length > 0 ? 
    Math.min(...nearbyHazards.map(h => calculateDistance(userLocation, h.location))) :
    Infinity;
};

const calculateNavigationComplexity = (
  route: NavigationRoute | null,
  depthData: DepthReading[]
): 'low' | 'medium' | 'high' => {
  if (!route) return 'low';
  
  const hazardCount = route.hazardWarnings.length;
  const routeLength = route.distance;
  const depthVariation = calculateDepthVariation(depthData);
  
  if (hazardCount > 3 || routeLength > 10000 || depthVariation > 10) {
    return 'high';
  } else if (hazardCount > 1 || routeLength > 5000 || depthVariation > 5) {
    return 'medium';
  }
  
  return 'low';
};

const determineCurrentActivity = (
  vesselData: any,
  route: NavigationRoute | null
): NavigationContext['currentActivity'] => {
  if (vesselData.speed < 1) return 'anchoring';
  if (vesselData.speed < 3 && route?.distance < 500) return 'docking';
  if (route?.hazardWarnings.length > 2) return 'navigating_hazards';
  return 'cruising';
};

const calculateLookAheadDistance = (speed: number): number => {
  // Calculate distance based on speed (minimum 200m, maximum 2km)
  return Math.max(200, Math.min(2000, speed * 100));
};

const calculateDistance = (point1: Location, point2: Location): number => {
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
};

const calculateDepthVariation = (depthData: DepthReading[]): number => {
  if (depthData.length < 2) return 0;
  
  const depths = depthData.map(r => r.depth);
  const maxDepth = Math.max(...depths);
  const minDepth = Math.min(...depths);
  
  return maxDepth - minDepth;
};

const calculateSessionPerformance = (): any => {
  // Implementation would track navigation accuracy, user satisfaction, etc.
  return {
    navigationAccuracy: 0.85,
    safetyIncidents: 0,
    userSatisfaction: 0.9
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  viewContainer: {
    flex: 1
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'column'
  },
  splitTop: {
    flex: 0.6,
    borderBottomWidth: 2,
    borderBottomColor: '#FFF'
  },
  splitBottom: {
    flex: 0.4
  }
});

export default ViewModeController;