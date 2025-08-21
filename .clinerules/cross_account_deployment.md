# Cross-Account 4-Bucket Deployment Architecture

## Overview

The HappyHippo platform uses a cross-account deployment architecture where builds happen in the **dev account** and deployments happen in **target accounts** (sandbox, staging, production).

## Account Structure

### Dev Account (Build Account) - 8 Buckets Total
**Purpose**: Central build location for all environments, shared with target accounts

**Frontend Transfer Buckets** (4):
- `tim-dev-release` - Development frontend builds (dev Cognito/API config)
- `tim-sb-release` - Sandbox frontend builds (sandbox Cognito/API config) - **Shared with sandbox account**
- `tim-stage-release` - Staging frontend builds (staging Cognito/API config) - **Shared with staging account**
- `tim-prod-release` - Production frontend builds (production Cognito/API config) - **Shared with production account**

**Lambda Transfer Buckets** (4):
- `tim-dev-lambda` - Development Lambda artifacts
- `tim-sb-lambda` - Lambda artifacts for sandbox - **Shared with sandbox account**
- `tim-stage-lambda` - Lambda artifacts for staging - **Shared with staging account**
- `tim-prod-lambda` - Lambda artifacts for production - **Shared with production account**

### Target Accounts (Deployment Accounts) - 2 Buckets Each
**Purpose**: Live deployment and operation only, no cross-account building

**Sandbox Account** (2 additional buckets):
- `tim-sb-fe-live` - Live frontend served by CloudFront
- `tim-sb-be-live` - Live backend referenced by SAM templates

**Staging Account** (2 additional buckets):
- `tim-stage-fe-live` - Live frontend served by CloudFront
- `tim-stage-be-live` - Live backend referenced by SAM templates

**Production Account** (2 additional buckets):
- `tim-prod-fe-live` - Live frontend served by CloudFront
- `tim-prod-be-live` - Live backend referenced by SAM templates

### Total Architecture: 8 + 6 = 14 Buckets
- **8 buckets in dev account** (all building/transfer, shared appropriately)
- **6 buckets in target accounts** (2 per account, live only)

## Critical Deployment Rules

### 1. Build Rules (Dev Account)
- ✅ **Frontend builds** with environment-specific Cognito/API configs
- ✅ **Backend builds** are environment-agnostic (same ZIPs for all environments)
- ✅ **Deploy to transfer buckets**: `tim-{env}-release` for frontend, `tim-dev-lambda` for backend
- ❌ **Never build directly in target accounts**

### 2. Cross-Account Copy Rules
- ✅ **Lambda artifacts**: Copy from `tim-dev-lambda` → `tim-{env}-lambda`
- ✅ **Frontend artifacts**: Already in correct transfer buckets per environment
- ❌ **Never skip Lambda artifact copying**

### 3. Promotion Rules (Target Account)
- ✅ **Frontend promotion**: `tim-{env}-release` → `tim-{env}-fe-live`
- ✅ **Backend promotion**: `tim-{env}-lambda` → `tim-{env}-be-live`
- ✅ **Lambda re-registration**: Update existing Lambda functions with new ZIP files
- ✅ **CloudFront invalidation**: Clear cache after frontend promotion
- ❌ **Never skip Lambda re-registration step**

### 4. SAM Deployment Rules
- ✅ **Reference live buckets only**: `tim-{env}-be-live`
- ✅ **Run in target account**: Use target account AWS credentials
- ✅ **Only for infrastructure changes**: New functions, API changes, environment variables
- ❌ **Don't use SAM for code-only updates** (handled by promotion step)

## Deployment Workflow

### Step 1: Build (Dev Account)
```bash
cd src/frontend
npm run build:sandbox        # Build with sandbox-specific config
npm run deploy:sandbox       # Deploy to tim-sb-release (dev account)
```

### Step 2: Cross-Account Copy (Dev Account)
```bash
npm run copy-lambda:sandbox  # tim-dev-lambda → tim-sb-lambda
```

### Step 3: Promotion (Target Account)
```bash
export AWS_PROFILE=sandbox-sso  # Switch to target account
npm run promote-cross-account:sandbox  # Transfer → live + Lambda re-registration
```

### Step 4: SAM Deploy (Target Account - Optional)
```bash
# Only for infrastructure changes
sam deploy --s3-bucket tim-sb-be-live
```

## Environment-Specific Configuration

