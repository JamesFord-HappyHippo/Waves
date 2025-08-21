# Claude Code AI Assistant Configuration - Waves

This file provides configuration and guidelines for Claude Code AI assistant to work effectively with the Waves mobile boating application. This configuration is based on proven patterns from Tim-Combo and specialized for marine navigation software development.

## Project Overview

Waves is a React Native mobile application for boaters that crowdsources depth data in nearshore waters. The platform combines real-time GPS tracking, environmental data integration, and machine learning to provide safer navigation guidance for recreational boaters.

Key characteristics:
- **Domain**: Marine navigation and safety technology
- **Architecture**: Mobile-first with cloud backend and geospatial processing
- **Primary Users**: Recreational boat owners, marina operators, maritime safety authorities
- **Scale**: Regional deployment with potential for multi-region expansion

## Technology Stack

### Mobile Frontend (Primary)
- **Framework**: React Native with TypeScript
- **Navigation**: React Navigation 6
- **Maps**: MapBox SDK with offline tile caching
- **Location Services**: React Native Location with background tracking
- **State Management**: Redux Toolkit with RTK Query
- **Storage**: AsyncStorage for settings, SQLite for offline data

### Backend Services
- **Runtime**: Node.js 22 (latest stable)
- **Framework**: Fastify with TypeScript support
- **Database**: PostgreSQL 16 with PostGIS extensions
- **Time-Series**: TimescaleDB for GPS tracking data
- **Caching**: Redis for session management and real-time data
- **Authentication**: JWT with refresh tokens

### Geospatial & Analytics
- **Spatial Database**: PostGIS for complex geospatial queries
- **Machine Learning**: TensorFlow.js for client-side depth prediction
- **Data Processing**: Node.js streams for real-time GPS processing
- **Environmental APIs**: NOAA, weather services, tide data integration

### Infrastructure
- **Cloud Provider**: AWS with multi-region capability
- **Mobile Deployment**: React Native CLI, Expo for development
- **Backend Deployment**: Docker containers on ECS
- **Data Storage**: S3 for map tiles and historical data
- **Monitoring**: CloudWatch, mobile crash reporting

## Environment Configurations

### Development Environment
```yaml
# .env.development
API_URL=http://localhost:8080
DATABASE_URL=postgresql://localhost:5432/waves_dev
REDIS_URL=redis://localhost:6379
MAPBOX_ACCESS_TOKEN=your_mapbox_token
NOAA_API_KEY=your_noaa_api_key
NODE_ENV=development
LOG_LEVEL=debug
```

### Production Environment
```yaml
# .env.production
API_URL=https://api.wavesapp.com
DATABASE_URL=postgresql://prod-host:5432/waves_prod
REDIS_URL=redis://prod-redis:6379
MAPBOX_ACCESS_TOKEN=prod_mapbox_token
NOAA_API_KEY=prod_noaa_api_key
NODE_ENV=production
LOG_LEVEL=info
```

### Mobile Configuration
```yaml
# React Native environment
REACT_NATIVE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
API_BASE_URL=https://api.wavesapp.com
SENTRY_DSN=your_sentry_dsn
ANALYTICS_KEY=your_analytics_key
```

## Core Standards Reference

All development standards are maintained in `.clinerules/` directory, customized for marine navigation software:

### API Standards
**Primary File**: `.clinerules/api_standards.md`

Core patterns for marine data:
- **Geospatial API Response Format**: GeoJSON with depth and safety metadata
- **Real-Time Streaming**: WebSocket patterns for live navigation updates
- **Offline-First**: API design supporting offline mobile operation
- **Safety-Critical Validation**: Strict validation for navigation-critical data

### Mobile Development Standards
**Primary File**: `.clinerules/mobile_standards.md`

Critical requirements:
- **Battery Optimization**: Efficient GPS tracking and location services
- **Offline Capability**: Critical navigation data available without connectivity
- **Performance**: 60fps rendering for real-time navigation displays
- **Privacy Controls**: Granular user control over tracking and data sharing

### Geospatial Standards
**Primary File**: `.clinerules/geospatial_standards.md`

Key patterns:
- **PostGIS Integration**: Advanced spatial queries for depth analysis
- **Coordinate Systems**: Proper handling of marine coordinate references
- **Data Aggregation**: Efficient processing of GPS tracks and depth data
- **Privacy Protection**: Anonymization of tracking data while preserving utility

### Safety & Compliance Standards
**Primary File**: `.clinerules/maritime_safety_standards.md`

Core requirements:
- **Navigation Disclaimers**: Clear limitations of crowdsourced data
- **Data Accuracy**: Validation and confidence scoring for depth data
- **Emergency Features**: Integration with marine rescue and distress systems
- **Regulatory Compliance**: Maritime safety regulations and data protection

## Implementation Guidelines

### When Developing Mobile Features
Always reference mobile standards:
```typescript
// Correct pattern for location tracking
const startTracking = async () => {
  const permission = await requestLocationPermission();
  if (permission === 'granted') {
    const watchId = Geolocation.watchPosition(
      (position) => {
        // Process location with battery optimization
        dispatch(updateLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          depth: estimateDepth(position),
          timestamp: position.timestamp,
          accuracy: position.coords.accuracy
        }));
      },
      (error) => handleLocationError(error),
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // Only update if moved 10m
        interval: 5000,     // Check every 5 seconds
        fastestInterval: 2000
      }
    );
  }
};
```

