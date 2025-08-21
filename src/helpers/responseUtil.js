/**
 * Response Utilities for Equilateral AI Agent System
 * 
 * **Developed by Equilateral AI (Pareidolia LLC)**
 * 
 * Standardized response formatting for all agents
 */

/**
 * Create standardized success response
 */
const createSuccessResponse = (data, message, metadata = {}) => ({
    success: true,
    data,
    message,
    metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        system: 'equilateral-ai'
    }
});

/**
 * Create standardized error response
 */
const createErrorResponse = (message, code = 'GENERAL_ERROR', details = {}) => ({
    success: false,
    message,
    error_code: code,
    error_details: details,
    timestamp: new Date().toISOString(),
    system: 'equilateral-ai'
});

/**
 * Create API response wrapper (for Tim-Combo compatibility)
 */
const createAPIResponse = (data, message, metadata = {}) => ({
    success: true,
    data: {
        Records: Array.isArray(data) ? data : [data]
    },
    message,
    metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        system: 'equilateral-ai'
    }
});

module.exports = {
    createSuccessResponse,
    createErrorResponse,
    createAPIResponse
};