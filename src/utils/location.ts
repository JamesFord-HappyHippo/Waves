/**
 * Location utility functions for marine navigation
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param point1 First coordinate point
 * @param point2 Second coordinate point
 * @returns Distance in nautical miles
 */
export const calculateDistance = (point1: Coordinates, point2: Coordinates): number => {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLon = toRadians(point2.longitude - point1.longitude);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) *
      Math.cos(toRadians(point2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculate bearing between two coordinates
 * @param point1 Starting coordinate point
 * @param point2 Ending coordinate point
 * @returns Bearing in degrees (0-360)
 */
export const calculateBearing = (point1: Coordinates, point2: Coordinates): number => {
  const dLon = toRadians(point2.longitude - point1.longitude);
  const lat1 = toRadians(point1.latitude);
  const lat2 = toRadians(point2.latitude);
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  
  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360; // Normalize to 0-360
};

/**
 * Calculate destination point given distance and bearing
 * @param start Starting coordinate point
 * @param distance Distance in nautical miles
 * @param bearing Bearing in degrees
 * @returns Destination coordinates
 */
export const calculateDestination = (
  start: Coordinates,
  distance: number,
  bearing: number,
): Coordinates => {
  const R = 3440.065; // Earth's radius in nautical miles
  const lat1 = toRadians(start.latitude);
  const lon1 = toRadians(start.longitude);
  const brng = toRadians(bearing);
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distance / R) +
      Math.cos(lat1) * Math.sin(distance / R) * Math.cos(brng),
  );
  
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distance / R) * Math.cos(lat1),
      Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2),
    );
  
  return {
    latitude: toDegrees(lat2),
    longitude: toDegrees(lon2),
  };
};

/**
 * Check if a point is within a given radius of another point
 * @param center Center point
 * @param point Point to check
 * @param radiusNm Radius in nautical miles
 * @returns True if point is within radius
 */
export const isWithinRadius = (
  center: Coordinates,
  point: Coordinates,
  radiusNm: number,
): boolean => {
  return calculateDistance(center, point) <= radiusNm;
};

/**
 * Format coordinates for display
 * @param coord Coordinate value
 * @param isLatitude True for latitude, false for longitude
 * @returns Formatted coordinate string
 */
export const formatCoordinate = (coord: number, isLatitude: boolean): string => {
  const abs = Math.abs(coord);
  const degrees = Math.floor(abs);
  const minutes = (abs - degrees) * 60;
  const direction = isLatitude 
    ? (coord >= 0 ? 'N' : 'S')
    : (coord >= 0 ? 'E' : 'W');
  
  return `${degrees}°${minutes.toFixed(3)}'${direction}`;
};

/**
 * Validate coordinate values
 * @param latitude Latitude value
 * @param longitude Longitude value
 * @returns True if coordinates are valid
 */
export const isValidCoordinate = (latitude: number, longitude: number): boolean => {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

/**
 * Convert radians to degrees
 */
const toDegrees = (radians: number): number => radians * (180 / Math.PI);