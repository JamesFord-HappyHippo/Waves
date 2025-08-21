/**
 * Unit conversion utilities for marine navigation
 */

export type UnitSystem = 'metric' | 'imperial' | 'nautical';
export type DistanceUnit = 'meters' | 'feet' | 'nautical_miles' | 'kilometers' | 'miles';
export type SpeedUnit = 'knots' | 'mph' | 'kph' | 'mps';
export type DepthUnit = 'meters' | 'feet' | 'fathoms';

// Distance conversions (all to meters)
const DISTANCE_TO_METERS = {
  meters: 1,
  feet: 0.3048,
  nautical_miles: 1852,
  kilometers: 1000,
  miles: 1609.344,
  fathoms: 1.8288,
};

// Speed conversions (all to m/s)
const SPEED_TO_MPS = {
  knots: 0.514444,
  mph: 0.44704,
  kph: 0.277778,
  mps: 1,
};

/**
 * Convert distance between units
 */
export const convertDistance = (
  value: number,
  fromUnit: DistanceUnit,
  toUnit: DistanceUnit,
): number => {
  const meters = value * DISTANCE_TO_METERS[fromUnit];
  return meters / DISTANCE_TO_METERS[toUnit];
};

/**
 * Convert speed between units
 */
export const convertSpeed = (
  value: number,
  fromUnit: SpeedUnit,
  toUnit: SpeedUnit,
): number => {
  const mps = value * SPEED_TO_MPS[fromUnit];
  return mps / SPEED_TO_MPS[toUnit];
};

/**
 * Convert depth to preferred unit system
 */
export const convertDepth = (
  depthInMeters: number,
  unitSystem: UnitSystem,
): { value: number; unit: DepthUnit } => {
  switch (unitSystem) {
    case 'imperial':
      return { value: depthInMeters * 3.28084, unit: 'feet' };
    case 'nautical':
      return { value: depthInMeters / 1.8288, unit: 'fathoms' };
    case 'metric':
    default:
      return { value: depthInMeters, unit: 'meters' };
  }
};

/**
 * Convert distance to preferred unit system
 */
export const convertDistanceForDisplay = (
  distanceInNm: number,
  unitSystem: UnitSystem,
): { value: number; unit: DistanceUnit } => {
  switch (unitSystem) {
    case 'imperial':
      return { value: distanceInNm * 1.15078, unit: 'miles' };
    case 'metric':
      return { value: distanceInNm * 1.852, unit: 'kilometers' };
    case 'nautical':
    default:
      return { value: distanceInNm, unit: 'nautical_miles' };
  }
};

/**
 * Convert speed to preferred unit system
 */
export const convertSpeedForDisplay = (
  speedInKnots: number,
  unitSystem: UnitSystem,
): { value: number; unit: SpeedUnit } => {
  switch (unitSystem) {
    case 'imperial':
      return { value: speedInKnots * 1.15078, unit: 'mph' };
    case 'metric':
      return { value: speedInKnots * 1.852, unit: 'kph' };
    case 'nautical':
    default:
      return { value: speedInKnots, unit: 'knots' };
  }
};

/**
 * Format distance with appropriate unit
 */
export const formatDistance = (
  distanceInNm: number,
  unitSystem: UnitSystem,
  precision: number = 1,
): string => {
  const { value, unit } = convertDistanceForDisplay(distanceInNm, unitSystem);
  const unitLabel = getUnitLabel(unit);
  return `${value.toFixed(precision)} ${unitLabel}`;
};

/**
 * Format speed with appropriate unit
 */
export const formatSpeed = (
  speedInKnots: number,
  unitSystem: UnitSystem,
  precision: number = 1,
): string => {
  const { value, unit } = convertSpeedForDisplay(speedInKnots, unitSystem);
  const unitLabel = getUnitLabel(unit);
  return `${value.toFixed(precision)} ${unitLabel}`;
};

/**
 * Format depth with appropriate unit
 */
export const formatDepth = (
  depthInMeters: number,
  unitSystem: UnitSystem,
  precision: number = 1,
): string => {
  const { value, unit } = convertDepth(depthInMeters, unitSystem);
  const unitLabel = getUnitLabel(unit);
  return `${value.toFixed(precision)} ${unitLabel}`;
};

/**
 * Get unit label for display
 */
export const getUnitLabel = (unit: DistanceUnit | SpeedUnit | DepthUnit): string => {
  const labels = {
    // Distance
    meters: 'm',
    feet: 'ft',
    nautical_miles: 'nm',
    kilometers: 'km',
    miles: 'mi',
    fathoms: 'ftm',
    
    // Speed
    knots: 'kts',
    mph: 'mph',
    kph: 'km/h',
    mps: 'm/s',
  };
  
  return labels[unit as keyof typeof labels] || unit;
};

/**
 * Parse user input and convert to base units
 */
export const parseDistance = (input: string, currentUnit: DistanceUnit): number => {
  const value = parseFloat(input);
  if (isNaN(value)) return 0;
  return convertDistance(value, currentUnit, 'nautical_miles');
};

/**
 * Parse speed input and convert to knots
 */
export const parseSpeed = (input: string, currentUnit: SpeedUnit): number => {
  const value = parseFloat(input);
  if (isNaN(value)) return 0;
  return convertSpeed(value, currentUnit, 'knots');
};

/**
 * Parse depth input and convert to meters
 */
export const parseDepth = (input: string, currentUnit: DepthUnit): number => {
  const value = parseFloat(input);
  if (isNaN(value)) return 0;
  
  switch (currentUnit) {
    case 'feet':
      return value / 3.28084;
    case 'fathoms':
      return value * 1.8288;
    case 'meters':
    default:
      return value;
  }
};