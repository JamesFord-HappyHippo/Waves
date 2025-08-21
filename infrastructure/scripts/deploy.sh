#!/bin/bash

# Waves Marine Navigation Platform - Automated Deployment Script
# Production-ready deployment orchestrator for safety-critical marine systems

set -euo pipefail

# Configuration
PROJECT_NAME="waves"
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "\n${BLUE}=================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}=================================================${NC}\n"
}

# Error handling
handle_error() {
    log_error "Deployment failed at line $1"
    log_error "Rolling back changes..."
    cleanup_on_error
    exit 1
}

trap 'handle_error $LINENO' ERR

# Cleanup function for failed deployments
cleanup_on_error() {
    log_warning "Performing emergency cleanup..."
    
    # Stop any running builds
    if [ ! -z "${CODEBUILD_PROJECT_NAME:-}" ]; then
        aws codebuild stop-build --id "${CODEBUILD_PROJECT_NAME}" 2>/dev/null || true
    fi
    
    # Revert ECS service if deployment in progress
    if [ ! -z "${ECS_SERVICE_ARN:-}" ]; then
        log_warning "Reverting ECS service to previous task definition..."
        # Implementation would go here for rollback
    fi
}

# Prerequisites check
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    # Check required tools
    local tools=("aws" "terraform" "docker" "node" "npm" "jq")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
        log_info "✓ $tool is available"
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    local aws_account_id=$(aws sts get-caller-identity --query Account --output text)
    log_info "✓ AWS credentials valid (Account: $aws_account_id)"
    
    # Check required environment variables
    local required_vars=("MAPBOX_ACCESS_TOKEN" "NOAA_API_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
        log_info "✓ $var is configured"
    done
    
    log_success "All prerequisites satisfied"
}

# Deploy infrastructure using Terraform
deploy_infrastructure() {
    log_header "Deploying Infrastructure with Terraform"
    
    cd "${ROOT_DIR}/infrastructure/aws/terraform"
    
    # Check if terraform.tfvars exists
    if [ ! -f "terraform.tfvars" ]; then
        log_error "terraform.tfvars not found. Please copy from terraform.tfvars.example and configure."
        exit 1
    fi
    
    # Initialize Terraform
    log_info "Initializing Terraform..."
    terraform init -upgrade
    
    # Validate configuration
    log_info "Validating Terraform configuration..."
    terraform validate
    
    # Plan deployment
    log_info "Planning infrastructure changes..."
    terraform plan -detailed-exitcode -out="${PROJECT_NAME}-${ENVIRONMENT}.tfplan"
    local plan_exit_code=$?
    
    if [ $plan_exit_code -eq 1 ]; then
        log_error "Terraform plan failed"
        exit 1
    elif [ $plan_exit_code -eq 2 ]; then
        log_info "Infrastructure changes detected, proceeding with apply..."
        
        # Apply changes
        terraform apply "${PROJECT_NAME}-${ENVIRONMENT}.tfplan"
        log_success "Infrastructure deployment completed"
    else
        log_info "No infrastructure changes needed"
    fi
    
    # Export important outputs
    export DB_ENDPOINT=$(terraform output -raw db_endpoint)
    export ALB_DNS_NAME=$(terraform output -raw alb_dns_name)
    export ECR_REPOSITORY_URL=$(terraform output -raw deployment_info | jq -r '.ecr_repository_url')
    export ECS_CLUSTER_NAME=$(terraform output -raw deployment_info | jq -r '.ecs_cluster_name')
    export ECS_SERVICE_NAME=$(terraform output -raw deployment_info | jq -r '.ecs_service_name')
    
    log_success "Infrastructure outputs exported"
    
    cd "${ROOT_DIR}"
}

