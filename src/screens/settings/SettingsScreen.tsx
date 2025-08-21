/**
 * Settings Screen for Waves Marine Navigation App
 * Features: User preferences, privacy settings, units, theme, notifications
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useAppSelector, useAppDispatch} from '@/store';
import {
  setUnits,
  setTheme,
  updateNotificationSettings,
  updatePrivacySettings,
  updateNavigationSettings,
  updateSafetySettings,
} from '@/store/slices/settingsSlice';

interface SettingRowProps {
  icon: string;
  title: string;
  subtitle?: string;
  value?: string | boolean;
  onPress?: () => void;
  showArrow?: boolean;
  showSwitch?: boolean;
  onSwitchChange?: (value: boolean) => void;
}

const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  title,
  subtitle,
  value,
  onPress,
  showArrow = false,
  showSwitch = false,
  onSwitchChange,
}) => (
  <TouchableOpacity
    style={styles.settingRow}
    onPress={onPress}
    disabled={showSwitch || !onPress}
  >
    <Icon name={icon} size={24} color="#007AFF" style={styles.settingIcon} />
    <View style={styles.settingContent}>
      <Text style={styles.settingTitle}>{title}</Text>
      {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
    </View>
    {showSwitch && (
      <Switch
        value={value as boolean}
        onValueChange={onSwitchChange}
        trackColor={{false: '#767577', true: '#81b0ff'}}
        thumbColor={value ? '#007AFF' : '#f4f3f4'}
      />
    )}
    {!showSwitch && value && typeof value === 'string' && (
      <Text style={styles.settingValue}>{value}</Text>
    )}
    {showArrow && (
      <Icon name="chevron-right" size={20} color="#C7C7CC" />
    )}
  </TouchableOpacity>
);

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({title, children}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionContent}>
      {children}
    </View>
  </View>
);

export const SettingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(state => state.settings);

  const handleUnitsChange = () => {
    const options = [
      {text: 'Metric', onPress: () => dispatch(setUnits('metric'))},
      {text: 'Imperial', onPress: () => dispatch(setUnits('imperial'))},
      {text: 'Nautical', onPress: () => dispatch(setUnits('nautical'))},
      {text: 'Cancel', style: 'cancel' as const},
    ];

    Alert.alert('Select Units', 'Choose your preferred unit system', options);
  };

  const handleThemeChange = () => {
    const options = [
      {text: 'Light', onPress: () => dispatch(setTheme('light'))},
      {text: 'Dark', onPress: () => dispatch(setTheme('dark'))},
      {text: 'Auto', onPress: () => dispatch(setTheme('auto'))},
      {text: 'Cancel', style: 'cancel' as const},
    ];

    Alert.alert('Select Theme', 'Choose your preferred theme', options);
  };

  const handleProfilePress = () => {
    Alert.alert('Profile', 'Navigate to profile screen', [{text: 'OK'}]);
  };

  const handleVesselPress = () => {
    Alert.alert('Vessel Settings', 'Configure your vessel details', [{text: 'OK'}]);
  };

  const handleOfflineMapsPress = () => {
    Alert.alert('Offline Maps', 'Manage offline map regions', [{text: 'OK'}]);
  };

  const handleDataExportPress = () => {
    Alert.alert(
      'Export Data',
      'Export your navigation and depth data',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Export', onPress: () => console.log('Exporting data...')},
      ],
    );
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            // Reset logic would go here
            Alert.alert('Settings Reset', 'All settings have been reset to default');
          },
        },
      ],
    );
  };

  const handleAboutPress = () => {
    Alert.alert(
      'About Waves',
      'Waves Marine Navigation v1.0.0\n\nCommunity-driven depth data for safer navigation.',
      [{text: 'OK'}],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* User Profile Section */}
        <Section title="Profile">
          <SettingRow
            icon="account-circle"
            title={settings.user?.name || 'Guest User'}
            subtitle={settings.user?.email || 'Tap to set up profile'}
            onPress={handleProfilePress}
            showArrow
          />
          <SettingRow
            icon="sailboat"
            title="Vessel Settings"
            subtitle={settings.user?.vesselName || 'Configure your vessel'}
            onPress={handleVesselPress}
            showArrow
          />
        </Section>

        {/* Display & Interface */}
        <Section title="Display & Interface">
          <SettingRow
            icon="ruler"
            title="Units"
            value={settings.units.charAt(0).toUpperCase() + settings.units.slice(1)}
            onPress={handleUnitsChange}
            showArrow
          />
          <SettingRow
            icon="theme-light-dark"
            title="Theme"
            value={settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1)}
            onPress={handleThemeChange}
            showArrow
          />
        </Section>

        {/* Navigation Settings */}
        <Section title="Navigation">
          <SettingRow
            icon="crosshairs-gps"
            title="Auto Follow GPS"
            subtitle="Automatically center map on your location"
            value={settings.navigation.autoFollowGPS}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updateNavigationSettings({autoFollowGPS: value}))
            }
          />
          <SettingRow
            icon="compass"
            title="Show Compass"
            subtitle="Display compass on navigation screen"
            value={settings.navigation.showCompass}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updateNavigationSettings({showCompass: value}))
            }
          />
          <SettingRow
            icon="speedometer"
            title="Show Speed"
            subtitle="Display speed over ground"
            value={settings.navigation.showSpeed}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updateNavigationSettings({showSpeed: value}))
            }
          />
          <SettingRow
            icon="volume-high"
            title="Voice Guidance"
            subtitle="Spoken navigation instructions"
            value={settings.navigation.voiceGuidance}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updateNavigationSettings({voiceGuidance: value}))
            }
          />
        </Section>

        {/* Safety & Alerts */}
        <Section title="Safety & Alerts">
          <SettingRow
            icon="waves"
            title="Depth Alerts"
            subtitle="Alert when depth is below safety threshold"
            value={settings.notifications.depthAlerts}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updateNotificationSettings({depthAlerts: value}))
            }
          />
          <SettingRow
            icon="weather-partly-cloudy"
            title="Weather Alerts"
            subtitle="Receive weather and marine warnings"
            value={settings.notifications.weatherAlerts}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updateNotificationSettings({weatherAlerts: value}))
            }
          />
          <SettingRow
            icon="navigation"
            title="Navigation Alerts"
            subtitle="Course deviation and waypoint alerts"
            value={settings.notifications.navigationAlerts}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updateNotificationSettings({navigationAlerts: value}))
            }
          />
          <SettingRow
            icon="shield-check"
            title="Safety Warnings"
            subtitle="Critical safety and emergency warnings"
            value={settings.safety.weatherWarnings}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updateSafetySettings({weatherWarnings: value}))
            }
          />
        </Section>

        {/* Privacy & Data */}
        <Section title="Privacy & Data">
          <SettingRow
            icon="map-marker-path"
            title="Share Location"
            subtitle="Share anonymous location for community features"
            value={settings.privacy.shareLocation}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updatePrivacySettings({shareLocation: value}))
            }
          />
          <SettingRow
            icon="database"
            title="Share Depth Data"
            subtitle="Contribute depth readings to community database"
            value={settings.privacy.shareDepthData}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updatePrivacySettings({shareDepthData: value}))
            }
          />
          <SettingRow
            icon="incognito"
            title="Anonymous Mode"
            subtitle="Use app without creating personal data"
            value={settings.privacy.anonymousMode}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updatePrivacySettings({anonymousMode: value}))
            }
          />
        </Section>

        {/* Data Management */}
        <Section title="Data Management">
          <SettingRow
            icon="map-outline"
            title="Offline Maps"
            subtitle="Manage downloaded map regions"
            onPress={handleOfflineMapsPress}
            showArrow
          />
          <SettingRow
            icon="battery"
            title="Battery Optimization"
            subtitle="Optimize for longer battery life"
            value={settings.notifications.batteryOptimization}
            showSwitch
            onSwitchChange={(value) =>
              dispatch(updateNotificationSettings({batteryOptimization: value}))
            }
          />
          <SettingRow
            icon="export"
            title="Export Data"
            subtitle="Export your navigation and depth data"
            onPress={handleDataExportPress}
            showArrow
          />
        </Section>

        {/* System */}
        <Section title="System">
          <SettingRow
            icon="restore"
            title="Reset Settings"
            subtitle="Reset all settings to default"
            onPress={handleResetSettings}
            showArrow
          />
          <SettingRow
            icon="information"
            title="About"
            subtitle="App version and information"
            onPress={handleAboutPress}
            showArrow
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingBottom: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#C7C7CC',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#C7C7CC',
  },
  settingIcon: {
    marginRight: 15,
    width: 24,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 17,
    color: '#1C1C1E',
    fontWeight: '400',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  settingValue: {
    fontSize: 17,
    color: '#8E8E93',
    marginRight: 8,
  },
});