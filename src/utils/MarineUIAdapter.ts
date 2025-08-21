/**
 * Marine UI Adapter - Optimizes interface for marine conditions
 * Handles sun glare, vessel motion, spray, and visibility challenges
 */

import { Platform, StatusBar, Dimensions } from 'react-native';
import { BrightnessManager } from './BrightnessManager';
import { HapticFeedbackManager } from './HapticFeedbackManager';

export interface MarineConditions {
  sunGlare: 'none' | 'moderate' | 'severe';
  motion: 'calm' | 'moderate' | 'rough';
  visibility: 'excellent' | 'good' | 'poor';
  spray: boolean;
  windSpeed: number; // knots
  seaState: number;  // 0-9 scale
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
}

export interface UIAdaptations {
  brightness: number;           // 0.3 - 2.0
  contrast: number;            // 0.5 - 2.0  
  fontSize: number;            // 0.8 - 1.5 multiplier
  buttonSize: number;          // 0.8 - 1.5 multiplier
  hapticStrength: number;      // 0.0 - 1.0
  colorMode: 'standard' | 'high_contrast' | 'night' | 'polarized';
  animationSpeed: number;      // 0.3 - 1.0 multiplier
  touchSensitivity: number;    // 0.5 - 1.5
}

export interface TouchTarget {
  minSize: number;            // Minimum touch target size
  spacing: number;            // Space between targets
  feedback: 'visual' | 'haptic' | 'both';
}

export class MarineUIAdapter {
  private currentAdaptations: UIAdaptations;
  private brightnessManager: BrightnessManager;
  private hapticManager: HapticFeedbackManager;
  
  constructor() {
    this.currentAdaptations = this.getDefaultAdaptations();
    this.brightnessManager = new BrightnessManager();
    this.hapticManager = new HapticFeedbackManager();
  }
  
  /**
   * Adapt UI based on current marine conditions
   */
  adaptForConditions(conditions: MarineConditions): UIAdaptations {
    let adaptations = { ...this.getDefaultAdaptations() };
    
    // Sun glare adaptations
    adaptations = this.adaptForSunGlare(adaptations, conditions.sunGlare);
    
    // Motion adaptations
    adaptations = this.adaptForMotion(adaptations, conditions.motion, conditions.seaState);
    
    // Visibility adaptations  
    adaptations = this.adaptForVisibility(adaptations, conditions.visibility);
    
    // Time of day adaptations
    adaptations = this.adaptForTimeOfDay(adaptations, conditions.timeOfDay);
    
    // Spray and weather adaptations
    if (conditions.spray || conditions.windSpeed > 15) {
      adaptations = this.adaptForWetConditions(adaptations);
    }
    
    this.currentAdaptations = adaptations;
    this.applyAdaptations(adaptations);
    
    return adaptations;
  }
  
  /**
   * Adapt for sun glare conditions
   */
  private adaptForSunGlare(adaptations: UIAdaptations, glareLevel: string): UIAdaptations {
    switch (glareLevel) {
      case 'severe':
        return {
          ...adaptations,
          brightness: 2.0,
          contrast: 2.0,
          fontSize: 1.3,
          buttonSize: 1.4,
          colorMode: 'high_contrast'
        };
      case 'moderate':
        return {
          ...adaptations,
          brightness: 1.6,
          contrast: 1.5,
          fontSize: 1.15,
          buttonSize: 1.2,
          colorMode: 'high_contrast'
        };
      default:
        return adaptations;
    }
  }
  
  /**
   * Adapt for vessel motion
   */
  private adaptForMotion(
    adaptations: UIAdaptations, 
    motionLevel: string,
    seaState: number
  ): UIAdaptations {
    const motionMultiplier = Math.min(1.5, 1.0 + (seaState * 0.1));
    
    switch (motionLevel) {
      case 'rough':
        return {
          ...adaptations,
          buttonSize: 1.5 * motionMultiplier,
          fontSize: 1.3 * motionMultiplier,
          hapticStrength: 1.0,
          touchSensitivity: 0.7, // Reduce accidental touches
          animationSpeed: 0.5    // Slower animations for stability
        };
      case 'moderate':
        return {
          ...adaptations,
          buttonSize: 1.2 * motionMultiplier,
          fontSize: 1.1 * motionMultiplier,
          hapticStrength: 0.8,
          touchSensitivity: 0.8,
          animationSpeed: 0.7
        };
      default:
        return adaptations;
    }
  }
  
