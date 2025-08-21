import React, { useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  height: 100%;
  background: #f8fafc;
  overflow-y: auto;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #475569 0%, #334155 100%);
  color: white;
  padding: 1.5rem;
`;

const Content = styled.div`
  padding: 1rem;
`;

const Section = styled.div`
  background: white;
  border-radius: 12px;
  margin-bottom: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const SectionHeader = styled.div`
  padding: 1rem 1.5rem;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 600;
  color: #374151;
`;

const SettingItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  
  &:last-child {
    border-bottom: none;
  }
`;

const SettingLabel = styled.div`
  flex: 1;
`;

const SettingTitle = styled.div`
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
`;

const SettingDescription = styled.div`
  font-size: 0.875rem;
  color: #64748b;
`;

const Toggle = styled.div<{ $active: boolean }>`
  width: 50px;
  height: 28px;
  border-radius: 14px;
  background: ${props => props.$active ? '#22c55e' : '#e2e8f0'};
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  
  &::after {
    content: '';
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: white;
    top: 2px;
    left: ${props => props.$active ? '24px' : '2px'};
    transition: left 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
`;

const Select = styled.select`
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  min-width: 120px;
`;

const Input = styled.input`
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  width: 100px;
  text-align: right;
`;

const Alert = styled.div<{ $type: 'warning' | 'info' }>`
  padding: 1rem;
  margin: 1rem;
  border-radius: 8px;
  background: ${props => props.$type === 'warning' ? '#fef3c7' : '#dbeafe'};
  color: ${props => props.$type === 'warning' ? '#92400e' : '#1e40af'};
  border-left: 4px solid ${props => props.$type === 'warning' ? '#f59e0b' : '#3b82f6'};
`;

const SettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState({
    // Safety Settings
    autoGroundingAlerts: true,
    safetyMargin: 5.0,
    alertDistance: 500,
    emergencyContacts: true,
    
    // Data Settings
    shareDepthData: true,
    anonymousMode: false,
    dataQualityFilter: 'medium',
    offlineSync: true,
    
    // Display Settings
    units: 'imperial',
    chartOverlay: 'official',
    nightMode: false,
    showConfidence: true,
    
    // Navigation Settings
    routeOptimization: 'balanced',
    autoRoute: false,
    weatherAlerts: true,
    tideCorrections: true
  });

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <Container>
      <Header>
        <h2>⚙️ Settings</h2>
        <p style={{ opacity: 0.9, marginTop: '0.5rem' }}>
          Configure your marine navigation preferences
        </p>
      </Header>

      <Content>
        <Alert $type="info">
          ℹ️ Settings are automatically saved and synced across your devices
        </Alert>

        {/* Vessel Information */}
        <Section>
          <SectionHeader>🚢 Vessel Information</SectionHeader>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Vessel Draft</SettingTitle>
              <SettingDescription>Maximum depth your vessel draws</SettingDescription>
            </SettingLabel>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Input 
                type="number" 
                value={settings.safetyMargin}
                onChange={(e) => updateSetting('safetyMargin', parseFloat(e.target.value))}
                step="0.1"
              />
              <span style={{ marginLeft: '0.5rem', color: '#64748b' }}>ft</span>
            </div>
          </SettingItem>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Safety Margin</SettingTitle>
              <SettingDescription>Additional clearance for safe navigation</SettingDescription>
            </SettingLabel>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Input 
                type="number" 
                value={settings.safetyMargin}
                onChange={(e) => updateSetting('safetyMargin', parseFloat(e.target.value))}
                step="0.1"
              />
              <span style={{ marginLeft: '0.5rem', color: '#64748b' }}>ft</span>
            </div>
          </SettingItem>
        </Section>

        {/* Safety Settings */}
        <Section>
          <SectionHeader>🛡️ Safety & Alerts</SectionHeader>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Auto Grounding Alerts</SettingTitle>
              <SettingDescription>Automatic shallow water warnings</SettingDescription>
            </SettingLabel>
            <Toggle 
              $active={settings.autoGroundingAlerts}
              onClick={() => updateSetting('autoGroundingAlerts', !settings.autoGroundingAlerts)}
            />
          </SettingItem>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Alert Distance</SettingTitle>
              <SettingDescription>How far ahead to check for hazards</SettingDescription>
            </SettingLabel>
            <Select 
              value={settings.alertDistance}
              onChange={(e) => updateSetting('alertDistance', parseInt(e.target.value))}
            >
              <option value={250}>250 ft</option>
              <option value={500}>500 ft</option>
              <option value={1000}>1000 ft</option>
              <option value={2000}>2000 ft</option>
            </Select>
          </SettingItem>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Weather Alerts</SettingTitle>
              <SettingDescription>Marine weather warnings and advisories</SettingDescription>
            </SettingLabel>
            <Toggle 
              $active={settings.weatherAlerts}
              onClick={() => updateSetting('weatherAlerts', !settings.weatherAlerts)}
            />
          </SettingItem>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Emergency Contacts</SettingTitle>
              <SettingDescription>Quick access to Coast Guard and contacts</SettingDescription>
            </SettingLabel>
            <Toggle 
              $active={settings.emergencyContacts}
              onClick={() => updateSetting('emergencyContacts', !settings.emergencyContacts)}
            />
          </SettingItem>
        </Section>

        {/* Data & Privacy */}
        <Section>
          <SectionHeader>🔒 Data & Privacy</SectionHeader>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Share Depth Data</SettingTitle>
              <SettingDescription>Contribute to community navigation safety</SettingDescription>
            </SettingLabel>
            <Toggle 
              $active={settings.shareDepthData}
              onClick={() => updateSetting('shareDepthData', !settings.shareDepthData)}
            />
          </SettingItem>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Anonymous Mode</SettingTitle>
              <SettingDescription>Hide your identity in shared data</SettingDescription>
            </SettingLabel>
            <Toggle 
              $active={settings.anonymousMode}
              onClick={() => updateSetting('anonymousMode', !settings.anonymousMode)}
            />
          </SettingItem>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Data Quality Filter</SettingTitle>
              <SettingDescription>Minimum confidence level for displayed data</SettingDescription>
            </SettingLabel>
            <Select 
              value={settings.dataQualityFilter}
              onChange={(e) => updateSetting('dataQualityFilter', e.target.value)}
            >
              <option value="low">Low - Show all data</option>
              <option value="medium">Medium - Moderate confidence</option>
              <option value="high">High - High confidence only</option>
            </Select>
          </SettingItem>
        </Section>

        {/* Display Settings */}
        <Section>
          <SectionHeader>🖥️ Display & Units</SectionHeader>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Units</SettingTitle>
              <SettingDescription>Distance and depth measurement units</SettingDescription>
            </SettingLabel>
            <Select 
              value={settings.units}
              onChange={(e) => updateSetting('units', e.target.value)}
            >
              <option value="imperial">Imperial (ft, nm)</option>
              <option value="metric">Metric (m, km)</option>
              <option value="nautical">Nautical (fathoms, nm)</option>
            </Select>
          </SettingItem>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Chart Overlay</SettingTitle>
              <SettingDescription>Which charts to display on map</SettingDescription>
            </SettingLabel>
            <Select 
              value={settings.chartOverlay}
              onChange={(e) => updateSetting('chartOverlay', e.target.value)}
            >
              <option value="official">Official Charts Only</option>
              <option value="community">Community Data Only</option>
              <option value="combined">Combined View</option>
            </Select>
          </SettingItem>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Show Confidence</SettingTitle>
              <SettingDescription>Display data confidence indicators</SettingDescription>
            </SettingLabel>
            <Toggle 
              $active={settings.showConfidence}
              onClick={() => updateSetting('showConfidence', !settings.showConfidence)}
            />
          </SettingItem>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Night Mode</SettingTitle>
              <SettingDescription>Red display for night navigation</SettingDescription>
            </SettingLabel>
            <Toggle 
              $active={settings.nightMode}
              onClick={() => updateSetting('nightMode', !settings.nightMode)}
            />
          </SettingItem>
        </Section>

        {/* Navigation Settings */}
        <Section>
          <SectionHeader>🧭 Navigation</SectionHeader>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Route Optimization</SettingTitle>
              <SettingDescription>How to plan your routes</SettingDescription>
            </SettingLabel>
            <Select 
              value={settings.routeOptimization}
              onChange={(e) => updateSetting('routeOptimization', e.target.value)}
            >
              <option value="shortest">Shortest Distance</option>
              <option value="safest">Safest Route</option>
              <option value="balanced">Balanced</option>
              <option value="fastest">Fastest Time</option>
            </Select>
          </SettingItem>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Tide Corrections</SettingTitle>
              <SettingDescription>Apply real-time tide data to depths</SettingDescription>
            </SettingLabel>
            <Toggle 
              $active={settings.tideCorrections}
              onClick={() => updateSetting('tideCorrections', !settings.tideCorrections)}
            />
          </SettingItem>
          
          <SettingItem>
            <SettingLabel>
              <SettingTitle>Offline Sync</SettingTitle>
              <SettingDescription>Download maps for offline use</SettingDescription>
            </SettingLabel>
            <Toggle 
              $active={settings.offlineSync}
              onClick={() => updateSetting('offlineSync', !settings.offlineSync)}
            />
          </SettingItem>
        </Section>

        <Alert $type="warning">
          ⚠️ Remember: Community data should not be used as the sole source for navigation. Always refer to official nautical charts and use proper seamanship.
        </Alert>
      </Content>
    </Container>
  );
};

export default SettingsScreen;