# Waves Marine Navigation Platform - AWS Infrastructure
# Production-ready multi-environment deployment

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }

  backend "s3" {
    bucket         = "waves-terraform-state"
    key            = "waves/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "waves-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Waves"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Team        = "Marine-Navigation"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Random password for RDS
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# VPC and Networking
module "vpc" {
  source = "./modules/vpc"

  name               = "${var.project_name}-${var.environment}"
  cidr               = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names
  
  # Marine-specific subnets for high availability
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets
  database_subnets = var.database_subnets

  enable_nat_gateway = true
  enable_vpn_gateway = false
  enable_dns_hostnames = true
  enable_dns_support = true

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Security Groups
module "security_groups" {
  source = "./modules/security"

  vpc_id = module.vpc.vpc_id
  
  environment = var.environment
  project_name = var.project_name
}

# RDS - PostgreSQL with PostGIS
module "database" {
  source = "./modules/rds"

  vpc_id              = module.vpc.vpc_id
  db_subnet_group_name = module.vpc.database_subnet_group_name
  security_group_ids  = [module.security_groups.rds_security_group_id]
  
  environment     = var.environment
  project_name    = var.project_name
  
  # PostGIS optimized instance
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  
  db_name     = var.db_name
  db_username = var.db_username
  db_password = random_password.db_password.result
  
  # High performance for geospatial queries
  performance_insights_enabled = true
  monitoring_interval = 60
  
  # Backup and maintenance
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  # Enable deletion protection for production
  deletion_protection = var.environment == "production" ? true : false
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Database"
  }
}

# ElastiCache Redis - Real-time data caching
module "redis" {
  source = "./modules/elasticache"

  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnets
  security_group_ids = [module.security_groups.redis_security_group_id]
  
  environment  = var.environment
  project_name = var.project_name
  
  node_type           = var.redis_node_type
  num_cache_nodes     = var.redis_num_nodes
  parameter_group     = "default.redis7"
  port                = 6379
  
  # Clustering for production
  replication_group_id = "${var.project_name}-${var.environment}-redis"
  description          = "Redis cache for Waves marine navigation platform"
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Cache"
  }
}

# ECS Cluster for backend services
module "ecs" {
  source = "./modules/ecs"

  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnets
  public_subnet_ids   = module.vpc.public_subnets
  security_group_ids  = [module.security_groups.ecs_security_group_id]
  
  environment  = var.environment
  project_name = var.project_name
  
  # Container configuration
  container_port     = 8080
  container_memory   = var.backend_memory
  container_cpu      = var.backend_cpu
  desired_capacity   = var.backend_desired_capacity
  max_capacity       = var.backend_max_capacity
  min_capacity       = var.backend_min_capacity
  
  # Environment variables for backend
  environment_variables = [
    {
      name  = "NODE_ENV"
      value = var.environment
    },
    {
      name  = "DATABASE_URL"
      value = "postgresql://${var.db_username}:${random_password.db_password.result}@${module.database.db_endpoint}:5432/${var.db_name}"
    },
    {
      name  = "REDIS_URL"
      value = "redis://${module.redis.primary_endpoint}:6379"
    },
    {
      name  = "JWT_SECRET"
      value = var.jwt_secret
    },
    {
      name  = "MAPBOX_ACCESS_TOKEN"
      value = var.mapbox_access_token
    },
    {
      name  = "NOAA_API_KEY"
      value = var.noaa_api_key
    }
  ]
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Backend"
  }
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnets
  security_group_ids  = [module.security_groups.alb_security_group_id]
  
  environment  = var.environment
  project_name = var.project_name
  
  target_group_arn = module.ecs.target_group_arn
  certificate_arn  = var.ssl_certificate_arn
  
  # Health check for marine safety systems
  health_check_path     = "/api/health"
  health_check_timeout  = 10
  health_check_interval = 30
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "LoadBalancer"
  }
}

# S3 Bucket for mobile app assets and map tiles
module "s3" {
  source = "./modules/s3"