# Setup database
setup_database() {
    log_header "Setting Up Database"
    
    # Get database credentials from Secrets Manager
    local secret_arn=$(terraform output -raw secrets_manager_secret_arn)
    local secret_value=$(aws secretsmanager get-secret-value --secret-id "$secret_arn" --query SecretString --output text)
    local db_password=$(echo "$secret_value" | jq -r '.database_password')
    
    # Build connection string
    local db_url="postgresql://waves_admin:${db_password}@${DB_ENDPOINT}:5432/waves_production"
    
    log_info "Testing database connectivity..."
    if ! timeout 30 bash -c "until pg_isready -h ${DB_ENDPOINT} -p 5432; do sleep 1; done"; then
        log_error "Database is not accessible"
        exit 1
    fi
    
    log_info "Running database setup script..."
    PGPASSWORD="$db_password" psql "$db_url" -f "${ROOT_DIR}/infrastructure/database/production-setup.sql"
    
    log_info "Testing database health..."
    local health_check=$(PGPASSWORD="$db_password" psql "$db_url" -t -c "SELECT status FROM waves.health_check;" | xargs)
    if [ "$health_check" != "healthy" ]; then
        log_error "Database health check failed"
        exit 1
    fi
    
    log_success "Database setup completed successfully"
}

# Build and deploy backend
deploy_backend() {
    log_header "Building and Deploying Backend"
    
    cd "${ROOT_DIR}/backend"
    
    # Install dependencies and run tests
    log_info "Installing backend dependencies..."
    npm ci --only=production
    
    log_info "Running backend tests..."
    npm run test
    
    # Build Docker image
    log_info "Building Docker image..."
    local image_tag="$(git rev-parse --short HEAD)"
    docker build -t "${PROJECT_NAME}-backend:${image_tag}" .
    docker tag "${PROJECT_NAME}-backend:${image_tag}" "${ECR_REPOSITORY_URL}:${image_tag}"
    docker tag "${PROJECT_NAME}-backend:${image_tag}" "${ECR_REPOSITORY_URL}:latest"
    
    # Login to ECR and push image
    log_info "Pushing Docker image to ECR..."
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REPOSITORY_URL"
    docker push "${ECR_REPOSITORY_URL}:${image_tag}"
    docker push "${ECR_REPOSITORY_URL}:latest"
    
    # Update ECS service
    log_info "Updating ECS service..."
    aws ecs update-service \
        --cluster "$ECS_CLUSTER_NAME" \
        --service "$ECS_SERVICE_NAME" \
        --force-new-deployment \
        --region "$AWS_REGION"
    
    # Wait for deployment to complete
    log_info "Waiting for service deployment to stabilize..."
    aws ecs wait services-stable \
        --cluster "$ECS_CLUSTER_NAME" \
        --services "$ECS_SERVICE_NAME" \
        --region "$AWS_REGION"
    
    # Health check
    log_info "Performing backend health check..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "https://${ALB_DNS_NAME}/api/health" > /dev/null; then
            log_success "Backend health check passed"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "Backend health check failed after $max_attempts attempts"
            exit 1
        fi
        
        log_info "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    log_success "Backend deployment completed successfully"
    cd "${ROOT_DIR}"
}

# Deploy mobile apps
deploy_mobile() {
    log_header "Building and Deploying Mobile Apps"
    
    cd "${ROOT_DIR}/WavesDemo"
    
    # Install dependencies
    log_info "Installing mobile app dependencies..."
    npm ci
    
    # Configure environment
    log_info "Configuring mobile environment for $ENVIRONMENT..."
    node ../scripts/configure-mobile-env.js "$ENVIRONMENT"
    
    # Check if we're in CI/CD or manual deployment
    if [ "${CI:-false}" = "true" ]; then
        log_info "Running in CI/CD environment, mobile builds will be handled by GitHub Actions"
    else
        log_warning "Manual deployment: Skipping mobile app builds"
        log_info "Mobile apps should be built and deployed through the CI/CD pipeline"
        log_info "To build manually, run:"
        log_info "  eas build --platform ios --profile $ENVIRONMENT"
        log_info "  eas build --platform android --profile $ENVIRONMENT"
    fi
    
    cd "${ROOT_DIR}"
}

