# RDS Module for Waves Marine Navigation Platform
# PostgreSQL with PostGIS and TimescaleDB optimizations

resource "aws_db_parameter_group" "postgresql" {
  family = "postgres16"
  name   = "${var.project_name}-${var.environment}-postgresql"

  # PostGIS and spatial optimizations
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,postgis,timescaledb"
  }

  parameter {
    name  = "max_connections"
    value = "200"
  }

  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4}"
  }

  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory*3/4}"
  }

  parameter {
    name  = "work_mem"
    value = "16384"  # 16MB for complex spatial queries
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "262144"  # 256MB for index maintenance
  }

  parameter {
    name  = "random_page_cost"
    value = "1.1"  # Optimized for SSD storage
  }

  parameter {
    name  = "effective_io_concurrency"
    value = "200"  # SSD optimization
  }

  # PostGIS specific optimizations
  parameter {
    name  = "max_locks_per_transaction"
    value = "256"  # Increased for spatial operations
  }

  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  parameter {
    name  = "wal_buffers"
    value = "16384"  # 16MB
  }

  parameter {
    name  = "default_statistics_target"
    value = "100"  # Better query planning for spatial data
  }

  # Logging for monitoring
  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log slow queries (>1s)
  }

  parameter {
    name  = "log_checkpoints"
    value = "1"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = var.tags
}

resource "aws_db_subnet_group" "postgresql" {
  count = var.db_subnet_group_name == null ? 1 : 0
  
  name       = "${var.project_name}-${var.environment}-postgresql"
  subnet_ids = var.subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-postgresql-subnet-group"
    }
  )
}

# KMS key for encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption - ${var.project_name} ${var.environment}"
  deletion_window_in_days = var.environment == "production" ? 30 : 7

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-rds-kms"
    }
  )
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.project_name}-${var.environment}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# RDS instance
resource "aws_db_instance" "postgresql" {
  identifier = "${var.project_name}-${var.environment}-postgresql"

  # Engine configuration - PostgreSQL 16 with PostGIS
  engine         = "postgres"
  engine_version = "16.4"
  instance_class = var.instance_class

  # Storage configuration
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds.arn
  iops                 = var.iops
  storage_throughput   = var.storage_throughput

  # Database configuration
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  # Network configuration
  db_subnet_group_name   = var.db_subnet_group_name != null ? var.db_subnet_group_name : aws_db_subnet_group.postgresql[0].name
  vpc_security_group_ids = var.security_group_ids
  publicly_accessible    = false

  # Parameter group
  parameter_group_name = aws_db_parameter_group.postgresql.name

  # High availability
  multi_az               = var.multi_az
  availability_zone      = var.multi_az ? null : var.availability_zone

  # Backup configuration
  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  copy_tags_to_snapshot  = true
  delete_automated_backups = false

  # Maintenance
  maintenance_window         = var.maintenance_window
  auto_minor_version_upgrade = false
  allow_major_version_upgrade = false

  # Monitoring
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? aws_iam_role.rds_monitoring[0].arn : null
  
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? (var.environment == "production" ? 731 : 7) : null
  performance_insights_kms_key_id      = var.performance_insights_enabled ? aws_kms_key.rds.arn : null

  # Security
  deletion_protection = var.deletion_protection
  skip_final_snapshot = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.project_name}-${var.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # Enable logs
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-postgresql"
      BackupRetention = var.backup_retention_period
      Environment = var.environment
    }
  )

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      password,
      final_snapshot_identifier
    ]
  }
}

# Enhanced monitoring IAM role
resource "aws_iam_role" "rds_monitoring" {
  count = var.monitoring_interval > 0 ? 1 : 0
  
  name = "${var.project_name}-${var.environment}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count = var.monitoring_interval > 0 ? 1 : 0
  
  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# CloudWatch log groups
resource "aws_cloudwatch_log_group" "postgresql" {
  name              = "/aws/rds/instance/${aws_db_instance.postgresql.identifier}/postgresql"
  retention_in_days = var.environment == "production" ? 30 : 7
  kms_key_id        = aws_kms_key.rds.arn

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-postgresql-logs"
    }
  )
}

resource "aws_cloudwatch_log_group" "postgresql_upgrade" {
  name              = "/aws/rds/instance/${aws_db_instance.postgresql.identifier}/upgrade"
  retention_in_days = var.environment == "production" ? 30 : 7
  kms_key_id        = aws_kms_key.rds.arn

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-postgresql-upgrade-logs"
    }
  )
}

# Read replica for production (for read-heavy marine data queries)
resource "aws_db_instance" "postgresql_read_replica" {
  count = var.create_read_replica ? 1 : 0
  
  identifier = "${var.project_name}-${var.environment}-postgresql-replica"

  # Replica configuration
  replicate_source_db = aws_db_instance.postgresql.identifier
  instance_class      = var.replica_instance_class != null ? var.replica_instance_class : var.instance_class

  # Storage
  storage_encrypted = true
  
  # Network
  publicly_accessible    = false
  vpc_security_group_ids = var.security_group_ids

  # Monitoring
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? aws_iam_role.rds_monitoring[0].arn : null
  
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? (var.environment == "production" ? 731 : 7) : null

  # Backup (read replicas don't need backup)
  backup_retention_period = 0
  
  # Security
  deletion_protection = var.environment == "production"
  skip_final_snapshot = true

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-postgresql-replica"
      Role = "ReadReplica"
    }
  )

  lifecycle {
    prevent_destroy = true
  }
}

# CloudWatch alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = [var.sns_topic_arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgresql.identifier
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-connection-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "150"  # Alert at 150 connections (max is 200)
  alarm_description   = "This metric monitors RDS connection count"
  alarm_actions       = [var.sns_topic_arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgresql.identifier
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "database_free_storage" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-free-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "10737418240"  # 10GB in bytes
  alarm_description   = "This metric monitors RDS free storage space"
  alarm_actions       = [var.sns_topic_arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgresql.identifier
  }

  tags = var.tags
}