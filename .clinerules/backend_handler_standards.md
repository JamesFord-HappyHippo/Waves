# Backend Handler Standards

## Method-Specific Handler Architecture (August 2025) ✅

### Current Pattern: Single HTTP Method Per Handler
**Status**: Deployed in both dev and sandbox environments
**Achievement**: 63+ method-specific handlers replacing multi-method handlers

### HTTP Method Parameter Conventions
**Strict adherence required for consistent API behavior:**

```javascript
// GET/DELETE Methods - Use queryStringParameters
async function getHandler({ queryStringParameters: queryParams = {}, requestContext }) {
    // ✅ CORRECT: Access query parameters
    const clientId = queryParams.Client_ID;
    const companyId = queryParams.Company_ID;
}

// POST/PUT Methods - Use body (requestBody)  
async function createHandler({ body: requestBody = {}, requestContext }) {
    // ✅ CORRECT: Access request body
    const clientName = requestBody.Client_Name;
    const clientType = requestBody.Client_Type;
}
```

### Method-Specific Naming Convention
**Handler files must include HTTP method suffix:**

```javascript
// ✅ CORRECT Method-Specific Naming
clientGet.js          // GET /tim/clients
clientCreate.js       // POST /tim/clients  
clientUpdate.js       // PUT /tim/clients
clientDelete.js       // DELETE /tim/clients

updateIntegrationInstancePut.js    // PUT /tim/integrations/instances/{instanceId}
getEmployeeMappingGet.js          // GET /tim/integrations/employee-mapping
createEmployeeMappingPost.js      // POST /tim/integrations/employee-mapping

// ❌ INCORRECT Multi-Method Handlers (deprecated)
client.js             // Handles multiple HTTP methods - DO NOT USE
employeeMapping.js    // Handles GET/POST/PUT - DO NOT USE
```

### SAM Template Configuration
**Each method-specific handler requires separate function definition:**

```yaml
# ✅ CORRECT: Method-specific functions
clientGetFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri:
      Bucket: !Ref TIMBucketName
      Key: clientGet_js.zip
    Events:
      clientGetEvent:
        Type: Api
        Properties:
          Path: /tim/clients
          Method: GET

clientCreateFunction:
  Type: AWS::Serverless::Function  
  Properties:
    CodeUri:
      Bucket: !Ref TIMBucketName
      Key: clientCreate_js.zip
    Events:
      clientCreateEvent:
        Type: Api
        Properties:
          Path: /tim/clients
          Method: POST
```

### Benefits of Method-Specific Architecture
- **Parameter Clarity**: No confusion between queryParams vs requestBody
- **Single Responsibility**: Each handler has one HTTP method concern
- **Better Debugging**: Stack traces point to specific method handlers
- **Cleaner Testing**: Test each HTTP method operation independently
- **Reduced Complexity**: Eliminates method switching logic within handlers

## Import Path Consistency

### Helper Imports
All backend handlers must use relative imports from the same directory structure:

```javascript
// ✅ CORRECT - Use relative paths to helpers in same directory structure
const { wrapHandler } = require('./lambdaWrapper');
const { executeQuery } = require('./dbOperations');
const { createSuccessResponse, createErrorResponse } = require('./responseUtil');
const { handleError } = require('./errorHandler');

// ❌ INCORRECT - Don't use ../admin/ or other directory traversal
const { wrapHandler } = require('../admin/lambdaWrapper');
const { executeQuery } = require('../admin/dbOperations');
```

### 🚨 CRITICAL: Helper Verification Before Import

**Before importing any helper in a handler, ALWAYS verify:**

```bash
# 1. Check helper exists in expected location
list_files src/backend/src/helpers

# 2. Verify the specific helper file
read_file src/backend/src/helpers/helperName.js

# 3. Check export pattern matches import expectations
```

**Rule**: Never assume a helper exists. Always verify file location and export pattern before adding imports.

**Common Helper Locations:**
- Core helpers: `src/backend/src/helpers/`
- Handler-specific helpers: Same directory as handler (`./`)
- Integration helpers: `src/backend/src/helpers/` (use relative path `./`)

### Standard Handler Pattern
All handlers must follow this exact pattern:

