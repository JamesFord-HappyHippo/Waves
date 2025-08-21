/**
 * Environmental Data Processing Service
 * Tide correction algorithms and environmental factor calculations
 */

import { Location, DepthReading } from '../../types';
import { TidePrediction, WaterLevel, NoaaStation, MeteorologicalData } from './NoaaApiClient';
import { MarineWeatherExtended } from './WeatherApiClient';

export interface TideCorrection {
  originalDepth: number;
  correctedDepth: number;
  tideHeight: number;
  correctionApplied: number;
  datum: string;
  station: NoaaStation;
  confidence: number;
  method: 'interpolated' | 'predicted' | 'observed' | 'estimated';
}

export interface EnvironmentalFactors {
  windCorrection: number;
  currentCorrection: number;
  pressureCorrection: number;
  temperatureCorrection: number;
  salinityCorrection: number;
  totalCorrection: number;
  confidence: number;
}

export interface QualityScore {
  score: number; // 0-1
  factors: {
    dataAge: number; // 0-1, newer is better
    stationDistance: number; // 0-1, closer is better
    environmentalConditions: number; // 0-1, calmer is better
    dataSource: number; // 0-1, official sources score higher
    instrumentAccuracy: number; // 0-1, better instruments score higher
  };
  warnings: string[];
}

export interface ProcessedDepthReading extends DepthReading {
  tideCorrection: TideCorrection;
  environmentalFactors: EnvironmentalFactors;
  qualityScore: QualityScore;
  safetyMargin: number;
  reliability: 'high' | 'medium' | 'low' | 'unreliable';
}

export class DataProcessingService {
  private readonly EARTH_RADIUS = 6371000; // meters
  private readonly STANDARD_ATMOSPHERE = 1013.25; // hPa
  private readonly SPEED_OF_SOUND_WATER = 1500; // m/s at 15°C
  
  /**
   * Apply comprehensive tide correction to depth reading
   */
  async applyTideCorrection(
    depthReading: DepthReading,
    station: NoaaStation,
    tidePredictions: TidePrediction[],
    currentWaterLevel?: WaterLevel
  ): Promise<TideCorrection> {
    
    const readingTime = new Date(depthReading.timestamp);
    let tideHeight = 0;
    let method: TideCorrection['method'] = 'estimated';
    let confidence = 0.5;

    // Use observed water level if available and recent (within 1 hour)
    if (currentWaterLevel && 
        Math.abs(new Date(currentWaterLevel.time).getTime() - readingTime.getTime()) < 60 * 60 * 1000) {
      tideHeight = currentWaterLevel.value;
      method = 'observed';
      confidence = currentWaterLevel.quality === 'verified' ? 0.95 : 0.85;
    }
    // Otherwise interpolate from predictions
    else if (tidePredictions.length >= 2) {
      const interpolated = this.interpolateTideHeight(readingTime, tidePredictions);
      tideHeight = interpolated.height;
      method = 'interpolated';
      confidence = interpolated.confidence;
    }
    // Fallback to nearest prediction
    else if (tidePredictions.length > 0) {
      const nearest = this.findNearestTidePrediction(readingTime, tidePredictions);
      tideHeight = nearest.value;
      method = 'predicted';
      confidence = 0.7; // Lower confidence for single point
    }

    // Adjust confidence based on station distance
    const distance = this.calculateDistance(
      depthReading.latitude, depthReading.longitude,
      station.latitude, station.longitude
    );
    
    // Reduce confidence for distant stations (>10km reduces confidence)
    if (distance > 10000) {
      confidence *= Math.max(0.3, 1 - (distance - 10000) / 50000);
    }

    const correctionApplied = tideHeight;
    const correctedDepth = depthReading.depth - correctionApplied;

    return {
      originalDepth: depthReading.depth,
      correctedDepth,
      tideHeight,
      correctionApplied,
      datum: 'MLLW', // Mean Lower Low Water
      station,
      confidence,
      method
    };
  }