  /**
   * Adapt for visibility conditions
   */
  private adaptForVisibility(adaptations: UIAdaptations, visibility: string): UIAdaptations {
    switch (visibility) {
      case 'poor':
        return {
          ...adaptations,
          brightness: Math.max(adaptations.brightness, 1.8),
          contrast: Math.max(adaptations.contrast, 1.8),
          fontSize: Math.max(adaptations.fontSize, 1.3),
          colorMode: 'high_contrast',
          hapticStrength: 1.0 // Rely more on haptic feedback
        };
      case 'good':
        return {
          ...adaptations,
          brightness: Math.max(adaptations.brightness, 1.2),
          contrast: Math.max(adaptations.contrast, 1.2)
        };
      default:
        return adaptations;
    }
  }
  
  /**
   * Adapt for time of day
   */
  private adaptForTimeOfDay(adaptations: UIAdaptations, timeOfDay: string): UIAdaptations {
    switch (timeOfDay) {
      case 'night':
        return {
          ...adaptations,
          brightness: 0.4,
          colorMode: 'night',
          fontSize: Math.max(adaptations.fontSize, 1.2),
          hapticStrength: Math.max(adaptations.hapticStrength, 0.8)
        };
      case 'dawn':
      case 'dusk':
        return {
          ...adaptations,
          brightness: 0.8,
          contrast: 1.3,
          fontSize: Math.max(adaptations.fontSize, 1.1)
        };
      default:
        return adaptations;
    }
  }
  
  /**
   * Adapt for wet/spray conditions
   */
  private adaptForWetConditions(adaptations: UIAdaptations): UIAdaptations {
    return {
      ...adaptations,
      touchSensitivity: 0.6,    // Reduce false touches from water
      buttonSize: Math.max(adaptations.buttonSize, 1.3),
      hapticStrength: Math.max(adaptations.hapticStrength, 0.9),
      animationSpeed: 0.8       // Reduce distracting animations
    };
  }
  
  /**
   * Calculate optimal touch targets for current conditions
   */
  calculateTouchTargets(conditions: MarineConditions): TouchTarget {
    const baseSize = 44; // iOS HIG minimum
    const motionMultiplier = conditions.motion === 'rough' ? 1.8 : 
                            conditions.motion === 'moderate' ? 1.4 : 1.0;
    const sprayMultiplier = conditions.spray ? 1.2 : 1.0;
    
    return {
      minSize: Math.round(baseSize * motionMultiplier * sprayMultiplier),
      spacing: Math.round(12 * motionMultiplier),
      feedback: conditions.motion === 'calm' ? 'visual' : 'both'
    };
  }
  
  /**
   * Get text scaling for current conditions
   */
  calculateTextScaling(conditions: MarineConditions): number {
    let scale = 1.0;
    
    // Sun glare scaling
    if (conditions.sunGlare === 'severe') scale *= 1.3;
    else if (conditions.sunGlare === 'moderate') scale *= 1.15;
    
    // Motion scaling
    if (conditions.motion === 'rough') scale *= 1.2;
    else if (conditions.motion === 'moderate') scale *= 1.1;
    
    // Visibility scaling
    if (conditions.visibility === 'poor') scale *= 1.25;
    
    return Math.min(1.6, scale); // Cap at 60% increase
  }
  
  /**
   * Generate color adjustments for conditions
   */
  getColorAdjustments(conditions: MarineConditions): {
    saturation: number;
    brightness: number;
    contrast: number;
    hueShift: number;
  } {
    let adjustments = {
      saturation: 1.0,
      brightness: 1.0,
      contrast: 1.0,
      hueShift: 0
    };
    
    // Polarized sunglasses adjustment
    if (conditions.sunGlare === 'severe') {
      adjustments.saturation = 1.3;
      adjustments.contrast = 1.5;
      adjustments.brightness = 1.4;
    }
    
    // Night vision preservation
    if (conditions.timeOfDay === 'night') {
      adjustments.brightness = 0.4;
      adjustments.hueShift = -10; // Reduce blue light
    }
    
    // Poor visibility enhancement
    if (conditions.visibility === 'poor') {
      adjustments.saturation = 1.4;
      adjustments.contrast = 1.6;
    }
    
    return adjustments;
  }
  
