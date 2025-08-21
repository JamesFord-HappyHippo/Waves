/**
 * Environmental Conditions Display Component
 * Shows weather, tide, and marine conditions relevant to depth readings
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  waveHeight: number;
  visibility: number;
  conditions: string;
}

interface TideData {
  currentLevel: number;
  nextHigh: {time: number; level: number};
  nextLow: {time: number; level: number};
  station: string;
}

interface EnvironmentalConditionsProps {
  weather?: WeatherData;
  tideData?: TideData;
  style?: ViewStyle;
  compact?: boolean;
}

export const EnvironmentalConditions: React.FC<EnvironmentalConditionsProps> = ({
  weather,
  tideData,
  style,
  compact = false,
}) => {
  const getWeatherIcon = (conditions: string): string => {
    const condition = conditions.toLowerCase();
    if (condition.includes('clear') || condition.includes('sunny')) return 'weather-sunny';
    if (condition.includes('cloud')) return 'weather-cloudy';
    if (condition.includes('rain')) return 'weather-rainy';
    if (condition.includes('storm')) return 'weather-lightning-rainy';
    if (condition.includes('fog')) return 'weather-fog';
    if (condition.includes('wind')) return 'weather-windy';
    return 'weather-partly-cloudy';
  };

  const getWindDirection = (degrees: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
  };

  const getTideDirection = (current: number, nextHigh: number, nextLow: number): 'rising' | 'falling' | 'slack' => {
    const nextHighTime = nextHigh;
    const nextLowTime = nextLow;
    
    if (nextHighTime < nextLowTime) {
      return 'rising';
    } else if (nextLowTime < nextHighTime) {
      return 'falling';
    }
    return 'slack';
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getVisibilityDescription = (visibility: number): string => {
    if (visibility >= 10) return 'Excellent';
    if (visibility >= 5) return 'Good';
    if (visibility >= 2) return 'Fair';
    return 'Poor';
  };

  const getSeaStateDescription = (waveHeight: number): string => {
    if (waveHeight < 0.1) return 'Calm';
    if (waveHeight < 0.5) return 'Smooth';
    if (waveHeight < 1.25) return 'Slight';
    if (waveHeight < 2.5) return 'Moderate';
    if (waveHeight < 4) return 'Rough';
    if (waveHeight < 6) return 'Very Rough';
    if (waveHeight < 9) return 'High';
    if (waveHeight < 14) return 'Very High';
    return 'Phenomenal';
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        {weather && (
          <View style={styles.compactItem}>
            <Icon name={getWeatherIcon(weather.conditions)} size={16} color="#007AFF" />
            <Text style={styles.compactText}>
              {Math.round(weather.temperature)}°C
            </Text>
          </View>
        )}
        
        {weather && weather.windSpeed > 0 && (
          <View style={styles.compactItem}>
            <Icon name="weather-windy" size={16} color="#007AFF" />
            <Text style={styles.compactText}>
              {Math.round(weather.windSpeed)} kts
            </Text>
          </View>
        )}
        
        {tideData && (
          <View style={styles.compactItem}>
            <Icon 
              name={getTideDirection(tideData.currentLevel, tideData.nextHigh.time, tideData.nextLow.time) === 'rising' ? 'arrow-up' : 'arrow-down'} 
              size={16} 
              color="#007AFF" 
            />
            <Text style={styles.compactText}>
              {tideData.currentLevel > 0 ? '+' : ''}{tideData.currentLevel.toFixed(1)}m
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Environmental Conditions</Text>
      
      {weather && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="weather-cloudy" size={20} color="#007AFF" />
            <Text style={styles.sectionTitle}>Weather</Text>
          </View>
          
          <View style={styles.conditionsGrid}>
            <View style={styles.conditionItem}>
              <Icon name={getWeatherIcon(weather.conditions)} size={24} color="#007AFF" />
              <Text style={styles.conditionLabel}>Conditions</Text>
              <Text style={styles.conditionValue}>{weather.conditions}</Text>
            </View>
            
            <View style={styles.conditionItem}>
              <Icon name="thermometer" size={24} color="#007AFF" />
              <Text style={styles.conditionLabel}>Temperature</Text>
              <Text style={styles.conditionValue}>{Math.round(weather.temperature)}°C</Text>
            </View>
            
            <View style={styles.conditionItem}>
              <Icon name="weather-windy" size={24} color="#007AFF" />
              <Text style={styles.conditionLabel}>Wind</Text>
              <Text style={styles.conditionValue}>
                {Math.round(weather.windSpeed)} kts {getWindDirection(weather.windDirection)}
              </Text>
            </View>
            
            <View style={styles.conditionItem}>
              <Icon name="waves" size={24} color="#007AFF" />
              <Text style={styles.conditionLabel}>Wave Height</Text>
              <Text style={styles.conditionValue}>
                {weather.waveHeight.toFixed(1)}m ({getSeaStateDescription(weather.waveHeight)})
              </Text>
            </View>
            
            <View style={styles.conditionItem}>
              <Icon name="eye" size={24} color="#007AFF" />
              <Text style={styles.conditionLabel}>Visibility</Text>
              <Text style={styles.conditionValue}>
                {weather.visibility.toFixed(1)}nm ({getVisibilityDescription(weather.visibility)})
              </Text>
            </View>
          </View>
        </View>
      )}
      
      {tideData && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="waves" size={20} color="#007AFF" />
            <Text style={styles.sectionTitle}>Tides</Text>
          </View>
          
          <View style={styles.tideInfo}>
            <View style={styles.tideCurrentContainer}>
              <View style={styles.tideCurrentLevel}>
                <Text style={styles.tideCurrentValue}>
                  {tideData.currentLevel > 0 ? '+' : ''}{tideData.currentLevel.toFixed(1)}m
                </Text>
                <Text style={styles.tideCurrentLabel}>Current Level</Text>
              </View>
              
              <View style={styles.tideDirection}>
                <Icon 
                  name={getTideDirection(tideData.currentLevel, tideData.nextHigh.time, tideData.nextLow.time) === 'rising' ? 'arrow-up' : 'arrow-down'} 
                  size={20} 
                  color={getTideDirection(tideData.currentLevel, tideData.nextHigh.time, tideData.nextLow.time) === 'rising' ? '#34C759' : '#FF3B30'} 
                />
                <Text style={styles.tideDirectionText}>
                  {getTideDirection(tideData.currentLevel, tideData.nextHigh.time, tideData.nextLow.time) === 'rising' ? 'Rising' : 'Falling'}
                </Text>
              </View>
            </View>
            
            <View style={styles.tidePredictions}>
              <View style={styles.tidePrediction}>
                <Text style={styles.tidePredictionLabel}>Next High</Text>
                <Text style={styles.tidePredictionValue}>
                  {formatTime(tideData.nextHigh.time)} ({tideData.nextHigh.level.toFixed(1)}m)
                </Text>
              </View>
              
              <View style={styles.tidePrediction}>
                <Text style={styles.tidePredictionLabel}>Next Low</Text>
                <Text style={styles.tidePredictionValue}>
                  {formatTime(tideData.nextLow.time)} ({tideData.nextLow.level.toFixed(1)}m)
                </Text>
              </View>
            </View>
            
            <Text style={styles.tideStation}>Station: {tideData.station}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 15,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 8,
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactText: {
    fontSize: 12,
    color: '#1C1C1E',
    marginLeft: 4,
    fontWeight: '500',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 15,
  },
  section: {
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
  },
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  conditionItem: {
    alignItems: 'center',
    width: '30%',
    marginBottom: 15,
  },
  conditionLabel: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  conditionValue: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  tideInfo: {
    alignItems: 'center',
  },
  tideCurrentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  tideCurrentLevel: {
    alignItems: 'center',
    marginRight: 20,
  },
  tideCurrentValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  tideCurrentLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  tideDirection: {
    alignItems: 'center',
  },
  tideDirectionText: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '600',
    marginTop: 2,
  },
  tidePredictions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 10,
  },
  tidePrediction: {
    alignItems: 'center',
    flex: 1,
  },
  tidePredictionLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  tidePredictionValue: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '600',
    textAlign: 'center',
  },
  tideStation: {
    fontSize: 10,
    color: '#8E8E93',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});