# Unified System Troubleshooting Guidelines

## Pre-Development Verification Checklist

### 1. Helper/Dependency Verification
Before starting any backend handler work:

```bash
# Always verify helper existence and location
1. Check if helper exists: list_files src/backend/src/helpers
2. Verify import path matches actual file location
3. Check if helper is properly exported
4. Verify function names exist in the actual module
```

**Rule**: Never assume helper imports without verification. Always check:
- File exists in expected location
- Export pattern matches import expectations (class vs object vs function)
- Helper follows standard patterns
- Function names match exactly (e.g., getCredentials vs getAuthenticationPackage)

### 1.1. UnifiedCredentialManager Function Verification
**CRITICAL**: Always verify unifiedCredentialManager function names:

```bash
# Check available functions in unifiedCredentialManager
read_file src/backend/src/helpers/unifiedCredentialManager.js

# Look for function definitions:
# - getAuthenticationPackage() ✅ EXISTS
# - getCredentials() ❌ DOES NOT EXIST
# - testAuthenticationFlow() ✅ EXISTS
# - getAllCredentials() ✅ EXISTS
```

**Common Errors to Avoid:**
- ❌ `const { unifiedCredentialManager } = require('./unifiedCredentialManager')` (Wrong destructuring)
- ❌ `unifiedCredentialManager.getCredentials()` (Function doesn't exist)
- ✅ `const unifiedCredentialManager = require('./unifiedCredentialManager')` (Correct import)
- ✅ `unifiedCredentialManager.getAuthenticationPackage()` (Correct function)

### 2. Database Schema Verification
Before working with data models:

```bash
# Check current database schema
1. Use MCP pg tool to check table structure
2. Verify field names match expected casing (PascalCase_With_Underscores vs camelCase)
3. Check for recent schema migrations
4. Validate constraint definitions
```

**Rule**: Always verify database schema matches code expectations before implementing queries.

### 3. API Endpoint Consistency Check
Before implementing frontend components:

```bash
# Verify API endpoint configuration
1. Check apiClient.ts for endpoint definitions
2. Verify backend handlers exist for all referenced endpoints
3. Ensure response formats match TypeScript interfaces
4. Test endpoint accessibility if possible
```

**Rule**: API endpoints must be defined in apiClient.ts before frontend components reference them.

### 4. TypeScript Interface Alignment
When working with API responses:

```bash
# Interface validation workflow
1. Check actual API response structure (via MCP or logs)
2. Compare with TypeScript interface definitions  
3. Update interfaces BEFORE implementing components
4. Verify all fields are properly typed
```

**Rule**: TypeScript interfaces must reflect actual API response structure, not assumed structure.

## Integration Issue Resolution Workflow

### 1. Data Layer First
```
Database Schema Check → Data Migration → Handler Updates → API Verification → Frontend Updates
```

### 2. Import Resolution Priority
```
1. Verify file exists in expected location
2. Check import path syntax (relative vs absolute)
3. Verify export pattern matches import
4. Test import in isolation if needed
```

### 3. Unified System Changes
When working with unified credential systems:

```
1. Check existing migration status
2. Verify unified table structure
3. Update all related handlers together
4. Test data flow end-to-end
5. Update frontend interfaces last
```

### 4. Visual Component Updates
When adding new visual elements:

```
1. Update TypeScript interfaces first
2. Verify data availability
3. Add visual components with proper typing
4. Test with actual data, not mock data
```

## Common Troubleshooting Patterns

### Issue: "Property X does not exist on type Y"
**Solution Order:**
1. Check actual API response structure
2. Update TypeScript interface
3. Verify data mapping in components
4. Test with real data

### Issue: "Cannot resolve module './helper'"
**Solution Order:**
1. Verify helper file exists
2. Check file location matches import path
3. Verify export pattern
4. Update import path if needed

### Issue: "No credentials found" 
**Solution Order:**
1. Check database for actual records
2. Verify query matches table structure
3. Check field name casing
4. Verify migration completed successfully

### Issue: "Empty dropdowns/non-functional UI"
**Solution Order:**
1. Check API endpoint returns data
2. Verify data transformation in components
3. Check TypeScript interface alignment
4. Verify component state management

## Prevention Rules

1. **Always Check Before Assuming**: Never assume files, helpers, or data structures exist without verification
2. **Database First**: When working with data, always verify current database state first
3. **Interface Alignment**: Keep TypeScript interfaces in sync with actual API responses
4. **End-to-End Testing**: Test complete data flow from database to UI before considering task complete
5. **Migration Verification**: When working with unified systems, always verify migration completed successfully

## Quick Commands for Verification

```bash
# Check helper existence
list_files src/backend/src/helpers

# Check database schema  
use_mcp_tool pg execute_query "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'table_name'"

# Check API endpoint configuration
read_file src/frontend/src/api/core/apiClient.ts

# Check TypeScript interface
search_files src/frontend "interface.*TypeName"
```

These guidelines will help catch integration issues early and provide a systematic approach to troubleshooting unified system problems.
