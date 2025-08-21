# Developer Getting Started Guide

## Welcome to Waves Development

This guide will get you up and running with the Waves marine navigation platform development environment. The platform combines React Native mobile development with Node.js backend services, PostgreSQL with PostGIS for geospatial data, and AWS cloud infrastructure.

## Prerequisites

### System Requirements

**Development Machine:**
- macOS 10.15+ (for iOS development) or Linux/Windows
- Node.js 22.0.0 or higher
- npm 10.0.0 or higher
- Git 2.30 or higher
- Docker 20.10 or higher
- PostgreSQL 16 with PostGIS extensions

**For Mobile Development:**
- Xcode 15+ (iOS development on macOS)
- Android Studio with SDK 34+ (Android development)
- React Native CLI
- CocoaPods (iOS dependencies)

**Required Accounts:**
- AWS Account (for cloud services)
- MapBox Account (for marine mapping)
- NOAA API Access (for weather/tide data)
- GitHub Account (for repository access)

### Knowledge Prerequisites

**Essential Skills:**
- JavaScript/TypeScript fundamentals
- React and React Native experience
- Node.js and Express/Fastify APIs
- PostgreSQL and SQL queries
- Git version control
- Basic AWS services knowledge

**Marine Domain Knowledge (Helpful):**
- Maritime navigation concepts
- Depth measurement and safety margins
- Weather and tide impacts on navigation
- Marine coordinate systems and charts

## Initial Setup

### 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/waves.git
cd waves

# Install root dependencies
npm install

# Initialize the project with AI agent system
node initialize-project.js

# Install backend dependencies
cd backend
npm install
cd ..

# Install mobile dependencies (React Native)
npm install
cd ios && pod install && cd ..  # iOS only
```

### 2. Environment Configuration

Create environment files for different components:

**Root `.env`:**
```bash
# Copy template and configure
cp .env.example .env

# Edit with your values
NODE_ENV=development
API_URL=http://localhost:8080
DATABASE_URL=postgresql://waves:password@localhost:5432/waves_dev
REDIS_URL=redis://localhost:6379

# External API Keys
MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieW91ci1hY2NvdW50IiwiYSI6InlvdXItdG9rZW4ifQ
NOAA_API_KEY=your-noaa-api-key
OPENWEATHER_API_KEY=your-openweather-key

# JWT Secrets
JWT_SECRET=your-super-secure-jwt-secret-for-development
JWT_REFRESH_SECRET=your-refresh-secret-for-development

# Development settings
LOG_LEVEL=debug
ENABLE_CORS=true
```

**Backend `.env`:**
```bash
cd backend
cp .env.example .env

# Backend-specific configuration
PORT=8080
NODE_ENV=development
DATABASE_URL=postgresql://waves:password@localhost:5432/waves_dev
REDIS_URL=redis://localhost:6379

# API Keys for external services
NOAA_API_KEY=your-noaa-api-key
OPENWEATHER_API_KEY=your-openweather-key
STORMGLASS_API_KEY=your-stormglass-key

# Security
JWT_SECRET=your-super-secure-jwt-secret-for-development
BCRYPT_ROUNDS=10

# Development features
ENABLE_API_DOCS=true
ENABLE_DEBUG_ROUTES=true
```

**Mobile `.env`:**
```bash
# React Native environment
REACT_NATIVE_MAPBOX_ACCESS_TOKEN=your-mapbox-token
API_BASE_URL=http://localhost:8080
SENTRY_DSN=your-sentry-dsn-for-development
ANALYTICS_KEY=your-analytics-key

# Development settings
REACT_NATIVE_ENV=development
ENABLE_FLIPPER=true
ENABLE_DEBUG_LOGS=true
```

### 3. Database Setup

**Using Docker (Recommended):**
```bash
# Start PostgreSQL with PostGIS in Docker
cd backend
docker-compose up -d postgres redis

