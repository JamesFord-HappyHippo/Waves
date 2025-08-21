/**
 * Depth Reporting Screen for Marine Navigation
 * Features: Manual depth entry, automatic reporting, depth history, safety alerts
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Switch,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useAppSelector, useAppDispatch} from '@/store';
import {useLocation} from '@/services/location/LocationProvider';
import {
  addDepthReading,
  updateCurrentDepth,
  setReportingMode,
  updateVesselDraft,
  updateSafetyMargin,
  toggleDepthAlerts,
} from '@/store/slices/depthSlice';

interface DepthEntry {
  depth: string;
  confidence: number;
  notes: string;
}

export const DepthReportingScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useAppSelector(state => state.location);
  const depth = useAppSelector(state => state.depth);
  const settings = useAppSelector(state => state.settings);
  
  const {getCurrentLocation} = useLocation();
  
  const [depthEntry, setDepthEntry] = useState<DepthEntry>({
    depth: '',
    confidence: 80,
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Simulate real-time depth updates (in real app, this would come from sensors)
    const interval = setInterval(() => {
      if (depth.reportingMode === 'automatic' && location.currentLocation) {
        // Simulate depth reading based on location
        const mockDepth = 5 + Math.random() * 10;
        dispatch(updateCurrentDepth(mockDepth));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [depth.reportingMode, location.currentLocation]);

  const handleSubmitDepthReading = async () => {
    if (!depthEntry.depth || isNaN(parseFloat(depthEntry.depth))) {
      Alert.alert('Error', 'Please enter a valid depth value');
      return;
    }

    const currentLocation = await getCurrentLocation();
    if (!currentLocation) {
      Alert.alert('Error', 'Unable to get current location. Please ensure GPS is enabled.');
      return;
    }

    setIsSubmitting(true);

    try {
      const depthReading = {
        id: `depth_${Date.now()}`,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        depth: parseFloat(depthEntry.depth),
        timestamp: Date.now(),
        vesselDraft: depth.vesselDraft,
        confidenceScore: depthEntry.confidence / 100,
        source: 'crowdsource' as const,
        userId: settings.user?.id,
      };

      dispatch(addDepthReading(depthReading));
      dispatch(updateCurrentDepth(parseFloat(depthEntry.depth)));
      
      // Clear form
      setDepthEntry({
        depth: '',
        confidence: 80,
        notes: '',
      });

      Alert.alert(
        'Success',
        'Depth reading submitted successfully!',
        [{text: 'OK'}],
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit depth reading. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportingModeToggle = (automatic: boolean) => {
    dispatch(setReportingMode(automatic ? 'automatic' : 'manual'));
  };

  const handleVesselDraftChange = (draft: string) => {
    const draftValue = parseFloat(draft);
    if (!isNaN(draftValue) && draftValue >= 0) {
      dispatch(updateVesselDraft(draftValue));
    }
  };

  const handleSafetyMarginChange = (margin: string) => {
    const marginValue = parseFloat(margin);
    if (!isNaN(marginValue) && marginValue >= 0) {
      dispatch(updateSafetyMargin(marginValue));
    }
  };

  const renderDepthHistoryItem = ({item}: {item: any}) => (
    <View style={styles.historyItem}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyDepth}>{item.depth.toFixed(1)}m</Text>
        <Text style={styles.historyTime}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
      <Text style={styles.historyLocation}>
        {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
      </Text>
      <View style={styles.historyFooter}>
        <Text style={styles.historySource}>{item.source}</Text>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>
            {Math.round(item.confidenceScore * 100)}%
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Current Status */}
        <View style={styles.statusCard}>
          <Text style={styles.sectionTitle}>Current Status</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Icon name="waves" size={24} color="#007AFF" />
              <Text style={styles.statusLabel}>Current Depth</Text>
              <Text style={styles.statusValue}>
                {depth.currentDepth?.toFixed(1) || '--'} m
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Icon name="ship-wheel" size={24} color="#007AFF" />
              <Text style={styles.statusLabel}>Vessel Draft</Text>
              <Text style={styles.statusValue}>
                {depth.vesselDraft.toFixed(1)} m
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Icon name="shield-check" size={24} color="#007AFF" />
              <Text style={styles.statusLabel}>Safety Margin</Text>
              <Text style={styles.statusValue}>
                {depth.safetyMargin.toFixed(1)} m
              </Text>
            </View>
          </View>
          
          {/* Safety Alert */}
          {depth.currentDepth !== null && depth.currentDepth < depth.minSafeDepth && (
            <View style={styles.safetyAlert}>
              <Icon name="alert-circle" size={20} color="#FF0000" />
              <Text style={styles.alertText}>
                Warning: Depth below safe threshold!
              </Text>
            </View>
          )}
        </View>

        {/* Manual Depth Entry */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Report Depth Reading</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Depth (meters)</Text>
            <TextInput
              style={styles.textInput}
              value={depthEntry.depth}
              onChangeText={(text) => setDepthEntry(prev => ({...prev, depth: text}))}
              placeholder="Enter depth in meters"
              keyboardType="decimal-pad"
              placeholderTextColor="#8E8E93"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Confidence: {depthEntry.confidence}%
            </Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>Low</Text>
              <View style={styles.slider}>
                {/* This would be a proper slider component in real implementation */}
                <TouchableOpacity
                  style={styles.sliderButton}
                  onPress={() => setDepthEntry(prev => ({
                    ...prev, 
                    confidence: Math.max(0, prev.confidence - 10)
                  }))}
                >
                  <Icon name="minus" size={16} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.sliderValue}>{depthEntry.confidence}%</Text>
                <TouchableOpacity
                  style={styles.sliderButton}
                  onPress={() => setDepthEntry(prev => ({
                    ...prev, 
                    confidence: Math.min(100, prev.confidence + 10)
                  }))}
                >
                  <Icon name="plus" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sliderLabel}>High</Text>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={depthEntry.notes}
              onChangeText={(text) => setDepthEntry(prev => ({...prev, notes: text}))}
              placeholder="Add any relevant notes..."
              multiline
              numberOfLines={3}
              placeholderTextColor="#8E8E93"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmitDepthReading}
            disabled={isSubmitting}
          >
            <Icon name="send" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Reading'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Automatic Reporting</Text>
              <Text style={styles.settingDescription}>
                Automatically report depth data while tracking
              </Text>
            </View>
            <Switch
              value={depth.reportingMode === 'automatic'}
              onValueChange={handleReportingModeToggle}
              trackColor={{false: '#767577', true: '#81b0ff'}}
              thumbColor={depth.reportingMode === 'automatic' ? '#007AFF' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Depth Alerts</Text>
              <Text style={styles.settingDescription}>
                Alert when depth is below safety threshold
              </Text>
            </View>
            <Switch
              value={depth.depthAlerts}
              onValueChange={() => dispatch(toggleDepthAlerts())}
              trackColor={{false: '#767577', true: '#81b0ff'}}
              thumbColor={depth.depthAlerts ? '#007AFF' : '#f4f3f4'}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Vessel Draft (m)</Text>
            <TextInput
              style={styles.textInput}
              value={depth.vesselDraft.toString()}
              onChangeText={handleVesselDraftChange}
              keyboardType="decimal-pad"
              placeholderTextColor="#8E8E93"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Safety Margin (m)</Text>
            <TextInput
              style={styles.textInput}
              value={depth.safetyMargin.toString()}
              onChangeText={handleSafetyMarginChange}
              keyboardType="decimal-pad"
              placeholderTextColor="#8E8E93"
            />
          </View>
        </View>

        {/* Recent Depth Readings */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Readings</Text>
          {depth.userReadings.length > 0 ? (
            <FlatList
              data={depth.userReadings.slice(-5).reverse()}
              keyExtractor={item => item.id}
              renderItem={renderDepthHistoryItem}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>No depth readings yet</Text>
          )}
        </View>
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
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 15,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 5,
    textAlign: 'center',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 2,
  },
  safetyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE6E6',
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  alertText: {
    color: '#FF0000',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#C7C7CC',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1C1C1E',
    backgroundColor: '#F9F9F9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slider: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 15,
  },
  sliderButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 15,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  settingDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  historyItem: {
    backgroundColor: '#F9F9F9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  historyDepth: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  historyTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  historyLocation: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historySource: {
    fontSize: 12,
    color: '#8E8E93',
    textTransform: 'capitalize',
  },
  confidenceBadge: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 10,
    color: '#007AFF',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 16,
    paddingVertical: 20,
  },
});