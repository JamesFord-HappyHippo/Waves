/**
 * Depth Quality Indicator Component
 * Visual indicator for depth reading data quality and confidence
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  warnings: string[];
  errors: string[];
  qualityScore: {
    gpsAccuracy: number;
    environmentalFactors: number;
    dataConsistency: number;
    overall: number;
  };
}

interface DepthQualityIndicatorProps {
  validation: ValidationResult;
  style?: ViewStyle;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

export const DepthQualityIndicator: React.FC<DepthQualityIndicatorProps> = ({
  validation,
  style,
  size = 'medium',
  showDetails = false,
}) => {
  const getQualityLevel = (score: number): 'high' | 'medium' | 'low' => {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  };

  const getQualityColor = (level: 'high' | 'medium' | 'low'): string => {
    switch (level) {
      case 'high': return '#34C759';
      case 'medium': return '#FF9500';
      case 'low': return '#FF3B30';
    }
  };

  const getQualityIcon = (level: 'high' | 'medium' | 'low'): string => {
    switch (level) {
      case 'high': return 'shield-check';
      case 'medium': return 'shield-alert';
      case 'low': return 'shield-remove';
    }
  };

  const getQualityText = (level: 'high' | 'medium' | 'low'): string => {
    switch (level) {
      case 'high': return 'High Quality';
      case 'medium': return 'Good Quality';
      case 'low': return 'Low Quality';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          iconSize: 16,
          fontSize: 10,
          padding: 6,
        };
      case 'medium':
        return {
          iconSize: 20,
          fontSize: 12,
          padding: 8,
        };
      case 'large':
        return {
          iconSize: 24,
          fontSize: 14,
          padding: 10,
        };
    }
  };

  const overallLevel = getQualityLevel(validation.qualityScore.overall);
  const qualityColor = getQualityColor(overallLevel);
  const qualityIcon = getQualityIcon(overallLevel);
  const qualityText = getQualityText(overallLevel);
  const sizeStyles = getSizeStyles();

  if (!validation.isValid) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Icon name="alert-circle" size={sizeStyles.iconSize} color="#FF3B30" />
        <Text style={[styles.text, { fontSize: sizeStyles.fontSize, color: '#FF3B30' }]}>
          Invalid
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View 
        style={[
          styles.indicator, 
          { backgroundColor: qualityColor, padding: sizeStyles.padding }
        ]}
      >
        <Icon name={qualityIcon} size={sizeStyles.iconSize} color="#FFFFFF" />
        <Text style={[styles.indicatorText, { fontSize: sizeStyles.fontSize }]}>
          {Math.round(validation.confidence * 100)}%
        </Text>
      </View>
      
      {showDetails && (
        <View style={styles.details}>
          <Text style={[styles.qualityLabel, { fontSize: sizeStyles.fontSize }]}>
            {qualityText}
          </Text>
          
          <View style={styles.scoreBreakdown}>
            <View style={styles.scoreItem}>
              <View style={styles.scoreBar}>
                <View 
                  style={[
                    styles.scoreProgress, 
                    { 
                      width: `${validation.qualityScore.gpsAccuracy * 100}%`,
                      backgroundColor: getQualityColor(getQualityLevel(validation.qualityScore.gpsAccuracy)),
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.scoreLabel, { fontSize: sizeStyles.fontSize - 1 }]}>
                GPS
              </Text>
            </View>
            
            <View style={styles.scoreItem}>
              <View style={styles.scoreBar}>
                <View 
                  style={[
                    styles.scoreProgress, 
                    { 
                      width: `${validation.qualityScore.environmentalFactors * 100}%`,
                      backgroundColor: getQualityColor(getQualityLevel(validation.qualityScore.environmentalFactors)),
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.scoreLabel, { fontSize: sizeStyles.fontSize - 1 }]}>
                ENV
              </Text>
            </View>
            
            <View style={styles.scoreItem}>
              <View style={styles.scoreBar}>
                <View 
                  style={[
                    styles.scoreProgress, 
                    { 
                      width: `${validation.qualityScore.dataConsistency * 100}%`,
                      backgroundColor: getQualityColor(getQualityLevel(validation.qualityScore.dataConsistency)),
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.scoreLabel, { fontSize: sizeStyles.fontSize - 1 }]}>
                CONS
              </Text>
            </View>
          </View>
          
          {validation.warnings.length > 0 && (
            <View style={styles.warningsContainer}>
              <Icon name="alert-outline" size={12} color="#FF9500" />
              <Text style={[styles.warningsText, { fontSize: sizeStyles.fontSize - 1 }]}>
                {validation.warnings.length} warning{validation.warnings.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  indicatorText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  errorContainer: {
    backgroundColor: '#FFE6E6',
    borderRadius: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    marginLeft: 4,
    fontWeight: '600',
  },
  details: {
    marginTop: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  qualityLabel: {
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  scoreBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  scoreItem: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 2,
  },
  scoreBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#F2F2F7',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  scoreProgress: {
    height: '100%',
    borderRadius: 2,
  },
  scoreLabel: {
    color: '#8E8E93',
    fontWeight: '500',
  },
  warningsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  warningsText: {
    color: '#FF9500',
    marginLeft: 4,
    fontWeight: '500',
  },
});