import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.05); opacity: 1; }
`;

const ripple = keyframes`
  0% { transform: scale(0.8); opacity: 0.8; }
  100% { transform: scale(2); opacity: 0; }
`;

const Container = styled.div`
  height: 100%;
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
  color: white;
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="waves" x="0" y="0" width="20" height="10" patternUnits="userSpaceOnUse"><path d="M0 5 Q5 0 10 5 T20 5" stroke="rgba(255,255,255,0.1)" stroke-width="1" fill="none"/></pattern></defs><rect width="100%" height="100%" fill="url(%23waves)"/></svg>');
    opacity: 0.3;
  }
`;

const Content = styled.div`
  flex: 1;
  padding: 1.5rem;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
`;

const InputGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  width: 100%;
  padding: 1rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
  
  background: ${props => props.$variant === 'primary' ? '#3b82f6' : '#e5e7eb'};
  color: ${props => props.$variant === 'primary' ? 'white' : '#374151'};
  
  &:hover {
    background: ${props => props.$variant === 'primary' ? '#2563eb' : '#d1d5db'};
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const StatusIndicator = styled.div<{ $status: 'good' | 'poor' | 'offline' }>`
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  
  background: ${props => {
    switch(props.$status) {
      case 'good': return '#dcfce7';
      case 'poor': return '#fef3c7';
      case 'offline': return '#fee2e2';
      default: return '#f3f4f6';
    }
  }};
  
  color: ${props => {
    switch(props.$status) {
      case 'good': return '#16a34a';
      case 'poor': return '#d97706';
      case 'offline': return '#dc2626';
      default: return '#6b7280';
    }
  }};
`;

const GPSPulse = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #22c55e;
  margin-right: 0.5rem;
  animation: ${pulse} 2s ease-in-out infinite;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    border-radius: 50%;
    background: #22c55e;
    opacity: 0.3;
    animation: ${ripple} 2s ease-out infinite;
  }
`;

const ProgressBar = styled.div<{ $progress: number }>`
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 1rem;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.$progress}%;
    background: linear-gradient(90deg, #3b82f6, #06b6d4);
    transition: width 0.3s ease;
  }
`;

const RecentReports = styled.div`
  max-height: 200px;
  overflow-y: auto;
`;

const ReportItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  
  &:last-child {
    border-bottom: none;
  }
`;

const DepthReportingScreen: React.FC = () => {
  const [depth, setDepth] = useState('');
  const [confidence, setConfidence] = useState('high');
  const [method, setMethod] = useState('sounder');
  const [conditions, setConditions] = useState('good');
  const [gpsAccuracy, setGpsAccuracy] = useState(2.3);
  const [gpsStatus, setGpsStatus] = useState<'good' | 'poor' | 'offline'>('good');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);

  const [recentReports] = useState([
    { depth: '18.5 ft', time: '2 min ago', confidence: 'High' },
    { depth: '22.1 ft', time: '5 min ago', confidence: 'High' },
    { depth: '15.8 ft', time: '8 min ago', confidence: 'Medium' },
    { depth: '19.3 ft', time: '12 min ago', confidence: 'High' },
  ]);

  // Simulate GPS updates
  useEffect(() => {
    const interval = setInterval(() => {
      const accuracy = Math.random() * 5 + 0.5;
      setGpsAccuracy(accuracy);
      
      if (accuracy < 3) setGpsStatus('good');
      else if (accuracy < 6) setGpsStatus('poor');
      else setGpsStatus('offline');
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
    if (!depth) return;
    
    setIsSubmitting(true);
    setSubmissionProgress(0);
    
    // Simulate submission progress
    const progressInterval = setInterval(() => {
      setSubmissionProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setIsSubmitting(false);
          setDepth('');
          return 0;
        }
        return prev + 20;
      });
    }, 300);
  };

  return (
    <Container>
      <Header>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2>📊 Depth Reporting</h2>
          <p style={{ opacity: 0.9, marginTop: '0.5rem' }}>
            Contribute to safer navigation
          </p>
        </div>
      </Header>

      <Content>
        {/* GPS Status */}
        <Card>
          <h3 style={{ marginBottom: '1rem', color: '#0369a1' }}>
            📡 GPS Status
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <StatusIndicator $status={gpsStatus}>
              <GPSPulse />
              GPS {gpsStatus.toUpperCase()}
            </StatusIndicator>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold' }}>±{gpsAccuracy.toFixed(1)}m</div>
              <div style={{ fontSize: '0.8em', color: '#64748b' }}>Accuracy</div>
            </div>
          </div>
        </Card>

        {/* Depth Input */}
        <Card>
          <h3 style={{ marginBottom: '1rem', color: '#0369a1' }}>
            🌊 Record Depth
          </h3>
          
          <InputGroup>
            <Label>Depth Reading</Label>
            <Input
              type="number"
              placeholder="Enter depth in feet"
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              step="0.1"
              min="0"
            />
          </InputGroup>

          <InputGroup>
            <Label>Measurement Method</Label>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="sounder">Depth Sounder</option>
              <option value="leadline">Lead Line</option>
              <option value="chart">Chart Reference</option>
              <option value="visual">Visual Estimate</option>
            </Select>
          </InputGroup>

          <InputGroup>
            <Label>Confidence Level</Label>
            <Select value={confidence} onChange={(e) => setConfidence(e.target.value)}>
              <option value="high">High - Very Accurate</option>
              <option value="medium">Medium - Reasonably Accurate</option>
              <option value="low">Low - Rough Estimate</option>
            </Select>
          </InputGroup>

          <InputGroup>
            <Label>Sea Conditions</Label>
            <Select value={conditions} onChange={(e) => setConditions(e.target.value)}>
              <option value="excellent">Excellent - Calm</option>
              <option value="good">Good - Light Chop</option>
              <option value="moderate">Moderate - Choppy</option>
              <option value="rough">Rough - Heavy Seas</option>
            </Select>
          </InputGroup>

          <Button
            $variant="primary"
            onClick={handleSubmit}
            disabled={!depth || gpsStatus === 'offline' || isSubmitting}
          >
            {isSubmitting ? `Submitting... ${submissionProgress}%` : '🚀 Submit Depth Reading'}
          </Button>
          
          {isSubmitting && <ProgressBar $progress={submissionProgress} />}
        </Card>

        {/* Recent Reports */}
        <Card>
          <h3 style={{ marginBottom: '1rem', color: '#0369a1' }}>
            📋 Recent Reports
          </h3>
          <RecentReports>
            {recentReports.map((report, index) => (
              <ReportItem key={index}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{report.depth}</div>
                  <div style={{ fontSize: '0.8em', color: '#64748b' }}>
                    {report.time}
                  </div>
                </div>
                <StatusIndicator $status={report.confidence === 'High' ? 'good' : 'poor'}>
                  {report.confidence}
                </StatusIndicator>
              </ReportItem>
            ))}
          </RecentReports>
        </Card>

        {/* Stats */}
        <Card>
          <h3 style={{ marginBottom: '1rem', color: '#0369a1' }}>
            📈 Your Contributions
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#3b82f6' }}>
                127
              </div>
              <div style={{ fontSize: '0.9em', color: '#64748b' }}>
                Total Reports
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#22c55e' }}>
                92%
              </div>
              <div style={{ fontSize: '0.9em', color: '#64748b' }}>
                Accuracy Rating
              </div>
            </div>
          </div>
        </Card>
      </Content>
    </Container>
  );
};

export default DepthReportingScreen;