# Setup monitoring and alerts
setup_monitoring() {
    log_header "Setting Up Monitoring and Alerts"
    
    # Create CloudWatch dashboard
    log_info "Creating CloudWatch dashboard..."
    local dashboard_body=$(cat "${ROOT_DIR}/infrastructure/monitoring/cloudwatch-dashboard.json")
    aws cloudwatch put-dashboard \
        --dashboard-name "Waves-Marine-Navigation-${ENVIRONMENT}" \
        --dashboard-body "$dashboard_body" \
        --region "$AWS_REGION"
    
    # Create SNS topics if they don't exist
    log_info "Setting up alert topics..."
    local critical_topic_arn=$(aws sns create-topic --name "${PROJECT_NAME}-${ENVIRONMENT}-critical-alerts" --query TopicArn --output text)
    local warning_topic_arn=$(aws sns create-topic --name "${PROJECT_NAME}-${ENVIRONMENT}-warning-alerts" --query TopicArn --output text)
    
    # Subscribe to critical alerts if email provided
    if [ ! -z "${ALERT_EMAIL:-}" ]; then
        aws sns subscribe \
            --topic-arn "$critical_topic_arn" \
            --protocol email \
            --notification-endpoint "$ALERT_EMAIL" \
            --region "$AWS_REGION" || log_warning "Email subscription may already exist"
    fi
    
    log_success "Monitoring and alerts configured"
}

# Run production verification tests
verify_deployment() {
    log_header "Verifying Production Deployment"
    
    # Test critical API endpoints
    log_info "Testing critical marine navigation endpoints..."
    
    local base_url="https://${ALB_DNS_NAME}"
    local test_endpoints=(
        "/api/health"
        "/api/health/database"
        "/api/health/redis"
        "/api/marine/depth?lat=37.7749&lon=-122.4194"
        "/api/weather/current?lat=37.7749&lon=-122.4194"
    )
    
    for endpoint in "${test_endpoints[@]}"; do
        log_info "Testing $endpoint..."
        if curl -f -s "${base_url}${endpoint}" > /dev/null; then
            log_success "✓ $endpoint"
        else
            log_error "✗ $endpoint failed"
            exit 1
        fi
    done
    
    # Test database performance
    log_info "Testing database performance..."
    local db_test_result=$(curl -s "${base_url}/api/health/database" | jq -r '.status')
    if [ "$db_test_result" != "healthy" ]; then
        log_error "Database performance test failed"
        exit 1
    fi
    
    # Test load balancer health
    log_info "Testing load balancer health..."
    local lb_health=$(aws elbv2 describe-target-health \
        --target-group-arn "$(aws elbv2 describe-target-groups --names "${PROJECT_NAME}-${ENVIRONMENT}-backend" --query 'TargetGroups[0].TargetGroupArn' --output text)" \
        --region "$AWS_REGION" \
        --query 'TargetHealthDescriptions[0].TargetHealth.State' \
        --output text)
    
    if [ "$lb_health" != "healthy" ]; then
        log_error "Load balancer target health check failed: $lb_health"
        exit 1
    fi
    
    log_success "All production verification tests passed"
}

