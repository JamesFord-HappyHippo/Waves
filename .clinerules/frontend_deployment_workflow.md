# Frontend Deployment Workflow

## Environment-Specific Build Process (August 2025) ✅

### Multi-Environment Configuration System
**Achievement**: Environment-specific builds with white label branding support

**Available Environments**:
```bash
npm run build:dev        # Development environment (HappyHippo branding)
npm run build:sandbox    # Sandbox environment (Flux Systems branding)
npm run build:staging    # Staging environment
npm run build:production # Production environment
```

### Environment Configuration Files
**Location**: `/src/frontend/`

```bash
.env.development    # Dev environment config
.env.sandbox       # Sandbox environment config (ADP pilot)
.env.staging       # Staging environment config  
.env.production    # Production environment config
```

### Sandbox Environment Configuration
**File**: `.env.sandbox`
```bash
# Sandbox Environment Configuration - Updated for ADP Pilot
REACT_APP_USER_POOL_ID=us-east-2_57sEtr0xp
REACT_APP_CLIENT_ID=7kd60mm3dknahib7d84nqvla43
REACT_APP_API_URL=https://k0y33bw7t8.execute-api.us-east-2.amazonaws.com/prod

# SES Email Configuration - Sandbox (using flux-systems emails for pilot)
REACT_APP_EMAIL_FROM=noreply@flux-systems.info
REACT_APP_SUPPORT_EMAIL=support@flux-systems.info

# AWS Region
REACT_APP_AWS_REGION=us-east-2

# ADP Integration Configuration
REACT_APP_ADP_PILOT_MODE=true
```

### White Label Branding System
**Trigger**: `REACT_APP_ADP_PILOT_MODE` environment variable

**Flux Systems Branding (Sandbox)**:
- **Login Title**: "Flux Systems"
- **Tagline**: "Where change is the constant and Integration is the Strategy"
- **Color Scheme**: Flux Systems theme
- **Domain**: flux-systems.info email addresses

**HappyHippo Branding (Default)**:
- **Login Title**: "Clarity For Your C-Suite"
- **Tagline**: "Ensuring consistent and transparent people operations in a qualitative world"
- **Color Scheme**: HappyHippo theme
- **Domain**: happyhippo.ai email addresses

## Cross-Account Deployment Process

### Build Preparation
```bash
# Navigate to frontend directory
cd /Users/jamesford/Source/Tim-Combo/src/frontend

# Build for target environment
npm run build:sandbox
# Output: Creates optimized production build in build/ directory
# Volume: ~21.8 MiB React production assets
```

### Build Output Structure
```
build/
├── asset-manifest.json    # Build asset mapping
├── favicon.ico           # Site favicon
├── index.html           # Main entry point
├── manifest.json        # PWA manifest
├── robots.txt          # SEO crawler instructions
├── logo192.png         # PWA icon (192x192)
├── logo512.png         # PWA icon (512x512)
├── img/                # Static images
└── static/
    ├── css/            # Compiled CSS bundles
    └── js/             # Compiled JavaScript bundles
```

### Media Account Deployment
**Target**: AWS Account `855652006097` - Frontend hosting and CDN

```bash
# 1. Authenticate to media account
aws sts get-caller-identity --profile media-sso
# Verify: Account "855652006097"

# 2. Deploy to S3 bucket
aws s3 sync build/ s3://tim-sb-fe-live-855652006097/ \
  --profile media-sso \
  --delete
# Volume: 21.8 MiB, ~130 files
# --delete: Removes old files not in current build

# 3. Invalidate CloudFront cache for immediate updates
aws cloudfront create-invalidation \
  --distribution-id E25ON3LWW4KFNF \
  --paths "/*" \
  --profile media-sso
# Result: Cache cleared, fresh content served immediately
```

### CloudFront Configuration
**Distribution**: `E25ON3LWW4KFNF`
**Domain**: `dev2b51x62m55.cloudfront.net`
**Origin**: `tim-sb-fe-live-855652006097.s3.us-east-1.amazonaws.com`

**Benefits**:
- **Global CDN**: Fast content delivery worldwide
- **HTTPS**: Automatic SSL/TLS termination
- **Caching**: Optimized asset delivery
- **Invalidation**: Immediate cache refresh capability

## Build Process Details

