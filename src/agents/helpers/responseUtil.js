// Project-agnostic responseUtil for agent systems
// Simplified version without Tim-Combo specific dependencies

// Simple console-based logger for agents
const logger = {
    info: (message, data, context) => {
        console.log(`[INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    },
    error: (message, error, context) => {
        console.error(`[ERROR] ${message}`, error?.message || error);
        if (error?.stack && process.env.NODE_ENV !== 'production') {
            console.error(error.stack);
        }
    }
};

// Basic CORS headers for agent responses
function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };
}

function logResponse(statusCode, body, context = {}) {
    logger.info('Agent Response', {
        type: 'response',
        statusCode,
        responseSize: JSON.stringify(body).length,
        success: statusCode < 400
    }, context);
}

function createResponse(statusCode, body, headers = {}) {
    const corsHeaders = getCorsHeaders();
    
    const response = {
        statusCode,
        headers: { ...corsHeaders, ...headers },
        body: JSON.stringify(body, null, 2)
    };
    
    logResponse(statusCode, body);
    return response;
}

function createErrorResponse(statusCode, message, error = null) {
    const body = {
        success: false,
        message,
        meta: {
            Timestamp: new Date().toISOString(),
            Error_Source: error?.source || 'Agent'
        }
    };

    if (error) {
        // Add error details
        if (error.code) body.error_code = error.code;
        if (error.details) body.error_details = error.details;
        
        // Add validation errors if present
        if (error.validation_errors) {
            body.validation_errors = error.validation_errors;
        }

        // Log error details securely
        logger.error('Agent Error Response', error, { statusCode });
        
        // Add debug info in non-production
        if (process.env.NODE_ENV !== 'production') {
            body.debug = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }
    }

    return createResponse(statusCode, body);
}

function createSuccessResponse(data, message = 'Operation successful', meta = {}) {
    // Handle data that's already wrapped in Records array or convert to array
    const records = data?.Records || (Array.isArray(data) ? data : [data]);
    
    // Build standard agent response
    const body = {
        success: true,
        message,
        meta: {
            Total_Records: records.length,
            Request_ID: meta.Request_ID || meta.requestId || `agent_${Date.now()}`,
            Timestamp: new Date().toISOString(),
            Agent_ID: meta.Agent_ID,
            Workflow_ID: meta.Workflow_ID
        },
        data: {
            Records: records
        }
    };

    // Add Agent_Context if relevant fields exist
    const agentContext = {
        Mode: meta.Mode,
        Operation: meta.Operation,
        Agent_ID: meta.Agent_ID,
        Workflow_ID: meta.Workflow_ID,
        ...meta.Agent_Context
    };
    if (Object.values(agentContext).some(v => v !== undefined)) {
        body.data.Agent_Context = agentContext;
    }

    // Add Analytics/Metrics if they exist
    const analytics = {
        Total_Active: records.filter(r => r.is_active === true).length,
        ...meta.Analytics,
        ...meta.Metrics,
        Performance_Metrics: meta.Performance_Metrics
    };
    if (Object.values(analytics).some(v => v !== undefined)) {
        body.data.Analytics = analytics;
    }

    return createResponse(200, body);
}

// Simplified validation error response
function createValidationErrorResponse(errors, message = 'Validation failed') {
    return createErrorResponse(400, message, { validation_errors: errors });
}

// Agent-specific response helpers
function createAgentResponse(agentName, operation, result, meta = {}) {
    return createSuccessResponse(result, `${agentName} ${operation} completed`, {
        ...meta,
        Agent_ID: agentName,
        Operation: operation
    });
}

function createWorkflowResponse(workflowId, step, result, meta = {}) {
    return createSuccessResponse(result, `Workflow step ${step} completed`, {
        ...meta,
        Workflow_ID: workflowId,
        Step: step
    });
}

module.exports = {
    createResponse,
    createErrorResponse, 
    createSuccessResponse,
    createValidationErrorResponse,
    createAgentResponse,
    createWorkflowResponse,
    getCorsHeaders,
    logger
};