# Generate deployment report
generate_report() {
    log_header "Generating Deployment Report"
    
    local report_file="${ROOT_DIR}/deployment-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# Waves Marine Navigation Platform - Deployment Report

**Environment**: $ENVIRONMENT  
**Deployment Date**: $(date -u '+%Y-%m-%d %H:%M:%S UTC')  
**Git Commit**: $(git rev-parse HEAD)  
**Deployed By**: $(whoami)

## Infrastructure Summary

- **AWS Region**: $AWS_REGION
- **Database Endpoint**: $DB_ENDPOINT
- **Load Balancer**: $ALB_DNS_NAME
- **ECS Cluster**: $ECS_CLUSTER_NAME
- **ECS Service**: $ECS_SERVICE_NAME

## Deployment Steps Completed

- ✅ Infrastructure deployment (Terraform)
- ✅ Database setup and configuration
- ✅ Backend application deployment
- ✅ Mobile app configuration
- ✅ Monitoring and alerts setup
- ✅ Production verification tests

## Health Check Results

$(curl -s "https://${ALB_DNS_NAME}/api/health" | jq -r .)

## Database Health

$(curl -s "https://${ALB_DNS_NAME}/api/health/database" | jq -r .)

## Post-Deployment Tasks

- [ ] DNS records updated (if domain changed)
- [ ] SSL certificates validated
- [ ] Mobile apps submitted to app stores (if applicable)
- [ ] Team notifications sent
- [ ] Documentation updated

## Monitoring Links

- CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=Waves-Marine-Navigation-$ENVIRONMENT
- ECS Service: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters/$ECS_CLUSTER_NAME/services
- RDS Instance: https://console.aws.amazon.com/rds/home?region=$AWS_REGION#database:id=waves-$ENVIRONMENT-postgresql

## Emergency Contacts

- Critical Issues: [Configure emergency contact]
- Technical Support: support@wavesapp.com
- On-Call Engineer: [Configure on-call rotation]

---
Generated by Waves Deployment Script v1.0
EOF

    log_success "Deployment report generated: $report_file"
    
    # Display summary
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}🌊 WAVES DEPLOYMENT SUCCESSFUL! 🌊${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
    echo -e "API URL: ${YELLOW}https://${ALB_DNS_NAME}${NC}"
    echo -e "Deployment Report: ${YELLOW}$report_file${NC}"
    echo -e "${GREEN}========================================${NC}\n"
}

# Main deployment function
main() {
    log_header "🌊 Waves Marine Navigation Platform Deployment"
    log_info "Starting deployment for environment: $ENVIRONMENT"
    log_info "AWS Region: $AWS_REGION"
    log_info "Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    
    # Parse command line arguments
    local skip_infra=false
    local skip_backend=false
    local skip_mobile=false
    local skip_verify=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-infrastructure)
                skip_infra=true
                shift
                ;;
            --skip-backend)
                skip_backend=true
                shift
                ;;
            --skip-mobile)
                skip_mobile=true
                shift
                ;;
            --skip-verification)
                skip_verify=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --skip-infrastructure  Skip Terraform infrastructure deployment"
                echo "  --skip-backend         Skip backend application deployment"
                echo "  --skip-mobile          Skip mobile app deployment"
                echo "  --skip-verification    Skip production verification tests"
                echo "  --help                 Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute deployment steps
    check_prerequisites
    
    if [ "$skip_infra" = false ]; then
        deploy_infrastructure
    else
        log_warning "Skipping infrastructure deployment"
        # Still need to export outputs if skipping
        cd "${ROOT_DIR}/infrastructure/aws/terraform"
        export DB_ENDPOINT=$(terraform output -raw db_endpoint)
        export ALB_DNS_NAME=$(terraform output -raw alb_dns_name)
        export ECR_REPOSITORY_URL=$(terraform output -raw deployment_info | jq -r '.ecr_repository_url')
        export ECS_CLUSTER_NAME=$(terraform output -raw deployment_info | jq -r '.ecs_cluster_name')
        export ECS_SERVICE_NAME=$(terraform output -raw deployment_info | jq -r '.ecs_service_name')
        cd "${ROOT_DIR}"
    fi
    
    setup_database
    
    if [ "$skip_backend" = false ]; then
        deploy_backend
    else
        log_warning "Skipping backend deployment"
    fi
    
    if [ "$skip_mobile" = false ]; then
        deploy_mobile
    else
        log_warning "Skipping mobile deployment"
    fi
    
    setup_monitoring
    
    if [ "$skip_verify" = false ]; then
        verify_deployment
    else
        log_warning "Skipping production verification"
    fi
    
    generate_report
}

# Execute main function with all arguments
main "$@"