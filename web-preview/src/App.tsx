import React, { useState } from 'react';
import styled from 'styled-components';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import MapScreen from './screens/MapScreen';
import Navigation3DScreen from './screens/Navigation3DScreen';
import DepthReportingScreen from './screens/DepthReportingScreen';
import SettingsScreen from './screens/SettingsScreen';
import ProfileScreen from './screens/ProfileScreen';

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);
`;

const Header = styled.header`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 1rem;
  color: white;
  text-align: center;
`;

const PhoneFrame = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
`;

const PhoneContainer = styled.div`
  width: 375px;
  height: 812px;
  background: #000;
  border-radius: 40px;
  padding: 10px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
`;

const Screen = styled.div`
  width: 100%;
  height: 100%;
  background: #f8fafc;
  border-radius: 30px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
`;

const StatusBar = styled.div`
  height: 44px;
  background: #000;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 600;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const TabBar = styled.div`
  height: 83px;
  background: rgba(248, 250, 252, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-bottom: 34px;
`;

const TabButton = styled(Link)<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: ${props => props.$active ? '#0ea5e9' : '#64748b'};
  font-size: 10px;
  font-weight: 600;
  
  &:hover {
    color: #0ea5e9;
  }
`;

const TabIcon = styled.div`
  width: 24px;
  height: 24px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
`;

const InfoPanel = styled.div`
  position: absolute;
  top: 2rem;
  right: 2rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 300px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  color: #334155;
  
  @media (max-width: 768px) {
    position: static;
    margin: 1rem auto;
    max-width: 90%;
  }
`;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('/');

  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Router>
      <AppContainer>
        <Header>
          <h1>🌊 Waves Marine Navigation - Interactive App Preview</h1>
          <p>Experience the mobile interface in your browser</p>
        </Header>
        
        <PhoneFrame>
          <InfoPanel>
            <h3 style={{ marginBottom: '1rem', color: '#0369a1' }}>
              📱 App Features Preview
            </h3>
            <ul style={{ listStyle: 'none', lineHeight: 1.6 }}>
              <li>🗺️ <strong>Map View:</strong> Marine charts with depth data</li>
              <li>🔮 <strong>3D Navigation:</strong> Underwater terrain visualization</li>
              <li>📊 <strong>Depth Reporting:</strong> Crowdsourced data collection</li>
              <li>⚙️ <strong>Settings:</strong> Marine preferences & safety</li>
              <li>👤 <strong>Profile:</strong> Vessel info & contributions</li>
            </ul>
            <p style={{ marginTop: '1rem', fontSize: '0.9em', color: '#64748b' }}>
              Click the tabs at the bottom to navigate between screens
            </p>
          </InfoPanel>

          <PhoneContainer>
            <Screen>
              <StatusBar>
                <span>{currentTime}</span>
                <div>
                  <span style={{ marginRight: '8px' }}>📶</span>
                  <span style={{ marginRight: '8px' }}>📶</span>
                  <span>🔋100%</span>
                </div>
              </StatusBar>
              
              <Content>
                <Routes>
                  <Route path="/" element={<MapScreen />} />
                  <Route path="/3d" element={<Navigation3DScreen />} />
                  <Route path="/depth" element={<DepthReportingScreen />} />
                  <Route path="/settings" element={<SettingsScreen />} />
                  <Route path="/profile" element={<ProfileScreen />} />
                </Routes>
              </Content>
              
              <TabBar>
                <TabButton 
                  to="/" 
                  $active={window.location.pathname === '/'}
                  onClick={() => setActiveTab('/')}
                >
                  <TabIcon>🗺️</TabIcon>
                  <span>Map</span>
                </TabButton>
                <TabButton 
                  to="/3d" 
                  $active={window.location.pathname === '/3d'}
                  onClick={() => setActiveTab('/3d')}
                >
                  <TabIcon>🔮</TabIcon>
                  <span>3D Nav</span>
                </TabButton>
                <TabButton 
                  to="/depth" 
                  $active={window.location.pathname === '/depth'}
                  onClick={() => setActiveTab('/depth')}
                >
                  <TabIcon>📊</TabIcon>
                  <span>Depth</span>
                </TabButton>
                <TabButton 
                  to="/settings" 
                  $active={window.location.pathname === '/settings'}
                  onClick={() => setActiveTab('/settings')}
                >
                  <TabIcon>⚙️</TabIcon>
                  <span>Settings</span>
                </TabButton>
                <TabButton 
                  to="/profile" 
                  $active={window.location.pathname === '/profile'}
                  onClick={() => setActiveTab('/profile')}
                >
                  <TabIcon>👤</TabIcon>
                  <span>Profile</span>
                </TabButton>
              </TabBar>
            </Screen>
          </PhoneContainer>
        </PhoneFrame>
      </AppContainer>
    </Router>
  );
};

export default App;