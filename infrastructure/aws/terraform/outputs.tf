# Waves Marine Navigation Platform - Terraform Outputs

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "database_subnets" {
  description = "List of IDs of database subnets"
  value       = module.vpc.database_subnets
}

# Database Outputs
output "db_endpoint" {
  description = "RDS instance endpoint"
  value       = module.database.db_endpoint
  sensitive   = false
}

output "db_port" {
  description = "RDS instance port"
  value       = module.database.db_port
}

output "db_name" {
  description = "RDS database name"
  value       = module.database.db_name
}

output "db_username" {
  description = "RDS database username"
  value       = module.database.db_username
  sensitive   = true
}

output "db_password_secret_arn" {
  description = "ARN of the secret containing the database password"
  value       = aws_secretsmanager_secret.api_keys.arn
  sensitive   = true
}

# Redis Outputs
output "redis_primary_endpoint" {
  description = "Primary endpoint of the Redis replication group"
  value       = module.redis.primary_endpoint
}

output "redis_reader_endpoint" {
  description = "Reader endpoint of the Redis replication group"
  value       = module.redis.reader_endpoint
}

output "redis_port" {
  description = "Redis port"
  value       = module.redis.port
}

# ECS Outputs
output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

output "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = module.ecs.task_definition_arn
}

# Load Balancer Outputs
output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = module.alb.dns_name
}

output "alb_zone_id" {
  description = "Hosted zone ID of the load balancer"
  value       = module.alb.zone_id
}

output "alb_arn" {
  description = "ARN of the load balancer"
  value       = module.alb.arn
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = module.ecs.target_group_arn
}

# S3 Outputs
output "app_assets_bucket_name" {
  description = "Name of the S3 bucket for mobile app assets"
  value       = module.s3.app_assets_bucket_name
}

output "app_assets_bucket_domain_name" {
  description = "Domain name of the S3 bucket for mobile app assets"
  value       = module.s3.app_assets_bucket_domain_name
}

output "map_tiles_bucket_name" {
  description = "Name of the S3 bucket for map tiles"
  value       = module.s3.map_tiles_bucket_name
}

output "user_data_bucket_name" {
  description = "Name of the S3 bucket for user data"
  value       = module.s3.user_data_bucket_name
}

# CloudFront Outputs
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = module.cloudfront.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "Hosted zone ID of the CloudFront distribution"
  value       = module.cloudfront.hosted_zone_id
}

# Security Group Outputs
output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = module.security_groups.alb_security_group_id
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = module.security_groups.ecs_security_group_id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = module.security_groups.rds_security_group_id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = module.security_groups.redis_security_group_id
}

# CodeBuild Outputs
output "codebuild_project_name" {
  description = "Name of the CodeBuild project"
  value       = module.codebuild.project_name
}

output "codebuild_project_arn" {
  description = "ARN of the CodeBuild project"
  value       = module.codebuild.project_arn
}

# Secrets Manager Outputs
output "secrets_manager_secret_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.api_keys.arn
  sensitive   = true
}

output "secrets_manager_secret_name" {
  description = "Name of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.api_keys.name
}

# CloudWatch Outputs
output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.backend_logs.name
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = aws_sns_topic.alerts.arn
}

# API Endpoints for Mobile App Configuration
output "api_base_url" {
  description = "Base URL for the API (for mobile app configuration)"
  value       = var.environment == "production" ? "https://api.wavesapp.com" : "https://${var.environment}-api.wavesapp.com"
}

output "websocket_url" {
  description = "WebSocket URL for real-time marine data"
  value       = var.environment == "production" ? "wss://api.wavesapp.com/ws" : "wss://${var.environment}-api.wavesapp.com/ws"
}

# Environment Configuration for Mobile App
output "mobile_app_config" {
  description = "Configuration object for mobile app deployment"
  value = {
    api_base_url              = var.environment == "production" ? "https://api.wavesapp.com" : "https://${var.environment}-api.wavesapp.com"
    websocket_url             = var.environment == "production" ? "wss://api.wavesapp.com/ws" : "wss://${var.environment}-api.wavesapp.com/ws"
    map_tiles_cdn_url         = module.cloudfront.domain_name
    environment               = var.environment
    enable_3d_navigation      = var.enable_3d_navigation
    enable_weather_overlay    = var.enable_weather_overlay
    enable_tide_data         = var.enable_tide_data
    enable_offline_maps      = var.enable_offline_maps
    enable_depth_prediction  = var.enable_depth_prediction
    max_location_history     = var.max_location_history
    map_tile_cache_size      = var.map_tile_cache_size
    depth_data_cache_ttl     = var.depth_data_cache_ttl
    weather_data_cache_ttl   = var.weather_data_cache_ttl
    default_safety_margin    = var.default_safety_margin
    default_vessel_draft     = var.default_vessel_draft
    depth_alert_threshold    = var.depth_alert_threshold
  }
  sensitive = false
}

# Infrastructure Summary
output "infrastructure_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    environment           = var.environment
    region               = var.aws_region
    vpc_cidr             = var.vpc_cidr
    database_instance    = var.db_instance_class
    redis_instance       = var.redis_node_type
    backend_capacity     = "${var.backend_min_capacity}-${var.backend_max_capacity} instances"
    high_availability    = var.multi_az_deployment
    monitoring_enabled   = var.enable_enhanced_monitoring
    backup_retention     = var.backup_retention_period
  }
}

# Connection Strings (for deployment scripts)
output "database_connection_string" {
  description = "Database connection string (without password)"
  value       = "postgresql://${var.db_username}@${module.database.db_endpoint}:5432/${var.db_name}"
  sensitive   = false
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = "redis://${module.redis.primary_endpoint}:6379"
  sensitive   = false
}

# Deployment Information
output "deployment_info" {
  description = "Information needed for application deployment"
  value = {
    ecr_repository_url    = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.project_name}-backend"
    ecs_cluster_name      = module.ecs.cluster_name
    ecs_service_name      = module.ecs.service_name
    load_balancer_dns     = module.alb.dns_name
    secrets_manager_arn   = aws_secretsmanager_secret.api_keys.arn
    log_group_name        = aws_cloudwatch_log_group.backend_logs.name
  }
}