# Deployment Standards and CI/CD Best Practices

## Cross-Account Deployment Architecture (August 2025) ✅

### Multi-Account Strategy - OPERATIONAL
**Achievement**: Successfully deployed method-specific handlers across 3 AWS accounts

**Account Structure**:
- **Dev Account**: `532595801838` - Development and build artifacts
- **Sandbox Account**: `455510265254` - Testing and validation environment  
- **Media Account**: `855652006097` - Frontend hosting and CDN

### Lambda Artifact Cross-Account Sync
**Process**: Dev → Sandbox Lambda deployment

```bash
# 1. Authenticate to sandbox account
aws sso login --profile sandbox-sso

# 2. Sync Lambda artifacts cross-account
aws s3 sync s3://tim-dev-lambda/ s3://tim-sb-be-live/ \
  --profile sandbox-sso \
  --source-region us-east-2 \
  --exclude "*.log" --exclude "*.txt" --include "*.zip"

# Results: 94.5 MiB, 255 Lambda .zip files synced
```

**Benefits**:
- **Artifact Consistency**: Same build artifacts across environments
- **Reduced Build Time**: Single build, multiple deployments
- **Version Control**: Centralized artifact management

### Frontend Cross-Account Deployment  
**Process**: Build in any account → Deploy to Media account

```bash
# 1. Build for target environment
npm run build:sandbox  # Uses .env.sandbox configuration

# 2. Authenticate to media account  
aws sts get-caller-identity --profile media-sso

# 3. Deploy to S3 + invalidate CloudFront
aws s3 sync build/ s3://tim-sb-fe-live-855652006097/ \
  --profile media-sso --delete

aws cloudfront create-invalidation \
  --distribution-id E25ON3LWW4KFNF \
  --paths "/*" --profile media-sso
```

**Results**:
- **Volume**: 21.8 MiB React production build
- **CDN**: Immediate cache invalidation for instant updates
- **Branding**: Environment-specific white label configuration

### OIDC Authentication Strategy
**Method**: AWS SSO profiles for secure cross-account access

```bash
# Available profiles for cross-account operations
aws configure list-profiles
# Output: default, media, sandbox-sso, media-sso, 855652006097_AWSAdministratorAccess
```

**Security Benefits**:
- **No Long-term Keys**: SSO tokens with automatic expiration
- **Role-based Access**: Minimum required permissions per account
- **Audit Trail**: All cross-account operations logged

## Clean Deploy Milestone Achievement

This document captures the deployment standards and CI/CD best practices established during the successful resolution of the S3 build duplicate handler issue and achievement of clean deployment architecture.

## S3 Build and Deployment Architecture

### Dual ZIP Strategy

**Overview**: Every Lambda handler generates two ZIP files in S3 for enterprise-grade deployment management.

**Pattern**:
```
actionAdvance_js-20250731-191345.zip  ← Timestamped archive version
actionAdvance_js.zip                  ← Clean current version (SAM references this)
```

### Purpose of Each Version

#### 1. Timestamped Archives
**Format**: `{handlerName}_js-{YYYYMMDD-HHMMSS}.zip`

**Purpose**:
- Archive/rollback copies with exact build timestamp
- Enable rollback to any specific deployment version
- Audit trail for compliance and debugging
- Disaster recovery capabilities
- Build history preservation

**Benefits**:
- Complete deployment history
- Granular rollback capability
- Compliance and audit support
- Emergency recovery options

#### 2. Clean Current Versions
**Format**: `{handlerName}_js.zip`

**Purpose**:
- Latest/current version that SAM template references
- CloudFormation uses these for Lambda deployment
- Always points to most recent successful build
- Simplified IAC references (no timestamp management needed)

**Benefits**:
- Atomic deployment pattern
- SAM template simplicity
- Consistent deployment references
- Zero timestamp management in IaC

### Rollback Mechanism

**The clean filename acts as a "pointer" to the active version.**

**Rollback Process**:
1. **Identify Target**: Find desired rollback timestamp (e.g., `20250730-140000`)
2. **Copy Operation**: `handlerName_js-20250730-140000.zip` → `handlerName_js.zip`
3. **SAM Reference**: Template still references `handlerName_js.zip`
4. **Deploy**: Next CloudFormation deployment uses the older version
5. **Verification**: System runs on previous version