  /**
   * Apply adaptations to the UI
   */
  private applyAdaptations(adaptations: UIAdaptations): void {
    // Brightness adjustment
    this.brightnessManager.setBrightness(adaptations.brightness);
    
    // Haptic feedback setup
    this.hapticManager.setStrength(adaptations.hapticStrength);
    
    // Status bar adjustments
    if (Platform.OS === 'ios') {
      StatusBar.setBarStyle(
        adaptations.colorMode === 'night' ? 'light-content' : 'dark-content'
      );
    }
  }
  
  /**
   * Get default UI adaptations
   */
  private getDefaultAdaptations(): UIAdaptations {
    return {
      brightness: 1.0,
      contrast: 1.0,
      fontSize: 1.0,
      buttonSize: 1.0,
      hapticStrength: 0.6,
      colorMode: 'standard',
      animationSpeed: 1.0,
      touchSensitivity: 1.0
    };
  }
  
  /**
   * Enable emergency UI mode for critical situations
   */
  enableEmergencyMode(): UIAdaptations {
    const emergencyAdaptations: UIAdaptations = {
      brightness: 2.0,
      contrast: 2.0,
      fontSize: 1.5,
      buttonSize: 1.6,
      hapticStrength: 1.0,
      colorMode: 'high_contrast',
      animationSpeed: 0.3,
      touchSensitivity: 0.6
    };
    
    this.currentAdaptations = emergencyAdaptations;
    this.applyAdaptations(emergencyAdaptations);
    
    return emergencyAdaptations;
  }
  
  /**
   * Enable battery conservation mode
   */
  enableBatteryConservationMode(): UIAdaptations {
    const batteryAdaptations: UIAdaptations = {
      ...this.currentAdaptations,
      brightness: Math.min(this.currentAdaptations.brightness, 0.6),
      animationSpeed: 0.5,
      hapticStrength: Math.min(this.currentAdaptations.hapticStrength, 0.3)
    };
    
    this.currentAdaptations = batteryAdaptations;
    this.applyAdaptations(batteryAdaptations);
    
    return batteryAdaptations;
  }
  
  /**
   * Get current adaptations
   */
  getCurrentAdaptations(): UIAdaptations {
    return { ...this.currentAdaptations };
  }
  
  /**
   * Test if conditions require UI adaptations
   */
  shouldAdapt(conditions: MarineConditions): boolean {
    return (
      conditions.sunGlare !== 'none' ||
      conditions.motion !== 'calm' ||
      conditions.visibility !== 'excellent' ||
      conditions.spray ||
      conditions.seaState > 2 ||
      conditions.timeOfDay === 'night'
    );
  }
}

/**
 * Brightness management utility
 */
class BrightnessManager {
  private originalBrightness: number = 1.0;
  
  async setBrightness(level: number): Promise<void> {
    try {
      // Store original brightness on first change
      if (this.originalBrightness === 1.0) {
        // Get current system brightness
        // Implementation would use native modules
      }
      
      // Set new brightness level
      const adjustedLevel = Math.max(0.1, Math.min(1.0, level / 2.0));
      // Implementation would use react-native-brightness or similar
      
    } catch (error) {
      console.warn('Could not adjust screen brightness:', error);
    }
  }
  
  async restoreOriginalBrightness(): Promise<void> {
    await this.setBrightness(this.originalBrightness);
  }
}

/**
 * Haptic feedback management utility
 */
class HapticFeedbackManager {
  private strength: number = 0.6;
  
  setStrength(strength: number): void {
    this.strength = Math.max(0.0, Math.min(1.0, strength));
  }
  
  triggerImpact(type: 'light' | 'medium' | 'heavy' = 'medium'): void {
    if (this.strength === 0) return;
    
    // Implementation would use react-native-haptic-feedback
    // or @react-native-community/react-native-haptic-feedback
  }
  
  triggerNotification(type: 'success' | 'warning' | 'error'): void {
    if (this.strength === 0) return;
    
    // Implementation would use haptic feedback library
  }
  
  triggerSelection(): void {
    if (this.strength === 0) return;
    
    // Implementation would use haptic feedback library
  }
}

export { BrightnessManager, HapticFeedbackManager };