### Frontend Environment Variables
Each environment gets built with specific Cognito and API Gateway URLs:

**Sandbox (.env.sandbox)**:
- `REACT_APP_USER_POOL_ID=us-east-2_7F0LoGK72` (sandbox Cognito)
- `REACT_APP_CLIENT_ID=2mm7uio7kednoe989nvmkegurs` (sandbox client)
- `REACT_APP_API_URL=https://t7dg67rssc.execute-api.us-east-2.amazonaws.com/sb`

**Development (.env.development)**:
- `REACT_APP_USER_POOL_ID=us-east-2_oWj5l1j6m` (dev Cognito)
- `REACT_APP_CLIENT_ID=oah0kkkfg9rsrrnplm17u49p0` (dev client)
- `REACT_APP_API_URL=https://13o3tvw50h.execute-api.us-east-2.amazonaws.com/dev`

## Lambda Re-Registration Process

### Automatic Process (Built into promote-cross-account script)
1. **List ZIP files** in live backend bucket
2. **Find matching Lambda functions** using naming pattern: `-{handlerName}Function-`
3. **Update function code** with new S3 object reference
4. **Wait for update completion** using AWS Lambda wait conditions
5. **Verify updates** completed successfully

### Manual Verification
```bash
# Check Lambda function was updated
aws lambda get-function --function-name tim-sandbox-handlerNameFunction-ABC123

# Verify S3 bucket reference
aws lambda get-function-configuration --function-name tim-sandbox-handlerNameFunction-ABC123 \
  --query 'CodeSha256'
```

## Available Scripts

### Build Scripts
- `npm run build:sandbox` - Build with sandbox config
- `npm run deploy:sandbox` - Deploy to transfer bucket (dev account)

### Cross-Account Scripts
- `npm run copy-lambda:sandbox` - Copy Lambda artifacts (dev → sandbox account)
- `npm run promote-cross-account:sandbox` - Promote + re-register (target account)

### Single Account Scripts (Legacy)
- `npm run promote:sandbox` - Same account promotion (for dev environment)

## Bucket Verification Commands

```bash
# Dev account buckets
aws s3 ls s3://tim-sb-release/     # Frontend with sandbox config
aws s3 ls s3://tim-dev-lambda/     # Lambda ZIP files

# Sandbox account buckets (switch profile first)
export AWS_PROFILE=sandbox-sso
aws s3 ls s3://tim-sb-lambda/      # Lambda ZIPs copied from dev
aws s3 ls s3://tim-sb-fe-live/     # Live frontend assets
aws s3 ls s3://tim-sb-be-live/     # Live backend assets
```

## Common Errors and Solutions

### ❌ "Lambda function not found for handler"
**Cause**: Handler name doesn't match existing Lambda function naming pattern
**Solution**: Check SAM template function names follow pattern: `{HandlerName}Function`

### ❌ "Failed to update Lambda function code"
**Cause**: Lambda function doesn't exist or permissions issue
**Solution**: Run SAM deploy first to create function, then retry promotion

### ❌ "S3 bucket access denied"
**Cause**: Wrong AWS profile or missing cross-account permissions
**Solution**: Verify AWS profile and check bucket policies for cross-account access

### ❌ "Frontend has wrong API URL"
**Cause**: Built with wrong environment config
**Solution**: Verify `.env.{environment}` file and rebuild with correct environment

## Benefits of This Architecture

1. **Environment Isolation**: Each target account completely independent
2. **Build Once, Deploy Many**: Lambda artifacts built once, used everywhere
3. **Environment-Specific Configs**: Frontend builds contain correct Cognito/API URLs
4. **Controlled Promotion**: Test in transfer buckets before going live
5. **Automatic Lambda Updates**: No manual function code updates needed
6. **Rollback Capability**: Previous versions available for quick rollback
7. **Cross-Account Security**: Build and deployment concerns properly separated

## Migration from Single-Account

### If Currently Using Single-Account Deployment
1. **Set up target accounts** with live buckets
2. **Configure cross-account bucket policies** for transfer bucket access
3. **Update deployment scripts** to use cross-account promotion
4. **Test with sandbox environment** before extending to production

### Verification Checklist
- [ ] Target account buckets created and accessible
- [ ] Cross-account bucket policies configured
- [ ] Environment-specific frontend configs verified
- [ ] Lambda re-registration tested and working
- [ ] CloudFront distributions pointing to live buckets
- [ ] SAM templates referencing live buckets
