import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

const Container = styled.div`
  height: 100%;
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
  overflow-y: auto;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  color: white;
  padding: 2rem 1.5rem;
  text-align: center;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.1)"/></svg>');
    animation: ${shimmer} 3s ease-in-out infinite;
  }
`;

const Avatar = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  border: 4px solid rgba(255, 255, 255, 0.3);
  position: relative;
  z-index: 1;
`;

const Content = styled.div`
  padding: 1rem;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const StatCard = styled.div`
  text-align: center;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
`;

const StatNumber = styled.div`
  font-size: 1.75rem;
  font-weight: bold;
  color: #059669;
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
`;

const VesselCard = styled.div`
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  border: 2px solid #0ea5e9;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
`;

const VesselInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Badge = styled.div<{ $color: string }>`
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => props.$color};
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ProgressBar = styled.div<{ $progress: number; $color: string }>`
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 0.5rem;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.$progress}%;
    background: ${props => props.$color};
    transition: width 0.3s ease;
  }
`;

const AchievementGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
`;

const AchievementCard = styled.div<{ $earned: boolean }>`
  padding: 1rem;
  text-align: center;
  border-radius: 8px;
  background: ${props => props.$earned ? '#dcfce7' : '#f9fafb'};
  border: 2px solid ${props => props.$earned ? '#22c55e' : '#e5e7eb'};
  opacity: ${props => props.$earned ? 1 : 0.6};
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const RecentActivity = styled.div`
  max-height: 200px;
  overflow-y: auto;
`;

const ActivityItem = styled.div`
  display: flex;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f1f5f9;
  
  &:last-child {
    border-bottom: none;
  }
`;

const ActivityIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e0f2fe;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 0.75rem;
  font-size: 1.25rem;
`;

const ProfileScreen: React.FC = () => {
  const [userData] = useState({
    name: 'Captain Sarah',
    joinDate: 'March 2024',
    totalReports: 127,
    accuracyRating: 92,
    areasExplored: 8,
    milesNavigated: 1247,
    level: 'Navigator',
    nextLevel: 'Master Mariner',
    levelProgress: 68
  });

  const [vesselData] = useState({
    name: 'Serenity',
    type: 'Sport Fishing',
    length: 32,
    draft: 3.2,
    beam: 11.5,
    year: 2019
  });

  const [achievements] = useState([
    { id: 1, icon: '🎯', name: 'First Report', earned: true },
    { id: 2, icon: '💯', name: '100 Reports', earned: true },
    { id: 3, icon: '🌊', name: 'Deep Explorer', earned: true },
    { id: 4, icon: '📍', name: 'Precise Navigator', earned: true },
    { id: 5, icon: '⭐', name: 'Top Contributor', earned: false },
    { id: 6, icon: '🏆', name: 'Safety Champion', earned: false }
  ]);

  const [recentActivity] = useState([
    { icon: '📊', text: 'Reported depth reading: 18.5ft', time: '2 hours ago' },
    { icon: '🗺️', text: 'Explored new area: Biscayne Bay', time: '1 day ago' },
    { icon: '✅', text: 'Verified community depth reading', time: '2 days ago' },
    { icon: '📈', text: 'Accuracy rating improved to 92%', time: '1 week ago' },
    { icon: '🎯', text: 'Achieved 100+ contributions milestone', time: '2 weeks ago' }
  ]);

  return (
    <Container>
      <Header>
        <Avatar>SC</Avatar>
        <h2 style={{ position: 'relative', zIndex: 1 }}>{userData.name}</h2>
        <p style={{ opacity: 0.9, position: 'relative', zIndex: 1 }}>
          Member since {userData.joinDate}
        </p>
        <div style={{ marginTop: '1rem', position: 'relative', zIndex: 1 }}>
          <Badge $color="#059669">{userData.level}</Badge>
        </div>
      </Header>

      <Content>
        {/* Stats Overview */}
        <Card>
          <h3 style={{ marginBottom: '1rem', color: '#0369a1' }}>
            📈 Navigation Statistics
          </h3>
          <StatGrid>
            <StatCard>
              <StatNumber>{userData.totalReports}</StatNumber>
              <StatLabel>Depth Reports</StatLabel>
            </StatCard>
            <StatCard>
              <StatNumber>{userData.accuracyRating}%</StatNumber>
              <StatLabel>Accuracy Rating</StatLabel>
            </StatCard>
            <StatCard>
              <StatNumber>{userData.areasExplored}</StatNumber>
              <StatLabel>Areas Explored</StatLabel>
            </StatCard>
            <StatCard>
              <StatNumber>{userData.milesNavigated}</StatNumber>
              <StatLabel>Miles Navigated</StatLabel>
            </StatCard>
          </StatGrid>
          
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>Progress to {userData.nextLevel}</span>
              <span style={{ color: '#64748b' }}>{userData.levelProgress}%</span>
            </div>
            <ProgressBar $progress={userData.levelProgress} $color="#059669" />
          </div>
        </Card>

        {/* Vessel Information */}
        <VesselCard>
          <h3 style={{ marginBottom: '1rem', color: '#0369a1', display: 'flex', alignItems: 'center' }}>
            ⛵ {vesselData.name}
            <Badge $color="#0ea5e9" style={{ marginLeft: 'auto' }}>
              {vesselData.type}
            </Badge>
          </h3>
          
          <VesselInfo>
            <span>Length:</span>
            <strong>{vesselData.length} ft</strong>
          </VesselInfo>
          <VesselInfo>
            <span>Draft:</span>
            <strong>{vesselData.draft} ft</strong>
          </VesselInfo>
          <VesselInfo>
            <span>Beam:</span>
            <strong>{vesselData.beam} ft</strong>
          </VesselInfo>
          <VesselInfo>
            <span>Year:</span>
            <strong>{vesselData.year}</strong>
          </VesselInfo>
        </VesselCard>

        {/* Achievements */}
        <Card>
          <h3 style={{ marginBottom: '1rem', color: '#0369a1' }}>
            🏆 Achievements
          </h3>
          <AchievementGrid>
            {achievements.map(achievement => (
              <AchievementCard key={achievement.id} $earned={achievement.earned}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                  {achievement.icon}
                </div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 600,
                  color: achievement.earned ? '#166534' : '#64748b'
                }}>
                  {achievement.name}
                </div>
              </AchievementCard>
            ))}
          </AchievementGrid>
        </Card>

        {/* Recent Activity */}
        <Card>
          <h3 style={{ marginBottom: '1rem', color: '#0369a1' }}>
            📋 Recent Activity
          </h3>
          <RecentActivity>
            {recentActivity.map((activity, index) => (
              <ActivityItem key={index}>
                <ActivityIcon>{activity.icon}</ActivityIcon>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                    {activity.text}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {activity.time}
                  </div>
                </div>
              </ActivityItem>
            ))}
          </RecentActivity>
        </Card>

        {/* Community Impact */}
        <Card>
          <h3 style={{ marginBottom: '1rem', color: '#0369a1' }}>
            🌊 Community Impact
          </h3>
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎯</div>
            <p style={{ color: '#64748b', lineHeight: 1.6 }}>
              Your contributions have helped make waters safer for{' '}
              <strong style={{ color: '#059669' }}>2,847 fellow boaters</strong> this month.
              Thank you for being part of the Waves community!
            </p>
          </div>
        </Card>
      </Content>
    </Container>
  );
};

export default ProfileScreen;