**Key Insight**: By manipulating which archive becomes the clean version, we achieve zero-downtime rollbacks without SAM template changes.

## Handler Architecture Standards

### Flat Integration Structure

**Requirement**: All integration handlers must be in a flat directory structure.

**Before (Problematic)**:
```
src/backend/src/handlers/integrations/
├── uploadCertificate.js → uploadCertificate_js.zip
├── adp/
│   └── timeEntrySubmit.js → timeEntrySubmit_js.zip ← POTENTIAL CONFLICT
├── quickbooks/
│   └── oauth.js → oauth_js.zip ← POTENTIAL CONFLICT  
└── callisto/
    ├── uploadCertificate.js → uploadCertificate_js.zip ← OVERWRITE!
    └── 19 other duplicates causing build failures
```

**After (Clean)**:
```
src/backend/src/handlers/integrations/ (45 handlers, all unique)
├── uploadCertificate.js → uploadCertificate_js.zip ✓
├── adpTimeEntrySubmit.js → adpTimeEntrySubmit_js.zip ✓
├── quickbooksOauth.js → quickbooksOauth_js.zip ✓
├── timebridgeSyncStatus.js → timebridgeSyncStatus_js.zip ✓
└── 41 other unique platform handlers ✓
```

### Handler Naming Conventions

**For Nested-to-Flat Migration**:
- `adp/timeEntrySubmit.js` → `adpTimeEntrySubmit.js`
- `quickbooks/oauth.js` → `quickbooksOauth.js`  
- `timebridge/status.js` → `timebridgeSyncStatus.js` (if duplicate exists)

**Benefits**:
- Unique ZIP file names (no S3 overwrites)
- Clear platform association
- Maintainable flat structure
- Deployment reliability

### Duplicate Resolution Strategy

**Problem**: Multiple handlers with same base name cause S3 ZIP overwrites.

**Solution Pattern**:
1. **Identify Duplicates**: `find src/backend/src/handlers -name "*.js" -exec basename {} .js \; | sort | uniq -c | sort -nr`
2. **Analyze Purpose**: Determine if handlers serve different purposes
3. **Rename Strategically**: Add descriptive prefixes or suffixes
4. **Update SAM Template**: Ensure ZIP key references match new names

**Example Resolution**:
```
src/backend/src/handlers/admin/timebridgeStatus.js       ← Admin version (keep)
src/backend/src/handlers/integrations/timebridgeStatus.js ← Integration version

RENAME TO:
src/backend/src/handlers/integrations/timebridgeSyncStatus.js ← Descriptive name
```

## SAM Template Alignment

### ZIP Key Synchronization

**Critical Requirement**: SAM template ZIP keys must match actual handler names.

**Validation Process**:
```bash
# Check for mismatches
grep -E "Key.*timebridge|Key.*adp|Key.*quickbooks" IAC/sam/dev_stuff/deployAPI/lambda_with_auth.yaml

# Compare with actual handlers
ls src/backend/src/handlers/integrations/ | grep -E "timebridge|adp|quickbooks"
```

**Update Pattern**:
```yaml
# BEFORE (mismatch)
Key: timebridgeStatus_js.zip

# AFTER (aligned)  
Key: timebridgeSyncStatus_js.zip
```

### API Coverage Validation

**Tools Available**:
- `node check_iac_coverage.js` - Validates handler/IAC alignment
- API mappings in `src/shared/types/api-mappings.ts`
- Frontend client in `src/frontend/src/api/core/apiClient.ts`

**Success Metrics**:
- **Total handlers**: 139+ mapped successfully
- **IAC coverage**: 100% (zero missing handlers)
- **Integration endpoints**: 49+ properly defined
- **Frontend coverage**: Complete endpoint coverage

## Build Pipeline Standards

### Success Indicators

**S3 Build Success**:
- **Unique ZIP Files**: Each handler generates unique S3 objects
- **No Overwrites**: Zero ZIP file conflicts or overwrites
- **Dual Strategy**: Both timestamped and clean versions present
- **CloudFormation Ready**: All ZIP files available for deployment

**Architecture Metrics**:
- **202 unique handlers** → **404 ZIP files** (2 per handler)
- **45 integration handlers** in flat structure
- **208 SAM functions** properly mapped
- **Zero conflicts** → **Perfect S3 population**