```javascript
/**
 * Handler Description
 * Brief description of what this handler does
 */

const { wrapHandler } = require('./lambdaWrapper');
const { executeQuery } = require('./dbOperations');
const { createSuccessResponse, createErrorResponse } = require('./responseUtil');
const { handleError } = require('./errorHandler');

/**
 * Main handler function
 */
async function handlerName({ queryParams = {}, requestBody = {}, requestContext, httpMethod }) {
    try {
        const Request_ID = requestContext.requestId;
        
        // Handler logic here
        
        return createSuccessResponse(
            { Records: results },
            'Success message',
            {
                Total_Records: results.length,
                Request_ID,
                Timestamp: new Date().toISOString()
            }
        );
        
    } catch (error) {
        console.error('Handler Error:', error);
        return handleError(error);
    }
}

exports.handler = wrapHandler(handlerName);
```

## Database Operations

### Use executeQuery Helper
```javascript
// ✅ CORRECT
const result = await executeQuery(query, params);

// ❌ INCORRECT - No direct database connections
const { Pool } = require('pg');
const pool = new Pool({...});
const result = await pool.query(query, params);
```

## Response Formatting

### Use Helper Functions
```javascript
// ✅ CORRECT
return createSuccessResponse(data, message, meta);

// ❌ INCORRECT - No manual response formatting
return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, data })
};
```

## Error Handling

### Use handleError Helper
```javascript
// ✅ CORRECT
catch (error) {
    console.error('Handler Error:', error);
    return handleError(error);
}

// ❌ INCORRECT - No manual error responses
catch (error) {
    return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: error.message })
    };
}
```

## Required Imports for All Handlers

Every handler must include these core imports:
- `wrapHandler` - Standard Lambda wrapper
- `executeQuery` - Database operations
- `createSuccessResponse` - Success responses
- `handleError` - Error handling

## Import Order

1. External packages (if needed: aws-sdk, papaparse, xlsx, etc.)
2. Core helpers (./lambdaWrapper, ./dbOperations, ./responseUtil, ./errorHandler)
3. Specific helpers or utilities
4. Business logic imports

This ensures consistency across all backend handlers and eliminates import path confusion.

## ID Generation Patterns

### Request IDs (Tracing/Logging)
All handlers must use AWS-provided request IDs instead of generating new UUIDs:

```javascript
// ✅ CORRECT - Use AWS Lambda request ID
async function handlerName({ queryParams = {}, requestBody = {}, requestContext }) {
    const Request_ID = requestContext.requestId;
    // ... handler logic
}

// ❌ INCORRECT - Don't generate random UUIDs for request tracing
const { v4: uuidv4 } = require('uuid');
const Request_ID = uuidv4();
```

### Entity IDs (Database Primary Keys)
Use business-scoped IDs that provide context and traceability:

```javascript
// ✅ CORRECT - Business-scoped entity IDs
const mapping_id = `mapping_${Company_ID}_${Date.now()}`;
const certificate_id = `cert_${Client_ID}_${Date.now()}`;
const template_id = `template_${Client_ID}_${Date.now()}`;

// ❌ INCORRECT - Random UUIDs with no business context
const mapping_id = require('crypto').randomUUID();
const certificate_id = uuidv4();
```

### Processing IDs (Workflow Tracking)
Use process-scoped IDs that include context and random suffix for uniqueness:

```javascript
// ✅ CORRECT - Process-scoped IDs
const processing_id = `proc_${Company_ID}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
const harvest_id = `harvest_${template_code}_${Date.now()}`;

// ❌ INCORRECT - Random UUIDs with no process context
const processing_id = uuidv4();
```

### LoadIDs (Batch Processing)
Use structured LoadIDs for batch data processing that provide company scope and chronological ordering:

```javascript
// ✅ CORRECT - Business-scoped LoadID pattern
// Format: load_TYPE_COMPANYID_YYYYMMDDHHMMSS_SEQ
async function generateLoadID(companyId, dataType = 'emp') {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T]/g, '').substr(0, 15);
    
    const sequenceQuery = `
        SELECT COALESCE(MAX(CAST(RIGHT(load_id, 3) AS INTEGER)), 0) + 1 as next_sequence
        FROM table_name WHERE load_id LIKE $1
    `;
    
    const sequencePattern = `load_${dataType}_${companyId}_${dateStr.substr(0, 13)}%`;
    const result = await executeQuery(sequenceQuery, [sequencePattern]);
    const sequence = result.rows[0].next_sequence.toString().padStart(3, '0');
    
    return `load_${dataType}_${companyId}_${dateStr}_${sequence}`;
}

// ❌ INCORRECT - Simple incrementing integers
SELECT COALESCE(max(load_id), 0) + 1 as new_load_id FROM table_name
```

### Audit/Log IDs
For audit trails and logging, use built-in crypto.randomUUID() (no external dependency):

```javascript
// ✅ CORRECT - Built-in Node.js crypto for audit logs
const audit_id = crypto.randomUUID();
const log_id = crypto.randomUUID();

