/**
 * Guidance3DView Component - 3D Marine Navigation Interface
 * Provides underwater terrain visualization and forward-looking guidance
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, Animated } from 'react-native';
import { Canvas, useThree, useFrame } from '@react-three/fiber/native';
import { useSelector } from 'react-redux';
import * as THREE from 'three';

import { DepthColors } from '../../utils/DepthColorSystem';
import { DepthProjectionSystem } from '../../utils/DepthProjectionSystem';
import { TerrainGenerator } from '../../utils/TerrainGenerator';
import CompassIndicator from './overlays/CompassIndicator';
import DepthGauge from './overlays/DepthGauge';
import SpeedIndicator from './overlays/SpeedIndicator';
import SafetyStatus from './overlays/SafetyStatus';
import NavigationControls from './NavigationControls';

interface Guidance3DViewProps {
  userLocation: Location;
  vesselHeading: number;
  vesselSpeed: number;
  vesselDraft: number;
  depthData: DepthReading[];
  lookAheadDistance: number;
  renderQuality: 'low' | 'medium' | 'high';
  onModeSwitch: (mode: 'map' | '3d' | 'split') => void;
}

interface Location {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}

interface DepthReading {
  id: string;
  location: Location;
  depth: number;
  confidence: number;
  timestamp: Date;
  source: 'user' | 'official' | 'sensor';
}

interface TerrainMesh {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minDepth: number;
    maxDepth: number;
  };
}

interface ProjectedDepth {
  time: number;
  position: Location;
  estimatedDepth: number | null;
  confidence: number;
  safetyStatus: 'safe' | 'caution' | 'danger';
}

const { width, height } = Dimensions.get('window');

// Terrain Mesh Component
const TerrainMeshComponent: React.FC<{
  mesh: TerrainMesh | null;
  userLocation: Location;
  vesselDraft: number;
}> = ({ mesh, userLocation, vesselDraft }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current && userLocation) {
      // Update position relative to user location
      meshRef.current.position.x = 0;
      meshRef.current.position.z = 0;
      meshRef.current.position.y = -vesselDraft; // Below water surface
    }
  });

  if (!mesh) return null;

  return (
    <mesh ref={meshRef} geometry={mesh.geometry} material={mesh.material}>
      {/* Water surface plane */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial
          color={0x006994}
          transparent={true}
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </mesh>
  );
};

// Vessel Model Component
const VesselModel: React.FC<{
  vesselDraft: number;
  vesselSpeed: number;
  heading: number;
}> = ({ vesselDraft, vesselSpeed, heading }) => {
  const vesselRef = useRef<THREE.Group>(null);
  const wakeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (vesselRef.current) {
      // Gentle bobbing motion based on speed
      const bobHeight = vesselSpeed > 0 ? Math.sin(clock.elapsedTime * 2) * 0.1 : 0;
      vesselRef.current.position.y = bobHeight;
      vesselRef.current.rotation.y = (heading * Math.PI) / 180;
    }

    if (wakeRef.current && vesselSpeed > 2) {
      // Animate wake pattern
      wakeRef.current.material.opacity = Math.min(vesselSpeed / 20, 0.6);
      wakeRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime) * 0.1);
    }
  });

  return (
    <group ref={vesselRef} position={[0, 0, 0]}>
      {/* Vessel hull */}
      <mesh position={[0, -vesselDraft / 2, 0]}>
        <boxGeometry args={[12, vesselDraft, 4]} />
        <meshLambertMaterial color={0xffffff} />
      </mesh>
      
      {/* Draft indicator */}
      <mesh position={[0, -vesselDraft, 0]}>
        <cylinderGeometry args={[6, 6, 0.2]} />
        <meshBasicMaterial color={0xff0000} transparent opacity={0.7} />
      </mesh>
      
      {/* Wake pattern */}
      {vesselSpeed > 2 && (
        <mesh ref={wakeRef} position={[0, -0.5, -20]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[20, 40, 16]} />
          <meshBasicMaterial
            color={0xffffff}
            transparent
            opacity={0.3}
            wireframe
          />
        </mesh>
      )}
    </group>
  );
};