### Deployment Readiness Checklist

**Pre-Deployment Verification**:
- [ ] All handlers have unique base names
- [ ] SAM template ZIP keys match handler names
- [ ] API mapper shows 100% coverage
- [ ] Frontend apiClient covers all endpoints
- [ ] S3 build produces dual ZIP strategy
- [ ] No duplicate handler conflicts

**Post-Deployment Verification**:
- [ ] All Lambda functions deployed successfully
- [ ] API endpoints responding correctly
- [ ] Frontend can access all required APIs
- [ ] Rollback capability tested and verified

## Best Practices Summary

### 1. Handler Organization
- **Flat Structure**: Keep all integration handlers in single directory
- **Unique Names**: Ensure no duplicate base names across entire codebase
- **Descriptive Naming**: Use platform prefixes for clarity
- **Regular Validation**: Check for duplicates during development

### 2. Deployment Strategy
- **Dual ZIP Pattern**: Always maintain timestamped + clean versions
- **Atomic Deployments**: Use clean ZIPs for consistent SAM references
- **Rollback Readiness**: Preserve timestamped archives for emergency rollback
- **Version Management**: Clean filename as "pointer" to active version

### 3. CI/CD Integration
- **Build Validation**: Verify unique ZIP generation before deployment
- **Template Alignment**: Ensure SAM keys match actual handler names
- **Coverage Verification**: Use API mapper to validate 100% coverage
- **Clean Deployments**: Achieve zero conflicts and perfect S3 population

### 4. Quality Assurance
- **Infrastructure Discovery**: Always check existing handlers before creating new ones
- **Endpoint Coverage**: Verify frontend/backend/IAC alignment
- **Rollback Testing**: Validate rollback procedures in development
- **Continuous Monitoring**: Regular architecture health checks

## Pre-Deployment Validation Protocol

### 🚨 Critical: Run These Checks RIGHT BEFORE Every Deployment

**Timing**: After all code changes, migrations, and cleanups are complete, but before triggering deployment.

#### 1. SAM Template Synchronization Check
```bash
echo "=== SAM TEMPLATE VALIDATION ==="
echo "Checking SAM ZIP keys against actual handlers..."

# Extract all ZIP keys from SAM template
SAM_KEYS=$(grep -o "Key: [^.]*_js.zip" IAC/sam/dev_stuff/deployAPI/lambda_with_auth.yaml | cut -d' ' -f2 | cut -d'_' -f1)

# Check each SAM key has corresponding handler
MISSING_HANDLERS=0
for handler_name in $SAM_KEYS; do
  # Check in integrations directory
  if [ ! -f "src/backend/src/handlers/integrations/${handler_name}.js" ]; then
    # Check in other directories
    HANDLER_FILE=$(find src/backend/src/handlers -name "${handler_name}.js" 2>/dev/null | head -1)
    if [ -z "$HANDLER_FILE" ]; then
      echo "❌ SAM references missing handler: ${handler_name}.js"
      MISSING_HANDLERS=$((MISSING_HANDLERS + 1))
    else
      echo "⚠️  Handler found in different location: $HANDLER_FILE"
    fi
  else
    echo "✅ Found: ${handler_name}.js"
  fi
done

if [ $MISSING_HANDLERS -gt 0 ]; then
  echo "🚨 DEPLOYMENT BLOCKED: $MISSING_HANDLERS missing handlers in SAM template"
  exit 1
fi
```

#### 2. Reverse Handler Validation
```bash
echo "=== REVERSE VALIDATION: Handlers → SAM ==="
echo "Checking all integration handlers have SAM functions..."

# Check each handler has SAM function
MISSING_SAM_FUNCTIONS=0
for handler_file in src/backend/src/handlers/integrations/*.js; do
  handler_name=$(basename "$handler_file" .js)
  
  # Check if handler has corresponding SAM function
  if ! grep -q "Key: ${handler_name}_js.zip" IAC/sam/dev_stuff/deployAPI/lambda_with_auth.yaml; then
    echo "❌ Handler missing from SAM: ${handler_name}.js"
    MISSING_SAM_FUNCTIONS=$((MISSING_SAM_FUNCTIONS + 1))
  else
    echo "✅ SAM function found: ${handler_name}"
  fi
done

if [ $MISSING_SAM_FUNCTIONS -gt 0 ]; then
  echo "🚨 DEPLOYMENT BLOCKED: $MISSING_SAM_FUNCTIONS handlers missing from SAM template"
  exit 1
fi
```

