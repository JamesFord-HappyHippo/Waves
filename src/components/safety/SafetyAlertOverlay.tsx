/**
 * Safety Alert Overlay - React Native component for displaying safety alerts with audio/visual feedback
 * Handles emergency alerts, grounding warnings, and navigation safety notifications
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { SafetyAlert } from '../../utils/SafetyAlertHierarchy';

interface SafetyAlertOverlayProps {
  alerts: SafetyAlert[];
  onAlertAcknowledge: (alertId: string) => void;
  onAlertDismiss: (alertId: string) => void;
  onEmergencyAction: (actionId: string, alertId: string) => void;
  testMode?: boolean;
}

interface AlertAudioConfig {
  soundFile: string;
  loop: boolean;
  volume: number;
}

const ALERT_SOUNDS: Record<string, AlertAudioConfig> = {
  info: { soundFile: 'notification.mp3', loop: false, volume: 0.3 },
  caution: { soundFile: 'caution.mp3', loop: false, volume: 0.5 },
  warning: { soundFile: 'warning.mp3', loop: true, volume: 0.7 },
  critical: { soundFile: 'critical.mp3', loop: true, volume: 0.9 },
  emergency: { soundFile: 'emergency.mp3', loop: true, volume: 1.0 }
};

const HAPTIC_PATTERNS: Record<string, Haptics.ImpactFeedbackStyle[]> = {
  info: [Haptics.ImpactFeedbackStyle.Light],
  caution: [Haptics.ImpactFeedbackStyle.Medium],
  warning: [Haptics.ImpactFeedbackStyle.Heavy, Haptics.ImpactFeedbackStyle.Medium],
  critical: [Haptics.ImpactFeedbackStyle.Heavy, Haptics.ImpactFeedbackStyle.Heavy, Haptics.ImpactFeedbackStyle.Heavy],
  emergency: [Haptics.ImpactFeedbackStyle.Heavy, Haptics.ImpactFeedbackStyle.Heavy, Haptics.ImpactFeedbackStyle.Heavy, Haptics.ImpactFeedbackStyle.Heavy]
};

const SafetyAlertOverlay: React.FC<SafetyAlertOverlayProps> = ({
  alerts,
  onAlertAcknowledge,
  onAlertDismiss,
  onEmergencyAction,
  testMode = false
}) => {
  const [currentAlert, setCurrentAlert] = useState<SafetyAlert | null>(null);
  const [alertQueue, setAlertQueue] = useState<SafetyAlert[]>([]);
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const flashAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const hapticIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update alert queue when alerts prop changes
  useEffect(() => {
    const activeAlerts = alerts.filter(alert => 
      !alert.metadata?.acknowledgedAt && !alert.metadata?.dismissedAt
    );
    
    setAlertQueue(activeAlerts);
    
    // Show highest priority alert
    if (activeAlerts.length > 0 && !currentAlert) {
      showNextAlert(activeAlerts);
    }
  }, [alerts, currentAlert]);

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      stopAudio();
      stopHaptics();
    };
  }, []);

  const showNextAlert = (availableAlerts: SafetyAlert[]) => {
    if (availableAlerts.length === 0) {
      setCurrentAlert(null);
      return;
    }

    // Sort by priority (emergency > critical > warning > caution > info)
    const sortedAlerts = [...availableAlerts].sort((a, b) => {
      const priorityOrder = { emergency: 5, critical: 4, warning: 3, caution: 2, info: 1 };
      return priorityOrder[b.severity] - priorityOrder[a.severity];
    });

    const nextAlert = sortedAlerts[0];
    setCurrentAlert(nextAlert);
    startAlertPresentation(nextAlert);
  };

  const startAlertPresentation = (alert: SafetyAlert) => {
    // Start visual animations
    startVisualAlerts(alert);
    
    // Start audio alerts
    if (alert.audioAlert.enabled && !testMode) {
      startAudio(alert);
    }
    
    // Start haptic feedback
    if (alert.hapticAlert.enabled && !testMode) {
      startHaptics(alert);
    }
    
    // Auto-dismiss for non-critical alerts
    if (alert.autoExpiry && alert.severity !== 'emergency' && alert.severity !== 'critical') {
      setTimeout(() => {
        handleAlertDismiss(alert.id);
      }, alert.autoExpiry * 1000);
    }
  };

  const startVisualAlerts = (alert: SafetyAlert) => {
    // Fade in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: alert.visualAlert.opacity,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();

    // Handle animations based on type
    switch (alert.visualAlert.animation) {
      case 'flash':
        startFlashAnimation();
        break;
      case 'pulse':
        startPulseAnimation();
        break;
      case 'bounce':
        startBounceAnimation();
        break;
    }

    // Emergency shake for critical alerts
    if (alert.severity === 'emergency' || alert.severity === 'critical') {
      startShakeAnimation();
    }
  };

  const startFlashAnimation = () => {
    const flash = () => {
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 0.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start(() => {
        if (currentAlert && (currentAlert.severity === 'critical' || currentAlert.severity === 'emergency')) {
          setTimeout(flash, 300);
        }
      });
    };
    flash();
  };

  const startPulseAnimation = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        })
      ]).start(() => {
        if (currentAlert && currentAlert.visualAlert.animation === 'pulse') {
          pulse();
        }
      });
    };
    pulse();
  };

  const startBounceAnimation = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      })
    ]).start();
  };

  const startShakeAnimation = () => {
    const shake = () => {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
      ]).start(() => {
        if (currentAlert && (currentAlert.severity === 'emergency')) {
          setTimeout(shake, 2000);
        }
      });
    };
    shake();
  };

  const startAudio = async (alert: SafetyAlert) => {
    try {
      const audioConfig = ALERT_SOUNDS[alert.severity];
      if (!audioConfig) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: `asset:///sounds/${audioConfig.soundFile}` },
        { shouldPlay: true, volume: audioConfig.volume, isLooping: audioConfig.loop }
      );

      setSoundObject(sound);
      setIsPlaying(true);

      // For non-looping sounds, handle intervals
      if (!audioConfig.loop && alert.audioAlert.frequency === 'repeating' && alert.audioAlert.interval) {
        audioIntervalRef.current = setInterval(async () => {
          try {
            await sound.replayAsync();
          } catch (error) {
            console.error('Error replaying sound:', error);
          }
        }, alert.audioAlert.interval * 1000);
      }

      // Auto-stop audio after duration
      if (alert.audioAlert.duration) {
        setTimeout(() => {
          stopAudio();
        }, alert.audioAlert.duration * 1000);
      }

    } catch (error) {
      console.error('Error playing alert sound:', error);
    }
  };

  const stopAudio = async () => {
    if (soundObject) {
      try {
        await soundObject.stopAsync();
        await soundObject.unloadAsync();
      } catch (error) {
        console.error('Error stopping sound:', error);
      }
      setSoundObject(null);
      setIsPlaying(false);
    }

    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
  };

  const startHaptics = (alert: SafetyAlert) => {
    const pattern = HAPTIC_PATTERNS[alert.severity];
    if (!pattern) return;

    const triggerHaptic = async () => {
      for (const feedback of pattern) {
        await Haptics.impactAsync(feedback);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };

    // Initial haptic
    triggerHaptic();

    // Repeating haptics for critical alerts
    if (alert.hapticAlert.repeats > 1 && alert.hapticAlert.interval) {
      let repeatCount = 0;
      hapticIntervalRef.current = setInterval(() => {
        if (repeatCount < alert.hapticAlert.repeats - 1) {
          triggerHaptic();
          repeatCount++;
        } else {
          stopHaptics();
        }
      }, alert.hapticAlert.interval);
    }
  };

  const stopHaptics = () => {
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
  };

  const handleAlertAcknowledge = (alertId: string) => {
    stopAudio();
    stopHaptics();
    onAlertAcknowledge(alertId);
    
    // Hide current alert and show next
    hideCurrentAlert();
    
    const remainingAlerts = alertQueue.filter(alert => alert.id !== alertId);
    setAlertQueue(remainingAlerts);
    setTimeout(() => showNextAlert(remainingAlerts), 300);
  };

  const handleAlertDismiss = (alertId: string) => {
    if (!currentAlert?.dismissible) return;
    
    stopAudio();
    stopHaptics();
    onAlertDismiss(alertId);
    
    hideCurrentAlert();
    
    const remainingAlerts = alertQueue.filter(alert => alert.id !== alertId);
    setAlertQueue(remainingAlerts);
    setTimeout(() => showNextAlert(remainingAlerts), 300);
  };

  const hideCurrentAlert = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      setCurrentAlert(null);
    });
  };

  const handleEmergencyAction = (actionId: string) => {
    if (!currentAlert) return;
    
    const action = currentAlert.actionItems.find(a => a.id === actionId);
    if (!action) return;

    if (action.confirmationRequired) {
      Alert.alert(
        'Confirm Emergency Action',
        `Are you sure you want to ${action.label}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Confirm', 
            style: 'destructive',
            onPress: () => onEmergencyAction(actionId, currentAlert.id)
          }
        ]
      );
    } else {
      onEmergencyAction(actionId, currentAlert.id);
    }
  };

  const getSeverityIcon = (severity: string) => {
    const icons = {
      info: 'info',
      caution: 'warning',
      warning: 'report-problem',
      critical: 'error',
      emergency: 'emergency'
    };
    return icons[severity] || 'info';
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

  if (!currentAlert) return null;

  const { width, height } = Dimensions.get('window');
  const isFullScreen = currentAlert.visualAlert.fullScreen;
  const isOverlay = currentAlert.visualAlert.overlay;

  return (
    <Modal
      visible={true}
      transparent={!isFullScreen}
      animationType="none"
      statusBarTranslucent={isFullScreen}
    >
      {isFullScreen && <StatusBar backgroundColor={getSeverityColor(currentAlert.severity)} />}
      
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: isFullScreen ? getSeverityColor(currentAlert.severity) : 'rgba(0,0,0,0.8)',
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateX: shakeAnim }
            ]
          }
        ]}
      >
        <Animated.View
          style={[
            styles.alertBox,
            {
              opacity: flashAnim,
              backgroundColor: getSeverityColor(currentAlert.severity),
              width: isFullScreen ? width : width * 0.9,
              maxHeight: isFullScreen ? height : height * 0.8,
              borderRadius: isFullScreen ? 0 : 12,
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <MaterialIcons 
              name={getSeverityIcon(currentAlert.severity)} 
              size={32} 
              color="white" 
            />
            <Text style={styles.severityText}>
              {currentAlert.severity.toUpperCase()}
            </Text>
            {currentAlert.timeToImpact && (
              <Text style={styles.timeToImpact}>
                {Math.floor(currentAlert.timeToImpact / 60)}:{(currentAlert.timeToImpact % 60).toString().padStart(2, '0')}
              </Text>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{currentAlert.title}</Text>

          {/* Message */}
          <Text style={styles.message}>{currentAlert.message}</Text>

          {/* Location */}
          <Text style={styles.location}>
            {currentAlert.location.latitude.toFixed(4)}, {currentAlert.location.longitude.toFixed(4)}
          </Text>

          {/* Emergency Actions */}
          {currentAlert.actionItems.filter(action => action.emergencyAction).length > 0 && (
            <View style={styles.emergencyActions}>
              <Text style={styles.actionsTitle}>Emergency Actions:</Text>
              {currentAlert.actionItems
                .filter(action => action.emergencyAction)
                .slice(0, 2) // Limit to 2 emergency actions
                .map(action => (
                  <TouchableOpacity
                    key={action.id}
                    style={[styles.emergencyButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                    onPress={() => handleEmergencyAction(action.id)}
                  >
                    <Text style={styles.emergencyButtonText}>{action.label}</Text>
                  </TouchableOpacity>
                ))
              }
            </View>
          )}

          {/* Regular Actions */}
          <View style={styles.actions}>
            {currentAlert.acknowledgmentRequired && (
              <TouchableOpacity
                style={[styles.button, styles.acknowledgeButton]}
                onPress={() => handleAlertAcknowledge(currentAlert.id)}
              >
                <Text style={styles.buttonText}>Acknowledge</Text>
              </TouchableOpacity>
            )}

            {currentAlert.dismissible && (
              <TouchableOpacity
                style={[styles.button, styles.dismissButton]}
                onPress={() => handleAlertDismiss(currentAlert.id)}
              >
                <Text style={styles.buttonText}>Dismiss</Text>
              </TouchableOpacity>
            )}

            {isPlaying && (
              <TouchableOpacity
                style={[styles.button, styles.muteButton]}
                onPress={stopAudio}
              >
                <MaterialIcons name="volume-off" size={20} color="white" />
                <Text style={styles.buttonText}>Mute</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Alert Queue Indicator */}
          {alertQueue.length > 1 && (
            <View style={styles.queueIndicator}>
              <Text style={styles.queueText}>
                {alertQueue.length - 1} more alert{alertQueue.length > 2 ? 's' : ''}
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertBox: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  severityText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10,
    flex: 1,
  },
  timeToImpact: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    fontFamily: 'monospace',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: 'white',
    marginBottom: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  location: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'monospace',
  },
  emergencyActions: {
    marginBottom: 20,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
  },
  emergencyButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  emergencyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  acknowledgeButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  dismissButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  muteButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    gap: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  queueIndicator: {
    marginTop: 15,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  queueText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default SafetyAlertOverlay;