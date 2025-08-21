# Infrastructure Discovery Rules

## 🚨 CRITICAL: Always Check Existing Infrastructure First

**Rule**: Before implementing ANY new feature, service, or system, you MUST perform comprehensive infrastructure discovery to identify existing capabilities.

## Infrastructure Discovery Checklist

### 1. Backend Handler Discovery
**Before creating any new handlers:**

```bash
# REQUIRED: Check existing handlers first
search_files src/backend/src/handlers [feature-keyword] "*.js"
list_files src/backend/src/handlers/[domain]
```

**Common Domains to Check:**
- `email/` - Email handling and notifications
- `users/` - User management and authentication  
- `admin/` - Administrative functions
- `integrations/` - Integration and API connections
- `mappings/` - Data mapping and transformation
- `load/` - Data loading and processing

### 2. Database Infrastructure Discovery
**Before designing new database features:**

```bash
# REQUIRED: Check ACTUAL database deployment (not just files)
use_mcp_tool pg execute_query "SELECT proname as procedure_name FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND prokind = 'p' ORDER BY proname;"

use_mcp_tool pg execute_query "SELECT proname as function_name FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND prokind = 'f' ORDER BY proname;"

# SECONDARY: Check file system (may be outdated)
list_files db/stored_procedures/ --recursive
use_mcp_tool pg get_table_schema [table_name]
```

**🚨 CRITICAL**: Always check DATABASE FIRST, then compare to file system. Database is source of truth for deployed capabilities.

**Key Areas to Check:**
- Email processing functions (add_emails_to_send, add_welcome_email_to_send, etc.)
- Batch processing engines (calculate_batch_scores, process_events_batch, etc.)
- Analytics and reporting functions (wage_analysis_*, attrition_analysis_*, etc.)
- Data loading and staging procedures (load_employee_data, process_staging_data, etc.)
- Workflow and approval procedures (advance_expired_actions, etc.)

### 3. Frontend Component Discovery
**Before building new UI components:**

```bash
# REQUIRED: Check existing components
search_files src/frontend/src/features [feature-keyword] "*.tsx"
search_files src/frontend/src/components [component-type] "*.tsx"
```

### 4. API Endpoint Discovery
**Before creating new API endpoints:**

```bash
# REQUIRED: Check existing API mappings
read_file src/shared/types/api-mappings.ts
read_file src/frontend/src/api/core/apiClient.ts
search_files src/backend/src/handlers [endpoint-pattern] "*.js"
```

## Discovered Infrastructure Inventory

### ✅ Email Infrastructure (COMPREHENSIVE)
```
src/backend/src/handlers/email/
├── emailService.js                 # Unified email service with SES
├── emailSend.js                    # Queue processing
├── emailCreateEmail.js             # Email creation  
├── emailGetEmail.js                # Email retrieval
├── emailUpdateEmail.js             # Email updates
├── emailDeleteEmail.js             # Email deletion
├── emailCreateTemplate.js          # Template management
├── emailGetTemplate.js             # Template retrieval
├── emailUpdateTemplate.js          # Template updates
├── emailDeleteTemplate.js          # Template deletion
├── emailSendRejection.js           # Workflow notifications
└── emailLoadSESFeedback.js         # SES feedback processing

Database Support:
├── db/stored_procedures/email/emailSend.SQL
└── Tables: Email_Templates, Emails_To_Send, Integration_Email_Notifications
```

### ✅ User Management Infrastructure (COMPREHENSIVE)
```
src/backend/src/handlers/users/
├── userCreate.js                   # User creation with welcome emails
├── userCognitoPost.js              # Post-confirmation trigger
├── userGet.js                      # User retrieval
├── userUpdate.js                   # User updates
└── [other user handlers]           # Complete CRUD system

Features:
├── AWS Cognito Integration         # Authentication and registration
├── Client-scoped users             # Multi-tenant user management
├── Entitlement management          # Role and permission system
└── Welcome email automation        # Onboarding workflows
```

### ✅ Batch Processing Infrastructure (ENTERPRISE-GRADE)
```
db/stored_procedures/
├── Email Processing Engine         # Database-level email queue processing
├── Flight Risk Scoring Engine      # Sophisticated analytics with event processing
├── Data Loading & Processing       # Master orchestration pipeline
├── Wage Analysis Engine            # Multi-dimensional wage analytics
├── Attrition Analysis Engine       # Comprehensive attrition analytics  
├── Tenure Analysis Engine          # Employee tenure analytics
├── Organization Management         # Dynamic hierarchy management
├── PMS Engine                      # Performance management processing
└── Workflow Processing             # Automated workflow advancement

Architecture Patterns:
├── Staging-based processing        # Validation and rollback capabilities
├── Event-driven analytics          # Real-time analytical updates
├── Multi-dimensional analysis      # Company/Dept/Job/Location analytics
└── Performance optimization        # Batch processing with configurable sizes
```

### ✅ Integration Infrastructure (EXTENSIVE)
```
src/backend/src/handlers/integrations/
├── Credential Management           # Unified credential system
├── Template System                 # Integration template engine
├── Mapping System                  # Data mapping and transformation
├── Test Connections               # Connection validation
├── Webhook Processing             # Event handling
├── Certificate Management         # Security certificate handling
└── ADP/WFN Integration           # Payroll system integration
```

## Discovery Commands Reference

### Backend Discovery
```bash
# List all handler categories
list_files src/backend/src/handlers

# Search for specific functionality
search_files src/backend/src/handlers "email|user|integration" "*.js"

# Check helper availability
list_files src/backend/src/helpers
```

### Database Discovery
```bash
# List stored procedures by category
list_files db/stored_procedures --recursive

# Check table schemas
use_mcp_tool pg execute_query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"

# Check for specific functions
use_mcp_tool pg check_function_exists [function_name]
```

### Frontend Discovery
```bash
# Check existing components
list_files src/frontend/src/features --recursive
list_files src/frontend/src/components --recursive

# Search for similar functionality
search_files src/frontend/src "component-keyword" "*.tsx"
```

## Rules for Extension vs. Creation

### ✅ EXTEND (Preferred):
- Existing handlers with similar functionality
- Proven infrastructure with good patterns
- Working systems that need additional features
- Established architectural patterns

### ❌ CREATE NEW (Only when):
- No existing infrastructure found after thorough discovery
- Existing systems are fundamentally incompatible
- Complete architectural change is required
- Existing system is deprecated/being replaced

## Violation Prevention

### Before ANY Implementation:
1. **Complete Discovery**: Use all discovery commands
2. **Document Findings**: Record what infrastructure exists
3. **Extension Analysis**: Determine how to extend vs. create new
4. **Pattern Following**: Use existing architectural patterns

### Red Flags (Stop and Discover):
- Planning to build "new" email systems
- Creating "new" user management
- Building "new" batch processing
- Implementing "new" analytics
- Creating "new" authentication flows

## Success Patterns

### ✅ Recent Success Example:
**Original Plan**: Build new email system for service business
**After Discovery**: Extend existing 12+ email handlers with white-label features
**Result**: Faster implementation, proven reliability, consistent architecture

### ✅ Extension Approach:
```javascript
// EXTEND existing emailService.js
function processClientTemplate(template, context, clientId) {
    // Get existing functionality
    const existing = processTemplate(template, context);
    
    // Add client-specific extensions
    const branding = await getClientBranding(clientId);
    return addClientBranding(existing, branding);
}
```

This rule prevents rebuilding sophisticated existing infrastructure and ensures we leverage proven capabilities.
