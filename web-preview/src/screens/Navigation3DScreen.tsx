import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

const rotate = keyframes`
  from { transform: perspective(500px) rotateX(60deg) rotateY(0deg); }
  to { transform: perspective(500px) rotateX(60deg) rotateY(360deg); }
`;

const wave = keyframes`
  0%, 100% { transform: translateY(0px); }
  25% { transform: translateY(-5px); }
  50% { transform: translateY(0px); }
  75% { transform: translateY(5px); }
`;

const Container = styled.div`
  height: 100%;
  background: linear-gradient(180deg, #1e3a8a 0%, #1e40af 30%, #3b82f6 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 1rem;
  backdrop-filter: blur(10px);
`;

const Scene3D = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1000px;
`;

const TerrainContainer = styled.div`
  width: 300px;
  height: 200px;
  transform: perspective(500px) rotateX(60deg);
  transform-style: preserve-3d;
  position: relative;
`;

const TerrainGrid = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 19px,
    rgba(255, 255, 255, 0.1) 20px
  ),
  repeating-linear-gradient(
    90deg,
    transparent,
    transparent 19px,
    rgba(255, 255, 255, 0.1) 20px
  );
`;

const DepthBlock = styled.div<{ $height: number; $color: string }>`
  position: absolute;
  width: 30px;
  height: 30px;
  background: ${props => props.$color};
  transform: translateZ(${props => props.$height}px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  opacity: 0.8;
  
  &:hover {
    opacity: 1;
    box-shadow: 0 0 20px ${props => props.$color};
  }
`;

const VesselPath = styled.div`
  position: absolute;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #3b82f6, transparent);
  top: 50%;
  animation: ${wave} 3s ease-in-out infinite;
  transform: translateZ(50px);
`;

const SafetyAlert = styled.div<{ $level: 'safe' | 'caution' | 'danger' }>`
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  padding: 1rem;
  border-radius: 8px;
  color: white;
  font-weight: bold;
  background: ${props => {
    switch(props.$level) {
      case 'safe': return 'rgba(34, 197, 94, 0.9)';
      case 'caution': return 'rgba(245, 158, 11, 0.9)';
      case 'danger': return 'rgba(239, 68, 68, 0.9)';
      default: return 'rgba(107, 114, 128, 0.9)';
    }
  }};
  backdrop-filter: blur(10px);
`;

const Controls = styled.div`
  position: absolute;
  bottom: 120px;
  left: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 1rem;
  backdrop-filter: blur(10px);
`;

const ControlRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Button = styled.button<{ $active?: boolean }>`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background: ${props => props.$active ? '#3b82f6' : '#e2e8f0'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.$active ? '#2563eb' : '#cbd5e1'};
  }
`;

const DepthMeter = styled.div`
  position: absolute;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  backdrop-filter: blur(10px);
`;

const Compass = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
  backdrop-filter: blur(10px);
  animation: ${rotate} 20s linear infinite;
`;

const Navigation3DScreen: React.FC = () => {
  const [viewMode, setViewMode] = useState<'underwater' | 'surface'>('underwater');
  const [showGrid, setShowGrid] = useState(true);
  const [currentDepth, setCurrentDepth] = useState(18.5);
  const [heading, setHeading] = useState(045);
  const [safetyLevel, setSafetyLevel] = useState<'safe' | 'caution' | 'danger'>('safe');

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDepth(prev => {
        const newDepth = prev + (Math.random() - 0.5) * 3;
        
        // Update safety level based on depth
        if (newDepth > 15) setSafetyLevel('safe');
        else if (newDepth > 8) setSafetyLevel('caution');
        else setSafetyLevel('danger');
        
        return Math.max(3, Math.min(30, newDepth));
      });
      
      setHeading(prev => (prev + 1) % 360);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Generate 3D terrain blocks
  const terrainBlocks = [];
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 7; y++) {
      const depth = Math.random() * 25 + 5;
      const height = Math.max(5, depth);
      let color = '#22c55e'; // Green for safe
      
      if (depth < 15) color = '#f59e0b'; // Yellow for caution
      if (depth < 8) color = '#ef4444'; // Red for danger
      
      terrainBlocks.push({
        id: `${x}-${y}`,
        x: x * 30,
        y: y * 30,
        height: height,
        color: color,
        depth: depth
      });
    }
  }

  return (
    <Container>
      <Header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>🔮 3D Navigation</h2>
            <p style={{ fontSize: '0.9em', opacity: 0.8 }}>Underwater Terrain View</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>HDG: {String(heading).padStart(3, '0')}°</div>
            <div>SOG: 12.8 kts</div>
          </div>
        </div>
      </Header>

      <Scene3D>
        {/* Safety Alert */}
        <SafetyAlert $level={safetyLevel}>
          {safetyLevel === 'safe' && '✅ Safe Waters - Good Clearance'}
          {safetyLevel === 'caution' && '⚠️ Caution - Shallow Waters Ahead'}
          {safetyLevel === 'danger' && '🚨 DANGER - Very Shallow Water!'}
        </SafetyAlert>

        {/* Compass */}
        <Compass>🧭</Compass>

        {/* Depth Meter */}
        <DepthMeter>
          <div style={{ fontSize: '1.5em', marginBottom: '0.5rem' }}>
            {currentDepth.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.8em', opacity: 0.8 }}>
            FEET
          </div>
        </DepthMeter>

        {/* 3D Terrain */}
        <TerrainContainer>
          {showGrid && <TerrainGrid />}
          
          {terrainBlocks.map(block => (
            <DepthBlock
              key={block.id}
              $height={block.height}
              $color={block.color}
              style={{ 
                left: `${block.x}px`, 
                top: `${block.y}px` 
              }}
              title={`Depth: ${block.depth.toFixed(1)}ft`}
            />
          ))}
          
          <VesselPath />
        </TerrainContainer>
      </Scene3D>

      <Controls>
        <h3 style={{ marginBottom: '1rem', color: '#0369a1' }}>
          🎮 3D Controls
        </h3>
        
        <ControlRow>
          <span>View Mode:</span>
          <div>
            <Button 
              $active={viewMode === 'underwater'}
              onClick={() => setViewMode('underwater')}
              style={{ marginRight: '0.5rem' }}
            >
              Underwater
            </Button>
            <Button 
              $active={viewMode === 'surface'}
              onClick={() => setViewMode('surface')}
            >
              Surface
            </Button>
          </div>
        </ControlRow>
        
        <ControlRow>
          <span>Grid Overlay:</span>
          <Button 
            $active={showGrid}
            onClick={() => setShowGrid(!showGrid)}
          >
            {showGrid ? 'ON' : 'OFF'}
          </Button>
        </ControlRow>
        
        <ControlRow>
          <span>Look Ahead:</span>
          <strong style={{ color: '#3b82f6' }}>500 ft</strong>
        </ControlRow>
        
        <ControlRow>
          <span>Safety Margin:</span>
          <strong style={{ color: safetyLevel === 'safe' ? '#22c55e' : '#ef4444' }}>
            {safetyLevel === 'safe' ? '✅ 5.0 ft' : '⚠️ 2.1 ft'}
          </strong>
        </ControlRow>
      </Controls>
    </Container>
  );
};

export default Navigation3DScreen;