# Wait for database to be ready
sleep 10

# Run database migrations
npm run db:migrate

# Seed with test data
npm run db:seed
```

**Manual PostgreSQL Setup:**
```bash
# Install PostgreSQL with PostGIS
# macOS with Homebrew:
brew install postgresql@16 postgis

# Ubuntu/Debian:
sudo apt-get install postgresql-16 postgresql-16-postgis-3

# Start PostgreSQL service
brew services start postgresql@16  # macOS
sudo systemctl start postgresql    # Linux

# Create development database
createdb waves_dev
psql waves_dev -c "CREATE EXTENSION postgis;"
psql waves_dev -c "CREATE EXTENSION timescaledb;"

# Run migrations
cd backend
npm run db:migrate
npm run db:seed
```

### 4. External Service Setup

**MapBox Configuration:**
1. Sign up at [MapBox](https://mapbox.com)
2. Create a new project for Waves
3. Generate access tokens for development
4. Add tokens to environment files

**NOAA API Setup:**
1. Register at [NOAA API Portal](https://api.weather.gov)
2. Generate API keys for Tides & Currents
3. Add keys to environment configuration

**AWS Development Setup:**
```bash
# Install AWS CLI
pip install awscli

# Configure AWS credentials for development
aws configure
# AWS Access Key ID: your-dev-access-key
# AWS Secret Access Key: your-dev-secret-key
# Default region: us-east-1
# Default output format: json
```

## Development Workflow

### 1. Start Development Environment

**Backend Services:**
```bash
# Terminal 1: Start backend API server
cd backend
npm run dev
# Server running on http://localhost:8080

# Terminal 2: Start Redis (if not using Docker)
redis-server

# Terminal 3: Start PostgreSQL (if not using Docker)
postgres -D /usr/local/var/postgresql@16
```

**Mobile Application:**
```bash
# Terminal 4: Start React Native Metro bundler
npm start

# Terminal 5: Start iOS simulator
npm run ios
# or specific device: npm run ios -- --simulator="iPhone 15 Pro"

# Terminal 6: Start Android emulator
npm run android
# or specific device: npm run android -- --deviceId=emulator-5554
```

### 2. Verify Installation

**Check Backend Health:**
```bash
# Test API health endpoint
curl http://localhost:8080/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "noaa_api": "available",
    "mapbox_api": "available"
  },
  "version": "1.0.0"
}
```

**Test Database Connection:**
```bash
cd backend
npm run db:test-connection

# Expected output:
✅ Database connection successful
✅ PostGIS extension available
✅ TimescaleDB extension available
✅ Sample depth data found: 1,247 records
```

**Verify Mobile App:**
1. App should launch successfully in simulator/emulator
2. Map should display with MapBox tiles
3. Location permission should be requested
4. Debug menu should be accessible (shake device/Cmd+D)

### 3. Development Commands

**Backend Development:**
```bash
cd backend

# Development server with hot reload
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Database operations
npm run db:migrate        # Run pending migrations
npm run db:seed          # Seed with test data
npm run db:reset         # Reset and reseed database

# Code quality
npm run lint             # ESLint checking
npm run lint:fix         # Auto-fix linting issues
npm run format           # Prettier formatting
npm run typecheck        # TypeScript checking
```

**Mobile Development:**
```bash
# React Native commands
npm start                # Metro bundler
npm run ios             # iOS simulator
npm run android         # Android emulator

# Testing
npm run test:mobile     # Mobile-specific tests
npm run test:location-tracking
npm run test:battery-usage
npm run test:navigation-accuracy
npm run test:offline-capability

# Code quality
npm run lint
npm run typecheck
npm run clean           # Clean build artifacts

# Platform-specific cleaning
npm run clean:ios       # Clean iOS build
npm run clean:android   # Clean Android build
```

## Development Tools

### Recommended IDE Setup

**Visual Studio Code Extensions:**
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-react-native",
    "ms-vscode.vscode-jest",
    "ms-postgresql.postgresql",
    "geequlim.godot-tools"
  ]
}
```

