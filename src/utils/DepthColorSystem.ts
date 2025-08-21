/**
 * Depth Color System - Marine Safety Color Coding
 * Provides depth-based color coding optimized for marine navigation
 */

// Color definitions optimized for marine conditions and accessibility
export const DepthColors = {
  // Primary safety colors - optimized for sunlight readability
  SAFE_GREEN: '#00C851',        // Deep water - safe navigation
  CAUTION_YELLOW: '#FFB000',    // Minimal clearance - proceed with caution  
  DANGER_RED: '#FF4444',        // Shallow water - avoid or extreme caution
  
  // Secondary indicators
  UNKNOWN_GRAY: '#6C757D',      // No data available
  LOW_CONFIDENCE: '#B0BEC5',    // Uncertain data quality
  VERY_SHALLOW: '#CC0000',      // Extremely shallow - immediate danger
  
  // High contrast variants for bright sunlight conditions
  SAFE_GREEN_HC: '#00A844',
  CAUTION_YELLOW_HC: '#E69500', 
  DANGER_RED_HC: '#E53935',
  
  // Night mode variants - reduced blue light
  SAFE_GREEN_NIGHT: '#26A69A',
  CAUTION_YELLOW_NIGHT: '#FFA726',
  DANGER_RED_NIGHT: '#EF5350',
  
  // Polarized sunglasses variants - enhanced contrast
  SAFE_GREEN_POLAR: '#00D456',
  CAUTION_YELLOW_POLAR: '#FFC107',
  DANGER_RED_POLAR: '#F44336'
};

export interface DepthThresholds {
  vesselDraft: number;          // User's vessel draft in meters
  safetyMargin: number;         // Additional safety clearance in meters
  tideCorrection: number;       // Real-time tide adjustment in meters
  confidenceThreshold: number;  // Minimum data confidence (0-1)
}

export interface RiskProfile {
  safetyMultiplier: number;     // Multiplier for safety margins
  confidenceMin: number;        // Minimum acceptable confidence
  alertSensitivity: number;     // How early to show warnings (0-1)
}

export const RiskProfiles: Record<string, RiskProfile> = {
  conservative: { 
    safetyMultiplier: 2.5, 
    confidenceMin: 0.8,
    alertSensitivity: 0.8
  },
  moderate: { 
    safetyMultiplier: 1.8, 
    confidenceMin: 0.6,
    alertSensitivity: 0.6
  },
  aggressive: { 
    safetyMultiplier: 1.3, 
    confidenceMin: 0.4,
    alertSensitivity: 0.4
  },
  professional: {
    safetyMultiplier: 2.0,
    confidenceMin: 0.7,
    alertSensitivity: 0.7
  }
};

export interface DisplayMode {
  contrast: 'standard' | 'high' | 'night' | 'polarized';
  brightness: number;           // 0.5 - 2.0
  colorBlindness: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

export class DepthColorCalculator {
  private colorPalette: Record<string, string>;
  
  constructor(displayMode: DisplayMode = { contrast: 'standard', brightness: 1.0, colorBlindness: 'none' }) {
    this.colorPalette = this.selectColorPalette(displayMode);
  }
  
  /**
   * Calculate appropriate color for a depth reading
   */
  calculateDepthColor(
    depth: number,
    thresholds: DepthThresholds, 
    confidence: number,
    riskProfile: RiskProfile = RiskProfiles.moderate
  ): string {
    // Handle missing or invalid data
    if (depth === null || depth === undefined || isNaN(depth)) {
      return this.colorPalette.UNKNOWN_GRAY;
    }
    
    // Apply confidence penalty
    if (confidence < thresholds.confidenceThreshold) {
      return this.colorPalette.LOW_CONFIDENCE;
    }
    
    // Calculate effective depth with tide correction
    const effectiveDepth = depth + thresholds.tideCorrection;
    
    // Calculate safety thresholds
    const minSafeDepth = thresholds.vesselDraft + 
                        (thresholds.safetyMargin * riskProfile.safetyMultiplier);
    const cautionDepth = minSafeDepth * 1.5;
    const dangerDepth = minSafeDepth * 0.8;
    const criticalDepth = thresholds.vesselDraft * 0.9;
    
    // Determine color based on safety analysis
    if (effectiveDepth < criticalDepth) {
      return this.colorPalette.VERY_SHALLOW;
    } else if (effectiveDepth < dangerDepth) {
      return this.colorPalette.DANGER_RED;
    } else if (effectiveDepth < minSafeDepth) {
      return this.colorPalette.CAUTION_YELLOW;
    } else if (effectiveDepth < cautionDepth) {
      // Gradient between caution and safe based on confidence
      return confidence > 0.8 ? 
             this.colorPalette.SAFE_GREEN : 
             this.colorPalette.CAUTION_YELLOW;
    } else {
      return this.colorPalette.SAFE_GREEN;
    }
  }
  
