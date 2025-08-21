# Environment Bucket Architecture Standards

## 🚨 CRITICAL: Always Use 4-Bucket Architecture

**Rule**: Every environment must follow the 4-bucket architecture pattern. Never deploy directly to operational buckets or skip the promotion workflow.

## Bucket Naming Convention

### Per Environment Pattern
For each environment (`dev`, `sb`, `stage`, `prod`, `test`):

#### Transfer/Staging Buckets (Cross-Account Accessible)
- **`tim-{env}-release`** - Frontend builds with environment-specific keys
- **`tim-{env}-lambda`** - Backend Lambda ZIP files

#### Live/Operational Buckets (Target Account Only) 
- **`tim-{env}-fe-live`** - Active frontend deployment (CloudFront references)
- **`tim-{env}-be-live`** - Active Lambda deployment (SAM references)

## Mandatory Architecture Rules

### 1. Build Process Rules
- ✅ **Frontend builds** must go to `tim-{env}-release` with environment-specific secrets
- ✅ **Backend builds** must go to `tim-{env}-lambda` as environment-agnostic ZIPs
- ❌ **Never build directly** to live buckets

### 2. Deployment Reference Rules
- ✅ **SAM templates** must reference `tim-{env}-be-live` buckets only
- ✅ **CloudFront distributions** must reference `tim-{env}-fe-live` buckets only
- ❌ **Never reference transfer buckets** in operational infrastructure

### 3. Promotion Workflow Rules
- ✅ **All deployments** must go through promotion: transfer → live buckets
- ✅ **Frontend promotion**: `tim-{env}-release` → `tim-{env}-fe-live`
- ✅ **Backend promotion**: `tim-{env}-lambda` → `tim-{env}-be-live`
- ❌ **Never skip promotion workflow**

### 4. Environment Isolation Rules
- ✅ **Each environment** has completely separate bucket sets
- ✅ **Cross-environment** access only through transfer buckets
- ❌ **Never mix environments** in bucket references

## Bucket Verification Checklist

Before any deployment work, verify:

- [ ] **Transfer buckets exist**: `tim-{env}-release`, `tim-{env}-lambda`
- [ ] **Live buckets exist**: `tim-{env}-fe-live`, `tim-{env}-be-live` 
- [ ] **SAM template references**: Point to `tim-{env}-be-live`
- [ ] **CloudFront references**: Point to `tim-{env}-fe-live`
- [ ] **Environment-specific builds**: Frontend contains correct API endpoints

## Common Violations to Avoid

### ❌ Direct Operational Deployment
```yaml
# WRONG - Deploying directly to operational bucket
CodeUri:
  Bucket: tim-sb-be-live
  Key: handler.zip
```

### ✅ Correct Promotion Pattern
```bash
# CORRECT - Promotion workflow
aws s3 sync s3://tim-sb-lambda/ s3://tim-sb-be-live/
# Then deploy SAM template referencing live bucket
```

### ❌ Cross-Environment References
```yaml
# WRONG - Referencing other environment's bucket
CodeUri:
  Bucket: tim-dev-be-live  # Wrong environment!
  Key: handler.zip
```

### ✅ Correct Environment References
```yaml
# CORRECT - Environment-specific bucket reference
CodeUri:
  Bucket: tim-sb-be-live  # Correct sandbox bucket
  Key: handler.zip
```

## Implementation Priority

### Immediate (Sandbox)
1. Create missing buckets: `tim-sb-lambda`, `tim-sb-fe-live`, `tim-sb-be-live`
2. Fix SAM template to reference `tim-sb-be-live`
3. Implement promotion scripts for sandbox

### Short-term (All Environments)
1. Create missing buckets for all environments
2. Update all SAM templates to reference live buckets
3. Create promotion scripts for all environments

### Long-term (Automation)
1. Integrate promotion workflows into CI/CD
2. Add automated testing between transfer and live promotion
3. Implement rollback capabilities

## Bucket Creation Standards

### Required Configuration
- **Encryption**: AES-256 server-side encryption
- **Access**: Appropriate IAM policies per bucket type
- **Tags**: Environment and purpose tags
- **Rollback Strategy**: Use promotion workflow to re-deploy previous versions

### Example Bucket Creation
```bash
# Create with proper settings
aws s3 mb s3://tim-sb-be-live --region us-east-2
aws s3api put-bucket-encryption \
  --bucket tim-sb-be-live \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

## Error Prevention

### Pre-Deployment Validation
Always run these checks before deployment:
```bash
# Verify bucket exists
aws s3 ls s3://tim-{env}-be-live/

# Verify SAM template references
grep -r "tim-{env}-be-live" IAC/sam/

# Verify no cross-environment references
grep -r "tim-{other-env}-" IAC/sam/
```

### Build Validation
Always verify builds are environment-specific:
```bash
# Check frontend build has correct API endpoints
grep -r "REACT_APP_API_URL" build/static/js/

# Check backend references correct bucket
grep -r "TIMBucketName" template.yaml
```

This architecture ensures clean environment separation, controlled deployments, and operational safety across all environments.