// ❌ INCORRECT - External UUID library
const { v4: uuidv4 } = require('uuid');
const audit_id = uuidv4();
```

## LoadID Data Type Prefixes

Use consistent prefixes for different data types:
- `load_emp_` - Employee data loads
- `load_dept_` - Department data loads  
- `load_job_` - Job/Position data loads
- `load_loc_` - Location data loads
- `load_org_` - Organization data loads
- `load_payroll_` - Payroll data loads
- `load_timesheet_` - Timesheet data loads

## Benefits of These Patterns

- **Traceability** - IDs contain business context for debugging
- **Company Isolation** - Company-scoped IDs prevent cross-contamination
- **Chronological Ordering** - Timestamp-based IDs provide natural sorting
- **Concurrency Safety** - Sequence numbers handle simultaneous operations
- **Dependency Reduction** - Eliminates external UUID library requirements
- **Support Efficiency** - Support teams can understand IDs immediately

## Common Violations and Enforcement

### 🚨 Critical Violations to Fix

#### 1. Missing Required Core Imports
```javascript
// ❌ VIOLATION - Missing wrapHandler and handleError
const { executeQuery } = require('./dbOperations');
const { createSuccessResponse } = require('./responseUtil');

// ✅ CORRECT - All required core imports present
const { wrapHandler } = require('./lambdaWrapper');
const { executeQuery } = require('./dbOperations');
const { createSuccessResponse, createErrorResponse } = require('./responseUtil');
const { handleError } = require('./errorHandler');
```

#### 2. Non-Standard Export Pattern
```javascript
// ❌ VIOLATION - Direct async export (unwrapped)
exports.handler = async (event) => {
    // handler logic
};

