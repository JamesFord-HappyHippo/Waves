# Coder Agent Knowledge Base

**Agent Type**: Core Implementation Specialist  
**Last Updated**: 2025-08-19T15:00:00Z

## Core Responsibilities

1. **Code Implementation**: Write production-quality code following Tim-Combo patterns
2. **API Design**: Create consistent endpoints following `.clinerules/api_standards.md`
3. **Refactoring**: Improve existing code without breaking functionality
4. **Optimization**: Enhance performance while maintaining readability
5. **Error Handling**: Implement robust error patterns following Tim-Combo standards

## Tim-Combo Specific Patterns

### Backend Handler Standards ✅
```javascript
// Required imports pattern
const { wrapHandler } = require('./lambdaWrapper');
const { executeQuery } = require('./dbOperations');
const { createSuccessResponse, createErrorResponse } = require('./responseUtil');
const { handleError } = require('./errorHandler');

// Standard handler pattern
async function handlerName({ queryParams = {}, requestBody = {}, requestContext }) {
    try {
        const Request_ID = requestContext.requestId;
        // Implementation logic
        return createSuccessResponse(
            { Records: results },
            'Success message',
            { Total_Records: results.length, Request_ID, Timestamp: new Date().toISOString() }
        );
    } catch (error) {
        console.error('Handler Error:', error);
        return handleError(error);
    }
}

exports.handler = wrapHandler(handlerName);
```

### API Response Format ✅
```javascript
// Always use APIResponse<T> with Records array wrapping
const result = await Make_Authorized_API_Call<DataType>(
  API_ENDPOINTS.DOMAIN.ACTION,
  'GET',
  undefined,
  { params: { Company_ID: companyId } }
);

if (result.success) {
  const records = result.data.Records; // Always wrapped in Records array
} else {
  console.error('API Error:', result.message);
}
```

### Frontend Component Patterns ✅
```tsx
// Context provider layering
<AuthProvider>
  <StatusProvider>
    <AccountProvider>
      <CompanyProvider>
        <FeatureProviders>
          <RouteComponent />
        </FeatureProviders>
      </CompanyProvider>
    </AccountProvider>
  </StatusProvider>
</AuthProvider>

// Performance optimization
const MemoizedComponent = React.memo(({ data }: Props) => {
  const memoizedValue = useMemo(() => expensiveCalculation(data), [data]);
  const handleClick = useCallback(() => action(data), [data]);
  
  return <ComponentUI value={memoizedValue} onClick={handleClick} />;
});
```

## Code Quality Standards

### 1. Field Naming Convention
- **Database Fields**: Use exact DB field names, PascalCase_With_Underscores
- **API Responses**: No transformation, maintain DB field format
- **Frontend**: Convert to camelCase only in component props/state

### 2. Error-First Design
```javascript
// Design error states before happy path
if (!requiredField) {
  return createErrorResponse('MISSING_REQUIRED_FIELD', 'Field X is required');
}

// Fail fast, fail loudly - no fallback data
if (authToken.expired) {
  throw new AuthenticationError('Token expired - user must re-authenticate');
}
```

### 3. Business-Scoped IDs
```javascript
// Use business-scoped IDs for traceability
const Client_ID = `CL_${Company_ID}_${timestamp}_${increment}`;
const Template_Code = `${source}_${target}_comprehensive_v${version}`;
```

## Integration Handler Access

### Database Operations ✅
```javascript
// Standard query pattern
const query = `
    SELECT Client_ID, Company_ID, Client_Name, Is_Active
    FROM clients 
    WHERE Company_ID = $1 AND Is_Active = true
    ORDER BY Created_Date DESC
`;

const result = await executeQuery(query, [Company_ID]);
if (result.success) {
    return createSuccessResponse({ Records: result.data });
} else {
    return handleError(result.error);
}
```

### Template System Integration
```javascript
// Access integration templates
const templateQuery = `
    SELECT template_code, field_mappings, transformation_rules, validation_rules
    FROM integration_templates 
    WHERE template_code = $1 AND is_active = true
`;

// Parse JSONB field mappings
const fieldMappings = template.field_mappings;
fieldMappings.employee_sync.forEach(mapping => {
    // Apply transformation based on mapping.transformation
});
```

## Performance Optimization

### 1. Lambda Optimization
- **Cold Start**: Keep imports minimal, use shared connection pools
- **Memory Usage**: Monitor for 512MB Lambda limits
- **Execution Time**: Target <5 second response times
- **Connection Reuse**: Leverage Lambda execution environment reuse

### 2. Database Optimization
```javascript
// Use connection pooling
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000
});

// Batch operations
const insertQuery = `
    INSERT INTO table_name (field1, field2) 
    VALUES ${values.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(', ')}
`;
```

## Capabilities
- code-generation
- refactoring
- optimization
- api-design
- error-handling

## Learning Log
- Agent initialized with base configuration
- ✅ **Tim-Combo Standards**: Complete `.clinerules/` directory with comprehensive patterns
- ✅ **Method-Specific Architecture**: 63+ handlers with clean parameter separation
- ✅ **Expression Engine**: 50+ functions with safe sandboxed evaluation

## Next Steps
- Ready for implementation tasks following Tim-Combo patterns
