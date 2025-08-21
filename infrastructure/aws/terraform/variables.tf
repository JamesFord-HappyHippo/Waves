# Waves Marine Navigation Platform - Terraform Variables

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "waves"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnets" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnets" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "database_subnets" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
}

# Database Configuration
variable "db_instance_class" {
  description = "RDS instance class - optimized for PostGIS geospatial queries"
  type        = string
  default     = "db.r6g.large"  # Memory optimized for spatial operations
}

variable "db_allocated_storage" {
  description = "Initial allocated storage for RDS instance"
  type        = number
  default     = 100
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS autoscaling"
  type        = number
  default     = 1000
}

variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "waves_production"
}

variable "db_username" {
  description = "Master username for the database"
  type        = string
  default     = "waves_admin"
}

# Redis Configuration
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r6g.large"  # Memory optimized for marine data caching
}

variable "redis_num_nodes" {
  description = "Number of Redis cache nodes"
  type        = number
  default     = 2
}

# Backend ECS Configuration
variable "backend_memory" {
  description = "Memory allocation for backend container (MB)"
  type        = number
  default     = 2048
}

variable "backend_cpu" {
  description = "CPU allocation for backend container"
  type        = number
  default     = 1024
}

variable "backend_desired_capacity" {
  description = "Desired number of backend instances"
  type        = number
  default     = 2
}

variable "backend_min_capacity" {
  description = "Minimum number of backend instances"
  type        = number
  default     = 1
}

variable "backend_max_capacity" {
  description = "Maximum number of backend instances"
  type        = number
  default     = 10
}

# Security and Authentication
variable "jwt_secret" {
  description = "JWT secret for authentication"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "JWT refresh token secret"
  type        = string
  sensitive   = true
}

variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate for HTTPS"
  type        = string
  default     = ""
}

# External API Keys - Marine Data Sources
variable "mapbox_access_token" {
  description = "MapBox access token for marine charts"
  type        = string
  sensitive   = true
}

variable "noaa_api_key" {
  description = "NOAA API key for marine weather and tide data"
  type        = string
  sensitive   = true
}

variable "openweather_api_key" {
  description = "OpenWeather API key for weather data"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stormglass_api_key" {
  description = "StormGlass API key for marine weather data"
  type        = string
  sensitive   = true
  default     = ""
}

# CI/CD Configuration
variable "github_repo_url" {
  description = "GitHub repository URL for source code"
  type        = string
  default     = "https://github.com/waves/waves-platform.git"
}

# CORS Configuration for Mobile App
variable "cors_allowed_origins" {
  description = "Allowed origins for CORS (mobile app URLs)"
  type        = list(string)
  default     = [
    "exp://localhost:8081",
    "http://localhost:8081",
    "https://localhost:8081",
    "wavesapp://",
    "waves://"
  ]
}

# Monitoring and Alerting
variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring for production safety"
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Email address for critical alerts"
  type        = string
  default     = "alerts@wavesapp.com"
}

# Feature Flags
variable "enable_3d_navigation" {
  description = "Enable 3D navigation features"
  type        = bool
  default     = true
}

variable "enable_weather_overlay" {
  description = "Enable weather overlay features"
  type        = bool
  default     = true
}

variable "enable_tide_data" {
  description = "Enable tide data integration"
  type        = bool
  default     = true
}

variable "enable_offline_maps" {
  description = "Enable offline map caching"
  type        = bool
  default     = true
}

variable "enable_depth_prediction" {
  description = "Enable ML-based depth prediction"
  type        = bool
  default     = true
}

# Performance and Safety Settings
variable "max_location_history" {
  description = "Maximum number of location points to store"
  type        = number
  default     = 10000
}

variable "map_tile_cache_size" {
  description = "Map tile cache size in bytes"
  type        = number
  default     = 104857600  # 100MB
}

variable "depth_data_cache_ttl" {
  description = "Depth data cache TTL in seconds"
  type        = number
  default     = 300  # 5 minutes
}

variable "weather_data_cache_ttl" {
  description = "Weather data cache TTL in seconds"
  type        = number
  default     = 1800  # 30 minutes
}

variable "default_safety_margin" {
  description = "Default safety margin for depth calculations (meters)"
  type        = number
  default     = 0.5
}

variable "default_vessel_draft" {
  description = "Default vessel draft for safety calculations (meters)"
  type        = number
  default     = 1.5
}

variable "depth_alert_threshold" {
  description = "Depth alert threshold (meters)"
  type        = number
  default     = 2.0
}

# Backup and Disaster Recovery
variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "multi_az_deployment" {
  description = "Enable multi-AZ deployment for high availability"
  type        = bool
  default     = true
}

# Cost Optimization
variable "enable_spot_instances" {
  description = "Enable spot instances for cost optimization (non-production only)"
  type        = bool
  default     = false
}

variable "auto_scaling_enabled" {
  description = "Enable auto scaling for ECS services"
  type        = bool
  default     = true
}

# Compliance and Governance
variable "enable_config_rules" {
  description = "Enable AWS Config rules for compliance"
  type        = bool
  default     = true
}

variable "enable_cloudtrail" {
  description = "Enable CloudTrail for audit logging"
  type        = bool
  default     = true
}

variable "enable_guardduty" {
  description = "Enable GuardDuty for threat detection"
  type        = bool
  default     = true
}

# Local development overrides
variable "local_development" {
  description = "Flag for local development environment"
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot when destroying RDS (development only)"
  type        = bool
  default     = false
}