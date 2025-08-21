/**
 * Navigation utility functions for marine routes
 */

import {Coordinates, calculateDistance, calculateBearing} from './location';

export interface RoutePoint extends Coordinates {
  name?: string;
  timestamp: number;
}

export interface NavigationInfo {
  distanceRemaining: number;
  bearingToNext: number;
  estimatedTimeOfArrival: number;
  crossTrackError: number;
  nextWaypoint: RoutePoint | null;
}

/**
 * Calculate total distance for a route
 */
export const calculateRouteDistance = (waypoints: RoutePoint[]): number => {
  if (waypoints.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalDistance += calculateDistance(waypoints[i], waypoints[i + 1]);
  }
  
  return totalDistance;
};

/**
 * Calculate estimated time of arrival
 */
export const calculateETA = (
  distanceNm: number,
  speedKnots: number,
): number => {
  if (speedKnots <= 0) return 0;
  const hoursToArrival = distanceNm / speedKnots;
  return Date.now() + (hoursToArrival * 60 * 60 * 1000);
};

/**
 * Find the closest point on a route to current position
 */
export const findClosestRoutePoint = (
  currentPosition: Coordinates,
  route: RoutePoint[],
): { index: number; distance: number } => {
  let closestIndex = 0;
  let minDistance = Infinity;
  
  route.forEach((point, index) => {
    const distance = calculateDistance(currentPosition, point);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });
  
  return { index: closestIndex, distance: minDistance };
};

/**
 * Calculate cross-track error (deviation from intended course)
 */
export const calculateCrossTrackError = (
  currentPosition: Coordinates,
  fromWaypoint: Coordinates,
  toWaypoint: Coordinates,
): number => {
  const distanceFromStart = calculateDistance(fromWaypoint, currentPosition);
  const bearingToDestination = calculateBearing(fromStart, toWaypoint);
  const bearingToCurrent = calculateBearing(fromWaypoint, currentPosition);
  
  const angleError = bearingToCurrent - bearingToDestination;
  return distanceFromStart * Math.sin(angleError * Math.PI / 180);
};

/**
 * Check if vessel has arrived at waypoint
 */
export const hasArrivedAtWaypoint = (
  currentPosition: Coordinates,
  waypoint: Coordinates,
  arrivalRadius: number = 0.05, // 0.05 nm default
): boolean => {
  return calculateDistance(currentPosition, waypoint) <= arrivalRadius;
};

/**
 * Generate navigation update for current position
 */
export const getNavigationUpdate = (
  currentPosition: Coordinates,
  route: RoutePoint[],
  currentWaypointIndex: number,
  speedKnots: number = 0,
): NavigationInfo => {
  if (!route.length || currentWaypointIndex >= route.length) {
    return {
      distanceRemaining: 0,
      bearingToNext: 0,
      estimatedTimeOfArrival: 0,
      crossTrackError: 0,
      nextWaypoint: null,
    };
  }
  
  const nextWaypoint = route[currentWaypointIndex];
  const distanceToNext = calculateDistance(currentPosition, nextWaypoint);
  const bearingToNext = calculateBearing(currentPosition, nextWaypoint);
  
  // Calculate total remaining distance
  let distanceRemaining = distanceToNext;
  for (let i = currentWaypointIndex; i < route.length - 1; i++) {
    distanceRemaining += calculateDistance(route[i], route[i + 1]);
  }
  
  // Calculate cross-track error if we have a previous waypoint
  let crossTrackError = 0;
  if (currentWaypointIndex > 0) {
    const fromWaypoint = route[currentWaypointIndex - 1];
    crossTrackError = calculateCrossTrackError(
      currentPosition,
      fromWaypoint,
      nextWaypoint,
    );
  }
  
  return {
    distanceRemaining,
    bearingToNext,
    estimatedTimeOfArrival: calculateETA(distanceRemaining, speedKnots),
    crossTrackError,
    nextWaypoint,
  };
};

/**
 * Validate route waypoints
 */
export const validateRoute = (waypoints: RoutePoint[]): string[] => {
  const errors: string[] = [];
  
  if (waypoints.length < 2) {
    errors.push('Route must have at least 2 waypoints');
  }
  
  waypoints.forEach((point, index) => {
    if (point.latitude < -90 || point.latitude > 90) {
      errors.push(`Waypoint ${index + 1}: Invalid latitude`);
    }
    if (point.longitude < -180 || point.longitude > 180) {
      errors.push(`Waypoint ${index + 1}: Invalid longitude`);
    }
  });
  
  // Check for duplicate waypoints
  for (let i = 0; i < waypoints.length - 1; i++) {
    for (let j = i + 1; j < waypoints.length; j++) {
      if (calculateDistance(waypoints[i], waypoints[j]) < 0.001) {
        errors.push(`Waypoints ${i + 1} and ${j + 1} are too close together`);
      }
    }
  }
  
  return errors;
};