  /**
   * Calculate environmental corrections for depth readings
   */
  calculateEnvironmentalFactors(
    depthReading: DepthReading,
    weather: MarineWeatherExtended,
    meteorological?: MeteorologicalData[]
  ): EnvironmentalFactors {
    
    const windCorrection = this.calculateWindCorrection(weather);
    const currentCorrection = this.calculateCurrentCorrection(weather);
    const pressureCorrection = this.calculatePressureCorrection(weather.barometricPressure);
    const temperatureCorrection = this.calculateTemperatureCorrection(weather.temperature);
    const salinityCorrection = this.calculateSalinityCorrection(depthReading.latitude, depthReading.longitude);

    const totalCorrection = windCorrection + currentCorrection + pressureCorrection + 
                           temperatureCorrection + salinityCorrection;

    // Calculate confidence based on data quality and environmental conditions
    const confidence = this.calculateEnvironmentalConfidence(weather, meteorological);

    return {
      windCorrection,
      currentCorrection,
      pressureCorrection,
      temperatureCorrection,
      salinityCorrection,
      totalCorrection,
      confidence
    };
  }

  /**
   * Calculate comprehensive quality score for depth reading
   */
  calculateQualityScore(
    depthReading: DepthReading,
    station: NoaaStation,
    weather: MarineWeatherExtended,
    dataAge: number
  ): QualityScore {
    
    const warnings: string[] = [];
    
    // Data age factor (fresher data is better)
    const ageHours = dataAge / (1000 * 60 * 60);
    const dataAge_score = Math.max(0, 1 - ageHours / 24); // Degrades over 24 hours
    if (ageHours > 6) warnings.push('Data older than 6 hours');

    // Station distance factor
    const distance = this.calculateDistance(
      depthReading.latitude, depthReading.longitude,
      station.latitude, station.longitude
    );
    const stationDistance_score = Math.max(0, 1 - distance / 50000); // Degrades over 50km
    if (distance > 20000) warnings.push('Tide station is far from reading location');

    // Environmental conditions factor (calmer conditions are better for accuracy)
    const environmentalConditions_score = this.calculateEnvironmentalStability(weather);
    if (weather.windSpeed > 10) warnings.push('High wind conditions may affect depth accuracy');
    if (weather.waveHeight > 2) warnings.push('High wave conditions may affect depth accuracy');

    // Data source factor
    const dataSource_score = this.getSourceReliability(depthReading.source);
    if (depthReading.source === 'predicted') warnings.push('Depth reading is predicted, not measured');

    // Instrument accuracy factor
    const instrumentAccuracy_score = this.estimateInstrumentAccuracy(depthReading);
    if (depthReading.confidenceScore < 0.7) warnings.push('Low confidence depth reading');

    const factors = {
      dataAge: dataAge_score,
      stationDistance: stationDistance_score,
      environmentalConditions: environmentalConditions_score,
      dataSource: dataSource_score,
      instrumentAccuracy: instrumentAccuracy_score
    };

    // Weighted average of factors
    const score = (
      factors.dataAge * 0.2 +
      factors.stationDistance * 0.2 +
      factors.environmentalConditions * 0.25 +
      factors.dataSource * 0.2 +
      factors.instrumentAccuracy * 0.15
    );

    return {
      score,
      factors,
      warnings
    };
  }

  /**
   * Process depth reading with full environmental corrections
   */
  async processDepthReading(
    depthReading: DepthReading,
    station: NoaaStation,
    tidePredictions: TidePrediction[],
    weather: MarineWeatherExtended,
    currentWaterLevel?: WaterLevel,
    meteorological?: MeteorologicalData[]
  ): Promise<ProcessedDepthReading> {
    
    const tideCorrection = await this.applyTideCorrection(
      depthReading, station, tidePredictions, currentWaterLevel
    );

    const environmentalFactors = this.calculateEnvironmentalFactors(
      depthReading, weather, meteorological
    );

    const dataAge = Date.now() - depthReading.timestamp;
    const qualityScore = this.calculateQualityScore(
      depthReading, station, weather, dataAge
    );

    // Apply all corrections
    const finalCorrectedDepth = tideCorrection.correctedDepth + environmentalFactors.totalCorrection;
    
    // Calculate safety margin based on uncertainties
    const safetyMargin = this.calculateSafetyMargin(
      tideCorrection, environmentalFactors, qualityScore
    );

    // Determine reliability rating
    const reliability = this.determineReliability(qualityScore.score, safetyMargin);

    return {
      ...depthReading,
      depth: finalCorrectedDepth,
      tideCorrection: {
        ...tideCorrection,
        correctedDepth: finalCorrectedDepth
      },
      environmentalFactors,
      qualityScore,
      safetyMargin,
      reliability
    };
  }

  // Private helper methods

