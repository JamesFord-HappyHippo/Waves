/**
 * Privacy Consent Modal for Marine Navigation Data
 * Ensures GDPR and maritime privacy compliance
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface PrivacyConsentModalProps {
  visible: boolean;
  onAccept: (consents: PrivacyConsents) => void;
  onDecline: () => void;
  type: 'depthDataSharing' | 'automaticDataSharing' | 'fullConsent';
}

export interface PrivacyConsents {
  depthDataSharing: boolean;
  automaticDataSharing: boolean;
  locationTracking: boolean;
  environmentalData: boolean;
  anonymizedAnalytics: boolean;
  emergencyDataSharing: boolean;
}

const CONSENT_DESCRIPTIONS = {
  depthDataSharing: {
    title: 'Depth Data Sharing',
    description: 'Share depth readings you manually submit to help create a crowdsourced marine navigation database.',
    details: [
      'Your depth readings will be anonymized before storage',
      'GPS coordinates are rounded to protect your privacy',
      'No personal information is attached to depth data',
      'Data helps other mariners navigate safely',
    ],
    required: false,
  },
  automaticDataSharing: {
    title: 'Automatic Data Collection',
    description: 'Allow automatic collection of depth and navigation data while using the app.',
    details: [
      'Collects data only when actively navigating',
      'Includes GPS tracks for route optimization',
      'Environmental conditions for context',
      'Can be disabled at any time in settings',
      'Data is processed locally first for privacy',
    ],
    required: false,
  },
  locationTracking: {
    title: 'Location Services',
    description: 'Access your device location for navigation features.',
    details: [
      'Required for core navigation functionality',
      'Location data is processed locally first',
      'Precise location needed for safety features',
      'Background location for trip tracking',
    ],
    required: true,
  },
  environmentalData: {
    title: 'Environmental Data Integration',
    description: 'Collect weather and tide data to improve navigation accuracy.',
    details: [
      'Weather conditions for route planning',
      'Tide data for depth corrections',
      'Sea state information for safety',
      'Data sourced from public weather services',
    ],
    required: false,
  },
  anonymizedAnalytics: {
    title: 'Anonymized Analytics',
    description: 'Help improve the app through anonymized usage analytics.',
    details: [
      'No personal information collected',
      'App performance and error reporting',
      'Feature usage statistics',
      'Used only for app improvement',
    ],
    required: false,
  },
  emergencyDataSharing: {
    title: 'Emergency Data Sharing',
    description: 'Share location and vessel data in case of emergency situations.',
    details: [
      'Activates only during emergency alerts',
      'Shares precise location with rescue services',
      'Includes vessel information for search and rescue',
      'Can save lives in emergency situations',
    ],
    required: false,
  },
};

export const PrivacyConsentModal: React.FC<PrivacyConsentModalProps> = ({
  visible,
  onAccept,
  onDecline,
  type,
}) => {
  const [consents, setConsents] = useState<PrivacyConsents>({
    depthDataSharing: false,
    automaticDataSharing: false,
    locationTracking: true, // Required for navigation
    environmentalData: true, // Recommended for safety
    anonymizedAnalytics: false,
    emergencyDataSharing: true, // Recommended for safety
  });

  const [showDetails, setShowDetails] = useState<string | null>(null);

  const getModalContent = () => {
    switch (type) {
      case 'depthDataSharing':
        return {
          title: 'Enable Depth Data Sharing?',
          subtitle: 'Help build a safer marine navigation database',
          focusItems: ['depthDataSharing', 'locationTracking'],
        };
      case 'automaticDataSharing':
        return {
          title: 'Enable Automatic Data Collection?',
          subtitle: 'Continuously improve navigation data while you sail',
          focusItems: ['automaticDataSharing', 'locationTracking', 'environmentalData'],
        };
      case 'fullConsent':
        return {
          title: 'Privacy Preferences',
          subtitle: 'Choose how your data is used to enhance marine navigation',
          focusItems: Object.keys(CONSENT_DESCRIPTIONS) as Array<keyof PrivacyConsents>,
        };
      default:
        return {
          title: 'Privacy Settings',
          subtitle: 'Manage your data preferences',
          focusItems: Object.keys(CONSENT_DESCRIPTIONS) as Array<keyof PrivacyConsents>,
        };
    }
  };

  const handleToggleConsent = (key: keyof PrivacyConsents) => {
    setConsents(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAccept = () => {
    onAccept(consents);
  };

  const canProceed = consents.locationTracking; // Location tracking is required

  const { title, subtitle, focusItems } = getModalContent();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Icon name="shield-check" size={32} color="#007AFF" />
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Collection Preferences</Text>
            <Text style={styles.sectionDescription}>
              Your privacy is important to us. Choose which data you're comfortable sharing 
              to help create safer marine navigation for everyone.
            </Text>
          </View>

          {focusItems.map((key) => {
            const config = CONSENT_DESCRIPTIONS[key];
            const isEnabled = consents[key];
            
            return (
              <View key={key} style={styles.consentItem}>
                <View style={styles.consentHeader}>
                  <View style={styles.consentInfo}>
                    <View style={styles.consentTitleRow}>
                      <Text style={styles.consentTitle}>{config.title}</Text>
                      {config.required && (
                        <View style={styles.requiredBadge}>
                          <Text style={styles.requiredText}>Required</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.consentDescription}>{config.description}</Text>
                  </View>
                  
                  <Switch
                    value={isEnabled}
                    onValueChange={() => handleToggleConsent(key)}
                    disabled={config.required}
                    trackColor={{false: '#767577', true: '#81b0ff'}}
                    thumbColor={isEnabled ? '#007AFF' : '#f4f3f4'}
                  />
                </View>

                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={() => setShowDetails(showDetails === key ? null : key)}
                >
                  <Text style={styles.detailsButtonText}>
                    {showDetails === key ? 'Hide Details' : 'Show Details'}
                  </Text>
                  <Icon
                    name={showDetails === key ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#007AFF"
                  />
                </TouchableOpacity>

                {showDetails === key && (
                  <View style={styles.detailsContent}>
                    {config.details.map((detail, index) => (
                      <View key={index} style={styles.detailItem}>
                        <Icon name="circle-small" size={16} color="#8E8E93" />
                        <Text style={styles.detailText}>{detail}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Protection</Text>
            <View style={styles.protectionItem}>
              <Icon name="lock-outline" size={20} color="#34C759" />
              <Text style={styles.protectionText}>
                All data is encrypted in transit and at rest
              </Text>
            </View>
            <View style={styles.protectionItem}>
              <Icon name="map-marker-remove-outline" size={20} color="#34C759" />
              <Text style={styles.protectionText}>
                GPS coordinates are anonymized for privacy
              </Text>
            </View>
            <View style={styles.protectionItem}>
              <Icon name="account-remove-outline" size={20} color="#34C759" />
              <Text style={styles.protectionText}>
                No personal information is stored with navigation data
              </Text>
            </View>
            <View style={styles.protectionItem}>
              <Icon name="delete-outline" size={20} color="#34C759" />
              <Text style={styles.protectionText}>
                You can delete your data at any time
              </Text>
            </View>
          </View>

          <View style={styles.legalSection}>
            <Text style={styles.legalText}>
              By continuing, you agree to our{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text> and{' '}
              <Text style={styles.legalLink}>Terms of Service</Text>.
              You can change these preferences at any time in Settings.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={onDecline}
          >
            <Text style={styles.declineButtonText}>Not Now</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.acceptButton, !canProceed && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={!canProceed}
          >
            <Text style={styles.acceptButtonText}>
              {type === 'fullConsent' ? 'Save Preferences' : 'Enable & Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 15,
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 25,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  consentItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  consentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  consentInfo: {
    flex: 1,
    marginRight: 15,
  },
  consentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  consentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginRight: 10,
  },
  requiredBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  requiredText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  consentDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  detailsButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginRight: 5,
  },
  detailsContent: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#8E8E93',
    flex: 1,
    lineHeight: 18,
    marginLeft: 5,
  },
  protectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  protectionText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginLeft: 10,
  },
  legalSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    marginBottom: 30,
  },
  legalText: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
    textAlign: 'center',
  },
  legalLink: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 15,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  acceptButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});