  /**
   * Calculate transparency/opacity based on confidence and data age
   */
  calculateOpacity(confidence: number, dataAge: number): number {
    const confidenceOpacity = Math.max(0.3, Math.min(1.0, confidence));
    const ageOpacity = Math.max(0.4, Math.min(1.0, 1 - (dataAge / (24 * 60 * 60 * 1000)))); // 24h decay
    
    return confidenceOpacity * ageOpacity;
  }
  
  /**
   * Calculate point size based on confidence and zoom level
   */
  calculatePointSize(confidence: number, zoomLevel: number, baseSize: number = 8): number {
    const confidenceMultiplier = 0.5 + (confidence * 0.8);
    const zoomMultiplier = Math.max(0.5, Math.min(2.0, zoomLevel / 10));
    
    return Math.round(baseSize * confidenceMultiplier * zoomMultiplier);
  }
  
  /**
   * Get border styling based on data source and quality
   */
  getBorderStyle(confidence: number, source: 'user' | 'official' | 'sensor'): {
    width: number;
    color: string;
    style: 'solid' | 'dashed';
  } {
    const width = confidence > 0.7 ? 2 : 1;
    const color = confidence > 0.7 ? '#FFFFFF' : '#CCCCCC';
    const style = source === 'official' ? 'solid' : 'dashed';
    
    return { width, color, style };
  }
  
  /**
   * Generate gradient colors for depth interpolation
   */
  generateDepthGradient(
    minDepth: number,
    maxDepth: number, 
    thresholds: DepthThresholds,
    steps: number = 10
  ): Array<{ depth: number; color: string }> {
    const gradient = [];
    const depthStep = (maxDepth - minDepth) / (steps - 1);
    
    for (let i = 0; i < steps; i++) {
      const depth = minDepth + (i * depthStep);
      const color = this.calculateDepthColor(depth, thresholds, 1.0);
      gradient.push({ depth, color });
    }
    
    return gradient;
  }
  
  /**
   * Convert color to different formats for various rendering systems
   */
  convertColor(color: string, format: 'hex' | 'rgb' | 'hsl' | 'rgba'): string | number[] {
    const hexColor = color.replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    switch (format) {
      case 'hex':
        return color;
      case 'rgb':
        return [r, g, b];
      case 'rgba':
        return [r, g, b, 255];
      case 'hsl':
        return this.rgbToHsl(r, g, b);
      default:
        return color;
    }
  }
  
