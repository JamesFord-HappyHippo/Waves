# Core Architecture Standards

## Layered Architecture Approach

The HappyHippo platform follows a strict layered architecture:

### 1. Super User Layer (Outermost)
- System-wide operations
- Client management
- No client/company scope required

### 2. Account Layer
- Client-scoped operations
- Company selection
- User entitlements

### 3. Company Layer
- Company-scoped operations
- Department/location data
- Employee management
- Workflow management:
  * Sequential approval groups (1-8)
  * Special groups:
    - MGR: Dynamic resolution to employee's manager
    - END: Explicit sequence termination

### 4. Feature Layer
- Feature-specific operations
- Use existing contexts
- Follow data hierarchy

## Context Architecture

### Core Contexts

1. **Status Context**
   - Manages super user administration
   - Handles role-based access
   - Provides client entitlements

2. **Account Context**
   - Manages current user context
   - Handles company selection
   - Provides basic user info

3. **Core Data Contexts**
   - EmployeeContext
   - DepartmentContext
   - LocationContext
   - JobsContext
   - CompanyContext

4. **Workflow Context**
   - Manages approval configurations
   - Tracks action flow
   - Handles workflow status

## Data Calculation Strategy

### Analytics Calculation Principles

1. **Calculations at Load Time, Not Request Time**
   - Complex calculations performed in stored procedures during data loading
   - No calculation overhead during API requests
   - Pre-calculated tables for analytics data

2. **Benefits**
   - Fast response times for analytics queries
   - Consistent performance across all views
   - Reduced API server load
   - Historical data preservation with period tracking

3. **Implementation**
   - Use pre-calculated analytics tables (e.g., Wage_Analysis_*)
   - Stored procedures for calculations
   - Clear separation between core data and analytics data

## Response Format Standards

All API responses must follow the standard format:

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
      Mode?: string;        // Operation mode
      Operation?: string;   // Operation type
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
```

## Workflow Architecture

### Key Components

1. **Database Tables**
   - Config_Actions: Defines action types and configurations
   - Config_Approvals: Defines approval sequences
   - Approval_Groups: Defines approval group identifiers
   - Approval_Group_Emails: Maps approval groups to recipients
   - Action_Track: Tracks action instances and progress

2. **Special Approval Groups**
   - MGR: Dynamically resolved to the employee's direct manager
   - END: Explicit termination of approval sequence

3. **Frontend Components**
   - WorkflowManager: CRUD operations for workflow configurations
   - WorkflowEditor: Interface for configuring approval sequences
   - WorkflowAnalytics: Displays workflow metrics and progress

## Handler Patterns

### Core Data Handler Pattern

All core data handlers must follow this pattern:
1. Required parameters validation
2. Basic query construction
3. Optional filter handling
4. Standard response formatting

### Example Core Fields

**Employee Handler**
```javascript
// Core fields with correct naming convention
- Employee_ID
- First_Name
- Last_Name
- Email
- Annual_Salary
- Date_of_Hire
- Termination_Date
- Department_ID
- Work_Location_ID
- Job_ID
- Reports_To
```

## Best Practices

1. **Layer Separation**
   - Keep components within their appropriate layer
   - Don't skip layers in the hierarchy
   - Maintain proper context access patterns

2. **Context Usage**
   - Keep contexts focused on specific domains
   - Avoid circular dependencies
   - Maintain clear data flow

3. **Data Access**
   - Use pre-calculated data for analytics
   - Implement efficient queries
   - Follow proper field naming conventions
   - Database is the source of truth for field names
