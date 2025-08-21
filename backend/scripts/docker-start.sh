#!/bin/bash

# Waves Backend Docker Startup Script
# Handles development and production startup scenarios

set -e

echo "🌊 Starting Waves Backend..."

# Function to wait for service
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local max_attempts=30
    local attempt=1

    echo "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z $host $port; then
            echo "$service_name is ready!"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to start within expected time"
    exit 1
}

# Function to run database migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    npm run db:migrate || {
        echo "❌ Database migration failed"
        exit 1
    }
    echo "✅ Database migrations completed"
}

# Function to run database seeding
run_seeds() {
    if [ "$SEED_DATABASE" = "true" ]; then
        echo "🌱 Seeding database..."
        npm run db:seed || {
            echo "❌ Database seeding failed"
            exit 1
        }
        echo "✅ Database seeding completed"
    fi
}

# Function to validate environment
validate_environment() {
    echo "🔍 Validating environment configuration..."
    
    # Check required environment variables
    local required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo "❌ Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        exit 1
    fi
    
    # Validate JWT secrets in production
    if [ "$NODE_ENV" = "production" ]; then
        if [[ "$JWT_SECRET" == *"change-in-production"* ]] || [[ "$JWT_REFRESH_SECRET" == *"change-in-production"* ]]; then
            echo "❌ Default JWT secrets detected in production environment"
            echo "Please set secure JWT_SECRET and JWT_REFRESH_SECRET"
            exit 1
        fi
    fi
    
    echo "✅ Environment validation passed"
}

# Function to setup directories
setup_directories() {
    echo "📁 Setting up directories..."
    
    # Create necessary directories
    mkdir -p logs uploads
    
    # Set permissions if running as root
    if [ "$(id -u)" = "0" ]; then
        chown -R waves:waves logs uploads 2>/dev/null || true
    fi
    
    echo "✅ Directories setup completed"
}

# Function to health check
health_check() {
    local max_attempts=30
    local attempt=1
    
    echo "🏥 Waiting for application health check..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:${PORT:-8080}/api/health >/dev/null 2>&1; then
            echo "✅ Application is healthy!"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts: Application not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ Application health check failed"
    return 1
}

# Main execution
main() {
    echo "Environment: ${NODE_ENV:-development}"
    echo "Port: ${PORT:-8080}"
    
    # Validate environment
    validate_environment
    
    # Setup directories
    setup_directories
    
    # Parse database URL for connection details
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
    else
        echo "❌ Invalid DATABASE_URL format"
        exit 1
    fi
    
    # Parse Redis URL for connection details
    if [[ $REDIS_URL =~ redis://([^:]+):([0-9]+) ]]; then
        REDIS_HOST="${BASH_REMATCH[1]}"
        REDIS_PORT="${BASH_REMATCH[2]}"
    else
        echo "❌ Invalid REDIS_URL format"
        exit 1
    fi
    
    # Wait for dependencies
    wait_for_service "$DB_HOST" "$DB_PORT" "PostgreSQL"
    wait_for_service "$REDIS_HOST" "$REDIS_PORT" "Redis"
    
    # Run database operations only if not in read-only mode
    if [ "$READ_ONLY_MODE" != "true" ]; then
        run_migrations
        run_seeds
    fi
    
    echo "🚀 Starting Waves Backend server..."
    
    # Start the application
    if [ "$NODE_ENV" = "development" ]; then
        # Development mode with nodemon
        exec npm run dev
    else
        # Production mode
        exec node dist/server.js
    fi
}

# Handle signals for graceful shutdown
cleanup() {
    echo "🛑 Received shutdown signal, cleaning up..."
    # Kill any background processes
    jobs -p | xargs -r kill
    exit 0
}

trap cleanup SIGTERM SIGINT

# Run main function
main "$@"