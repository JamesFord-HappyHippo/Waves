/**
 * Environmental Data Display Component
 * Comprehensive environmental information display for marine navigation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useEnvironmentalData, useWeatherData, useTideData, useMarineAlerts } from '../../services/environmental/EnvironmentalDataProvider';
import { MarineAlert } from '../../services/environmental/WeatherApiClient';

const { width: screenWidth } = Dimensions.get('window');

interface EnvironmentalDataDisplayProps {
  showDetailedView?: boolean;
  onAlertPress?: (alert: MarineAlert) => void;
  style?: any;
}

export const EnvironmentalDataDisplay: React.FC<EnvironmentalDataDisplayProps> = ({
  showDetailedView = true,
  onAlertPress,
  style
}) => {
  const { refreshData, isRealtimeEnabled, enableRealtimeUpdates, batteryOptimization, setBatteryOptimization } = useEnvironmentalData();
  const { weather, forecast, isLoading: weatherLoading, error: weatherError } = useWeatherData();
  const { station, predictions, currentLevel, isLoading: tidesLoading, error: tidesError } = useTideData();
  const { alerts, criticalAlerts, isLoading: alertsLoading, error: alertsError } = useMarineAlerts();

  const [selectedTab, setSelectedTab] = useState<'current' | 'forecast' | 'tides' | 'alerts'>('current');
  const [refreshing, setRefreshing] = useState(false);

  const isLoading = weatherLoading || tidesLoading || alertsLoading;
  const hasError = weatherError || tidesError || alertsError;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleRealtimeUpdates = () => {
    enableRealtimeUpdates(!isRealtimeEnabled);
  };

  const toggleBatteryOptimization = () => {
    setBatteryOptimization(!batteryOptimization);
  };

  const handleAlertPress = (alert: MarineAlert) => {
    if (onAlertPress) {
      onAlertPress(alert);
    } else {
      Alert.alert(
        alert.title,
        alert.description,
        [{ text: 'OK' }]
      );
    }
  };

  const renderTabButtons = () => (
    <View style={styles.tabContainer}>
      {[
        { key: 'current', label: 'Current', icon: 'partly-sunny-outline' },
        { key: 'forecast', label: 'Forecast', icon: 'time-outline' },
        { key: 'tides', label: 'Tides', icon: 'water-outline' },
        { key: 'alerts', label: 'Alerts', icon: 'warning-outline', badge: criticalAlerts.length }
      ].map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tabButton, selectedTab === tab.key && styles.activeTab]}
          onPress={() => setSelectedTab(tab.key as any)}
        >
          <View style={styles.tabContent}>
            <Icon 
              name={tab.icon} 
              size={20} 
              color={selectedTab === tab.key ? '#007AFF' : '#666'} 
            />
            <Text style={[styles.tabLabel, selectedTab === tab.key && styles.activeTabLabel]}>
              {tab.label}
            </Text>
            {tab.badge && tab.badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tab.badge}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCurrentWeather = () => {
    if (!weather) return <Text style={styles.noDataText}>No weather data available</Text>;

    return (
      <View style={styles.currentWeatherContainer}>
        <View style={styles.mainWeatherInfo}>
          <View style={styles.temperatureContainer}>
            <Text style={styles.temperature}>{Math.round(weather.temperature)}°C</Text>
            <Text style={styles.conditions}>{weather.conditions}</Text>
          </View>
          <View style={styles.weatherIcon}>
            <Icon name={getWeatherIcon(weather.conditions)} size={60} color="#007AFF" />
          </View>
        </View>

        <View style={styles.weatherGrid}>
          <WeatherMetric
            icon="speedometer-outline"
            label="Wind"
            value={`${Math.round(weather.windSpeed)} m/s`}
            secondary={`${Math.round(weather.windDirection)}°`}
          />
          <WeatherMetric
            icon="water-outline"
            label="Wave Height"
            value={`${weather.waveHeight?.toFixed(1) || 'N/A'} m`}
          />
          <WeatherMetric
            icon="eye-outline"
            label="Visibility"
            value={`${weather.visibility?.toFixed(1) || 'N/A'} km`}
          />
          <WeatherMetric
            icon="speedometer-outline"
            label="Pressure"
            value={`${weather.barometricPressure?.toFixed(0) || 'N/A'} hPa`}
          />
        </View>

        {weather.swellHeight && (
          <View style={styles.swellInfo}>
            <Text style={styles.sectionTitle}>Swell Information</Text>
            <View style={styles.swellGrid}>
              <WeatherMetric
                icon="water-outline"
                label="Swell Height"
                value={`${weather.swellHeight.toFixed(1)} m`}
              />
              <WeatherMetric
                icon="compass-outline"
                label="Direction"
                value={`${weather.swellDirection?.toFixed(0) || 'N/A'}°`}
              />
              <WeatherMetric
                icon="timer-outline"
                label="Period"
                value={`${weather.swellPeriod?.toFixed(0) || 'N/A'}s`}
              />
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderForecast = () => {
    if (forecast.length === 0) return <Text style={styles.noDataText}>No forecast data available</Text>;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.forecastScroll}>
        {forecast.slice(0, 12).map((item, index) => (
          <View key={index} style={styles.forecastItem}>
            <Text style={styles.forecastTime}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Icon 
              name={getWeatherIcon(item.weather.conditions)} 
              size={30} 
              color="#007AFF" 
              style={styles.forecastIcon}
            />
            <Text style={styles.forecastTemp}>{Math.round(item.weather.temperature)}°</Text>
            <Text style={styles.forecastWind}>{Math.round(item.weather.windSpeed)} m/s</Text>
            <Text style={styles.forecastWave}>{item.weather.waveHeight?.toFixed(1) || 'N/A'}m</Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderTides = () => {
    if (!station) return <Text style={styles.noDataText}>No tide station data available</Text>;

    const nextHigh = predictions.find(p => p.type === 'H' && new Date(p.time).getTime() > Date.now());
    const nextLow = predictions.find(p => p.type === 'L' && new Date(p.time).getTime() > Date.now());

    return (
      <View style={styles.tidesContainer}>
        <View style={styles.stationInfo}>
          <Text style={styles.sectionTitle}>Tide Station</Text>
          <Text style={styles.stationName}>{station.name}</Text>
          <Text style={styles.stationDetails}>
            {station.state} • {(station.distance && station.distance / 1000)?.toFixed(1) || 'N/A'} km away
          </Text>
        </View>

        {currentLevel && (
          <View style={styles.currentTideContainer}>
            <Text style={styles.sectionTitle}>Current Water Level</Text>
            <View style={styles.currentTideInfo}>
              <Text style={styles.currentTideLevel}>{currentLevel.value.toFixed(2)} m</Text>
              <Text style={styles.currentTideQuality}>
                {currentLevel.quality || 'Unknown'} quality
              </Text>
            </View>
          </View>
        )}

        <View style={styles.nextTidesContainer}>
          <Text style={styles.sectionTitle}>Next Tides</Text>
          <View style={styles.nextTidesGrid}>
            {nextHigh && (
              <View style={styles.tideInfo}>
                <Icon name="trending-up-outline" size={24} color="#007AFF" />
                <Text style={styles.tideType}>High Tide</Text>
                <Text style={styles.tideTime}>
                  {new Date(nextHigh.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.tideLevel}>{nextHigh.value.toFixed(2)} m</Text>
              </View>
            )}
            {nextLow && (
              <View style={styles.tideInfo}>
                <Icon name="trending-down-outline" size={24} color="#FF6B6B" />
                <Text style={styles.tideType}>Low Tide</Text>
                <Text style={styles.tideTime}>
                  {new Date(nextLow.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.tideLevel}>{nextLow.value.toFixed(2)} m</Text>
              </View>
            )}
          </View>
        </View>

        {predictions.length > 0 && (
          <View style={styles.tidePredictionsContainer}>
            <Text style={styles.sectionTitle}>24-Hour Tide Predictions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {predictions.slice(0, 8).map((prediction, index) => (
                <View key={index} style={styles.predictionItem}>
                  <Text style={styles.predictionTime}>
                    {new Date(prediction.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Icon 
                    name={prediction.type === 'H' ? 'trending-up-outline' : 'trending-down-outline'} 
                    size={20} 
                    color={prediction.type === 'H' ? '#007AFF' : '#FF6B6B'} 
                  />
                  <Text style={styles.predictionLevel}>{prediction.value.toFixed(1)}m</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const renderAlerts = () => {
    if (alerts.length === 0) return <Text style={styles.noDataText}>No active marine alerts</Text>;

    return (
      <ScrollView style={styles.alertsContainer}>
        {alerts.map((alert, index) => (
          <TouchableOpacity
            key={alert.id || index}
            style={[styles.alertItem, getAlertStyle(alert.severity)]}
            onPress={() => handleAlertPress(alert)}
          >
            <View style={styles.alertHeader}>
              <Icon 
                name={getAlertIcon(alert.type)} 
                size={24} 
                color={getAlertColor(alert.severity)} 
              />
              <View style={styles.alertTitleContainer}>
                <Text style={[styles.alertTitle, { color: getAlertColor(alert.severity) }]}>
                  {alert.title}
                </Text>
                <Text style={styles.alertSeverity}>{alert.severity.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.alertDescription} numberOfLines={3}>
              {alert.description}
            </Text>
            <View style={styles.alertFooter}>
              <Text style={styles.alertTime}>
                Valid until: {new Date(alert.validTo).toLocaleString()}
              </Text>
              <Text style={styles.alertSource}>Source: {alert.source}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderControls = () => (
    <View style={styles.controlsContainer}>
      <TouchableOpacity
        style={[styles.controlButton, isRealtimeEnabled && styles.activeControl]}
        onPress={toggleRealtimeUpdates}
      >
        <Icon 
          name={isRealtimeEnabled ? "flash" : "flash-off"} 
          size={20} 
          color={isRealtimeEnabled ? "#FFF" : "#666"} 
        />
        <Text style={[styles.controlText, isRealtimeEnabled && styles.activeControlText]}>
          Live Updates
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.controlButton, batteryOptimization && styles.activeControl]}
        onPress={toggleBatteryOptimization}
      >
        <Icon 
          name={batteryOptimization ? "battery-charging" : "battery-half"} 
          size={20} 
          color={batteryOptimization ? "#FFF" : "#666"} 
        />
        <Text style={[styles.controlText, batteryOptimization && styles.activeControlText]}>
          Battery Saver
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (selectedTab) {
      case 'current':
        return renderCurrentWeather();
      case 'forecast':
        return renderForecast();
      case 'tides':
        return renderTides();
      case 'alerts':
        return renderAlerts();
      default:
        return null;
    }
  };

  if (hasError) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={48} color="#FF6B6B" />
          <Text style={styles.errorText}>Failed to load environmental data</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {renderTabButtons()}
      
      <ScrollView
        style={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Icon name="hourglass-outline" size={48} color="#007AFF" />
            <Text style={styles.loadingText}>Loading environmental data...</Text>
          </View>
        ) : (
          renderContent()
        )}
      </ScrollView>

      {showDetailedView && renderControls()}
    </View>
  );
};

// Helper Components
const WeatherMetric: React.FC<{
  icon: string;
  label: string;
  value: string;
  secondary?: string;
}> = ({ icon, label, value, secondary }) => (
  <View style={styles.weatherMetric}>
    <Icon name={icon} size={20} color="#666" />
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    {secondary && <Text style={styles.metricSecondary}>{secondary}</Text>}
  </View>
);

// Helper Functions
const getWeatherIcon = (conditions: string): string => {
  const condition = conditions.toLowerCase();
  if (condition.includes('clear') || condition.includes('sunny')) return 'sunny-outline';
  if (condition.includes('cloud')) return 'cloudy-outline';
  if (condition.includes('rain')) return 'rainy-outline';
  if (condition.includes('storm')) return 'thunderstorm-outline';
  if (condition.includes('fog')) return 'cloud-outline';
  if (condition.includes('wind')) return 'leaf-outline';
  return 'partly-sunny-outline';
};

const getAlertIcon = (type: string): string => {
  switch (type) {
    case 'gale': return 'warning-outline';
    case 'storm': return 'thunderstorm-outline';
    case 'hurricane': return 'warning';
    case 'smallcraft': return 'boat-outline';
    case 'fog': return 'cloud-outline';
    case 'ice': return 'snow-outline';
    default: return 'information-circle-outline';
  }
};

const getAlertColor = (severity: string): string => {
  switch (severity) {
    case 'extreme': return '#8B0000';
    case 'severe': return '#FF4500';
    case 'moderate': return '#FF8C00';
    default: return '#4169E1';
  }
};

const getAlertStyle = (severity: string) => {
  switch (severity) {
    case 'extreme':
      return { borderLeftColor: '#8B0000', backgroundColor: '#FFF5F5' };
    case 'severe':
      return { borderLeftColor: '#FF4500', backgroundColor: '#FFF8F0' };
    case 'moderate':
      return { borderLeftColor: '#FF8C00', backgroundColor: '#FFFBF0' };
    default:
      return { borderLeftColor: '#4169E1', backgroundColor: '#F0F8FF' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabContent: {
    alignItems: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#007AFF',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  // Current Weather Styles
  currentWeatherContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  mainWeatherInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  temperatureContainer: {
    flex: 1,
  },
  temperature: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  conditions: {
    fontSize: 18,
    color: '#666',
    marginTop: 4,
  },
  weatherIcon: {
    alignItems: 'center',
  },
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  weatherMetric: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  metricSecondary: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  swellInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  swellGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Forecast Styles
  forecastScroll: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 16,
  },
  forecastItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
    minWidth: 80,
  },
  forecastTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  forecastIcon: {
    marginBottom: 8,
  },
  forecastTemp: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  forecastWind: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  forecastWave: {
    fontSize: 12,
    color: '#007AFF',
  },
  // Tides Styles
  tidesContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  stationInfo: {
    marginBottom: 20,
  },
  stationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  stationDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  currentTideContainer: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  currentTideInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentTideLevel: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  currentTideQuality: {
    fontSize: 14,
    color: '#666',
  },
  nextTidesContainer: {
    marginBottom: 20,
  },
  nextTidesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tideInfo: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  tideType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  tideTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  tideLevel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 4,
  },
  tidePredictionsContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  predictionItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
    minWidth: 70,
  },
  predictionTime: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  predictionLevel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  // Alerts Styles
  alertsContainer: {
    flex: 1,
  },
  alertItem: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  alertSeverity: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  alertDescription: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTime: {
    fontSize: 12,
    color: '#666',
  },
  alertSource: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  // Control Styles
  controlsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
  },
  activeControl: {
    backgroundColor: '#007AFF',
  },
  controlText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  activeControlText: {
    color: '#FFF',
    fontWeight: '600',
  },
  // Error and Loading Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    padding: 32,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
});

export default EnvironmentalDataDisplay;