**VS Code Settings:**
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.exclude": {
    "**/node_modules": true,
    "**/ios/build": true,
    "**/android/build": true,
    "**/ios/Pods": true
  }
}
```

### Debugging Setup

**Backend API Debugging:**
```bash
# Debug with Node.js inspector
npm run dev:debug

# Or use VS Code launch configuration
# .vscode/launch.json:
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/backend/src/server.ts",
  "runtimeArgs": ["--loader", "ts-node/esm"],
  "env": {
    "NODE_ENV": "development"
  }
}
```

**React Native Debugging:**
```bash
# Enable Flipper debugging
npm run ios -- --configuration Debug
npm run android -- --variant=debug

# Or use Chrome DevTools
# Shake device → Debug JS Remotely
```

**Database Debugging:**
```bash
# Connect to development database
psql waves_dev

# Enable query logging
\set VERBOSITY verbose
\timing on

# Example spatial query
SELECT ST_AsText(location), depth 
FROM depth_readings 
WHERE ST_DWithin(location, ST_Point(-122.4194, 37.7749), 1000) 
LIMIT 10;
```

### Testing Environment

**Test Database Setup:**
```bash
# Create test database
createdb waves_test
psql waves_test -c "CREATE EXTENSION postgis;"
psql waves_test -c "CREATE EXTENSION timescaledb;"

# Run test migrations
NODE_ENV=test npm run db:migrate
```

**Running Tests:**
```bash
# Backend unit tests
cd backend
npm test

# Integration tests
npm run test:integration

# Mobile tests
cd ..
npm run test:mobile

# End-to-end tests
npm run test:e2e

# Coverage reports
npm run test:coverage
```

## Marine Development Guidelines

### Safety-First Development

**Critical Code Areas:**
- Depth calculation and safety margins
- Navigation route calculation
- GPS accuracy and positioning
- Battery optimization for marine use
- Emergency contact and alert systems

**Testing Requirements:**
```typescript
// Example: Depth safety calculation test
describe('Depth Safety Calculator', () => {
  test('should flag dangerous depth conditions', () => {
    const result = calculateSafety({
      depth: 1.2,        // 1.2m depth
      vesselDraft: 2.0,  // 2.0m draft
      safetyMargin: 0.5, // 0.5m margin
      tideCorrection: -0.3 // Falling tide
    });
    
    expect(result.status).toBe('DANGER');
    expect(result.clearance).toBe(-1.1); // Negative clearance
    expect(result.alerts).toContain('GROUNDING_RISK');
  });
});
```

### Marine Data Validation

**Coordinate Validation:**
```typescript
// Validate marine coordinates
function validateMarineCoordinates(lat: number, lon: number): boolean {
  // Basic range validation
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return false;
  }
  
  // Check for land-locked coordinates (basic water body validation)
  return isInWaterBody(lat, lon);
}
```

**Depth Data Validation:**
```typescript
// Validate depth readings
function validateDepthReading(reading: DepthReading): ValidationResult {
  const errors = [];
  
  if (reading.depth < 0 || reading.depth > 1000) {
    errors.push('Depth must be between 0 and 1000 meters');
  }
  
  if (reading.confidence < 0 || reading.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
  }
  
  if (reading.vesselDraft && reading.depth < reading.vesselDraft) {
    errors.push('Reported depth less than vessel draft - verify reading');
  }
  
  return { valid: errors.length === 0, errors };
}
```

## Development Best Practices

### Code Organization

**Project Structure:**
```
waves/
├── src/                 # Mobile app source
│   ├── components/      # Reusable UI components
│   ├── screens/         # Screen components
│   ├── services/        # API and data services
│   ├── store/           # Redux state management
│   ├── utils/           # Utility functions
│   └── types/           # TypeScript type definitions
├── backend/             # Backend API server
│   ├── src/
│   │   ├── routes/      # API route handlers
│   │   ├── services/    # Business logic
│   │   ├── models/      # Database models
│   │   ├── middleware/  # Express middleware
│   │   └── utils/       # Utility functions
│   ├── database/        # Database migrations and seeds
│   └── tests/           # Backend tests
├── docs/               # Documentation
└── infrastructure/     # AWS infrastructure as code
```

### Git Workflow

**Branch Naming:**
```bash
# Feature branches
feature/depth-data-validation
feature/marine-weather-integration