  environment  = var.environment
  project_name = var.project_name
  
  # Bucket for mobile app assets
  app_assets_bucket_name = "${var.project_name}-${var.environment}-mobile-assets"
  
  # Bucket for map tiles and geospatial data
  map_tiles_bucket_name = "${var.project_name}-${var.environment}-map-tiles"
  
  # Bucket for user uploads and depth data
  user_data_bucket_name = "${var.project_name}-${var.environment}-user-data"
  
  # CORS configuration for mobile app
  cors_allowed_origins = var.cors_allowed_origins
  cors_allowed_methods = ["GET", "POST", "PUT", "DELETE"]
  cors_allowed_headers = ["*"]
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Storage"
  }
}

# CloudFront distribution for static assets
module "cloudfront" {
  source = "./modules/cloudfront"

  environment  = var.environment
  project_name = var.project_name
  
  # S3 bucket for static assets
  s3_bucket_domain_name = module.s3.app_assets_bucket_domain_name
  s3_bucket_id         = module.s3.app_assets_bucket_id
  
  # Custom domain configuration
  domain_name = var.environment == "production" ? "api.wavesapp.com" : "${var.environment}-api.wavesapp.com"
  certificate_arn = var.ssl_certificate_arn
  
  # Mobile-optimized caching
  default_ttl = 86400  # 24 hours
  max_ttl     = 31536000  # 1 year
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "CDN"
  }
}

# CodeBuild for CI/CD
module "codebuild" {
  source = "./modules/codebuild"

  environment  = var.environment
  project_name = var.project_name
  
  # Source configuration
  source_location = var.github_repo_url
  
  # Build environment
  compute_type = "BUILD_GENERAL1_MEDIUM"
  image        = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
  
  # Service role for CodeBuild
  service_role_arn = aws_iam_role.codebuild_role.arn
  
  # Environment variables for build
  environment_variables = [
    {
      name  = "AWS_DEFAULT_REGION"
      value = var.aws_region
    },
    {
      name  = "AWS_ACCOUNT_ID"
      value = data.aws_caller_identity.current.account_id
    },
    {
      name  = "IMAGE_REPO_NAME"
      value = "${var.project_name}-backend"
    },
    {
      name  = "IMAGE_TAG"
      value = "latest"
    },
    {
      name  = "ENVIRONMENT"
      value = var.environment
    }
  ]
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "CI-CD"
  }
}

# Secrets Manager for API keys and sensitive data
resource "aws_secretsmanager_secret" "api_keys" {
  name        = "${var.project_name}-${var.environment}-api-keys"
  description = "API keys and secrets for Waves marine navigation platform"
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Security"
  }
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id
  secret_string = jsonencode({
    database_password    = random_password.db_password.result
    jwt_secret          = var.jwt_secret
    jwt_refresh_secret  = var.jwt_refresh_secret
    mapbox_access_token = var.mapbox_access_token
    noaa_api_key        = var.noaa_api_key
    openweather_api_key = var.openweather_api_key
    stormglass_api_key  = var.stormglass_api_key
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "backend_logs" {
  name              = "/aws/ecs/${var.project_name}-${var.environment}-backend"
  retention_in_days = var.environment == "production" ? 30 : 7
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Logging"
  }
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = module.ecs.service_name
    ClusterName = module.ecs.cluster_name
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Monitoring"
  }
}

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-${var.environment}-alerts"
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Alerting"
  }
}

# IAM role for CodeBuild
resource "aws_iam_role" "codebuild_role" {
  name = "${var.project_name}-${var.environment}-codebuild-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codebuild.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "CI-CD"
  }
}

# IAM policy for CodeBuild
resource "aws_iam_role_policy" "codebuild_policy" {
  role = aws_iam_role.codebuild_role.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:GetAuthorizationToken",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "iam:PassRole",
          "s3:GetObject",
          "s3:PutObject",
          "secretsmanager:GetSecretValue"
        ]
        Resource = "*"
      }
    ]
  })
}