// ✅ CORRECT - Wrapped function pattern
async function handlerName({ queryParams = {}, requestContext }) {
    // handler logic
}
exports.handler = wrapHandler(handlerName);
```

#### 3. Raw Event Parameter Usage
```javascript
// ❌ VIOLATION - Raw event access
exports.handler = async (event) => {
    const queryParams = event.queryStringParameters || {};
    const requestId = event.requestContext?.requestId;

// ✅ CORRECT - Standard parameter destructuring
async function handlerName({ queryParams = {}, requestContext }) {
    const Request_ID = requestContext.requestId;
```

#### 4. Manual Error Handling
```javascript
// ❌ VIOLATION - Custom error responses
catch (error) {
    if (error.message.includes('access')) {
        return createErrorResponse(403, 'Access denied', {...});
    } else {
        return createErrorResponse(500, 'Internal error', {...});
    }
}

// ✅ CORRECT - Standard error helper
catch (error) {
    console.error('Handler Error:', error);
    return handleError(error);
}
```

#### 5. Non-Standard Response Format
```javascript
// ❌ VIOLATION - Custom response structure
return createSuccessResponse('Success message', {
    data: results,
    count: results.length
});

// ✅ CORRECT - Standard Records pattern
return createSuccessResponse(
    { Records: results },
    'Success message',
    {
        Total_Records: results.length,
        Request_ID,
        Timestamp: new Date().toISOString()
    }
);
```

### ✅ Enforcement Checklist

When reviewing or fixing handlers, verify:

- [ ] **wrapHandler import and usage** - `const { wrapHandler } = require('./lambdaWrapper');`
- [ ] **handleError import and usage** - `const { handleError } = require('./errorHandler');`
- [ ] **Standard parameter destructuring** - `{ queryParams = {}, requestBody = {}, requestContext }`
- [ ] **AWS-native request ID** - `const Request_ID = requestContext.requestId;`
- [ ] **Wrapped export** - `exports.handler = wrapHandler(functionName);`
- [ ] **Standard error handling** - `return handleError(error);` in catch blocks
- [ ] **Records response format** - `{ Records: [...] }` in success responses
- [ ] **Core helpers first** - Import order: core helpers, then specific helpers

### 🔧 Migration Patterns

#### Converting Non-Wrapped Handlers
```javascript
// BEFORE (non-compliant)
exports.handler = async (event) => {
    try {
        // logic
        return { statusCode: 200, body: JSON.stringify(result) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

// AFTER (compliant)
async function handlerName({ queryParams = {}, requestContext }) {
    try {
        const Request_ID = requestContext.requestId;
        // logic
        return createSuccessResponse({ Records: results }, 'Success', {
            Total_Records: results.length,
            Request_ID,
            Timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Handler Error:', error);
        return handleError(error);
    }
}
exports.handler = wrapHandler(handlerName);
```

## Systematic Module Usage Verification

### 🚨 CRITICAL: Before Using Any Shared Module

**When using any shared module (unifiedCredentialManager, integrationManager, etc.), ALWAYS:**

1. **Verify Module Functions Exist**:
   ```bash
   # Read the actual module file
   read_file src/backend/src/helpers/moduleName.js
   
   # Check for the specific function you want to use
   search_files src/backend/src/helpers "functionName" "moduleName.js"
   ```

2. **Check All Related Handlers**:
   ```bash
   # Find all handlers using the same module
   search_files src/backend/src/handlers "moduleName" "*.js"
   
   # Check each handler for function usage patterns
   search_files src/backend/src/handlers "\.functionName\(" "*.js"
   ```

3. **Verify Import Patterns**:
   ```bash
   # Look for import variations that might be incorrect
   search_files src/backend/src/handlers "require.*moduleName" "*.js"
   ```

### 📋 Shared Module Verification Checklist

#### For unifiedCredentialManager:
- [ ] **Import**: `const unifiedCredentialManager = require('./unifiedCredentialManager')` (NOT destructured)
- [ ] **Available Functions**: `getAuthenticationPackage()`, `testAuthenticationFlow()`, `getAllCredentials()`
- [ ] **NOT Available**: `getCredentials()` (common mistake)
- [ ] **Response Format**: Returns `{ credential_id, oauth2: {...}, certificate: {...}, integration_settings: {...} }`

#### For credentialManager (Legacy - Avoid):
- [ ] **Status**: ⚠️ Legacy module, migrate to unifiedCredentialManager
- [ ] **If Found**: Replace with unifiedCredentialManager calls
- [ ] **Common Migration**: `getCredentials()` → `getAuthenticationPackage()`

### 🔍 Systematic Issue Prevention Protocol

#### When Adding New Handler Using Shared Module:
1. **Read the module source** to understand available functions
2. **Search for similar usage** in existing handlers
3. **Test import pattern** in isolation if needed
4. **Verify function signatures** match your usage

#### When Debugging Module-Related Errors:
1. **Check ALL handlers** using the same module (not just the failing one)
2. **Look for import pattern inconsistencies** (destructuring vs direct import)
3. **Verify function names** exist in the actual module
4. **Update ALL related handlers** in the same commit

#### When Updating Shared Modules:
1. **Search for ALL usage** across the codebase
2. **Update ALL handlers** that use changed functions
3. **Test representative handlers** from different domains
4. **Update documentation** and Cline rules

### ⚡ Quick Commands for Module Verification

```bash
# Check what functions a module exports
read_file src/backend/src/helpers/unifiedCredentialManager.js | grep -E "(async function|function|exports\.|module\.exports)"

# Find all handlers using a specific module
search_files src/backend/src/handlers "unifiedCredentialManager" "*.js"

# Check for problematic function calls
search_files src/backend/src/handlers "\.getCredentials\(" "*.js"

# Verify import patterns
search_files src/backend/src/handlers "const.*=.*require.*unifiedCredentialManager" "*.js"
```

### 📝 Documentation Requirements

When working with shared modules:
- **Document function signatures** in commit messages
- **Note breaking changes** that affect other handlers  
- **List all affected files** in the commit description
- **Update Cline rules** if new patterns are established

#### Import Standardization
```javascript
// BEFORE (mixed order)
const { executeQuery } = require('./dbOperations');
const { validateRequiredParams } = require('./validationUtil');
const { createSuccessResponse } = require('./responseUtil');
const { someBusinessHelper } = require('./businessHelper');

// AFTER (correct order)
const { wrapHandler } = require('./lambdaWrapper');
const { executeQuery } = require('./dbOperations');
const { createSuccessResponse, createErrorResponse } = require('./responseUtil');
const { handleError } = require('./errorHandler');
const { validateRequiredParams } = require('./validationUtil');
const { someBusinessHelper } = require('./businessHelper');
```

### 🎯 Handler Standards Priority

**High Priority Fixes:**
1. Missing wrapHandler usage (security/monitoring impact)
2. Missing handleError usage (error handling consistency)
3. Non-standard parameter access (maintainability)

**Medium Priority Fixes:**
1. Import order violations (code organization)
2. Response format inconsistencies (API consistency)

**Low Priority Fixes:**
1. Comment format improvements
2. Variable naming consistency

This enforcement guide ensures all 203+ handlers follow consistent patterns for maintainability, debugging, and operational efficiency.
