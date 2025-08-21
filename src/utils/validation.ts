/**
 * Validation utilities for marine navigation data
 */

/**
 * Validate email address format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate depth reading value
 */
export const isValidDepth = (depth: number): boolean => {
  return depth >= 0 && depth <= 11000; // Max ocean depth ~11km
};

/**
 * Validate vessel draft value
 */
export const isValidDraft = (draft: number): boolean => {
  return draft >= 0 && draft <= 100; // Reasonable range in meters
};

/**
 * Validate safety margin value
 */
export const isValidSafetyMargin = (margin: number): boolean => {
  return margin >= 0 && margin <= 10; // Reasonable range in meters
};

/**
 * Validate speed value
 */
export const isValidSpeed = (speedKnots: number): boolean => {
  return speedKnots >= 0 && speedKnots <= 100; // Reasonable range for marine vessels
};

/**
 * Validate bearing value
 */
export const isValidBearing = (bearing: number): boolean => {
  return bearing >= 0 && bearing < 360;
};

/**
 * Validate coordinate pair
 */
export const isValidCoordinates = (lat: number, lon: number): boolean => {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
};

/**
 * Validate vessel name
 */
export const isValidVesselName = (name: string): boolean => {
  return name.length > 0 && name.length <= 50 && /^[a-zA-Z0-9\s\-']+$/.test(name);
};

/**
 * Validate user name
 */
export const isValidUserName = (name: string): boolean => {
  return name.length >= 2 && name.length <= 50 && /^[a-zA-Z\s\-']+$/.test(name);
};

/**
 * Validate confidence score (0-1)
 */
export const isValidConfidence = (confidence: number): boolean => {
  return confidence >= 0 && confidence <= 1;
};

/**
 * Validate timestamp
 */
export const isValidTimestamp = (timestamp: number): boolean => {
  const now = Date.now();
  const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
  const oneHourFromNow = now + (60 * 60 * 1000);
  return timestamp >= oneYearAgo && timestamp <= oneHourFromNow;
};

/**
 * Validate route waypoints
 */
export const validateWaypoints = (waypoints: Array<{latitude: number; longitude: number}>): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (waypoints.length < 2) {
    errors.push('At least 2 waypoints are required');
  }
  
  waypoints.forEach((wp, index) => {
    if (!isValidCoordinates(wp.latitude, wp.longitude)) {
      errors.push(`Waypoint ${index + 1} has invalid coordinates`);
    }
  });
  
  // Check for duplicate waypoints
  for (let i = 0; i < waypoints.length - 1; i++) {
    for (let j = i + 1; j < waypoints.length; j++) {
      const wp1 = waypoints[i];
      const wp2 = waypoints[j];
      if (Math.abs(wp1.latitude - wp2.latitude) < 0.0001 && 
          Math.abs(wp1.longitude - wp2.longitude) < 0.0001) {
        errors.push(`Waypoints ${i + 1} and ${j + 1} are too close together`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate depth reading data
 */
export const validateDepthReading = (reading: {
  latitude: number;
  longitude: number;
  depth: number;
  vesselDraft: number;
  confidenceScore: number;
  timestamp: number;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!isValidCoordinates(reading.latitude, reading.longitude)) {
    errors.push('Invalid coordinates');
  }
  
  if (!isValidDepth(reading.depth)) {
    errors.push('Invalid depth value');
  }
  
  if (!isValidDraft(reading.vesselDraft)) {
    errors.push('Invalid vessel draft');
  }
  
  if (!isValidConfidence(reading.confidenceScore)) {
    errors.push('Invalid confidence score');
  }
  
  if (!isValidTimestamp(reading.timestamp)) {
    errors.push('Invalid timestamp');
  }
  
  // Additional marine-specific validations
  if (reading.depth < reading.vesselDraft) {
    errors.push('Depth cannot be less than vessel draft');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitize user input
 */
export const sanitizeString = (input: string): string => {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/[<>]/g, '') // Remove angle brackets
    .substring(0, 1000); // Limit length
};

/**
 * Validate and sanitize vessel profile
 */
export const validateVesselProfile = (profile: {
  name: string;
  type: string;
  length?: number;
  draft?: number;
}): { isValid: boolean; errors: string[]; sanitized: any } => {
  const errors: string[] = [];
  
  const sanitized = {
    name: sanitizeString(profile.name),
    type: profile.type,
    length: profile.length,
    draft: profile.draft,
  };
  
  if (!isValidVesselName(sanitized.name)) {
    errors.push('Invalid vessel name');
  }
  
  const validTypes = ['sailboat', 'powerboat', 'kayak', 'other'];
  if (!validTypes.includes(profile.type)) {
    errors.push('Invalid vessel type');
  }
  
  if (profile.length !== undefined && (profile.length <= 0 || profile.length > 500)) {
    errors.push('Invalid vessel length');
  }
  
  if (profile.draft !== undefined && !isValidDraft(profile.draft)) {
    errors.push('Invalid vessel draft');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};