  private interpolateTideHeight(
    targetTime: Date,
    predictions: TidePrediction[]
  ): { height: number; confidence: number } {
    
    // Sort predictions by time
    const sortedPredictions = [...predictions].sort((a, b) => 
      new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    const targetTimestamp = targetTime.getTime();

    // Find the two predictions that bracket the target time
    let before: TidePrediction | null = null;
    let after: TidePrediction | null = null;

    for (let i = 0; i < sortedPredictions.length; i++) {
      const predTime = new Date(sortedPredictions[i].time).getTime();
      
      if (predTime <= targetTimestamp) {
        before = sortedPredictions[i];
      } else {
        after = sortedPredictions[i];
        break;
      }
    }

    if (!before && !after) {
      throw new Error('No tide predictions available for interpolation');
    }

    if (!before) {
      // Target time is before all predictions
      return { height: after!.value, confidence: 0.6 };
    }

    if (!after) {
      // Target time is after all predictions
      return { height: before.value, confidence: 0.6 };
    }

    // Linear interpolation between before and after
    const beforeTime = new Date(before.time).getTime();
    const afterTime = new Date(after.time).getTime();
    
    const ratio = (targetTimestamp - beforeTime) / (afterTime - beforeTime);
    const interpolatedHeight = before.value + ratio * (after.value - before.value);
    
    // Confidence decreases if interpolating over a long time span
    const timeSpanHours = (afterTime - beforeTime) / (1000 * 60 * 60);
    const confidence = Math.max(0.7, 1 - timeSpanHours / 12); // Reduce confidence for >12h spans

    return { height: interpolatedHeight, confidence };
  }

  private findNearestTidePrediction(
    targetTime: Date,
    predictions: TidePrediction[]
  ): TidePrediction {
    const targetTimestamp = targetTime.getTime();
    
    return predictions.reduce((nearest, current) => {
      const currentDiff = Math.abs(new Date(current.time).getTime() - targetTimestamp);
      const nearestDiff = Math.abs(new Date(nearest.time).getTime() - targetTimestamp);
      
      return currentDiff < nearestDiff ? current : nearest;
    });
  }

  private calculateWindCorrection(weather: MarineWeatherExtended): number {
    // Wind can create surface waves that affect depth sounder readings
    // Higher wind speeds create more measurement uncertainty
    const windSpeed = weather.windSpeed;
    
    if (windSpeed < 5) return 0;
    if (windSpeed < 10) return -0.05; // Minor negative correction
    if (windSpeed < 15) return -0.1;
    return -0.2; // Significant uncertainty in high winds
  }

  private calculateCurrentCorrection(weather: MarineWeatherExtended): number {
    // Water currents can affect vessel positioning and depth readings
    if (!weather.currentSpeed) return 0;
    
    const currentSpeed = weather.currentSpeed;
    if (currentSpeed < 0.5) return 0;
    if (currentSpeed < 1.0) return -0.02;
    if (currentSpeed < 2.0) return -0.05;
    return -0.1;
  }

  private calculatePressureCorrection(pressure: number): number {
    // Atmospheric pressure affects water level (inverted barometer effect)
    // 1 hPa change ≈ 1 cm water level change
    if (!pressure) return 0;
    
    const pressureDiff = this.STANDARD_ATMOSPHERE - pressure;
    return pressureDiff * 0.01; // Convert hPa to meters
  }

  private calculateTemperatureCorrection(temperature: number): number {
    // Temperature affects water density and sound speed
    // Impacts depth sounder accuracy
    if (!temperature) return 0;
    
    const tempDiff = temperature - 15; // 15°C reference
    return tempDiff * 0.001; // Small correction factor
  }

  private calculateSalinityCorrection(latitude: number, longitude: number): number {
    // Estimate salinity based on location (simplified)
    // Real implementation would use salinity databases
    
    // Coastal areas typically have lower salinity
    const distanceFromCoast = this.estimateDistanceFromCoast(latitude, longitude);
    
    if (distanceFromCoast < 5000) { // Within 5km of coast
      return -0.01; // Slightly less dense water
    }
    
    return 0; // Assume standard salinity offshore
  }

  private calculateEnvironmentalConfidence(
    weather: MarineWeatherExtended,
    meteorological?: MeteorologicalData[]
  ): number {
    let confidence = 1.0;
    
    // Reduce confidence for poor weather conditions
    if (weather.windSpeed > 10) confidence *= 0.9;
    if (weather.windSpeed > 15) confidence *= 0.8;
    if (weather.waveHeight > 2) confidence *= 0.85;
    if (weather.visibility < 1) confidence *= 0.7;
    
    // Boost confidence if we have recent meteorological data
    if (meteorological && meteorological.length > 0) {
      confidence *= 1.1;
    }
    
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  private calculateEnvironmentalStability(weather: MarineWeatherExtended): number {
    let stability = 1.0;
    
    // Wind conditions
    if (weather.windSpeed > 15) stability *= 0.5;
    else if (weather.windSpeed > 10) stability *= 0.7;
    else if (weather.windSpeed > 5) stability *= 0.9;
    
    // Wave conditions
    if (weather.waveHeight > 3) stability *= 0.4;
    else if (weather.waveHeight > 2) stability *= 0.6;
    else if (weather.waveHeight > 1) stability *= 0.8;
    
    // Visibility
    if (weather.visibility < 0.5) stability *= 0.5;
    else if (weather.visibility < 1) stability *= 0.7;
    
    return Math.max(0.1, stability);
  }

  private getSourceReliability(source: string): number {
    switch (source) {
      case 'official': return 1.0;
      case 'crowdsource': return 0.8;
      case 'predicted': return 0.6;
      default: return 0.5;
    }
  }

  private estimateInstrumentAccuracy(depthReading: DepthReading): number {
    // Based on the confidence score of the reading
    return depthReading.confidenceScore;
  }

  private calculateSafetyMargin(
    tideCorrection: TideCorrection,
    environmentalFactors: EnvironmentalFactors,
    qualityScore: QualityScore
  ): number {
    // Base safety margin
    let margin = 0.5; // 50cm base margin
    
    // Increase margin for uncertain tide corrections
    if (tideCorrection.confidence < 0.8) {
      margin += (1 - tideCorrection.confidence) * 0.5;
    }
    
    // Increase margin for poor environmental conditions
    if (environmentalFactors.confidence < 0.8) {
      margin += (1 - environmentalFactors.confidence) * 0.3;
    }
    
    // Increase margin for low quality scores
    if (qualityScore.score < 0.7) {
      margin += (1 - qualityScore.score) * 0.5;
    }
    
    return Math.min(margin, 2.0); // Cap at 2 meters
  }

  private determineReliability(qualityScore: number, safetyMargin: number): 'high' | 'medium' | 'low' | 'unreliable' {
    if (qualityScore > 0.8 && safetyMargin < 0.8) return 'high';
    if (qualityScore > 0.6 && safetyMargin < 1.2) return 'medium';
    if (qualityScore > 0.4 && safetyMargin < 1.8) return 'low';
    return 'unreliable';
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return this.EARTH_RADIUS * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private estimateDistanceFromCoast(latitude: number, longitude: number): number {
    // Simplified estimation - in production, use proper coastal databases
    // This is a placeholder that assumes coastal proximity based on coordinates
    
    // Check if coordinates are near major coastlines (very simplified)
    const coastalProximity = Math.min(
      Math.abs(longitude + 74.0), // East Coast US approximation
      Math.abs(longitude + 122.0), // West Coast US approximation
      Math.abs(longitude + 81.0) // Gulf Coast approximation
    );
    
    return Math.max(0, coastalProximity * 111000); // Rough conversion to meters
  }

  /**
   * Batch process multiple depth readings efficiently
   */
  async batchProcessDepthReadings(
    depthReadings: DepthReading[],
    station: NoaaStation,
    tidePredictions: TidePrediction[],
    weather: MarineWeatherExtended,
    currentWaterLevel?: WaterLevel,
    meteorological?: MeteorologicalData[]
  ): Promise<ProcessedDepthReading[]> {
    
    const processedReadings: ProcessedDepthReading[] = [];
    
    // Process readings in parallel batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < depthReadings.length; i += batchSize) {
      const batch = depthReadings.slice(i, i + batchSize);
      const batchPromises = batch.map(reading => 
        this.processDepthReading(reading, station, tidePredictions, weather, currentWaterLevel, meteorological)
      );
      
      const batchResults = await Promise.all(batchPromises);
      processedReadings.push(...batchResults);
    }
    
    return processedReadings;
  }
}

export const dataProcessingService = new DataProcessingService();