import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
`;

const MapContainer = styled.div`
  height: 100%;
  position: relative;
  background: linear-gradient(180deg, #87ceeb 0%, #4682b4 50%, #1e3a8a 100%);
  overflow: hidden;
`;

const MapOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><defs><pattern id="waves" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M0 10 Q5 5 10 10 T20 10" stroke="rgba(255,255,255,0.1)" stroke-width="1" fill="none"/></pattern></defs><rect width="100%" height="100%" fill="url(%23waves)"/></svg>');
`;

const DepthPoint = styled.div<{ $depth: number; $confidence: number }>`
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${props => {
    if (props.$depth > 20) return '#22c55e'; // Green - safe
    if (props.$depth > 10) return '#f59e0b'; // Yellow - caution
    return '#ef4444'; // Red - shallow
  }};
  opacity: ${props => props.$confidence};
  animation: ${pulse} 2s ease-in-out infinite;
  cursor: pointer;
  
  &:hover {
    transform: scale(1.5);
    transition: transform 0.2s;
  }
`;

const VesselIcon = styled.div`
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: #3b82f6;
  border-radius: 50%;
  border: 3px solid white;
  animation: ${float} 3s ease-in-out infinite;
  
  &:after {
    content: '⛵';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
  }
`;

const LocationPulse = styled.div`
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  border: 2px solid #3b82f6;
  border-radius: 50%;
  opacity: 0.3;
  animation: ${pulse} 2s ease-in-out infinite;
`;

const Header = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  color: white;
  padding: 1rem;
  z-index: 10;
`;

const StatusPanel = styled.div`
  position: absolute;
  bottom: 100px;
  left: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
`;

const StatusRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const DepthInfo = styled.div<{ $depth: number }>`
  position: absolute;
  top: 20%;
  right: 1rem;
  background: ${props => {
    if (props.$depth > 20) return 'rgba(34, 197, 94, 0.9)'; // Green
    if (props.$depth > 10) return 'rgba(245, 158, 11, 0.9)'; // Yellow
    return 'rgba(239, 68, 68, 0.9)'; // Red
  }};
  color: white;
  padding: 0.75rem;
  border-radius: 8px;
  font-weight: bold;
  backdrop-filter: blur(10px);
`;

const MapScreen: React.FC = () => {
  const [currentDepth, setCurrentDepth] = useState(15.5);
  const [vesselDraft, setVesselDraft] = useState(3.2);
  const [clearance, setClearance] = useState(12.3);
  const [gpsAccuracy, setGpsAccuracy] = useState(2.1);

  // Simulate depth readings
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDepth(prev => prev + (Math.random() - 0.5) * 2);
      setClearance(prev => prev + (Math.random() - 0.5) * 1);
      setGpsAccuracy(prev => Math.max(0.5, prev + (Math.random() - 0.5) * 0.5));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Sample depth points
  const depthPoints = [
    { x: 20, y: 30, depth: 25, confidence: 0.9 },
    { x: 60, y: 20, depth: 8, confidence: 0.7 },
    { x: 80, y: 60, depth: 32, confidence: 0.95 },
    { x: 30, y: 70, depth: 5, confidence: 0.8 },
    { x: 70, y: 80, depth: 18, confidence: 0.85 },
    { x: 40, y: 40, depth: 12, confidence: 0.75 },
    { x: 85, y: 35, depth: 28, confidence: 0.9 },
  ];

  return (
    <MapContainer>
      <MapOverlay />
      
      <Header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>🌊 Marine Chart View</h2>
            <p style={{ fontSize: '0.9em', opacity: 0.8 }}>Miami Bay, FL</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>GPS: {gpsAccuracy.toFixed(1)}m</div>
            <div>Speed: 8.3 kts</div>
          </div>
        </div>
      </Header>

      {/* Depth points */}
      {depthPoints.map((point, index) => (
        <DepthPoint
          key={index}
          $depth={point.depth}
          $confidence={point.confidence}
          style={{ 
            left: `${point.x}%`, 
            top: `${point.y}%` 
          }}
          title={`Depth: ${point.depth}ft (${Math.round(point.confidence * 100)}% confidence)`}
        />
      ))}

      {/* Vessel position */}
      <LocationPulse />
      <VesselIcon />

      {/* Current depth info */}
      <DepthInfo $depth={currentDepth}>
        <div style={{ fontSize: '1.5em' }}>{currentDepth.toFixed(1)} ft</div>
        <div style={{ fontSize: '0.8em', opacity: 0.9 }}>Current Depth</div>
      </DepthInfo>

      {/* Status panel */}
      <StatusPanel>
        <h3 style={{ marginBottom: '0.75rem', color: '#0369a1' }}>
          ⚓ Navigation Status
        </h3>
        <StatusRow>
          <span>🚢 Vessel Draft:</span>
          <strong>{vesselDraft.toFixed(1)} ft</strong>
        </StatusRow>
        <StatusRow>
          <span>📏 Under-Keel Clearance:</span>
          <strong style={{ 
            color: clearance < 5 ? '#ef4444' : clearance < 10 ? '#f59e0b' : '#22c55e' 
          }}>
            {clearance.toFixed(1)} ft
          </strong>
        </StatusRow>
        <StatusRow>
          <span>🎯 GPS Accuracy:</span>
          <strong style={{ 
            color: gpsAccuracy > 5 ? '#ef4444' : gpsAccuracy > 3 ? '#f59e0b' : '#22c55e' 
          }}>
            ±{gpsAccuracy.toFixed(1)} m
          </strong>
        </StatusRow>
        <StatusRow>
          <span>🌊 Tide Status:</span>
          <strong>Rising (+2.3 ft in 1h)</strong>
        </StatusRow>
      </StatusPanel>
    </MapContainer>
  );
};

export default MapScreen;