// Forward Path Projection Component
const ProjectionPath: React.FC<{
  projections: ProjectedDepth[];
  vesselDraft: number;
  safetyMargin: number;
}> = ({ projections, vesselDraft, safetyMargin }) => {
  const pathRef = useRef<THREE.Line>(null);

  const pathGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const colors: number[] = [];

    projections.forEach((proj, index) => {
      const x = index * 10; // 10 meters per projection point
      const y = proj.estimatedDepth ? -proj.estimatedDepth : -20;
      const z = 0;

      points.push(new THREE.Vector3(x, y, z));

      // Color based on safety status
      const color = new THREE.Color(
        proj.safetyStatus === 'safe' ? DepthColors.SAFE_GREEN :
        proj.safetyStatus === 'caution' ? DepthColors.CAUTION_YELLOW :
        DepthColors.DANGER_RED
      );
      colors.push(color.r, color.g, color.b);
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    return geometry;
  }, [projections]);

  const pathMaterial = useMemo(() => 
    new THREE.LineBasicMaterial({ 
      vertexColors: true,
      linewidth: 5,
      transparent: true,
      opacity: 0.8
    }), []
  );

  return (
    <line ref={pathRef} geometry={pathGeometry} material={pathMaterial}>
      {/* Safety zone indicators along path */}
      {projections.map((proj, index) => {
        if (!proj.estimatedDepth) return null;
        
        const clearance = proj.estimatedDepth - vesselDraft;
        const isSafe = clearance > safetyMargin;
        
        return (
          <mesh
            key={index}
            position={[index * 10, -proj.estimatedDepth + 1, 0]}
          >
            <sphereGeometry args={[isSafe ? 1 : 2]} />
            <meshBasicMaterial 
              color={isSafe ? DepthColors.SAFE_GREEN : DepthColors.DANGER_RED}
              transparent
              opacity={0.6}
            />
          </mesh>
        );
      })}
    </line>
  );
};

