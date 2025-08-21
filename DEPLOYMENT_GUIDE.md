# Waves Marine Navigation Platform - Deployment Guide

**🌊 Complete Production Deployment Documentation for Marine Safety-Critical Systems**

## Overview

This guide provides comprehensive instructions for deploying the Waves marine navigation platform to production. The platform is designed as a safety-critical system for recreational boaters, combining real-time GPS tracking, crowdsourced depth data, and environmental monitoring.

## Architecture Summary

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile Apps   │    │   Web Frontend  │    │  Marketing Site │
│  (iOS/Android)  │    │   (React PWA)   │    │  (Static S3)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────────────┘
          │                      │                      
          └──────────┬───────────┘                      
                     │                                  
┌─────────────────────▼─────────────────────┐                    
│           Application Load Balancer        │                    
│              (HTTPS/WSS)                   │                    
└─────────────────────┬─────────────────────┘                    
                      │                                          
┌─────────────────────▼─────────────────────┐                    
│              ECS Cluster                   │                    
│    ┌──────────┐  ┌──────────┐             │                    
│    │ Backend  │  │ Backend  │  (Auto      │                    
│    │   API    │  │   API    │   Scaling)  │                    
│    └──────────┘  └──────────┘             │                    
└─────────────────────┬─────────────────────┘                    
                      │                                          
      ┌───────────────┼───────────────┐                          
      │               │               │                          
┌─────▼─────┐  ┌──────▼──────┐  ┌─────▼─────┐                    
│PostgreSQL │  │    Redis    │  │   S3      │                    
│PostGIS+   │  │ ElastiCache │  │ Storage   │                    
│TimescaleDB│  │   Cluster   │  │           │                    
└───────────┘  └─────────────┘  └───────────┘                    
```

## Prerequisites

### AWS Account Setup
1. **AWS Account** with appropriate permissions
2. **Domain Name** registered (e.g., `wavesapp.com`)
3. **SSL Certificate** in AWS Certificate Manager
4. **Route 53 Hosted Zone** for DNS management

### API Keys Required
- **MapBox Access Token** - Marine chart rendering
- **NOAA API Key** - Weather and tide data
- **Expo Account** - Mobile app distribution
- **Monitoring Services** - Sentry, Analytics (optional)

### Development Tools
```bash
# Required tools
aws-cli v2
terraform >= 1.0
docker >= 20.10
node.js >= 22
npm >= 8
```

## Step 1: Infrastructure Deployment

### 1.1 Terraform State Backend Setup

First, create the Terraform state backend:

```bash
# Create S3 bucket for Terraform state
aws s3 mb s3://waves-terraform-state --region us-east-1

# Create DynamoDB table for state locking
aws dynamodb create-table \
    --table-name waves-terraform-locks \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region us-east-1
```

### 1.2 Configure Terraform Variables

```bash
cd infrastructure/aws/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your specific values:

```hcl
# Basic Configuration
aws_region   = "us-east-1"
environment  = "production"
project_name = "waves"

# Database Configuration
db_instance_class        = "db.r6g.xlarge"
db_allocated_storage     = 200
db_max_allocated_storage = 2000

# Security and Authentication
jwt_secret              = "your-super-secure-jwt-secret"
jwt_refresh_secret      = "your-super-secure-refresh-secret"
ssl_certificate_arn     = "arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id"

# Marine API Keys
mapbox_access_token     = "pk.your_mapbox_access_token"
noaa_api_key           = "your_noaa_api_key"
openweather_api_key    = "your_openweather_api_key"

# Monitoring
alert_email = "alerts@yourdomain.com"
```

### 1.3 Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Plan the deployment
terraform plan -out=waves-production.tfplan

# Apply the infrastructure
terraform apply waves-production.tfplan
```

**Expected Deployment Time**: 15-25 minutes

### 1.4 Verify Infrastructure

```bash
# Check infrastructure health
terraform output infrastructure_summary

# Verify database connectivity
aws rds describe-db-instances --db-instance-identifier waves-production-postgresql

# Check ECS cluster
aws ecs describe-clusters --clusters waves-production
```

## Step 2: Database Setup

### 2.1 Database Initialization

```bash
# Get database endpoint from Terraform output
DB_ENDPOINT=$(terraform output -raw db_endpoint)
DB_PASSWORD=$(aws secretsmanager get-secret-value \
    --secret-id waves-production-api-keys \
    --query SecretString --output text | jq -r '.database_password')