#### 3. Duplicate Handler Name Check
```bash
echo "=== DUPLICATE HANDLER CHECK ==="
echo "Checking for duplicate handler names across directories..."

DUPLICATES=$(find src/backend/src/handlers -name "*.js" -exec basename {} .js \; | sort | uniq -c | sort -nr | awk '$1 > 1 {print $2 " (" $1 " instances)"}')

if [ -n "$DUPLICATES" ]; then
  echo "❌ Duplicate handler names found:"
  echo "$DUPLICATES"
  echo "🚨 DEPLOYMENT BLOCKED: Fix duplicate handler names"
  exit 1
else
  echo "✅ No duplicate handler names found"
fi
```

#### 4. IAC Coverage Final Check
```bash
echo "=== FINAL IAC COVERAGE CHECK ==="
node check_iac_coverage.js

if [ $? -ne 0 ]; then
  echo "🚨 DEPLOYMENT BLOCKED: IAC coverage issues detected"
  exit 1
fi
```

### Pre-Deployment Checklist

**Execute in this exact order:**

- [ ] **Code Changes Complete**: All handler migrations, renames, and deletions finalized
- [ ] **SAM Template Updated**: ZIP keys align with current handler names  
- [ ] **Run SAM Validation**: Execute SAM template synchronization check
- [ ] **Run Reverse Validation**: Execute handlers → SAM validation
- [ ] **Run Duplicate Check**: Verify no duplicate handler names
- [ ] **Run IAC Coverage**: Final coverage validation
- [ ] **All Checks Pass**: Green light for deployment
- [ ] **Deploy**: Trigger CloudFormation deployment
- [ ] **Post-Deploy Verification**: Confirm all functions deployed successfully

### Common Validation Failures

#### ❌ "SAM references missing handler"
**Cause**: SAM template references handler that was deleted or renamed
**Fix**: Update or remove SAM function definition

#### ❌ "Handler missing from SAM"  
**Cause**: New handler added but no SAM function created
**Fix**: Add SAM function definition with correct ZIP key

#### ❌ "Duplicate handler names"
**Cause**: Multiple handlers with same base name in different directories
**Fix**: Rename handlers to have unique names (use prefixes)

#### ❌ "IAC coverage issues"
**Cause**: Handler/SAM mapping inconsistencies
**Fix**: Align handlers with SAM functions and API mappings

### Deployment Failure Recovery

If deployment fails after validation passes:

1. **Check CloudFormation Events**: Look for specific error messages
2. **Verify S3 ZIP Files**: Ensure all referenced ZIP files exist in S3
3. **Check Build Logs**: Verify build process completed successfully
4. **Rollback if Needed**: Use emergency rollback procedures
5. **Re-run Validation**: Validation may have been run on stale code

## Emergency Procedures

### Rollback Execution
1. **Identify Issue**: Determine problematic deployment timestamp
2. **Find Target**: Locate last known good timestamped archive
3. **Execute Rollback**: Copy timestamped archive to clean version
4. **Deploy**: Run CloudFormation deployment with clean ZIPs
5. **Verify**: Confirm system functionality on previous version

### Build Failure Recovery
1. **Identify Duplicates**: Check for ZIP naming conflicts
2. **Resolve Conflicts**: Rename handlers with unique names
3. **Update SAM**: Align template keys with new handler names
4. **Rebuild**: Trigger fresh S3 build process
5. **Validate**: Confirm dual ZIP strategy success

## Lessons Learned Integration

### Key Principle: Validation Timing Matters

**❌ Wrong**: Validate early, then make changes
**✅ Right**: Make all changes, then validate immediately before deploy

**Why**: SAM templates become "stale" after handler migrations and cleanups. Final validation must happen at the last possible moment before deployment.

### Process Improvement Mandate

Every deployment must include the complete pre-deployment validation protocol. No exceptions.

This deployment standard represents the "Clean Deploy Milestone" with enhanced validation procedures to prevent SAM template misalignment issues.
