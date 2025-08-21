/**
 * Navigation Controls - Marine Navigation Interface Controls
 * Optimized for marine conditions with large touch targets and clear feedback
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Vibration,
  Alert,
  Dimensions
} from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { ViewMode } from './ViewModeController';
import { MarineConditions } from '../../utils/MarineUIAdapter';

interface NavigationControlsProps {
  style?: any;
  onCenterUser: () => void;
  onModeSwitch: (mode: ViewMode) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  currentMode: ViewMode;
  isFollowingUser?: boolean;
  batteryLevel: number;
  signalStrength: number;
  onEmergency?: () => void;
}

interface ControlButton {
  id: string;
  icon: string;
  label: string;
  action: () => void;
  disabled?: boolean;
  danger?: boolean;
  primary?: boolean;
  badge?: string | number;
}

const { width, height } = Dimensions.get('window');

const NavigationControls: React.FC<NavigationControlsProps> = ({
  style,
  onCenterUser,
  onModeSwitch,
  onZoomIn,
  onZoomOut,
  currentMode,
  isFollowingUser = false,
  batteryLevel,
  signalStrength,
  onEmergency
}) => {
  // Redux state
  const marineConditions = useSelector((state: any) => state.environment.conditions);
  const safetyAlerts = useSelector((state: any) => state.safety.alerts);
  const userPreferences = useSelector((state: any) => state.user.preferences);
  
  // Component state
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Animations
  const panelAnimation = new Animated.Value(0);
  const emergencyPulse = new Animated.Value(1);
  
  // Calculate control sizing based on marine conditions
  const controlSize = useMemo(() => {
    let baseSize = 56;
    
    // Increase size for rough conditions
    if (marineConditions.motion === 'rough') baseSize *= 1.4;
    else if (marineConditions.motion === 'moderate') baseSize *= 1.2;
    
    // Increase for spray conditions
    if (marineConditions.spray) baseSize *= 1.1;
    
    // Increase for poor visibility
    if (marineConditions.visibility === 'poor') baseSize *= 1.2;
    
    return Math.min(80, Math.round(baseSize));
  }, [marineConditions]);
  
  // Emergency alert animation
  useEffect(() => {
    const hasEmergencyAlerts = safetyAlerts.some((alert: any) => 
      alert.severity === 'critical' || alert.severity === 'emergency'
    );
    
    if (hasEmergencyAlerts) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(emergencyPulse, {
            toValue: 1.3,
            duration: 300,
            useNativeDriver: true
          }),
          Animated.timing(emergencyPulse, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true
          })
        ])
      );
      animation.start();
      
      return () => animation.stop();
    }
  }, [safetyAlerts, emergencyPulse]);
  
  // Haptic feedback helper
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (Platform.OS === 'ios') {
      // Use iOS haptic feedback
      // Implementation would use @react-native-community/react-native-haptic-feedback
    } else {
      // Android vibration patterns
      const patterns = {
        light: [50],
        medium: [100],
        heavy: [200]
      };
      Vibration.vibrate(patterns[type]);
    }
  }, []);
  
  // Handle long press for emergency functions
  const handleLongPress = useCallback((action: () => void) => {
    const timer = setTimeout(() => {
      triggerHaptic('heavy');
      action();
    }, 1000);
    
    setLongPressTimer(timer);
  }, [triggerHaptic]);
  
  const handlePressOut = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);
  
  // Toggle panel expansion
  const togglePanel = useCallback((panelId: string) => {
    const isExpanding = expandedPanel !== panelId;
    setExpandedPanel(isExpanding ? panelId : null);
    
    Animated.timing(panelAnimation, {
      toValue: isExpanding ? 1 : 0,
      duration: 300,
      useNativeDriver: false
    }).start();
    
    triggerHaptic('light');
  }, [expandedPanel, panelAnimation, triggerHaptic]);
  
  // Generate control buttons based on current mode and conditions
  const primaryControls = useMemo((): ControlButton[] => {
    const controls: ControlButton[] = [
      {
        id: 'center',
        icon: isFollowingUser ? 'my-location' : 'location-searching',
        label: 'Center',
        action: onCenterUser,
        primary: isFollowingUser
      },
      {
        id: 'mode',
        icon: currentMode === 'map' ? '3d-rotation' : 'map',
        label: currentMode === 'map' ? '3D View' : 'Map View',
        action: () => onModeSwitch(currentMode === 'map' ? '3d' : 'map')
      }
    ];
    
    // Add zoom controls if available
    if (onZoomIn && onZoomOut) {
      controls.push(
        {
          id: 'zoom-in',
          icon: 'zoom-in',
          label: 'Zoom In',
          action: onZoomIn
        },
        {
          id: 'zoom-out',
          icon: 'zoom-out',
          label: 'Zoom Out',
          action: onZoomOut
        }
      );
    }
    
    return controls;
  }, [currentMode, isFollowingUser, onCenterUser, onModeSwitch, onZoomIn, onZoomOut]);
  
  const secondaryControls = useMemo((): ControlButton[] => {
    const criticalAlerts = safetyAlerts.filter((alert: any) => 
      alert.severity === 'critical' || alert.severity === 'emergency'
    );
    
    return [
      {
        id: 'split',
        icon: 'view-column',
        label: 'Split View',
        action: () => onModeSwitch('split'),
        disabled: batteryLevel < 0.2
      },
      {
        id: 'alerts',
        icon: 'warning',
        label: 'Alerts',
        action: () => togglePanel('alerts'),
        badge: criticalAlerts.length > 0 ? criticalAlerts.length : undefined,
        danger: criticalAlerts.length > 0
      }
    ];
  }, [safetyAlerts, batteryLevel, onModeSwitch, togglePanel]);
  
  // Emergency controls - always visible but require long press
  const emergencyControls = useMemo((): ControlButton[] => {
    if (!onEmergency) return [];
    
    return [
      {
        id: 'emergency',
        icon: 'emergency',
        label: 'Emergency',
        action: () => {
          Alert.alert(
            'Emergency Mode',
            'Activate emergency mode and contact authorities?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Activate', 
                style: 'destructive',
                onPress: onEmergency
              }
            ]
          );
        },
        danger: true
      }
    ];
  }, [onEmergency]);
  
  // Render individual control button
  const renderControlButton = useCallback((control: ControlButton, size: number = controlSize) => {
    const buttonStyle = [
      styles.controlButton,
      {
        width: size,
        height: size,
        borderRadius: size / 2
      },
      control.primary && styles.primaryButton,
      control.danger && styles.dangerButton,
      control.disabled && styles.disabledButton
    ];
    
    const iconColor = control.primary ? '#FFFFFF' : 
                     control.danger ? '#FFFFFF' : 
                     control.disabled ? '#999999' : '#333333';
    
    return (
      <TouchableOpacity
        key={control.id}
        style={buttonStyle}
        onPress={() => {
          if (control.disabled) return;
          triggerHaptic();
          control.action();
        }}
        onLongPress={() => {
          if (control.danger && !control.disabled) {
            handleLongPress(control.action);
          }
        }}
        onPressOut={handlePressOut}
        disabled={control.disabled}
        accessibilityLabel={control.label}
        accessibilityRole="button"
        accessibilityState={{ disabled: control.disabled }}
      >
        <Icon 
          name={control.icon} 
          size={size * 0.4} 
          color={iconColor} 
        />
        
        {/* Badge indicator */}
        {control.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {typeof control.badge === 'number' && control.badge > 99 ? '99+' : control.badge}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [controlSize, triggerHaptic, handleLongPress, handlePressOut]);
  
  // Render status indicators
  const renderStatusBar = useCallback(() => (
    <View style={styles.statusBar}>
      {/* Battery indicator */}
      <View style={[
        styles.statusIndicator,
        batteryLevel < 0.2 && styles.criticalStatus
      ]}>
        <Icon 
          name={batteryLevel < 0.2 ? 'battery-alert' : 'battery-std'} 
          size={16} 
          color={batteryLevel < 0.2 ? '#FF4444' : '#666666'} 
        />
        <Text style={styles.statusText}>
          {Math.round(batteryLevel * 100)}%
        </Text>
      </View>
      
      {/* Signal strength indicator */}
      <View style={styles.statusIndicator}>
        <Icon 
          name={signalStrength > 0.7 ? 'signal-cellular-4-bar' :
                signalStrength > 0.5 ? 'signal-cellular-3-bar' :
                signalStrength > 0.3 ? 'signal-cellular-2-bar' :
                signalStrength > 0 ? 'signal-cellular-1-bar' :
                'signal-cellular-off'}
          size={16} 
          color={signalStrength > 0.5 ? '#666666' : '#FF4444'} 
        />
      </View>
      
      {/* Current mode indicator */}
      <View style={styles.statusIndicator}>
        <Text style={styles.modeText}>
          {currentMode.toUpperCase()}
        </Text>
      </View>
    </View>
  ), [batteryLevel, signalStrength, currentMode]);
  
  return (
    <View style={[styles.container, style]}>
      {/* Status bar */}
      {renderStatusBar()}
      
      {/* Primary controls */}
      <View style={styles.primaryControls}>
        {primaryControls.map(control => renderControlButton(control))}
      </View>
      
      {/* Secondary controls */}
      <View style={styles.secondaryControls}>
        {secondaryControls.map(control => renderControlButton(control, controlSize * 0.8))}
      </View>
      
      {/* Emergency controls */}
      {emergencyControls.length > 0 && (
        <Animated.View 
          style={[
            styles.emergencyControls,
            { transform: [{ scale: emergencyPulse }] }
          ]}
        >
          {emergencyControls.map(control => renderControlButton(control, controlSize * 1.2))}
        </Animated.View>
      )}
      
      {/* Expanded panels */}
      {expandedPanel === 'alerts' && (
        <Animated.View
          style={[
            styles.expandedPanel,
            {
              opacity: panelAnimation,
              transform: [{
                translateX: panelAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0]
                })
              }]
            }
          ]}
        >
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Safety Alerts</Text>
            <TouchableOpacity 
              onPress={() => togglePanel('alerts')}
              style={styles.panelClose}
            >
              <Icon name="close" size={20} color="#666666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.panelContent}>
            {safetyAlerts.length === 0 ? (
              <Text style={styles.noAlertsText}>No active alerts</Text>
            ) : (
              safetyAlerts.map((alert: any) => (
                <View key={alert.id} style={[
                  styles.alertItem,
                  alert.severity === 'critical' && styles.criticalAlert,
                  alert.severity === 'emergency' && styles.emergencyAlert
                ]}>
                  <Icon 
                    name={alert.type === 'grounding' ? 'warning' : 'info'}
                    size={20}
                    color={alert.severity === 'critical' || alert.severity === 'emergency' ? '#FFFFFF' : '#666666'}
                  />
                  <Text style={[
                    styles.alertText,
                    (alert.severity === 'critical' || alert.severity === 'emergency') && styles.alertTextWhite
                  ]}>
                    {alert.description}
                  </Text>
                </View>
              ))
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 60 : 40,
    bottom: 120,
    width: 80,
    alignItems: 'center'
  },
  statusBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    minWidth: 60,
    alignItems: 'center'
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
    color: '#666666'
  },
  modeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#666666',
    letterSpacing: 0.5
  },
  criticalStatus: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 4
  },
  primaryControls: {
    alignItems: 'center',
    marginBottom: 16
  },
  secondaryControls: {
    alignItems: 'center',
    marginBottom: 16
  },
  emergencyControls: {
    position: 'absolute',
    bottom: 16,
    alignItems: 'center'
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  primaryButton: {
    backgroundColor: '#007AFF'
  },
  dangerButton: {
    backgroundColor: '#FF4444'
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    opacity: 0.6
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold'
  },
  expandedPanel: {
    position: 'absolute',
    right: 90,
    top: 0,
    width: 280,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333'
  },
  panelClose: {
    padding: 4
  },
  panelContent: {
    padding: 12,
    maxHeight: 300
  },
  noAlertsText: {
    textAlign: 'center',
    color: '#666666',
    fontStyle: 'italic',
    padding: 20
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    marginVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFB000'
  },
  criticalAlert: {
    backgroundColor: '#FF4444',
    borderLeftColor: '#CC0000'
  },
  emergencyAlert: {
    backgroundColor: '#CC0000',
    borderLeftColor: '#990000'
  },
  alertText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    lineHeight: 16,
    color: '#333333'
  },
  alertTextWhite: {
    color: '#FFFFFF'
  }
});

export default NavigationControls;