// Social Login Buttons for Marine Authentication
// Adapted from HoneyDo patterns for marine navigation platform

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MarineSocialAuth, SocialProvider, VesselInfo } from '../../auth/marineSocialAuth';

interface SocialLoginButtonsProps {
  onSocialSignIn?: (provider: SocialProvider) => void;
  vesselInfo?: VesselInfo;
  disabled?: boolean;
  showMarineDisclaimer?: boolean;
}

const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({
  onSocialSignIn,
  vesselInfo,
  disabled = false,
  showMarineDisclaimer = true
}) => {

  const handleSocialAuth = async (provider: SocialProvider) => {
    try {
      if (disabled) return;

      // Show marine safety notice for first-time users
      if (showMarineDisclaimer) {
        Alert.alert(
          '🌊 Marine Safety Notice',
          'Waves uses verified accounts to ensure reliable emergency contacts and vessel information for marine safety compliance.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Continue', 
              onPress: () => proceedWithAuth(provider),
              style: 'default'
            }
          ]
        );
      } else {
        await proceedWithAuth(provider);
      }
    } catch (error) {
      console.error(`Error with ${provider.displayName} authentication:`, error);
      Alert.alert(
        'Authentication Error',
        `Unable to connect with ${provider.displayName}. Please try again or contact support.`,
        [{ text: 'OK' }]
      );
    }
  };

  const proceedWithAuth = async (provider: SocialProvider) => {
    try {
      if (onSocialSignIn) {
        onSocialSignIn(provider);
      } else {
        await MarineSocialAuth.signInWithSocial(provider, vesselInfo);
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  };

  const socialProviders: SocialProvider[] = [
    { name: 'google', displayName: 'Google' },
    { name: 'apple', displayName: 'Apple' },
  ];

  return (
    <View style={styles.container}>
      {showMarineDisclaimer && (
        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimerTitle}>🔒 Secure Marine Authentication</Text>
          <Text style={styles.disclaimerText}>
            Your account enables emergency services integration and verified vessel information for safer navigation.
          </Text>
        </View>
      )}

      <View style={styles.buttonsContainer}>
        {socialProviders.map((provider) => (
          <TouchableOpacity
            key={provider.name}
            style={[
              styles.socialButton,
              styles[`${provider.name}Button`],
              disabled && styles.disabledButton
            ]}
            onPress={() => handleSocialAuth(provider)}
            disabled={disabled}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.providerIcon}>
                {getProviderIcon(provider.name)}
              </Text>
              <Text style={styles.buttonText}>
                Continue with {provider.displayName}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.securityNotice}>
        <Text style={styles.securityText}>
          🛡️ Your data is encrypted and protected. We only use your email for account verification and emergency contact purposes.
        </Text>
      </View>

      <View style={styles.marineFeatures}>
        <Text style={styles.featuresTitle}>Marine Platform Features:</Text>
        <Text style={styles.featureItem}>• Emergency contact integration</Text>
        <Text style={styles.featureItem}>• Vessel-specific depth warnings</Text>
        <Text style={styles.featureItem}>• Crowdsourced navigation data</Text>
        <Text style={styles.featureItem}>• Offline emergency capabilities</Text>
      </View>
    </View>
  );
};

const getProviderIcon = (provider: string): string => {
  const icons = {
    google: '🔍',
    apple: '🍎',
    facebook: '📘'
  };
  return icons[provider as keyof typeof icons] || '🔐';
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
  },
  
  disclaimerContainer: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 8,
  },
  
  disclaimerText: {
    fontSize: 14,
    color: '#1565c0',
    lineHeight: 20,
  },
  
  buttonsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  
  socialButton: {
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  googleButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  
  appleButton: {
    backgroundColor: '#000000',
  },
  
  facebookButton: {
    backgroundColor: '#1877f2',
  },
  
  disabledButton: {
    opacity: 0.5,
  },
  
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  
  providerIcon: {
    fontSize: 20,
  },
  
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  
  securityNotice: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  
  securityText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 16,
  },
  
  marineFeatures: {
    backgroundColor: '#e8f5e8',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  
  featuresTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#155724',
    marginBottom: 8,
  },
  
  featureItem: {
    fontSize: 12,
    color: '#155724',
    marginLeft: 8,
    lineHeight: 18,
  },
});

// Add custom button text styles for different providers
const providerStyles = StyleSheet.create({
  googleText: {
    color: '#1f2937',
  },
  appleText: {
    color: '#ffffff',
  },
  facebookText: {
    color: '#ffffff',
  },
});

export default SocialLoginButtons;