// Hazard Markers Component
const HazardMarkers: React.FC<{
  hazards: Array<{
    id: string;
    position: Location;
    type: 'shallow' | 'obstacle' | 'current';
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  userLocation: Location;
}> = ({ hazards, userLocation }) => {
  return (
    <>
      {hazards.map(hazard => {
        const relativeX = (hazard.position.longitude - userLocation.longitude) * 111000;
        const relativeZ = (hazard.position.latitude - userLocation.latitude) * 111000;
        
        const color = hazard.severity === 'critical' ? 0xff0000 :
                     hazard.severity === 'high' ? 0xff4444 :
                     hazard.severity === 'medium' ? 0xffbb00 : 0xffdd44;

        return (
          <group key={hazard.id} position={[relativeX, 5, relativeZ]}>
            {/* Warning beacon */}
            <mesh>
              <coneGeometry args={[3, 8, 6]} />
              <meshBasicMaterial color={color} />
            </mesh>
            
            {/* Pulsing warning light */}
            <mesh>
              <sphereGeometry args={[1]} />
              <meshBasicMaterial 
                color={color}
                transparent
                opacity={0.8}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
};

// Main Camera Controller
const CameraController: React.FC<{
  userLocation: Location;
  vesselHeading: number;
  cameraMode: 'follow' | 'free';
}> = ({ userLocation, vesselHeading, cameraMode }) => {
  const { camera } = useThree();
  
  useFrame(() => {
    if (cameraMode === 'follow') {
      // Follow vessel with slight offset behind and above
      const cameraDistance = 50;
      const cameraHeight = 15;
      
      const radianHeading = (vesselHeading * Math.PI) / 180;
      const offsetX = -Math.sin(radianHeading) * cameraDistance;
      const offsetZ = -Math.cos(radianHeading) * cameraDistance;
      
      camera.position.set(offsetX, cameraHeight, offsetZ);
      camera.lookAt(0, 0, 0); // Look at vessel
    }
  });

  return null;
};

const Guidance3DView: React.FC<Guidance3DViewProps> = ({
  userLocation,
  vesselHeading,
  vesselSpeed,
  vesselDraft,
  depthData,
  lookAheadDistance,
  renderQuality,
  onModeSwitch
}) => {
  // Redux state
  const userPreferences = useSelector((state: any) => state.user.depthPreferences);
  const safetyAlerts = useSelector((state: any) => state.safety.alerts);
  const batteryLevel = useSelector((state: any) => state.device.batteryLevel);

  // Component state
  const [terrainMesh, setTerrainMesh] = useState<TerrainMesh | null>(null);
  const [cameraMode, setCameraMode] = useState<'follow' | 'free'>('follow');
  const [projectedDepths, setProjectedDepths] = useState<ProjectedDepth[]>([]);
  const [currentDepth, setCurrentDepth] = useState<number>(0);

  // Utility classes
  const projectionSystem = useMemo(() => new DepthProjectionSystem(), []);
  const terrainGenerator = useMemo(() => new TerrainGenerator(), []);

  // Generate terrain mesh from depth data
  useEffect(() => {
    if (depthData.length > 0) {
      const mesh = terrainGenerator.generateUnderwaterTerrain(depthData, {
        resolution: renderQuality === 'high' ? 1 : renderQuality === 'medium' ? 2 : 4,
        bounds: calculateViewBounds(userLocation, lookAheadDistance),
        smoothing: true,
        userLocation
      });
      setTerrainMesh(mesh);
    }
  }, [depthData, renderQuality, lookAheadDistance, userLocation, terrainGenerator]);

  // Calculate forward depth projections
  useEffect(() => {
    if (depthData.length > 0) {
      const projections = projectionSystem.calculateForwardDepths(
        userLocation,
        vesselHeading,
        vesselSpeed,
        lookAheadDistance / vesselSpeed, // time horizon
        depthData
      );
      setProjectedDepths(projections);
    }
  }, [userLocation, vesselHeading, vesselSpeed, lookAheadDistance, depthData, projectionSystem]);

  // Calculate current depth
  useEffect(() => {
    const nearbyReading = projectionSystem.interpolateDepth(userLocation, depthData);
    setCurrentDepth(nearbyReading || 0);
  }, [userLocation, depthData, projectionSystem]);

  // Pan responder for free camera control
  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setCameraMode('free');
      },
      onPanResponderMove: (evt, gestureState) => {
        // Handle camera rotation based on gesture
        // Implementation would update camera angles
      },
      onPanResponderRelease: () => {
        // Option to return to follow mode after release
        setTimeout(() => setCameraMode('follow'), 2000);
      }
    }), []
  );

  // Calculate view bounds for terrain generation
  const calculateViewBounds = useCallback((location: Location, distance: number) => {
    const metersPerDegree = 111000;
    const deltaLat = distance / metersPerDegree;
    const deltaLng = distance / (metersPerDegree * Math.cos(location.latitude * Math.PI / 180));
    
    return {
      minLat: location.latitude - deltaLat,
      maxLat: location.latitude + deltaLat,
      minLng: location.longitude - deltaLng,
      maxLng: location.longitude + deltaLng
    };
  }, []);

  // Process hazards from safety alerts
  const hazards = useMemo(() => 
    safetyAlerts
      .filter((alert: any) => alert.type === 'grounding' || alert.type === 'shallow')
      .map((alert: any) => ({
        id: alert.id,
        position: alert.location,
        type: alert.type,
        severity: alert.severity
      })), [safetyAlerts]
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* 3D Scene */}
      <Canvas style={styles.canvas} camera={{ position: [0, 15, 50], fov: 60 }}>
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[100, 100, 50]} 
          intensity={0.8}
          castShadow
        />
        <directionalLight 
          position={[-100, 50, -50]} 
          intensity={0.3}
        />

        {/* Camera controller */}
        <CameraController
          userLocation={userLocation}
          vesselHeading={vesselHeading}
          cameraMode={cameraMode}
        />

        {/* Underwater terrain */}
        <TerrainMeshComponent
          mesh={terrainMesh}
          userLocation={userLocation}
          vesselDraft={vesselDraft}
        />

        {/* Vessel model */}
        <VesselModel
          vesselDraft={vesselDraft}
          vesselSpeed={vesselSpeed}
          heading={vesselHeading}
        />

        {/* Forward path projection */}
        <ProjectionPath
          projections={projectedDepths}
          vesselDraft={vesselDraft}
          safetyMargin={userPreferences.safetyMargin}
        />

        {/* Hazard markers */}
        <HazardMarkers
          hazards={hazards}
          userLocation={userLocation}
        />

        {/* Depth grid overlay */}
        <gridHelper args={[1000, 50]} position={[0, -20, 0]} />
      </Canvas>

      {/* 2D Overlay Elements */}
      <View style={styles.overlayContainer}>
        <CompassIndicator 
          heading={vesselHeading}
          style={styles.compass}
        />
        
        <DepthGauge 
          currentDepth={currentDepth}
          vesselDraft={vesselDraft}
          safetyMargin={userPreferences.safetyMargin}
          style={styles.depthGauge}
        />
        
        <SpeedIndicator 
          speed={vesselSpeed}
          unit="knots"
          style={styles.speedIndicator}
        />
        
        <SafetyStatus 
          status={calculateSafetyStatus(projectedDepths, vesselDraft)}
          alerts={safetyAlerts}
          style={styles.safetyStatus}
        />
      </View>

      {/* Navigation controls */}
      <NavigationControls
        style={styles.controls}
        onModeSwitch={onModeSwitch}
        onCenterUser={() => setCameraMode('follow')}
        currentMode="3d"
        batteryLevel={batteryLevel}
        signalStrength={0.8}
      />
    </View>
  );
};

// Helper function to calculate overall safety status
const calculateSafetyStatus = (
  projections: ProjectedDepth[],
  vesselDraft: number
): 'safe' | 'caution' | 'danger' => {
  const dangerousProjections = projections.filter(p => p.safetyStatus === 'danger');
  const cautionProjections = projections.filter(p => p.safetyStatus === 'caution');
  
  if (dangerousProjections.length > 0) return 'danger';
  if (cautionProjections.length > projections.length / 3) return 'caution';
  return 'safe';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#001122'
  },
  canvas: {
    flex: 1
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none'
  },
  compass: {
    position: 'absolute',
    top: 60,
    left: 20,
    pointerEvents: 'auto'
  },
  depthGauge: {
    position: 'absolute',
    top: 60,
    right: 20,
    pointerEvents: 'auto'
  },
  speedIndicator: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    pointerEvents: 'auto'
  },
  safetyStatus: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    pointerEvents: 'auto'
  },
  controls: {
    position: 'absolute',
    right: 16,
    top: 50,
    bottom: 200
  }
});

export default Guidance3DView;