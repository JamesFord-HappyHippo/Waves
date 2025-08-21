# Pilot Infrastructure Patterns and Deployment Standards

## Overview

This document captures the pilot infrastructure deployment patterns established during the Flux Systems pilot setup, including simplification strategies, common issues, and deployment best practices.

## Pilot Infrastructure Architecture

### Split Stack Approach

**Base Infrastructure Stack** (Persistent):
- **Purpose**: RDS + Cognito that survive Lambda deployments
- **Stack Name**: `flux-systems-pilot-base`
- **Components**: PostgreSQL ARM64 + Cognito User Pool
- **Deployment**: Once, then stable

**Lambda Application Stack** (Frequent Updates):
- **Purpose**: API Gateway + Lambda functions
- **References**: CloudFormation exports from base stack
- **Deployment**: Frequent updates without touching database

### Simplification Strategy for Pilot

#### 1. **Default VPC Pattern (Not Custom VPC)**
```yaml
# ✅ PILOT APPROACH - Default VPC with public access
DatabaseInstance:
  Type: AWS::RDS::DBInstance
  Properties:
    PubliclyAccessible: true  # Uses default security group
    # NO VPCSecurityGroups property - uses default
```

**Benefits**:
- No VPC creation/management complexity
- No subnet group configuration
- No NAT gateway costs
- Direct public access for development

**Security Trade-offs** (Acceptable for pilot):
- Database publicly accessible (0.0.0.0/0)
- No VPC isolation
- Uses default security group

#### 2. **Simplified Cognito Configuration**
```yaml
# ✅ PILOT APPROACH - Minimal Cognito setup
CognitoUserPool:
  Properties:
    MfaConfiguration: 'OFF'  # String format required!
    Policies:
      PasswordPolicy:
        MinimumLength: 8
        RequireUppercase: false  # Simplified
        RequireNumbers: true
        RequireSymbols: false
```

**Benefits**:
- Faster user onboarding
- No MFA complexity
- Simplified password requirements

#### 3. **ARM64 Cost Optimization**
```yaml
# ✅ PILOT APPROACH - ARM64 for cost savings
DatabaseInstance:
  Properties:
    DBInstanceClass: db.t4g.micro  # ARM64
    Engine: postgres
    EngineVersion: '15.13'  # Latest stable
    StorageType: gp3  # Better performance/cost
```

**Benefits**:
- ~30% cost reduction vs x86
- Latest PostgreSQL features
- Better gp3 performance/cost ratio

## Cross-Account Deployment Patterns

### 1. **Snapshot Sharing Process**
```bash
# ✅ CORRECT - Share from develop to sandbox
# In develop account (532595801838):
aws rds modify-db-snapshot-attribute \
  --db-snapshot-identifier happy2-arm64-pg15-20250805-1059 \
  --attribute-name restore \
  --values-to-add 455510265254

# In sandbox account (455510265254):
aws rds describe-db-snapshots --include-shared  # Key: include-shared flag!
```

### 2. **AWS SSO Authentication Pattern**
```bash
# ✅ CORRECT - Profile switching pattern
export AWS_PROFILE=default          # Develop account
export AWS_PROFILE=sandbox-sso      # Sandbox account
aws sts get-caller-identity         # Always verify context
```

## Common CloudFormation Issues and Solutions

### 1. **Cognito MfaConfiguration Type Error**
```yaml
# ❌ WRONG - Boolean (validation error)
MfaConfiguration: OFF

# ✅ CORRECT - String (works)
MfaConfiguration: 'OFF'
```

### 2. **VPC Security Group Orphan References**
```yaml
# ❌ WRONG - References removed security group
VPCSecurityGroups:
  - !Ref DatabaseSecurityGroup  # Resource doesn't exist!

# ✅ CORRECT - Remove property entirely
PubliclyAccessible: true  # Uses default security group
```

### 3. **Cross-Account Resource Visibility**
```bash
# ❌ WRONG - Empty results
aws rds describe-db-snapshots --snapshot-type shared

# ✅ CORRECT - Shows cross-account resources
aws rds describe-db-snapshots --include-shared
```

## Branding Strategy

### Flux Systems Implementation
```yaml
# Database branding
DatabaseName: 'fluxsystems'  # Not 'happyhippo'
DBInstanceIdentifier: 'pilot-flux-systems-pilot-db'

# Cognito branding
CognitoUserPoolName: 'Flux-Systems-Pilot-UserPool'
UserPoolTags:
  Service: 'Flux-Systems-Pilot'

# CORS origins (support both brands)
AllowedCorsOrigins:
  - 'http://localhost:3000'
  - 'https://pilot.happyhippo.ai'      # Legacy support
  - 'https://pilot.flux-systems.info'  # New branding
```

