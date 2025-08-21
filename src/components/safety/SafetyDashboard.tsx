/**
 * Safety Dashboard - Comprehensive safety monitoring and controls interface
 * Displays real-time safety status, alerts, compliance, and emergency features
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  RefreshControl,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafetyAlert } from '../../utils/SafetyAlertHierarchy';
import { ValidationResult } from '../../utils/SafetyValidationEngine';
import { ComplianceCheck } from '../../utils/MaritimeComplianceManager';
import { EmergencyIncident } from '../../utils/EmergencyProtocolManager';
import { NavigationStatus } from '../../utils/SafeRouteNavigation';

interface SafetyDashboardProps {
  safetyStatus: {
    currentDepth: number | null;
    safetyMargin: number | null;
    confidence: number;
    dataAge: number;
    alertCount: number;
    complianceStatus: 'compliant' | 'warning' | 'non_compliant';
  };
  activeAlerts: SafetyAlert[];
  navigationStatus: NavigationStatus | null;
  complianceCheck: ComplianceCheck | null;
  emergencyIncidents: EmergencyIncident[];
  onEmergencyReport: () => void;
  onComplianceCheck: () => void;
  onAlertSettings: () => void;
  onViewAlerts: () => void;
  onLocationSharing: () => void;
  onEmergencyContacts: () => void;
  onRefresh: () => Promise<void>;
}

const SafetyDashboard: React.FC<SafetyDashboardProps> = ({
  safetyStatus,
  activeAlerts,
  navigationStatus,
  complianceCheck,
  emergencyIncidents,
  onEmergencyReport,
  onComplianceCheck,
  onAlertSettings,
  onViewAlerts,
  onLocationSharing,
  onEmergencyContacts,
  onRefresh,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [quickActionsExpanded, setQuickActionsExpanded] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const getSafetyStatusColor = () => {
    if (emergencyIncidents.some(i => i.status !== 'resolved')) return '#CC0000';
    if (activeAlerts.some(a => a.severity === 'critical' || a.severity === 'emergency')) return '#FF4444';
    if (activeAlerts.some(a => a.severity === 'warning')) return '#FF8800';
    if (activeAlerts.some(a => a.severity === 'caution')) return '#FFB000';
    return '#00C851';
  };

  const getSafetyStatusText = () => {
    if (emergencyIncidents.some(i => i.status !== 'resolved')) return 'EMERGENCY';
    if (activeAlerts.some(a => a.severity === 'critical' || a.severity === 'emergency')) return 'CRITICAL';
    if (activeAlerts.some(a => a.severity === 'warning')) return 'WARNING';
    if (activeAlerts.some(a => a.severity === 'caution')) return 'CAUTION';
    return 'SAFE';
  };

  const getDepthStatusIcon = () => {
    if (!safetyStatus.currentDepth || !safetyStatus.safetyMargin) return 'help';
    if (safetyStatus.safetyMargin < 1) return 'warning';
    if (safetyStatus.safetyMargin < 2) return 'info';
    return 'check-circle';
  };

  const getDepthStatusColor = () => {
    if (!safetyStatus.currentDepth || !safetyStatus.safetyMargin) return '#666';
    if (safetyStatus.safetyMargin < 1) return '#FF4444';
    if (safetyStatus.safetyMargin < 2) return '#FFB000';
    return '#00C851';
  };

  const getComplianceStatusIcon = () => {
    switch (safetyStatus.complianceStatus) {
      case 'compliant': return 'verified';
      case 'warning': return 'warning';
      case 'non_compliant': return 'error';
      default: return 'help';
    }
  };

  const getComplianceStatusColor = () => {
    switch (safetyStatus.complianceStatus) {
      case 'compliant': return '#00C851';
      case 'warning': return '#FFB000';
      case 'non_compliant': return '#FF4444';
      default: return '#666';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleEmergencyReport = () => {
    Alert.alert(
      'Report Emergency',
      'Select the type of emergency you are experiencing:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Grounding', onPress: () => onEmergencyReport() },
        { text: 'Collision', onPress: () => onEmergencyReport() },
        { text: 'Fire', onPress: () => onEmergencyReport() },
        { text: 'Medical', onPress: () => onEmergencyReport() },
        { text: 'Other Emergency', onPress: () => onEmergencyReport() },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Safety Status Header */}
      <LinearGradient
        colors={[getSafetyStatusColor(), getSafetyStatusColor() + '80']}
        style={styles.statusHeader}
      >
        <View style={styles.statusContent}>
          <MaterialIcons name="security" size={32} color="white" />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>Safety Status</Text>
            <Text style={styles.statusValue}>{getSafetyStatusText()}</Text>
          </View>
          <TouchableOpacity onPress={onViewAlerts} style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{safetyStatus.alertCount}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Emergency Button */}
      <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergencyReport}>
        <LinearGradient
          colors={['#FF0000', '#CC0000']}
          style={styles.emergencyGradient}
        >
          <MaterialIcons name="emergency" size={24} color="white" />
          <Text style={styles.emergencyText}>REPORT EMERGENCY</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Key Metrics */}
      <View style={styles.metricsContainer}>
        <Text style={styles.sectionTitle}>Key Safety Metrics</Text>
        
        <View style={styles.metricsGrid}>
          {/* Depth Safety */}
          <View style={styles.metricCard}>
            <MaterialIcons 
              name={getDepthStatusIcon()} 
              size={24} 
              color={getDepthStatusColor()} 
            />
            <Text style={styles.metricLabel}>Depth Safety</Text>
            <Text style={styles.metricValue}>
              {safetyStatus.currentDepth 
                ? `${safetyStatus.currentDepth.toFixed(1)}m`
                : 'Unknown'
              }
            </Text>
            <Text style={styles.metricSubtext}>
              {safetyStatus.safetyMargin 
                ? `${safetyStatus.safetyMargin.toFixed(1)}m clearance`
                : 'No data'
              }
            </Text>
          </View>

          {/* Data Confidence */}
          <View style={styles.metricCard}>
            <MaterialIcons 
              name="analytics" 
              size={24} 
              color={safetyStatus.confidence > 0.7 ? '#00C851' : '#FFB000'} 
            />
            <Text style={styles.metricLabel}>Data Quality</Text>
            <Text style={styles.metricValue}>
              {(safetyStatus.confidence * 100).toFixed(0)}%
            </Text>
            <Text style={styles.metricSubtext}>
              {formatTimeAgo(Date.now() - safetyStatus.dataAge)}
            </Text>
          </View>

          {/* Compliance Status */}
          <View style={styles.metricCard}>
            <MaterialIcons 
              name={getComplianceStatusIcon()} 
              size={24} 
              color={getComplianceStatusColor()} 
            />
            <Text style={styles.metricLabel}>Compliance</Text>
            <Text style={styles.metricValue}>
              {safetyStatus.complianceStatus.toUpperCase()}
            </Text>
            <TouchableOpacity onPress={onComplianceCheck}>
              <Text style={styles.metricLink}>Check Now</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Status */}
          <View style={styles.metricCard}>
            <MaterialCommunityIcons 
              name="navigation" 
              size={24} 
              color={navigationStatus ? '#00C851' : '#666'} 
            />
            <Text style={styles.metricLabel}>Navigation</Text>
            <Text style={styles.metricValue}>
              {navigationStatus ? 'Active' : 'Inactive'}
            </Text>
            <Text style={styles.metricSubtext}>
              {navigationStatus 
                ? `${(navigationStatus.routeProgress * 100).toFixed(0)}% complete`
                : 'No active route'
              }
            </Text>
          </View>
        </View>
      </View>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <View style={styles.alertsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Alerts</Text>
            <TouchableOpacity onPress={onViewAlerts}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {activeAlerts.slice(0, 3).map((alert) => (
            <View key={alert.id} style={styles.alertItem}>
              <MaterialIcons 
                name={alert.severity === 'emergency' ? 'emergency' : 'warning'} 
                size={20} 
                color={getSeverityColor(alert.severity)} 
              />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertTime}>
                  {formatTimeAgo(alert.timestamp)}
                </Text>
              </View>
              <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(alert.severity) }]}>
                <Text style={styles.severityBadgeText}>
                  {alert.severity.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Emergency Features */}
      <View style={styles.emergencyFeaturesContainer}>
        <Text style={styles.sectionTitle}>Emergency Features</Text>
        
        <View style={styles.emergencyGrid}>
          <TouchableOpacity style={styles.emergencyFeature} onPress={onLocationSharing}>
            <MaterialIcons name="share-location" size={32} color="#007AFF" />
            <Text style={styles.emergencyFeatureText}>Location Sharing</Text>
            <Text style={styles.emergencyFeatureSubtext}>Share with contacts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.emergencyFeature} onPress={onEmergencyContacts}>
            <MaterialIcons name="contact-emergency" size={32} color="#007AFF" />
            <Text style={styles.emergencyFeatureText}>Emergency Contacts</Text>
            <Text style={styles.emergencyFeatureSubtext}>Manage contacts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.emergencyFeature}>
            <MaterialCommunityIcons name="radio" size={32} color="#007AFF" />
            <Text style={styles.emergencyFeatureText}>VHF Channel 16</Text>
            <Text style={styles.emergencyFeatureSubtext}>Coast Guard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.emergencyFeature}>
            <MaterialIcons name="sos" size={32} color="#FF4444" />
            <Text style={styles.emergencyFeatureText}>Mayday Signal</Text>
            <Text style={styles.emergencyFeatureSubtext}>Emergency broadcast</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity 
          style={styles.sectionHeader}
          onPress={() => setQuickActionsExpanded(!quickActionsExpanded)}
        >
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <MaterialIcons 
            name={quickActionsExpanded ? 'expand-less' : 'expand-more'} 
            size={24} 
            color="#666" 
          />
        </TouchableOpacity>

        {quickActionsExpanded && (
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.quickAction} onPress={onAlertSettings}>
              <MaterialIcons name="settings" size={24} color="#666" />
              <Text style={styles.quickActionText}>Alert Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction} onPress={onComplianceCheck}>
              <MaterialIcons name="fact-check" size={24} color="#666" />
              <Text style={styles.quickActionText}>Compliance Check</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction}>
              <MaterialIcons name="speed" size={24} color="#666" />
              <Text style={styles.quickActionText}>Speed Monitor</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction}>
              <MaterialCommunityIcons name="weather-partly-cloudy" size={24} color="#666" />
              <Text style={styles.quickActionText}>Weather Check</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction}>
              <MaterialCommunityIcons name="compass" size={24} color="#666" />
              <Text style={styles.quickActionText}>Navigation Aid</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction}>
              <MaterialIcons name="report" size={24} color="#666" />
              <Text style={styles.quickActionText}>Incident Report</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Safety Tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.sectionTitle}>Safety Reminders</Text>
        <View style={styles.tipItem}>
          <MaterialIcons name="lightbulb" size={20} color="#FFB000" />
          <Text style={styles.tipText}>
            Always verify depth readings with your depth sounder
          </Text>
        </View>
        <View style={styles.tipItem}>
          <MaterialIcons name="lightbulb" size={20} color="#FFB000" />
          <Text style={styles.tipText}>
            Keep emergency contacts updated and easily accessible
          </Text>
        </View>
        <View style={styles.tipItem}>
          <MaterialIcons name="lightbulb" size={20} color="#FFB000" />
          <Text style={styles.tipText}>
            Monitor weather conditions and plan accordingly
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const getSeverityColor = (severity: string) => {
  const colors = {
    info: '#00C851',
    caution: '#FFB000',
    warning: '#FF8800',
    critical: '#FF4444',
    emergency: '#CC0000'
  };
  return colors[severity] || '#00C851';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusHeader: {
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  statusTitle: {
    color: 'white',
    fontSize: 16,
    opacity: 0.8,
  },
  statusValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  alertBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 30,
    alignItems: 'center',
  },
  alertBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emergencyButton: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  emergencyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  emergencyText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  metricsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  metricCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    width: '47%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
    textAlign: 'center',
  },
  metricSubtext: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    textAlign: 'center',
  },
  metricLink: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  alertsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 14,
  },
  alertItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  alertContent: {
    flex: 1,
    marginLeft: 15,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  alertTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  severityBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emergencyFeaturesContainer: {
    padding: 20,
    paddingTop: 0,
  },
  emergencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  emergencyFeature: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    width: '47%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  emergencyFeatureText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  emergencyFeatureSubtext: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  quickActionsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickAction: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    width: '31%',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  quickActionText: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  tipsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    lineHeight: 20,
  },
});

export default SafetyDashboard;