# Bug fixes
bugfix/gps-accuracy-issue
bugfix/depth-calculation-error

# Marine safety related
safety/grounding-prevention-alerts
safety/emergency-contact-system
```

**Commit Messages:**
```bash
# Good commit messages for marine development
git commit -m "feat(safety): add grounding risk calculation"
git commit -m "fix(depth): correct tide correction calculation"
git commit -m "docs(marine): update NOAA API integration guide"
git commit -m "test(navigation): add route safety validation tests"
```

### Performance Considerations

**Mobile Performance:**
```typescript
// Battery-optimized GPS tracking
const gpsConfig = {
  enableHighAccuracy: true,
  distanceFilter: 10,      // Only update if moved 10m
  interval: 5000,          // Check every 5 seconds
  fastestInterval: 2000,   // Fastest update rate
  maximumAge: 10000        // Use cached location up to 10s old
};

// Memory-efficient depth data handling
const MAX_DEPTH_POINTS = 10000;
const depthDataLRU = new LRUCache({
  max: MAX_DEPTH_POINTS,
  ttl: 24 * 60 * 60 * 1000 // 24 hours
});
```

**Database Performance:**
```sql
-- Spatial indexes for fast geospatial queries
CREATE INDEX CONCURRENTLY idx_depth_readings_location_time 
ON depth_readings USING GIST (location, timestamp);

-- Partial indexes for active data
CREATE INDEX CONCURRENTLY idx_active_vessels 
ON vessels (owner_id) WHERE is_active = true;
```

## Troubleshooting

### Common Issues

**PostgreSQL Connection Issues:**
```bash
# Check PostgreSQL is running
pg_ctl status -D /usr/local/var/postgresql@16

# Check PostGIS extension
psql waves_dev -c "SELECT PostGIS_version();"

# Reset permissions if needed
psql waves_dev -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO waves;"
```

**React Native Issues:**
```bash
# Metro bundler cache issues
npx react-native start --reset-cache

# iOS build issues
cd ios && pod install && cd ..
npx react-native run-ios --simulator="iPhone 15 Pro"

# Android build issues
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

**MapBox Issues:**
```bash
# Verify MapBox token
curl "https://api.mapbox.com/v1/tokens?access_token=YOUR_TOKEN"

# Check iOS Info.plist has token
grep -r "MBXAccessToken" ios/

# Check Android strings.xml has token
grep -r "mapbox_access_token" android/
```

### Getting Help

**Development Support:**
- Internal Slack: #waves-development
- Marine Safety Questions: #marine-safety
- Infrastructure Issues: #devops-support

**External Resources:**
- [React Native Documentation](https://reactnative.dev)
- [PostGIS Documentation](https://postgis.net/docs/)
- [NOAA API Documentation](https://api.tidesandcurrents.noaa.gov)
- [MapBox Mobile SDK](https://docs.mapbox.com/ios/maps/)

**Code Review Process:**
1. Create feature branch from `develop`
2. Implement changes with tests
3. Ensure all marine safety tests pass
4. Create pull request with marine safety checklist
5. Get approval from marine domain expert for safety-critical changes
6. Merge after all checks pass

You're now ready to start developing with the Waves marine navigation platform! Remember that marine safety is paramount - always test navigation-critical features thoroughly and follow the safety validation procedures.