# Run production database setup
psql "postgresql://waves_admin:${DB_PASSWORD}@${DB_ENDPOINT}:5432/waves_production" \
    -f ../database/production-setup.sql
```

### 2.2 Database Performance Tuning

```bash
# Apply PostGIS optimizations
psql "postgresql://waves_admin:${DB_PASSWORD}@${DB_ENDPOINT}:5432/waves_production" << EOF
-- Create additional indexes for marine queries
CREATE INDEX CONCURRENTLY idx_location_tracks_spatial_temporal 
ON marine_data.location_tracks USING GIST(location, recorded_at);

CREATE INDEX CONCURRENTLY idx_depth_readings_confidence_location
ON marine_data.depth_readings USING GIST(location) 
WHERE confidence_score > 0.8;

-- Analyze tables for query optimization
ANALYZE;
EOF
```

## Step 3: Backend Deployment

### 3.1 Build and Push Docker Image

```bash
cd backend

# Get ECR repository URL
ECR_REPO=$(terraform output -raw deployment_info | jq -r '.ecr_repository_url')

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin $ECR_REPO

# Build and push image
docker build -t waves-backend .
docker tag waves-backend:latest $ECR_REPO:latest
docker push $ECR_REPO:latest
```

### 3.2 Deploy Backend Service

```bash
# Update ECS service with new image
aws ecs update-service \
    --cluster waves-production \
    --service waves-backend \
    --force-new-deployment

# Monitor deployment
aws ecs wait services-stable \
    --cluster waves-production \
    --services waves-backend
```

### 3.3 Verify Backend Health

```bash
# Get load balancer DNS
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test API health
curl -f https://$ALB_DNS/api/health

# Test database connectivity
curl -f https://$ALB_DNS/api/health/database

# Test marine data endpoints
curl -f "https://$ALB_DNS/api/marine/depth?lat=37.7749&lon=-122.4194"
```

## Step 4: Mobile App Deployment

### 4.1 Configure Mobile Environment

```bash
cd WavesDemo

# Install dependencies
npm install

# Configure environment for production
node ../scripts/configure-mobile-env.js production
```

### 4.2 EAS Build Setup

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS project
eas build:configure
```

Create `eas.json`:

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://dev-api.wavesapp.com"
      }
    },
    "staging": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://staging-api.wavesapp.com"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.wavesapp.com"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 4.3 Build Mobile Apps

```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

### 4.4 Deploy to App Stores

```bash
# Submit to App Store Connect
eas submit --platform ios --latest

# Submit to Google Play Console
eas submit --platform android --latest
```

## Step 5: Monitoring Setup

### 5.1 CloudWatch Dashboard

```bash
# Create custom CloudWatch dashboard
aws cloudwatch put-dashboard \
    --dashboard-name "Waves-Marine-Navigation" \
    --dashboard-body file://infrastructure/monitoring/cloudwatch-dashboard.json
```

### 5.2 Set Up Alerts

```bash
# Create SNS topics for alerts
aws sns create-topic --name waves-critical-alerts
aws sns create-topic --name waves-warning-alerts

# Subscribe to alerts
aws sns subscribe \
    --topic-arn arn:aws:sns:us-east-1:123456789012:waves-critical-alerts \
    --protocol email \
    --notification-endpoint alerts@yourdomain.com
```

### 5.3 Configure Prometheus/Grafana (Optional)

```bash
# Deploy monitoring stack
kubectl apply -f infrastructure/monitoring/prometheus-grafana.yml

# Access Grafana dashboard
kubectl port-forward svc/grafana 3000:3000
# Open http://localhost:3000
```

## Step 6: Security Hardening

### 6.1 Enable AWS Security Services

```bash
# Enable GuardDuty
aws guardduty create-detector --enable

# Enable Config
aws configservice put-configuration-recorder \
    --configuration-recorder file://infrastructure/security/config-recorder.json

# Enable CloudTrail
aws cloudtrail create-trail \
    --name waves-audit-trail \
    --s3-bucket-name waves-audit-logs
