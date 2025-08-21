# API Standards and Response Formats

## Method-Specific Handler Integration (August 2025) ✅

### HTTP Method Parameter Patterns
**CRITICAL**: Method-specific handlers require consistent parameter access patterns

**GET/DELETE Requests**: Use `queryStringParameters`
```typescript
// Handler signature for GET/DELETE
async function getHandler({ queryStringParameters: queryParams = {}, requestContext }) {
    // ✅ CORRECT: Access query parameters
    const clientId = queryParams.Client_ID;
    const companyId = queryParams.Company_ID;
    const filters = queryParams.filters;
}
```

**POST/PUT Requests**: Use `body` parameter
```typescript
// Handler signature for POST/PUT
async function createHandler({ body: requestBody = {}, requestContext }) {
    // ✅ CORRECT: Access request body
    const clientName = requestBody.Client_Name;
    const clientType = requestBody.Client_Type;
    const configuration = requestBody.configuration;
}
```

### Frontend API Client Pattern
**File**: `src/frontend/src/api/core/apiClient.ts`

```typescript
// ✅ CORRECT: Method-specific API calls
// GET request - parameters in URL query string
const getResult = await Make_Authorized_API_Call<ClientType[]>(
  API_ENDPOINTS.CLIENT.GET,
  'GET',
  undefined,  // No body for GET requests
  { params: { Client_ID: clientId, Company_ID: companyId } }
);

// POST request - parameters in request body
const createResult = await Make_Authorized_API_Call<ClientType>(
  API_ENDPOINTS.CLIENT.CREATE,
  'POST',
  { Client_Name: "New Client", Client_Type: "FLIGHT" },  // Body data
  undefined  // No URL params for POST requests
);
```

### API Endpoint Configuration
**Pattern**: Separate endpoints for each HTTP method

```typescript
// API endpoint definitions
const API_ENDPOINTS = {
  CLIENT: {
    GET: '/tim/clients',        // GET /tim/clients?Client_ID=123
    CREATE: '/tim/clients',     // POST /tim/clients (body data)
    UPDATE: '/tim/clients',     // PUT /tim/clients (body data)  
    DELETE: '/tim/clients'      // DELETE /tim/clients?Client_ID=123
  },
  INTEGRATION: {
    INSTANCES: {
      GET: '/tim/integrations/instances',                    // GET with query params
      CREATE: '/tim/integrations/instances',                 // POST with body
      UPDATE: '/tim/integrations/instances/{instanceId}',    // PUT with body
      DELETE: '/tim/integrations/instances/{instanceId}'     // DELETE with query params
    }
  }
};
```

## Core API Response Format

All API responses must follow this exact format:

```typescript
interface APIResponse<T> {
  success: true;
  message: string;
  meta: {
    Total_Records: number;
    Request_ID: string;     // UUID format
    Timestamp: string;      // ISO 8601 UTC
    Company_ID?: string;
    period_date?: string;   // Keep lowercase from DB
    last_update?: string;   // Keep lowercase from DB
  };
  data: {
    Records: T[];           // Always wrap in Records array
    Query_Context?: {       // Optional operation context
      Mode?: string;        // Operation mode (e.g., "Login")
      Operation?: string;   // Operation type (e.g., "READ")
      Company_ID?: string;  // Scoping context
      Period_Date?: string; // Time context
    };
    Analytics?: {           // Optional analytics
      Total_Active: number;
      By_Status?: Record<string, number>;
      Performance_Metrics?: {
        Total_Duration_MS: number;
        Average_Record_Duration_MS: number;
        Batches_Processed: number;
      };
    };
  };
}

interface APIErrorResponse {
  success: false;
  message: string;           // Primary error message
  meta: {
    Timestamp: string;       // ISO 8601 UTC
    Request_ID?: string;     // UUID format
    Error_Source: string;    // Source of the error
  };
  error_code: string;        // Keep lowercase for error fields
  error_details: string;     // Keep lowercase for error fields
  validation_errors?: {      // Keep lowercase for error fields
    field: string;
    code: string;
    message: string;
  }[];
}
```

## Field Naming Rules

### Database Authority
- Use exact DB field names in API responses
- Database is the single source of truth for field naming
- No transformation of field names between DB and API

### Naming Conventions
1. **PascalCase_With_Underscores** for most fields
2. **Keep lowercase fields as-is** from DB (period_date, last_update)
3. **PascalCase_With_Underscores** for derived/computed fields
4. **Keep lowercase** for error-specific fields (error_code, error_details)

### Required Date Fields
- `Create_Date`: Required, entity creation date (ISO string in TypeScript, date in PostgreSQL)
- `Last_Updated`: Optional, last modification date (ISO string in TypeScript, date in PostgreSQL)

## API Implementation Standards

### Endpoint Configuration
- All endpoints must be defined in `src/frontend/src/api/core/apiClient.ts`
- Use consistent URL patterns: `/tim/{domain}/{action}`
- Group related endpoints in nested objects

### Response Transformation
- Always return data in `Records` array format
- Include `Query_Context` for operation traceability
- Include `Analytics` for performance metrics
- Transform raw responses using `transformResponse<T>()` function

### Error Handling
- Use `handleError()` helper for consistent error responses
- Include `Request_ID` for traceability
- Provide specific `error_code` and `error_details`
- Include `validation_errors` array when applicable

## Frontend API Usage

### Required Imports
```typescript
import { API_ENDPOINTS, Make_Authorized_API_Call } from '../api/core/apiClient';
import type { APIResponse, APIErrorResponse } from '../api/core/types';
```

### Standard API Call Pattern
```typescript
try {
  const result = await Make_Authorized_API_Call<DataType>(
    API_ENDPOINTS.DOMAIN.ACTION,
    'GET',
    undefined,
    { params: { Company_ID: companyId } }
  );
  
  if (result.success) {
    // Use result.data.Records
    const records = result.data.Records;
    // Access analytics: result.data.Analytics
    // Access context: result.data.Query_Context
  } else {
    // Handle error
    console.error('API Error:', result.message);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

### Component Integration
- Always check `result.success` before accessing data
- Use `result.data.Records` for array data
- Handle loading states during API calls
- Display user-friendly error messages

## Endpoint Additions Protocol

### Before Adding Components
1. Verify endpoint exists in `apiClient.ts`
2. If missing, add to appropriate section with consistent naming
3. Follow existing URL patterns and grouping
4. Test endpoint accessibility before component usage

### Component Development
1. Import endpoints from `API_ENDPOINTS`
2. Never hardcode URLs in components
3. Use `Make_Authorized_API_Call` for all requests
4. Handle both success and error responses
5. Include Company_ID in params when required

## Validation Checklist

### API Response Validation
- [ ] Returns proper APIResponse<T> format
- [ ] Includes Records array
- [ ] Includes proper meta fields
- [ ] Uses correct field naming conventions
- [ ] Includes Query_Context when applicable

### Endpoint Configuration Validation
- [ ] Endpoint defined in apiClient.ts
- [ ] Follows URL pattern conventions
- [ ] Grouped with related endpoints
- [ ] Referenced correctly in components
- [ ] Uses consistent naming

### Error Handling Validation
- [ ] Implements APIErrorResponse format
- [ ] Includes specific error codes
- [ ] Provides actionable error messages
- [ ] Handles validation errors appropriately
- [ ] Includes Request_ID for traceability
