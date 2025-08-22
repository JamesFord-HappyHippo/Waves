// Marine Registration Component
// Multi-step registration flow with vessel and emergency contact information

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput } from 'react-native';
import { MarineSocialAuth, VesselInfo, EmergencyContact, SocialProvider } from '../../auth/marineSocialAuth';
import SocialLoginButtons from './SocialLoginButtons';

interface MarineRegistrationProps {
  onRegistrationComplete?: (user: any) => void;
  initialStep?: 'welcome' | 'vessel' | 'emergency' | 'auth';
}

type RegistrationStep = 'welcome' | 'vessel' | 'emergency' | 'auth' | 'processing' | 'complete';

const MarineRegistration: React.FC<MarineRegistrationProps> = ({
  onRegistrationComplete,
  initialStep = 'welcome'
}) => {
  const [currentStep, setCurrentStep] = useState<RegistrationStep>(initialStep);
  const [vesselInfo, setVesselInfo] = useState<VesselInfo>({
    name: '',
    draftFeet: 0,
    lengthFeet: 0,
    beamFeet: 0,
    vesselType: 'recreational',
    emergencyContacts: [{
      name: '',
      phone: '',
      relationship: 'spouse'
    }]
  });
  
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Check if we're returning from auth callback
    if (MarineSocialAuth.checkSocialRedirect()) {
      setCurrentStep('processing');
      handleAuthCallback();
    }
  }, []);

  const handleAuthCallback = async () => {
    try {
      setIsProcessing(true);
      const result = await MarineSocialAuth.handleMarineAuthCallback();
      
      if (result.success && result.user) {
        setCurrentStep('complete');
        if (onRegistrationComplete) {
          onRegistrationComplete(result.user);
        }
      } else {
        Alert.alert(
          'Authentication Failed',
          result.error || 'Unable to complete registration. Please try again.',
          [{ text: 'OK', onPress: () => setCurrentStep('auth') }]
        );
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      Alert.alert(
        'Registration Error',
        'An error occurred during registration. Please try again.',
        [{ text: 'OK', onPress: () => setCurrentStep('auth') }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSocialSignIn = async (provider: SocialProvider) => {
    try {
      setIsProcessing(true);
      await MarineSocialAuth.signInWithSocial(provider, vesselInfo);
    } catch (error) {
      console.error('Social sign-in error:', error);
      Alert.alert(
        'Authentication Error',
        'Unable to start authentication. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const validateVesselInfo = (): boolean => {
    if (!vesselInfo.name.trim()) {
      Alert.alert('Vessel Information Required', 'Please enter your vessel name.');
      return false;
    }
    if (vesselInfo.draftFeet <= 0) {
      Alert.alert('Draft Required', 'Please enter your vessel\'s maximum draft in feet.');
      return false;
    }
    return true;
  };

  const validateEmergencyContact = (): boolean => {
    const contact = vesselInfo.emergencyContacts[0];
    if (!contact.name.trim()) {
      Alert.alert('Emergency Contact Required', 'Please enter an emergency contact name.');
      return false;
    }
    if (!contact.phone.trim()) {
      Alert.alert('Phone Number Required', 'Please enter an emergency contact phone number.');
      return false;
    }
    // Basic phone validation
    if (!/^\+?[\d\s\-\(\)]+$/.test(contact.phone)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number.');
      return false;
    }
    return true;
  };

  const addEmergencyContact = () => {
    if (vesselInfo.emergencyContacts.length < 3) {
      setVesselInfo({
        ...vesselInfo,
        emergencyContacts: [...vesselInfo.emergencyContacts, {
          name: '',
          phone: '',
          relationship: 'friend'
        }]
      });
    }
  };

  const removeEmergencyContact = (index: number) => {
    if (vesselInfo.emergencyContacts.length > 1) {
      const newContacts = vesselInfo.emergencyContacts.filter((_, i) => i !== index);
      setVesselInfo({ ...vesselInfo, emergencyContacts: newContacts });
    }
  };

  const updateEmergencyContact = (index: number, field: keyof EmergencyContact, value: string) => {
    const newContacts = [...vesselInfo.emergencyContacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setVesselInfo({ ...vesselInfo, emergencyContacts: newContacts });
  };

  const renderWelcomeStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerSection}>
        <Text style={styles.appTitle}>🌊 Welcome to Waves</Text>
        <Text style={styles.subtitle}>Safe Boating Through Community Intelligence</Text>
      </View>

      <View style={styles.benefitsSection}>
        <Text style={styles.sectionTitle}>Join the Marine Community</Text>
        <View style={styles.benefitsList}>
          <Text style={styles.benefitItem}>📍 Crowdsourced depth data for safer navigation</Text>
          <Text style={styles.benefitItem}>🚨 Emergency contact integration</Text>
          <Text style={styles.benefitItem}>⚓ Vessel-specific depth warnings</Text>
          <Text style={styles.benefitItem}>📱 Works offline for emergency situations</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setCurrentStep('vessel')}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>

      <Text style={styles.privacyNote}>
        Your data is kept private and secure. We only share anonymous depth data to improve marine safety for everyone.
      </Text>
    </View>
  );

  const renderVesselInfoStep = () => (
    <ScrollView style={styles.stepContainer}>
      <Text style={styles.stepTitle}>⛵ Vessel Information</Text>
      <Text style={styles.stepDescription}>
        This information helps provide accurate depth guidance and enables emergency services integration.
      </Text>

      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>Vessel Name *</Text>
        <TextInput
          style={styles.textInput}
          value={vesselInfo.name}
          onChangeText={(text) => setVesselInfo({ ...vesselInfo, name: text })}
          placeholder="e.g., 'Sea Breeze'"
          autoCapitalize="words"
        />

        <Text style={styles.fieldLabel}>Vessel Type</Text>
        <View style={styles.typeSelector}>
          {['recreational', 'fishing', 'sailing', 'commercial'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeOption,
                vesselInfo.vesselType === type && styles.typeOptionSelected
              ]}
              onPress={() => setVesselInfo({ ...vesselInfo, vesselType: type })}
            >
              <Text style={[
                styles.typeOptionText,
                vesselInfo.vesselType === type && styles.typeOptionTextSelected
              ]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Maximum Draft (feet) *</Text>
        <TextInput
          style={styles.textInput}
          value={vesselInfo.draftFeet ? vesselInfo.draftFeet.toString() : ''}
          onChangeText={(text) => setVesselInfo({ ...vesselInfo, draftFeet: parseFloat(text) || 0 })}
          placeholder="e.g., 3.5"
          keyboardType="decimal-pad"
        />
        <Text style={styles.fieldHelp}>This helps filter depth warnings relevant to your vessel</Text>

        <Text style={styles.fieldLabel}>Length (feet)</Text>
        <TextInput
          style={styles.textInput}
          value={vesselInfo.lengthFeet ? vesselInfo.lengthFeet.toString() : ''}
          onChangeText={(text) => setVesselInfo({ ...vesselInfo, lengthFeet: parseFloat(text) || 0 })}
          placeholder="e.g., 25"
          keyboardType="decimal-pad"
        />

        <Text style={styles.fieldLabel}>Beam (feet)</Text>
        <TextInput
          style={styles.textInput}
          value={vesselInfo.beamFeet ? vesselInfo.beamFeet.toString() : ''}
          onChangeText={(text) => setVesselInfo({ ...vesselInfo, beamFeet: parseFloat(text) || 0 })}
          placeholder="e.g., 8.5"
          keyboardType="decimal-pad"
        />
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          if (validateVesselInfo()) {
            setCurrentStep('emergency');
          }
        }}
      >
        <Text style={styles.buttonText}>Continue to Emergency Contacts</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderEmergencyContactStep = () => (
    <ScrollView style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🚨 Emergency Contacts</Text>
      <View style={styles.safetyNotice}>
        <Text style={styles.safetyNoticeTitle}>Marine Safety Requirement</Text>
        <Text style={styles.safetyNoticeText}>
          Emergency contact information enables integration with marine rescue services and Coast Guard if needed.
        </Text>
      </View>

      <View style={styles.formSection}>
        {vesselInfo.emergencyContacts.map((contact, index) => (
          <View key={index} style={styles.contactContainer}>
            <View style={styles.contactHeader}>
              <Text style={styles.contactTitle}>
                {index === 0 ? 'Primary Contact' : `Contact ${index + 1}`}
              </Text>
              {vesselInfo.emergencyContacts.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeEmergencyContact(index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput
              style={styles.textInput}
              value={contact.name}
              onChangeText={(text) => updateEmergencyContact(index, 'name', text)}
              placeholder="Enter full name"
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Phone Number *</Text>
            <TextInput
              style={styles.textInput}
              value={contact.phone}
              onChangeText={(text) => updateEmergencyContact(index, 'phone', text)}
              placeholder="+1 (555) 123-4567"
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>Relationship</Text>
            <View style={styles.relationshipSelector}>
              {['spouse', 'family', 'friend', 'crew', 'marina'].map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[
                    styles.relationshipOption,
                    contact.relationship === rel && styles.relationshipOptionSelected
                  ]}
                  onPress={() => updateEmergencyContact(index, 'relationship', rel)}
                >
                  <Text style={[
                    styles.relationshipOptionText,
                    contact.relationship === rel && styles.relationshipOptionTextSelected
                  ]}>
                    {rel.charAt(0).toUpperCase() + rel.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {vesselInfo.emergencyContacts.length < 3 && (
          <TouchableOpacity style={styles.addContactButton} onPress={addEmergencyContact}>
            <Text style={styles.addContactText}>+ Add Another Contact</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          if (validateEmergencyContact()) {
            setCurrentStep('auth');
          }
        }}
      >
        <Text style={styles.buttonText}>Continue to Account Creation</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderAuthStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🔐 Create Your Account</Text>
      <Text style={styles.stepDescription}>
        Complete registration with a secure social login to verify your identity for marine safety compliance.
      </Text>

      <SocialLoginButtons
        onSocialSignIn={handleSocialSignIn}
        vesselInfo={vesselInfo}
        disabled={isProcessing}
        showMarineDisclaimer={true}
      />

      <View style={styles.summarySection}>
        <Text style={styles.summaryTitle}>Registration Summary:</Text>
        <Text style={styles.summaryItem}>🚢 Vessel: {vesselInfo.name}</Text>
        <Text style={styles.summaryItem}>📏 Draft: {vesselInfo.draftFeet} ft</Text>
        <Text style={styles.summaryItem}>
          📞 Emergency Contacts: {vesselInfo.emergencyContacts.length}
        </Text>
      </View>
    </View>
  );

  const renderProcessingStep = () => (
    <View style={[styles.stepContainer, styles.centeredContainer]}>
      <Text style={styles.processingTitle}>🔄 Creating Your Account...</Text>
      <Text style={styles.processingText}>
        Verifying your identity and setting up your marine profile.
      </Text>
      <Text style={styles.processingSubtext}>This may take a moment.</Text>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={[styles.stepContainer, styles.centeredContainer]}>
      <Text style={styles.successTitle}>🎉 Welcome to Waves!</Text>
      <Text style={styles.successText}>
        Your marine navigation account has been created successfully.
      </Text>
      
      <View style={styles.nextSteps}>
        <Text style={styles.nextStepsTitle}>What's next:</Text>
        <Text style={styles.nextStepsItem}>✅ Verify your emergency contacts</Text>
        <Text style={styles.nextStepsItem}>🗺️ Start exploring marine data</Text>
        <Text style={styles.nextStepsItem}>📊 Contribute depth readings</Text>
        <Text style={styles.nextStepsItem}>⚓ Access safety features</Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          if (onRegistrationComplete) {
            onRegistrationComplete({});
          }
        }}
      >
        <Text style={styles.buttonText}>Enter Waves</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return renderWelcomeStep();
      case 'vessel':
        return renderVesselInfoStep();
      case 'emergency':
        return renderEmergencyContactStep();
      case 'auth':
        return renderAuthStep();
      case 'processing':
        return renderProcessingStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderWelcomeStep();
    }
  };

  return (
    <View style={styles.container}>
      {currentStep !== 'welcome' && currentStep !== 'processing' && currentStep !== 'complete' && (
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: getProgressWidth(currentStep) }
            ]} 
          />
        </View>
      )}
      {renderCurrentStep()}
    </View>
  );
};

const getProgressWidth = (step: RegistrationStep): string => {
  const progress = {
    welcome: '0%',
    vessel: '33%',
    emergency: '66%',
    auth: '100%',
    processing: '100%',
    complete: '100%'
  };
  return progress[step] || '0%';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    position: 'relative',
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: '#0ea5e9',
    borderRadius: 2,
  },
  
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  
  centeredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  headerSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0ea5e9',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  
  stepDescription: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
    lineHeight: 22,
  },
  
  benefitsSection: {
    marginBottom: 30,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  
  benefitsList: {
    gap: 12,
  },
  
  benefitItem: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  
  formSection: {
    marginBottom: 30,
  },
  
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  
  fieldHelp: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  
  typeOption: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  
  typeOptionSelected: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  
  typeOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  
  typeOptionTextSelected: {
    color: '#ffffff',
  },
  
  safetyNotice: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  
  safetyNoticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
  },
  
  safetyNoticeText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  
  contactContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
  },
  
  removeButtonText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  
  relationshipSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  
  relationshipOption: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  
  relationshipOptionSelected: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  
  relationshipOptionText: {
    fontSize: 12,
    color: '#374151',
  },
  
  relationshipOptionTextSelected: {
    color: '#ffffff',
  },
  
  addContactButton: {
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0ea5e9',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  
  addContactText: {
    fontSize: 16,
    color: '#0ea5e9',
    fontWeight: '500',
  },
  
  summarySection: {
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  
  summaryItem: {
    fontSize: 14,
    color: '#0c4a6e',
    lineHeight: 20,
  },
  
  primaryButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  
  privacyNote: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  
  processingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  
  processingText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  
  processingSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 16,
    textAlign: 'center',
  },
  
  successText: {
    fontSize: 18,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 24,
  },
  
  nextSteps: {
    backgroundColor: '#ecfdf5',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 12,
  },
  
  nextStepsItem: {
    fontSize: 14,
    color: '#065f46',
    lineHeight: 22,
    marginLeft: 8,
  },
});

export default MarineRegistration;