```

### 6.2 Configure WAF

```bash
# Create WAF Web ACL
aws wafv2 create-web-acl \
    --scope CLOUDFRONT \
    --default-action Allow={} \
    --rules file://infrastructure/security/waf-rules.json \
    --name WavesMarineNavigationWAF
```

## Step 7: DNS and SSL Setup

### 7.1 Configure Route 53

```bash
# Get ALB DNS name
ALB_DNS=$(terraform output -raw alb_dns_name)
ALB_ZONE_ID=$(terraform output -raw alb_zone_id)

# Create DNS records
aws route53 change-resource-record-sets \
    --hosted-zone-id Z1234567890123 \
    --change-batch file://dns-changes.json
```

Create `dns-changes.json`:

```json
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.wavesapp.com",
        "Type": "A",
        "AliasTarget": {
          "DNSName": "your-alb-dns-name.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true,
          "HostedZoneId": "Z35SXDOTRQ7X7K"
        }
      }
    }
  ]
}
```

### 7.2 SSL Certificate Validation

```bash
# Verify SSL certificate
aws acm describe-certificate --certificate-arn your-certificate-arn

# Test HTTPS endpoint
curl -v https://api.wavesapp.com/api/health
```

## Step 8: Production Verification

### 8.1 End-to-End Testing

```bash
# Run production smoke tests
cd backend
npm run test:production

# Test critical marine navigation endpoints
curl -f "https://api.wavesapp.com/api/marine/depth?lat=37.7749&lon=-122.4194"
curl -f "https://api.wavesapp.com/api/weather/current?lat=37.7749&lon=-122.4194"
curl -f "https://api.wavesapp.com/api/marine/hazards?lat=37.7749&lon=-122.4194&radius=1000"
```

### 8.2 Performance Testing

```bash
# Run load tests
k6 run backend/tests/performance/api-load-test.js

# Test database performance
psql "postgresql://waves_admin:${DB_PASSWORD}@${DB_ENDPOINT}:5432/waves_production" << EOF
EXPLAIN ANALYZE SELECT * FROM marine_data.get_depth_in_area(37.7749, -122.4194, 1000);
EOF
```

### 8.3 Security Testing

```bash
# Run security scans
docker run --rm -v $(pwd):/target \
    aquasec/trivy fs /target

# Test WAF rules
curl -X POST https://api.wavesapp.com/api/test \
    -H "Content-Type: application/json" \
    -d '{"test": "<script>alert(1)</script>"}'
```

## Step 9: Backup and Disaster Recovery

### 9.1 Configure Automated Backups

```bash
# Enable RDS automated backups (already configured in Terraform)
aws rds modify-db-instance \
    --db-instance-identifier waves-production-postgresql \
    --backup-retention-period 30 \
    --backup-window "03:00-04:00"

# Create manual snapshot
aws rds create-db-snapshot \
    --db-instance-identifier waves-production-postgresql \
    --db-snapshot-identifier waves-production-initial-snapshot
```

### 9.2 Test Disaster Recovery

```bash
# Test database restore (in development environment)
aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier waves-test-restore \
    --db-snapshot-identifier waves-production-initial-snapshot

# Test application recovery
# This should be performed in a staging environment
```

## Step 10: Go-Live Checklist

### Pre-Launch Verification

- [ ] **Infrastructure Health**: All AWS services running
- [ ] **Database Performance**: Query performance optimized
- [ ] **API Endpoints**: All critical endpoints responding
- [ ] **Mobile Apps**: iOS and Android apps approved and published
- [ ] **SSL Certificates**: HTTPS working correctly
- [ ] **DNS Configuration**: All domains resolving correctly
- [ ] **Monitoring**: Alerts configured and tested
- [ ] **Security**: WAF, GuardDuty, and CloudTrail enabled
- [ ] **Backups**: Automated backups configured and tested

### Marine Safety Verification

- [ ] **Depth Data Accuracy**: Crowdsourced data validation working
- [ ] **Weather Integration**: NOAA API integration functional
- [ ] **Emergency Features**: Emergency contact system operational
- [ ] **Navigation Hazards**: Hazard detection and alerting working
- [ ] **Offline Capability**: Mobile apps work without connectivity
- [ ] **Privacy Controls**: User privacy settings functional

### Performance Verification

- [ ] **API Response Times**: < 200ms for critical endpoints
- [ ] **Database Performance**: Spatial queries optimized
- [ ] **Mobile App Performance**: 60fps navigation rendering
- [ ] **Caching**: Redis caching effective
- [ ] **CDN**: Static assets served efficiently

## Maintenance and Operations

### Daily Operations

```bash
# Check system health
aws ecs describe-services --cluster waves-production --services waves-backend
aws rds describe-db-instances --db-instance-identifier waves-production-postgresql

