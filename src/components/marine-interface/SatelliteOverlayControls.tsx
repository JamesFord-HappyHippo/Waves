/**
 * Satellite Overlay Controls Component
 * Provides UI controls for managing satellite imagery and chart overlays
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { SatelliteOverlayManager, SATELLITE_SOURCES, SatelliteSource, OverlaySettings } from '@/utils/SatelliteOverlayManager';

interface Props {
  overlayManager: SatelliteOverlayManager;
  visible: boolean;
  onClose: () => void;
}

const SatelliteOverlayControls: React.FC<Props> = ({
  overlayManager,
  visible,
  onClose,
}) => {
  const [settings, setSettings] = useState<OverlaySettings>(overlayManager.getSettings());
  const [selectedSource, setSelectedSource] = useState<string>(settings.baseMap);

  useEffect(() => {
    if (visible) {
      setSettings(overlayManager.getSettings());
      setSelectedSource(overlayManager.getSettings().baseMap);
    }
  }, [visible, overlayManager]);

  const updateSetting = (key: keyof OverlaySettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    overlayManager.updateSettings({ [key]: value });
  };

  const selectSatelliteSource = (sourceId: string) => {
    const source = SATELLITE_SOURCES.find(s => s.id === sourceId);
    
    if (source?.requiresApiKey) {
      Alert.alert(
        'API Key Required',
        `${source.name} requires an API key. Please configure in settings.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Use Anyway', onPress: () => {
            setSelectedSource(sourceId);
            updateSetting('baseMap', sourceId);
          }}
        ]
      );
    } else {
      setSelectedSource(sourceId);
      updateSetting('baseMap', sourceId);
    }
  };

  const renderSourceCard = (source: SatelliteSource) => {
    const isSelected = selectedSource === source.id;
    
    return (
      <TouchableOpacity
        key={source.id}
        style={[
          styles.sourceCard,
          isSelected && styles.sourceCardSelected
        ]}
        onPress={() => selectSatelliteSource(source.id)}
      >
        <View style={styles.sourceHeader}>
          <Text style={[
            styles.sourceName,
            isSelected && styles.sourceNameSelected
          ]}>
            {source.name}
          </Text>
          <View style={styles.sourceBadges}>
            {source.requiresApiKey && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>API</Text>
              </View>
            )}
            <View style={[
              styles.badge,
              source.cost === 'free' ? styles.badgeFree : styles.badgePaid
            ]}>
              <Text style={styles.badgeText}>{source.cost.toUpperCase()}</Text>
            </View>
          </View>
        </View>
        
        <Text style={styles.sourceDescription}>{source.description}</Text>
        
        <View style={styles.sourceDetails}>
          <Text style={styles.sourceDetail}>
            Max Zoom: {source.maxZoom} • Quality: {source.quality}
          </Text>
        </View>
        
        {isSelected && (
          <Icon name="check-circle" size={24} color="#22c55e" style={styles.selectedIcon} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.title}>🛰️ Satellite & Charts</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Satellite Source Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Satellite Imagery Source</Text>
            <Text style={styles.sectionDescription}>
              Choose your preferred satellite imagery provider
            </Text>
            
            {SATELLITE_SOURCES.map(renderSourceCard)}
          </View>

          {/* Overlay Controls */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Layer Controls</Text>
            
            {/* Satellite Opacity */}
            <View style={styles.controlGroup}>
              <View style={styles.controlHeader}>
                <Text style={styles.controlLabel}>Satellite Opacity</Text>
                <Text style={styles.controlValue}>{Math.round(settings.satelliteOpacity * 100)}%</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={settings.satelliteOpacity}
                onValueChange={(value) => updateSetting('satelliteOpacity', value)}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#e2e8f0"
                thumbStyle={styles.sliderThumb}
              />
            </View>

            {/* Chart Overlay */}
            <View style={styles.controlRow}>
              <View style={styles.controlInfo}>
                <Text style={styles.controlLabel}>NOAA Chart Overlay</Text>
                <Text style={styles.controlSubtitle}>Official nautical charts</Text>
              </View>
              <Switch
                value={settings.chartOverlay}
                onValueChange={(value) => updateSetting('chartOverlay', value)}
                trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                thumbColor={settings.chartOverlay ? '#ffffff' : '#64748b'}
              />
            </View>

            {/* Chart Opacity */}
            {settings.chartOverlay && (
              <View style={styles.controlGroup}>
                <View style={styles.controlHeader}>
                  <Text style={styles.controlLabel}>Chart Opacity</Text>
                  <Text style={styles.controlValue}>{Math.round(settings.chartOpacity * 100)}%</Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  value={settings.chartOpacity}
                  onValueChange={(value) => updateSetting('chartOpacity', value)}
                  minimumTrackTintColor="#3b82f6"
                  maximumTrackTintColor="#e2e8f0"
                  thumbStyle={styles.sliderThumb}
                />
              </View>
            )}

            {/* Depth Data Overlay */}
            <View style={styles.controlRow}>
              <View style={styles.controlInfo}>
                <Text style={styles.controlLabel}>Community Depth Data</Text>
                <Text style={styles.controlSubtitle}>Crowdsourced depth readings</Text>
              </View>
              <Switch
                value={settings.depthDataOverlay}
                onValueChange={(value) => updateSetting('depthDataOverlay', value)}
                trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                thumbColor={settings.depthDataOverlay ? '#ffffff' : '#64748b'}
              />
            </View>

            {/* Shallow Water Highlight */}
            <View style={styles.controlRow}>
              <View style={styles.controlInfo}>
                <Text style={styles.controlLabel}>Shallow Water Alerts</Text>
                <Text style={styles.controlSubtitle}>Highlight dangerous shallows</Text>
              </View>
              <Switch
                value={settings.showShallowWaterHighlight}
                onValueChange={(value) => updateSetting('showShallowWaterHighlight', value)}
                trackColor={{ false: '#e2e8f0', true: '#ef4444' }}
                thumbColor={settings.showShallowWaterHighlight ? '#ffffff' : '#64748b'}
              />
            </View>

            {/* Night Mode */}
            <View style={styles.controlRow}>
              <View style={styles.controlInfo}>
                <Text style={styles.controlLabel}>Night Navigation Mode</Text>
                <Text style={styles.controlSubtitle}>Red-tinted display for night vision</Text>
              </View>
              <Switch
                value={settings.nightModeInversion}
                onValueChange={(value) => updateSetting('nightModeInversion', value)}
                trackColor={{ false: '#e2e8f0', true: '#dc2626' }}
                thumbColor={settings.nightModeInversion ? '#ffffff' : '#64748b'}
              />
            </View>
          </View>

          {/* Marine Navigation Tips */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💡 Navigation Tips</Text>
            <View style={styles.tipCard}>
              <Icon name="information-outline" size={20} color="#3b82f6" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Satellite Imagery Benefits</Text>
                <Text style={styles.tipText}>
                  Satellite images show visible sandbars, coral reefs, kelp beds, and shallow areas that may not appear on charts.
                </Text>
              </View>
            </View>
            
            <View style={styles.tipCard}>
              <Icon name="alert-outline" size={20} color="#f59e0b" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Safety Reminder</Text>
                <Text style={styles.tipText}>
                  Always use official nautical charts as your primary navigation source. Satellite imagery is supplementary.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  sourceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  sourceCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#f0f9ff',
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  sourceNameSelected: {
    color: '#1e40af',
  },
  sourceBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  badgeFree: {
    backgroundColor: '#dcfce7',
  },
  badgePaid: {
    backgroundColor: '#fef3c7',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  sourceDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  sourceDetails: {
    marginBottom: 4,
  },
  sourceDetail: {
    fontSize: 12,
    color: '#9ca3af',
  },
  selectedIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  controlGroup: {
    marginBottom: 24,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  controlInfo: {
    flex: 1,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
  },
  controlSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  controlValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderThumb: {
    backgroundColor: '#3b82f6',
    width: 20,
    height: 20,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
});

export default SatelliteOverlayControls;