### When Creating Backend Services
Follow geospatial handler patterns:
```javascript
// Marine navigation handler pattern
const { wrapHandler } = require('./lambdaWrapper');
const { executeGeoQuery } = require('./geoOperations');
const { validateDepthData } = require('./safetyValidation');

async function getDepthData({ queryParams, requestContext }) {
    try {
        const { latitude, longitude, draft } = queryParams;
        
        // Validate safety-critical parameters
        const validatedParams = validateDepthData({ latitude, longitude, draft });
        
        // PostGIS query for depth analysis
        const depthData = await executeGeoQuery(`
            SELECT 
                ST_AsGeoJSON(location) as location,
                depth_reading,
                confidence_score,
                reading_timestamp,
                vessel_draft,
                tide_correction
            FROM depth_readings 
            WHERE ST_DWithin(
                location, 
                ST_MakePoint($1, $2)::geography, 
                1000  -- 1km radius
            )
            AND vessel_draft >= $3
            AND confidence_score > 0.7
            ORDER BY reading_timestamp DESC
            LIMIT 50
        `, [longitude, latitude, draft]);
        
        return createSuccessResponse(
            { 
                Records: depthData,
                SafetyNotice: "Crowdsourced data - verify with official charts"
            },
            'Depth data retrieved successfully',
            {
                Query_Context: validatedParams,
                Data_Quality_Score: calculateQualityScore(depthData),
                Request_ID: requestContext.requestId
            }
        );
    } catch (error) {
        return handleMaritimeError(error);
    }
}

exports.handler = wrapHandler(getDepthData);
```

### When Building Geospatial Features
Reference PostGIS standards:
```sql
-- Example depth aggregation query
SELECT 
    ST_AsGeoJSON(ST_Centroid(ST_Collect(location))) as center_point,
    AVG(depth_reading) as avg_depth,
    MIN(depth_reading) as min_depth,
    COUNT(*) as reading_count,
    AVG(confidence_score) as confidence
FROM depth_readings 
WHERE ST_Within(
    location,
    ST_MakeEnvelope($1, $2, $3, $4, 4326)
)
AND reading_timestamp > NOW() - INTERVAL '30 days'
GROUP BY ST_SnapToGrid(location, 0.001); -- ~100m grid
```

## Validation Checklist

Before completing any marine navigation implementation:

### Mobile App Implementation
- [ ] Battery optimization for background GPS tracking
- [ ] Offline capability for critical navigation features  
- [ ] Privacy controls for location data sharing
- [ ] Safety disclaimers for navigation guidance
- [ ] Performance testing for real-time map rendering

### Backend Implementation
- [ ] PostGIS spatial queries optimized for marine data
- [ ] Proper coordinate system handling (WGS84, local projections)
- [ ] Data validation for safety-critical depth information
- [ ] Privacy anonymization for GPS tracking data
- [ ] Integration with maritime data sources (NOAA, etc.)

### Safety & Compliance
- [ ] Navigation disclaimers prominently displayed
- [ ] Official chart data integration and referencing
- [ ] Emergency contact integration capabilities
- [ ] Data accuracy confidence scoring
- [ ] Maritime privacy regulation compliance

## Testing & Validation Commands

When implementing marine features, run:
```bash
# Mobile testing
npx react-native run-ios --simulator="iPhone 15 Pro"
npm run test:mobile

# Backend testing
npm run test:geospatial
npm run test:api

# Performance testing
npm run test:location-tracking
npm run test:battery-usage

# Safety testing
npm run test:navigation-accuracy
npm run test:offline-capability
```

## Agent System Optimization

### Marine Navigation Agent
- **GPS Processing**: Optimized for real-time location tracking and route calculation
- **Battery Efficiency**: Mobile-first development with power optimization
- **Offline Capability**: Navigation features that work without connectivity
- **Safety Validation**: Automated review of navigation-critical code

### Environmental Data Agent  
- **API Integration**: Specialized in marine data sources (NOAA, weather services)
- **Data Validation**: Quality assessment of environmental data feeds
- **Real-Time Processing**: Efficient handling of streaming environmental data
- **Forecasting Integration**: Tide, weather, and condition predictions

### Geospatial Analysis Agent
- **PostGIS Optimization**: Advanced spatial queries and index optimization
- **Performance Tuning**: Efficient processing of large GPS datasets
- **Data Aggregation**: Intelligent summarization of crowdsourced depth data
- **Privacy Protection**: Anonymization while preserving data utility

### Mobile Development Agent
- **React Native Optimization**: Performance patterns for navigation apps
- **Cross-Platform**: iOS and Android specific optimizations
- **User Experience**: Marine-focused UI/UX patterns
- **Testing Automation**: Mobile-specific testing strategies

## Getting Help

For marine navigation development questions:
1. **Check marine-specific `.clinerules/`** for detailed navigation patterns
2. **Reference existing marine apps** for proven UI/UX patterns
3. **Validate against maritime safety** requirements and regulations
4. **Test extensively offline** to ensure navigation reliability

## Best Practices

1. **Safety First**: Navigation accuracy is critical - validate all calculations
2. **Offline Capability**: Core navigation features must work without connectivity  
3. **Battery Optimization**: Efficient GPS tracking for extended marine trips
4. **Privacy by Design**: User control over tracking data and sharing
5. **Progressive Enhancement**: Graceful degradation when data sources unavailable

## Current System State

### Project Status: Initial Setup ✅
- **Agent System**: Configured with marine navigation specialization
- **Technology Stack**: React Native + Node.js 22 + PostGIS architecture defined
- **Development Environment**: Ready for marine navigation development
- **Standards**: Maritime safety and mobile optimization patterns established

### Next Development Phase
- [ ] Set up React Native development environment
- [ ] Configure PostGIS database with marine coordinate systems
- [ ] Implement basic GPS tracking with privacy controls
- [ ] Integrate MapBox for marine charts and depth visualization
- [ ] Create boat registration and profile management

---

**🌊 Ready to build safer waters through community-driven navigation intelligence!** ⚓