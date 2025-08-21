// Error Handler Middleware
// Centralized error handling for Waves backend

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import logger from '../utils/logger';
import { WavesError } from '../types';

export interface ErrorResponse {
  success: false;
  message: string;
  code: string;
  details?: any;
  metadata: {
    timestamp: Date;
    requestId: string;
    path: string;
    method: string;
  };
}

export function errorHandler(
  error: FastifyError | WavesError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.headers['x-request-id'] || 'unknown';
  
  // Log the error with context
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    requestId,
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent']
  });

  // Determine status code and error details
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Handle specific error types
  if ('statusCode' in error && error.statusCode) {
    statusCode = error.statusCode;
  }

  if ('code' in error && error.code) {
    code = error.code;
  }

  // Handle Fastify validation errors
  if (error.validation) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = error.validation.map(v => ({
      field: v.instancePath.replace('/', '') || v.schemaPath.split('/').pop(),
      message: v.message,
      value: v.data
    }));
  }

  // Handle JWT errors
  if (error.message?.includes('jwt')) {
    statusCode = 401;
    code = 'AUTHENTICATION_ERROR';
    message = 'Invalid or expired authentication token';
  }

  // Handle database errors
  if (error.message?.includes('duplicate key')) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'Resource already exists';
  }

  if (error.message?.includes('foreign key')) {
    statusCode = 400;
    code = 'INVALID_REFERENCE';
    message = 'Referenced resource does not exist';
  }

  // Handle rate limiting
  if (error.message?.includes('Rate limit')) {
    statusCode = 429;
    code = 'RATE_LIMIT_EXCEEDED';
    message = 'Too many requests, please try again later';
  }

  // Handle connection errors
  if (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED')) {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'External service temporarily unavailable';
  }

  // Custom Waves errors
  if ('statusCode' in error && 'code' in error) {
    message = error.message;
    details = (error as WavesError).details;
  }

  // Don't expose internal errors in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal server error';
    details = undefined;
  }

  const errorResponse: ErrorResponse = {
    success: false,
    message,
    code,
    details,
    metadata: {
      timestamp: new Date(),
      requestId: requestId as string,
      path: request.url,
      method: request.method
    }
  };

  reply.status(statusCode).send(errorResponse);
}

// Helper function to create custom errors
export class WavesApiError extends Error implements WavesError {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'API_ERROR', details?: any) {
    super(message);
    this.name = 'WavesApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Specific error classes for common scenarios
export class ValidationError extends WavesApiError {
  constructor(message: string, field?: string, value?: any) {
    super(message, 400, 'VALIDATION_ERROR', { field, value });
  }
}

export class AuthenticationError extends WavesApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends WavesApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends WavesApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'RESOURCE_NOT_FOUND');
  }
}

export class ConflictError extends WavesApiError {
  constructor(message: string) {
    super(message, 409, 'RESOURCE_CONFLICT');
  }
}

export class SafetyError extends WavesApiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'SAFETY_VIOLATION', details);
  }
}

export class GeospatialError extends WavesApiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'GEOSPATIAL_ERROR', details);
  }
}