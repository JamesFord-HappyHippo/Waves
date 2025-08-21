# API Development Workflow Standards

## API-First Development Flow

To prevent TypeScript errors and API contract mismatches, follow this development sequence:

```
Check Existing APIs → API Definition → Backend Implementation → API Client Configuration → Frontend Usage
```

## Step 0: Check Existing APIs FIRST

**CRITICAL**: Before creating ANY new handlers or API endpoints, always check if they already exist:

1. **Check API Mappings**: Review `src/shared/types/api-mappings.ts` to see all existing API paths
   - This file contains the definitive mapping of API paths to Lambda functions
   - Search for similar endpoints that might already handle your use case
   - Look for existing paths with different HTTP methods (GET, POST, PUT, DELETE)

2. **Check SAM Template**: Review `IAC/sam/tim-complete-api.yaml` to see all deployed functions
   - Contains all Lambda functions and their API Gateway mappings
   - Shows the complete API infrastructure

3. **Check Handler Directory**: Scan `src/backend/src/handlers/` for existing handlers
   - Most common operations already have handlers implemented
   - Look in subdirectories like `/admin/`, `/integrations/`, `/mappings/` etc.

### Common Existing Endpoints
- Credentials: `/tim/credentials` (GET), `/tim/credentials/status` (GET)
- User management: `/tim/user` (GET, POST, PUT, DELETE)
- Company data: `/tim/company` (GET, POST, PUT, DELETE)
- Integrations: `/tim/integrations/*` (extensive existing API)
- Email: `/tim/email` (GET, POST, PUT, DELETE)

## Step 1: API Definition

**Only if no existing API handles your use case**, then document the new API contract:

1. Document the API contract including:
   - Endpoint URL pattern
   - HTTP method
   - Request parameters and body schema
   - Response schema (following APIResponse pattern)
   - Error conditions

2. Add the endpoint to `src/frontend/src/api/core/apiClient.ts` in the appropriate section:

```typescript
// Example API addition:
TIMEBRIDGE: {
  STATUS: API_BASE + "/tim/timebridge/status",
  ENABLE: API_BASE + "/tim/timebridge/enable",
  DISABLE: API_BASE + "/tim/timebridge/disable",
  DATA_SYNC: API_BASE + "/tim/timebridge/data-sync",    // Add all endpoints before usage
  SCHEDULE_SYNC: API_BASE + "/tim/timebridge/schedule-sync",
  SYNC: API_BASE + "/tim/timebridge/sync"
}
```

## Step 2: Backend Handler Implementation

**Only create new handlers if Step 0 confirmed none exist**

Implement the backend handler following the standards in `backend_handler_standards.md`:

1. Use required helper imports
2. Follow the standard handler pattern
3. Return standardized response format
4. Handle errors consistently
5. Use proper ID generation patterns

## Step 3: API Client Configuration Verification

Before starting frontend component development:

1. Verify the endpoint exists in `apiClient.ts`
2. Cross-reference with `src/shared/types/api-mappings.ts` to ensure consistency
3. Ensure it follows URL pattern conventions
4. Confirm it's properly grouped with related endpoints
5. Run a quick test to verify endpoint accessibility if possible

## Step 4: Frontend Component Implementation

Implement frontend components using the API:

1. Import from API_ENDPOINTS, never hardcode URLs
2. Use Make_Authorized_API_Call for all requests
3. Handle both success and error responses
4. Check result.success before accessing data
5. Use result.data.Records for array data

## Common Development Pitfalls to Avoid

### ❌ Most Common Mistake: Not Checking Existing APIs

```
// INCORRECT FLOW - Creates duplicate handlers
Assume new handler needed
↓
Create new backend handler
↓
Add new endpoint to apiClient.ts
↓
Discover existing handler already exists
↓
Waste time removing duplicate code
```

### ❌ Incorrect Order of Development

```
// INCORRECT FLOW - Leads to TypeScript errors
Frontend Component Development (assumes endpoint exists)
↓
TypeScript Error: Property 'X' does not exist
↓
Add missing endpoint to apiClient.ts
```

### ✅ Correct Order of Development

```
// CORRECT FLOW - Prevents TypeScript errors and duplicates
Check src/shared/types/api-mappings.ts for existing APIs
↓
If exists: Use existing endpoint from apiClient.ts
↓
If not exists: Add endpoint to apiClient.ts → Implement backend handler
↓
Frontend component development (uses existing endpoint)
```

### ❌ API Usage Without Contract

```typescript
// AVOID: Referencing endpoints that don't exist
API_ENDPOINTS.INTEGRATIONS.TIMEBRIDGE.DATA_SYNC // Error if not defined first
```

### ✅ Proper API Contract Verification

```typescript
// CORRECT: Verify endpoint exists before component development
// 1. Check in apiClient.ts that the endpoint is defined
// 2. Then use it in components
if (isSuccessResponse(response)) {
  const records = response.data.Records;
  // Process data
}
```

## Integration Validation Protocol

1. **Cross-reference API mappings**:
   ```bash
   # Check if endpoint exists in mappings
   grep -r "your-endpoint-path" src/shared/types/api-mappings.ts
   ```

2. **Verify TypeScript compilation**:
   ```bash
   cd src/frontend && npm run typecheck
   ```

3. **Check for duplicate endpoints**:
   ```bash
   # Look for similar paths in apiClient.ts
   grep -r "similar-path" src/frontend/src/api/core/apiClient.ts
   ```

If errors appear like:
```
TS2339: Property 'X' does not exist on type...
```

This indicates a missing API endpoint in the `apiClient.ts` configuration.

## Key Principles

1. **Existing APIs as Single Source of Truth**
   - Always check `src/shared/types/api-mappings.ts` FIRST
   - Most operations already have handlers implemented
   - Reuse existing handlers instead of creating duplicates

2. **API Configuration Consistency**
   - All components must reference endpoints from API_ENDPOINTS
   - All endpoints must be defined before component development
   - TypeScript compilation should be clean before committing code
   - Document the existence of each endpoint in project documentation

3. **Handler Reuse Over Creation**
   - Default assumption: handler probably already exists
   - Only create new handlers after confirming none exist
   - Look for similar operations in related domains

By following this API-first development workflow with existing API checking, we prevent both TypeScript errors AND duplicate handler creation.