# Monitor key metrics
aws cloudwatch get-metric-statistics \
    --namespace AWS/ApplicationELB \
    --metric-name TargetResponseTime \
    --dimensions Name=LoadBalancer,Value=app/waves-production/1234567890123456 \
    --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average
```

### Weekly Maintenance

```bash
# Update Docker images
cd backend
git pull origin main
docker build -t waves-backend:$(git rev-parse --short HEAD) .
# Deploy through CI/CD pipeline

# Database maintenance
psql "postgresql://waves_admin:${DB_PASSWORD}@${DB_ENDPOINT}:5432/waves_production" << EOF
-- Clean up old location data
SELECT marine_data.cleanup_old_data();

-- Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.popular_navigation_areas;

-- Update table statistics
ANALYZE;
EOF
```

### Monthly Reviews

- **Security Review**: Review GuardDuty findings and WAF logs
- **Performance Review**: Analyze CloudWatch metrics and optimize
- **Cost Optimization**: Review AWS costs and optimize resources
- **Capacity Planning**: Review usage trends and plan scaling
- **Disaster Recovery Testing**: Test backup and restore procedures

## Troubleshooting

### Common Issues

#### API Service Not Responding
```bash
# Check ECS service status
aws ecs describe-services --cluster waves-production --services waves-backend

# Check logs
aws logs get-log-events \
    --log-group-name /aws/ecs/waves-production-backend \
    --log-stream-name ecs/waves-backend/$(aws ecs list-tasks --cluster waves-production --service-name waves-backend --query 'taskArns[0]' --output text | rev | cut -d'/' -f1 | rev)

# Restart service
aws ecs update-service --cluster waves-production --service waves-backend --force-new-deployment
```

#### Database Performance Issues
```bash
# Check database metrics
aws cloudwatch get-metric-statistics \
    --namespace AWS/RDS \
    --metric-name CPUUtilization \
    --dimensions Name=DBInstanceIdentifier,Value=waves-production-postgresql \
    --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average

# Check for long-running queries
psql "postgresql://waves_admin:${DB_PASSWORD}@${DB_ENDPOINT}:5432/waves_production" << EOF
SELECT query, state, query_start, now() - query_start AS duration
FROM pg_stat_activity 
WHERE state != 'idle' AND query_start < now() - interval '1 minute'
ORDER BY duration DESC;
EOF
```

#### Mobile App Issues
```bash
# Check for new builds
eas build:list --platform all

# Create emergency OTA update
cd WavesDemo
eas update --channel production --message "Emergency bug fix"
```

## Security Incident Response

### Immediate Response (< 5 minutes)

1. **Identify the threat** from GuardDuty or CloudTrail logs
2. **Isolate affected systems** by modifying security groups
3. **Preserve evidence** by creating EBS snapshots
4. **Notify stakeholders** using emergency contact list

### Investigation (< 30 minutes)

1. **Analyze logs** in CloudWatch and CloudTrail
2. **Check for data breach** in application logs
3. **Assess impact** on marine navigation services
4. **Document findings** for post-incident review

### Recovery (< 2 hours)

1. **Patch vulnerabilities** and redeploy services
2. **Update security rules** in WAF and security groups
3. **Reset compromised credentials** in Secrets Manager
4. **Verify system integrity** through health checks

## Support and Contact Information

### Emergency Contacts

- **Critical Issues (Marine Safety)**: +1-XXX-XXX-XXXX
- **Technical Support**: support@wavesapp.com
- **Security Issues**: security@wavesapp.com

### Resources

- **Documentation**: https://docs.wavesapp.com
- **Status Page**: https://status.wavesapp.com
- **Developer Portal**: https://developers.wavesapp.com

---

**⚓ Safe waters and successful deployments!**

This deployment guide ensures that the Waves marine navigation platform is deployed with the highest standards of reliability, security, and performance required for safety-critical maritime applications.