### React Build Optimization
**Command**: `NODE_ENV=production DISABLE_ESLINT_PLUGIN=true react-scripts build`

**Features**:
- **Production Mode**: Optimized bundle size and performance
- **Code Splitting**: Automatic chunk generation for efficient loading
- **Tree Shaking**: Dead code elimination
- **Minification**: JavaScript and CSS compression
- **Source Maps**: Generated for debugging (uploaded but not served)

### Build Warnings Handling
**Flowbite React Source Maps**: Non-blocking warnings about missing TypeScript source files
```
Failed to parse source map from '.../flowbite-react/src/components/...'
```
**Impact**: None - warnings are cosmetic, build completes successfully

### Build Performance Metrics
**Typical Build Time**: ~2-3 minutes
**Bundle Size**: ~21.8 MiB total assets
**Chunks**: ~130 files (JS, CSS, images, manifests)

## Environment-Specific API Integration

### Sandbox Integration Points
```javascript
// Environment variables automatically injected during build
const API_URL = process.env.REACT_APP_API_URL;
// Result: "https://k0y33bw7t8.execute-api.us-east-2.amazonaws.com/prod"

const USER_POOL_ID = process.env.REACT_APP_USER_POOL_ID;
// Result: "us-east-2_57sEtr0xp"

const ADP_PILOT_MODE = process.env.REACT_APP_ADP_PILOT_MODE === 'true';
// Result: true (enables Flux Systems branding)
```

### API Client Configuration
**File**: `src/frontend/src/api/core/apiClient.ts`
**Pattern**: Environment variables drive API endpoint configuration

```javascript
// API base URL determined by build environment
const baseURL = process.env.REACT_APP_API_URL;

// Cognito configuration
const cognitoConfig = {
  userPoolId: process.env.REACT_APP_USER_POOL_ID,
  clientId: process.env.REACT_APP_CLIENT_ID,
  region: process.env.REACT_APP_AWS_REGION
};
```

## Deployment Verification

### Post-Deployment Checks
```bash
# 1. Verify S3 deployment
aws s3 ls s3://tim-sb-fe-live-855652006097/ --profile media-sso | head -5
# Expected: Fresh timestamps on key files (index.html, manifest.json, etc.)

# 2. Check CloudFront invalidation status
aws cloudfront get-invalidation \
  --distribution-id E25ON3LWW4KFNF \
  --id [INVALIDATION_ID] \
  --profile media-sso
# Expected: Status "Completed"

# 3. Browser verification
curl -I https://dev2b51x62m55.cloudfront.net
# Expected: HTTP/2 200, fresh cache headers
```

### Success Indicators
✅ **S3 Sync**: All ~130 files uploaded with fresh timestamps
✅ **CloudFront**: Invalidation completed, cache cleared
✅ **Browser**: Fresh content served, no 404 errors on assets
✅ **API**: Frontend connects to correct API endpoints
✅ **Branding**: Correct white label theme displayed

## Troubleshooting Common Issues

### Build Failures
**Symptom**: `npm run build:sandbox` fails
**Solutions**:
1. Check `.env.sandbox` file exists and has correct values
2. Verify `scripts/build-env.js` can read environment file
3. Clear node_modules: `rm -rf node_modules package-lock.json && npm install`

### S3 Sync Issues
**Symptom**: Permission denied during S3 sync
**Solutions**:
1. Refresh SSO token: `aws sso login --profile media-sso`
2. Verify account: `aws sts get-caller-identity --profile media-sso`
3. Check bucket exists: `aws s3 ls --profile media-sso | grep tim-sb-fe`

### CloudFront Caching Issues
**Symptom**: Old content still served after deployment
**Solutions**:
1. Create new invalidation: `aws cloudfront create-invalidation --distribution-id E25ON3LWW4KFNF --paths "/*" --profile media-sso`
2. Check invalidation status: Wait for "Completed" status
3. Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

## Future Enhancements

### Automation Opportunities
- **GitHub Actions**: Automatic build and deploy on main branch push
- **Environment Promotion**: Dev → Sandbox → Production pipeline
- **Health Checks**: Post-deployment verification automation
- **Rollback**: Automated rollback on deployment failures

### Multi-Environment Expansion
- **Production Environment**: Scale current sandbox process
- **Staging Environment**: Pre-production validation
- **Feature Branches**: Temporary deployment for testing