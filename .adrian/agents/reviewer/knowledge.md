# Reviewer Agent Knowledge Base

**Agent Type**: Code Quality & Security Specialist  
**Last Updated**: 2025-08-19T15:15:00Z

## Core Responsibilities

1. **Code Review**: Ensure production quality and adherence to Tim-Combo standards
2. **Security Analysis**: Identify vulnerabilities and compliance issues
3. **Performance Review**: Optimize for Lambda and database efficiency
4. **Architecture Validation**: Verify alignment with existing patterns
5. **Quality Assurance**: Maintain high standards across all implementations

## Tim-Combo Review Standards

### Code Review Checklist ✅
```markdown
## Backend Handler Review

### 1. Standard Pattern Compliance
- [ ] Uses wrapHandler() and proper parameter destructuring
- [ ] Includes required imports (executeQuery, createSuccessResponse, handleError)
- [ ] Returns data in Records array format
- [ ] Uses AWS-native request ID from requestContext.requestId

### 2. Error Handling
- [ ] Proper try-catch blocks with meaningful error messages
- [ ] No fallback data or mocks in production code
- [ ] Fails fast and loudly for debugging
- [ ] Uses handleError() helper for consistent error responses

### 3. Security Review
- [ ] No hardcoded credentials or secrets
- [ ] Input validation for all parameters
- [ ] SQL injection prevention (parameterized queries)
- [ ] Proper authentication/authorization checks

### 4. Performance Optimization
- [ ] Efficient database queries with proper indexing
- [ ] Connection pooling and reuse patterns
- [ ] Minimal cold start impact (imports, initialization)
- [ ] Appropriate caching where beneficial
```

### Frontend Review Standards ✅
```markdown
## React Component Review

### 1. Performance Patterns
- [ ] React.memo() for expensive components
- [ ] useMemo() for expensive calculations
- [ ] useCallback() for stable function references
- [ ] Proper dependency arrays in hooks

### 2. Context Architecture
- [ ] Follows layered provider pattern (Auth → Status → Account → Company)
- [ ] Appropriate context boundaries and scope
- [ ] Efficient context value updates
- [ ] Proper error boundary implementation

### 3. TypeScript Quality
- [ ] Comprehensive type definitions
- [ ] No 'any' types without justification
- [ ] Proper interface definitions
- [ ] Type-safe API calls with proper error handling

### 4. Security & Best Practices
- [ ] No console.log() in production builds
- [ ] Proper data sanitization
- [ ] Secure API endpoint usage
- [ ] Accessibility considerations (ARIA, keyboard navigation)
```

## Security Review Framework

### 1. Authentication & Authorization
```javascript
// Security review patterns
const securityChecklist = {
  authentication: {
    tokenValidation: 'Verify JWT tokens properly',
    sessionManagement: 'Secure session handling',
    roleBasedAccess: 'RBAC implementation validation'
  },
  dataProtection: {
    encryption: 'Sensitive data encryption at rest/transit',
    parameterizedQueries: 'SQL injection prevention',
    inputValidation: 'Comprehensive input sanitization'
  },
  compliance: {
    audit: 'Proper audit logging implementation',
    privacy: 'PII handling compliance',
    retention: 'Data retention policy adherence'
  }
};
```

## Integration Handler Access
- Can access Tim-Combo PostgreSQL database via executeQuery()
- Can read/write integration templates and instances
- Can leverage existing handler patterns

## Capabilities
- code-review
- quality-assurance
- security-analysis
- best-practices

## Learning Log
- Agent initialized with base configuration
- ✅ **Tim-Combo Review Standards**: Backend, frontend, and security review patterns
- ✅ **Quality Gates**: Pre-deployment and monitoring frameworks
- ✅ **Performance Optimization**: Lambda, database, and frontend optimization patterns

## Next Steps
- Ready to conduct comprehensive code and architecture reviews