## Deployment Commands

### Base Infrastructure Deployment
```bash
# Deploy base infrastructure (once)
aws cloudformation create-stack \
  --stack-name flux-systems-pilot-base \
  --template-body file://IAC/cloudformation/pilot-base-infrastructure.yaml \
  --parameters ParameterKey=EnvironmentName,ParameterValue=pilot \
               ParameterKey=DatabasePassword,ParameterValue=FluxSyst3ms2025! \
  --capabilities CAPABILITY_IAM

# Monitor deployment
aws cloudformation describe-stacks --stack-name flux-systems-pilot-base
```

### Lambda Artifact Promotion (Controlled)
**GitHub Action**: Controlled promotion workflow to keep sandbox stable

**Promotion Triggers**:
- **Manual Only**: `workflow_dispatch` with required confirmation
- **Stable Releases**: Automatic promotion on GitHub releases
- **Required Fields**: Target environment, promotion reason, confirmation

**Benefits**:
- **Sandbox Stability**: Prevents automatic promotion of broken dev builds
- **Controlled Deployment**: Manual approval required for promotions
- **Audit Trail**: Promotion reason and confirmation tracking
- **Multi-Environment**: Support for sandbox and staging targets

**Manual Promotion Process**:
1. Go to GitHub Actions → "Promote Lambda Artifacts"
2. Select target environment (sandbox/staging)
3. Provide promotion reason (e.g., "stable build", "bug fix")
4. Confirm promotion (checkbox)
5. Run workflow to promote 202 ZIP files

**Alternative: Script-based promotion**:
```bash
# Manual promotion using script
cd IAC/cloudformation && ./sync-lambda-artifacts.sh
```

### Lambda Stack Deployment
```bash
# Deploy Lambda stack using exports (after base infrastructure completes)
sam deploy --profile sandbox-sso --parameter-overrides \
  DatabaseEndpoint=!ImportValue pilot-DB-Endpoint \
  CognitoUserPoolId=!ImportValue pilot-UserPool-ID
```

## Security Considerations

### Pilot-Acceptable Simplifications
1. **Public Database Access**: OK for pilot testing
2. **No MFA**: Faster development iteration
3. **Default VPC**: Reduces complexity
4. **Simplified Passwords**: 8+ chars vs enterprise requirements
5. **CloudFormation Passwords**: Not Secrets Manager

### Production Migration Requirements
1. **Private VPC**: Custom VPC with private subnets
2. **MFA Enforcement**: Required for production users
3. **Complex Passwords**: Full enterprise requirements
4. **Secrets Manager**: Proper secret rotation
5. **WAF + Security Groups**: Comprehensive protection

## Cost Optimization Achieved

### ARM64 Benefits
- **RDS**: db.t4g.micro vs db.t3.micro (~30% savings)
- **Storage**: gp3 vs gp2 (better performance/cost)
- **Modern Engine**: PostgreSQL 15.13 performance improvements

### Pilot Sizing
- **Single AZ**: No Multi-AZ costs
- **20GB Storage**: Right-sized for testing
- **Micro Instance**: Sufficient for pilot load

## Lessons Learned

### Recurring Patterns to Watch For
1. **Type Mismatches**: AWS properties often require specific types (string vs boolean)
2. **VPC Artifacts**: Simplifying complex templates leaves orphan references
3. **Cross-Account Visibility**: Need specific flags for shared resources
4. **Template Validation**: Always validate before deployment

### Prevention Strategies
1. **Validate Templates**: `aws cloudformation validate-template`
2. **Check Property Types**: Consult AWS documentation
3. **Clean VPC References**: Remove all VPC-specific properties when simplifying
4. **Test Cross-Account**: Verify resource sharing with correct query flags

## Infrastructure Exports

The base stack exports these values for Lambda stack consumption:
```yaml
Exports:
  - pilot-DB-Endpoint
  - pilot-DB-Port  
  - pilot-DB-Name
  - pilot-UserPool-ID
  - pilot-UserPoolClient-ID
  - pilot-UserPool-ARN
  - pilot-UserPoolDomain
```

## Success Metrics

### Technical Achievements
- ✅ PostgreSQL 13.20 → 15.13 upgrade
- ✅ x86 → ARM64 architecture migration  
- ✅ Cross-account snapshot sharing
- ✅ Flux Systems branding implementation
- ✅ Cost optimization (~30% reduction)

### Operational Benefits
- ✅ Split stack architecture (persistent base + frequent app updates)
- ✅ Simplified pilot security model
- ✅ Cross-account deployment capability
- ✅ Documented common issue resolution patterns

This pilot infrastructure provides a solid foundation for development while maintaining a clear path to production security enhancement.