  /**
   * Select appropriate color palette based on display conditions
   */
  private selectColorPalette(displayMode: DisplayMode): Record<string, string> {
    let basePalette = DepthColors;
    
    // Select base palette based on contrast mode
    switch (displayMode.contrast) {
      case 'high':
        basePalette = {
          ...DepthColors,
          SAFE_GREEN: DepthColors.SAFE_GREEN_HC,
          CAUTION_YELLOW: DepthColors.CAUTION_YELLOW_HC,
          DANGER_RED: DepthColors.DANGER_RED_HC
        };
        break;
      case 'night':
        basePalette = {
          ...DepthColors,
          SAFE_GREEN: DepthColors.SAFE_GREEN_NIGHT,
          CAUTION_YELLOW: DepthColors.CAUTION_YELLOW_NIGHT,
          DANGER_RED: DepthColors.DANGER_RED_NIGHT
        };
        break;
      case 'polarized':
        basePalette = {
          ...DepthColors,
          SAFE_GREEN: DepthColors.SAFE_GREEN_POLAR,
          CAUTION_YELLOW: DepthColors.CAUTION_YELLOW_POLAR,
          DANGER_RED: DepthColors.DANGER_RED_POLAR
        };
        break;
    }
    
    // Apply colorblind adjustments
    if (displayMode.colorBlindness !== 'none') {
      basePalette = this.adjustForColorBlindness(basePalette, displayMode.colorBlindness);
    }
    
    // Apply brightness adjustments
    if (displayMode.brightness !== 1.0) {
      basePalette = this.adjustBrightness(basePalette, displayMode.brightness);
    }
    
    return basePalette;
  }
  
  /**
   * Adjust colors for color blindness accessibility
   */
  private adjustForColorBlindness(
    palette: Record<string, string>, 
    type: 'protanopia' | 'deuteranopia' | 'tritanopia'
  ): Record<string, string> {
    // Color blind friendly alternatives
    const adjustedPalette = { ...palette };
    
    switch (type) {
      case 'protanopia': // Red-blind
        adjustedPalette.DANGER_RED = '#FF6B1A'; // Orange instead of red
        adjustedPalette.SAFE_GREEN = '#0099CC'; // Blue-green
        break;
      case 'deuteranopia': // Green-blind  
        adjustedPalette.SAFE_GREEN = '#0099CC'; // Blue
        adjustedPalette.CAUTION_YELLOW = '#FFCC00'; // More saturated yellow
        break;
      case 'tritanopia': // Blue-blind
        adjustedPalette.SAFE_GREEN = '#00CC66'; // More green
        adjustedPalette.CAUTION_YELLOW = '#FF9900'; // Orange-yellow
        break;
    }
    
    return adjustedPalette;
  }
  
  /**
   * Adjust overall brightness of color palette
   */
  private adjustBrightness(
    palette: Record<string, string>, 
    brightness: number
  ): Record<string, string> {
    const adjustedPalette: Record<string, string> = {};
    
    Object.entries(palette).forEach(([key, color]) => {
      const [r, g, b] = this.convertColor(color, 'rgb') as number[];
      const adjustedR = Math.min(255, Math.max(0, r * brightness));
      const adjustedG = Math.min(255, Math.max(0, g * brightness));
      const adjustedB = Math.min(255, Math.max(0, b * brightness));
      
      adjustedPalette[key] = `#${Math.round(adjustedR).toString(16).padStart(2, '0')}${Math.round(adjustedG).toString(16).padStart(2, '0')}${Math.round(adjustedB).toString(16).padStart(2, '0')}`;
    });
    
    return adjustedPalette;
  }
  
  /**
   * Convert RGB to HSL color space
   */
  private rgbToHsl(r: number, g: number, b: number): number[] {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0; // Achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: h = 0;
      }
      h /= 6;
    }
    
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }
}

/**
 * Confidence visualization utilities
 */
export class ConfidenceIndicator {
  /**
   * Calculate visual indicators for data confidence
   */
  static getVisualizationProperties(confidence: number): {
    pointRadius: number;
    opacity: number;
    borderStyle: { width: number; color: string };
    pulseAnimation: boolean;
  } {
    return {
      pointRadius: Math.max(4, confidence * 12),
      opacity: Math.max(0.3, confidence * 0.9),
      borderStyle: {
        width: confidence > 0.7 ? 2 : 1,
        color: confidence > 0.7 ? '#FFFFFF' : '#CCCCCC'
      },
      pulseAnimation: confidence < 0.5
    };
  }
  
  /**
   * Generate confidence-based label text
   */
  static getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.9) return 'Verified';
    if (confidence >= 0.7) return 'High Confidence';
    if (confidence >= 0.5) return 'Moderate';
    if (confidence >= 0.3) return 'Low Confidence';
    return 'Unverified';
  }
}

export default DepthColorCalculator;