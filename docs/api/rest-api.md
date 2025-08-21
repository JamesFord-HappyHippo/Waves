# REST API Documentation

## API Overview

The Waves REST API provides programmatic access to marine navigation data, depth readings, weather information, and safety alerts. All endpoints are secured with JWT authentication and follow RESTful conventions.

**Base URL**: `https://api.wavesapp.com/v1`  
**Authentication**: Bearer Token (JWT)  
**Content Type**: `application/json`  
**Rate Limiting**: 1000 requests per hour per user

## Authentication

### JWT Token Authentication

All API requests require a valid JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Obtaining Tokens

#### POST /auth/login

Authenticate user and receive JWT tokens.

**Request:**
```json
{
  "email": "captain@example.com",
  "password": "securePassword123",
  "deviceInfo": {
    "deviceId": "iPhone-12-Pro-A1B2C3",
    "platform": "iOS",
    "appVersion": "1.2.3"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "user": {
      "id": "uuid-v4-user-id",
      "email": "captain@example.com",
      "role": "captain",
      "verified": true
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### POST /auth/refresh

Refresh expired access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Depth Data API

### GET /depth/readings

Retrieve depth readings for a specific geographic area.

**Parameters:**
- `latitude` (required): Latitude in decimal degrees
- `longitude` (required): Longitude in decimal degrees  
- `radius` (optional): Search radius in meters (default: 1000, max: 10000)
- `vesselDraft` (optional): Minimum vessel draft to consider
- `maxAge` (optional): Maximum age of data in days (default: 30)
- `confidence` (optional): Minimum confidence score (0.0-1.0, default: 0.5)

**Example Request:**
```http
GET /api/v1/depth/readings?latitude=37.7749&longitude=-122.4194&radius=2000&vesselDraft=2.0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "readings": [
      {
        "id": "depth-reading-uuid",
        "latitude": 37.7751,
        "longitude": -122.4192,
        "depth": 15.2,
        "confidence": 0.85,
        "vesselDraft": 2.1,
        "timestamp": "2024-01-15T09:45:00Z",
        "userId": "contributor-uuid",
        "distanceMeters": 156.7,
        "source": "crowdsource",
        "tideCorrection": 0.3,
        "conditions": {
          "seaState": 2,
          "visibility": "good",
          "weather": "clear"
        }
      }
    ],
    "query": {
      "location": {
        "latitude": 37.7749,
        "longitude": -122.4194
      },
      "radius": 2000,
      "vesselDraft": 2.0,
      "maxAge": 30
    },
    "count": 1,
    "safetyNotice": "Always verify depth readings with your depth sounder. Crowdsourced data may be inaccurate."
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### POST /depth/readings

Submit a new depth reading.

**Request:**
```json
{
  "latitude": 37.7750,
  "longitude": -122.4195,
  "depth": 12.8,
  "confidence": 0.9,
  "vesselDraft": 1.8,
  "timestamp": "2024-01-15T10:25:00Z",
  "conditions": {
    "seaState": 1,
    "visibility": "excellent",
    "weather": "clear",
    "windSpeed": 5,
    "method": "sonar"
  },
  "notes": "Rocky bottom, good holding"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new-depth-reading-uuid",
    "submittedAt": "2024-01-15T10:30:00Z",
    "location": {
      "latitude": 37.7750,
      "longitude": -122.4195
    },
    "depth": 12.8,
    "confidence": 0.9,
    "status": "pending_verification",
    "safetyNotice": "Thank you for contributing to marine safety. Your data will be validated before publication."
  },
  "message": "Depth reading submitted successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /depth/statistics

Get depth statistics and analytics for an area.

**Parameters:**
- `latitude` (required): Center latitude
- `longitude` (required): Center longitude
- `radius` (optional): Analysis radius in meters (default: 5000)
- `timeframe` (optional): Analysis timeframe in days (default: 90)

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalReadings": 1247,
      "averageDepth": 18.6,
      "minDepth": 0.8,
      "maxDepth": 45.2,
      "averageConfidence": 0.76,
      "uniqueContributors": 89,
      "dataQualityScore": 0.82,
      "coverage": {
        "areaKm2": 78.5,
        "readingsPerKm2": 15.9
      },
      "centerPoint": {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749]
      }
    },
    "trends": {
      "depthChange": {
        "trend": "stable",
        "changePercent": -2.1,
        "confidenceInterval": 0.95
      },
      "contributionRate": {
        "readingsPerDay": 4.2,
        "trend": "increasing"
      }
    },
    "safetyAnalysis": {
      "riskLevel": "moderate",
      "hazardAreas": 3,
      "recommendations": [
        "Use caution in northeastern quadrant",
        "Verify depths during low tide periods"
      ]
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Weather & Environmental API

### GET /weather/marine

Get marine weather data for a location.

**Parameters:**
- `latitude` (required): Location latitude
- `longitude` (required): Location longitude
- `forecast` (optional): Include forecast data (true/false, default: true)
- `includeAlerts` (optional): Include weather alerts (true/false, default: true)

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "timestamp": "2024-01-15T10:30:00Z",
      "location": {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "station": "NOAA-9414290",
        "stationName": "San Francisco, CA"
      },
      "conditions": {
        "temperature": 15.2,
        "windSpeed": 12.5,
        "windDirection": 285,
        "waveHeight": 1.2,
        "wavePeriod": 8,
        "waveDirection": 290,
        "visibility": 16.1,
        "barometricPressure": 1015.2,
        "humidity": 68,
        "seaState": 2
      },
      "tides": {
        "currentLevel": 1.8,
        "trend": "rising",
        "nextHigh": {
          "time": "2024-01-15T14:22:00Z",
          "level": 2.4
        },
        "nextLow": {
          "time": "2024-01-15T20:45:00Z",
          "level": 0.3
        }
      }
    },
    "forecast": [
      {
        "timestamp": "2024-01-15T12:00:00Z",
        "windSpeed": 15.0,
        "windDirection": 290,
        "waveHeight": 1.5,
        "visibility": 14.8,
        "conditions": "partly_cloudy"
      }
    ],
    "alerts": [
      {
        "id": "marine-alert-uuid",
        "type": "small_craft_advisory",
        "severity": "moderate",
        "description": "Small craft advisory in effect for strong winds",
        "startTime": "2024-01-15T12:00:00Z",
        "endTime": "2024-01-15T18:00:00Z",
        "affectedAreas": ["San Francisco Bay", "Half Moon Bay"]
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /weather/tides

Get detailed tide information for a location.

**Parameters:**
- `latitude` (required): Location latitude
- `longitude` (required): Location longitude
- `days` (optional): Number of days to forecast (1-7, default: 3)
- `datum` (optional): Tide datum (MLLW, MSL, STND, default: MLLW)

**Response:**
```json
{
  "success": true,
  "data": {
    "station": {
      "id": "9414290",
      "name": "San Francisco, CA",
      "latitude": 37.807,
      "longitude": -122.465,
      "timeZone": "PST",
      "datum": "MLLW"
    },
    "predictions": [
      {
        "time": "2024-01-15T06:12:00Z",
        "height": 2.1,
        "type": "H"
      },
      {
        "time": "2024-01-15T12:34:00Z",
        "height": 0.2,
        "type": "L"
      }
    ],
    "extremes": {
      "highestHigh": 2.4,
      "lowestLow": -0.1,
      "meanHighWater": 1.9,
      "meanLowWater": 0.3
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Navigation API

### POST /navigation/route

Calculate safe navigation route between points.

**Request:**
```json
{
  "start": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "end": {
    "latitude": 37.8044,
    "longitude": -122.4078
  },
  "vessel": {
    "draft": 2.0,
    "length": 12.0,
    "beam": 3.5,
    "type": "sailboat"
  },
  "preferences": {
    "safetyMargin": 1.5,
    "avoidShallowWater": true,
    "considerTides": true,
    "routeType": "fastest"
  },
  "departureTime": "2024-01-15T14:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "route": {
      "id": "route-uuid",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-122.4194, 37.7749],
          [-122.4180, 37.7765],
          [-122.4078, 37.8044]
        ]
      },
      "waypoints": [
        {
          "latitude": 37.7749,
          "longitude": -122.4194,
          "type": "start",
          "eta": "2024-01-15T14:00:00Z"
        },
        {
          "latitude": 37.7765,
          "longitude": -122.4180,
          "type": "waypoint",
          "eta": "2024-01-15T14:12:00Z",
          "notes": "Shallow area to starboard"
        },
        {
          "latitude": 37.8044,
          "longitude": -122.4078,
          "type": "destination",
          "eta": "2024-01-15T14:35:00Z"
        }
      ],
      "summary": {
        "totalDistance": 5.2,
        "estimatedDuration": 35,
        "minDepth": 3.2,
        "avgDepth": 12.8,
        "safetyRating": "high",
        "weatherConditions": "favorable"
      },
      "alerts": [
        {
          "id": "route-alert-uuid",
          "type": "shallow_water",
          "severity": "caution",
          "location": {
            "latitude": 37.7823,
            "longitude": -122.4156
          },
          "message": "Shallow water area - maintain course to port",
          "distance": 2.1
        }
      ]
    },
    "alternatives": [
      {
        "id": "alt-route-uuid",
        "description": "Longer but safer route",
        "distance": 6.1,
        "duration": 42,
        "safetyRating": "very_high"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /navigation/hazards

Get navigation hazards and warnings for an area.

**Parameters:**
- `latitude` (required): Center latitude
- `longitude` (required): Center longitude
- `radius` (optional): Search radius in meters (default: 5000)
- `severity` (optional): Minimum severity level (info, warning, danger)

**Response:**
```json
{
  "success": true,
  "data": {
    "hazards": [
      {
        "id": "hazard-uuid",
        "type": "shallow_water",
        "severity": "danger",
        "location": {
          "latitude": 37.7756,
          "longitude": -122.4201
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [-122.4203, 37.7754],
            [-122.4199, 37.7754],
            [-122.4199, 37.7758],
            [-122.4203, 37.7758],
            [-122.4203, 37.7754]
          ]]
        },
        "description": "Submerged rock outcropping",
        "minDepth": 0.5,
        "source": "user_report",
        "reportedBy": "Captain Smith",
        "reportedAt": "2024-01-14T16:30:00Z",
        "verified": true,
        "verificationCount": 3
      }
    ],
    "restrictedAreas": [
      {
        "id": "restriction-uuid",
        "type": "military_zone",
        "severity": "danger",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[...]]
        },
        "description": "Military exercise area",
        "restrictions": {
          "vesselTypes": ["all"],
          "timeRestriction": {
            "start": "2024-01-15T08:00:00Z",
            "end": "2024-01-15T17:00:00Z"
          }
        },
        "authority": "US Coast Guard",
        "contact": {
          "phone": "+1-415-399-3547",
          "vhfChannel": 16
        }
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## User & Vessel Management

### GET /users/profile

Get current user profile information.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "captain@example.com",
      "firstName": "John",
      "lastName": "Smith",
      "role": "captain",
      "verified": true,
      "memberSince": "2023-03-15T10:00:00Z",
      "preferences": {
        "units": "metric",
        "theme": "marine",
        "safetyMargin": 1.5,
        "depthAlerts": true,
        "weatherAlerts": true,
        "batteryOptimization": true
      },
      "privacy": {
        "shareTrackingData": false,
        "shareDepthData": true,
        "publicProfile": false
      },
      "statistics": {
        "depthReadingsContributed": 247,
        "milesNavigated": 1842.5,
        "hoursOnWater": 312,
        "reputationScore": 92
      }
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /vessels

Get user's registered vessels.

**Response:**
```json
{
  "success": true,
  "data": {
    "vessels": [
      {
        "id": "vessel-uuid",
        "name": "Sea Wanderer",
        "type": "sailboat",
        "specifications": {
          "length": 12.2,
          "beam": 3.8,
          "draft": 1.9,
          "displacement": 4500,
          "maxSpeed": 8.5,
          "fuelCapacity": 75,
          "waterCapacity": 190
        },
        "registration": {
          "number": "CF1234AB",
          "mmsi": "367123456",
          "callSign": "WDB1234"
        },
        "equipment": {
          "depthSounder": true,
          "gps": true,
          "vhfRadio": true,
          "radar": false,
          "ais": true
        },
        "insurance": {
          "carrier": "Marine Insurance Co",
          "policyNumber": "MI-12345",
          "expiresAt": "2024-12-31T23:59:59Z"
        },
        "isActive": true,
        "lastUsed": "2024-01-14T16:30:00Z"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### POST /vessels

Register a new vessel.

**Request:**
```json
{
  "name": "Ocean Explorer",
  "type": "powerboat",
  "specifications": {
    "length": 8.5,
    "beam": 2.8,
    "draft": 0.6,
    "displacement": 1200,
    "maxSpeed": 25,
    "fuelCapacity": 200
  },
  "registration": {
    "number": "CF5678CD",
    "state": "CA"
  },
  "equipment": {
    "depthSounder": true,
    "gps": true,
    "vhfRadio": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vessel": {
      "id": "new-vessel-uuid",
      "name": "Ocean Explorer",
      "status": "pending_verification",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  },
  "message": "Vessel registered successfully. Verification may be required for advanced features.",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Safety & Emergency API

### GET /safety/alerts

Get active safety alerts for current location.

**Parameters:**
- `latitude` (required): Current latitude
- `longitude` (required): Current longitude
- `radius` (optional): Alert radius in meters (default: 10000)
- `severity` (optional): Minimum severity (info, warning, critical, emergency)

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "safety-alert-uuid",
        "type": "grounding_risk",
        "severity": "critical",
        "priority": 8,
        "location": {
          "latitude": 37.7751,
          "longitude": -122.4195
        },
        "message": "CRITICAL: Shallow water in 30 seconds. Depth 1.2m, clearance 0.3m",
        "timeToImpact": 30,
        "estimatedDepth": 1.2,
        "vesselClearance": 0.3,
        "confidenceLevel": 0.85,
        "avoidanceAction": {
          "type": "course_change",
          "recommendedHeading": 315,
          "priority": 8,
          "description": "Turn 45° to port",
          "timeRequired": 15
        },
        "createdAt": "2024-01-15T10:29:45Z",
        "acknowledged": false
      }
    ],
    "emergencyContacts": [
      {
        "id": "contact-uuid",
        "name": "US Coast Guard Sector San Francisco",
        "type": "coast_guard",
        "phoneNumbers": ["+1-415-399-3547"],
        "vhfChannel": 16,
        "location": {
          "latitude": 37.8199,
          "longitude": -122.3085
        },
        "available24h": true,
        "distance": 12.5
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### POST /safety/alerts/{alertId}/acknowledge

Acknowledge a safety alert.

**Request:**
```json
{
  "acknowledgedAt": "2024-01-15T10:30:15Z",
  "userAction": "course_changed",
  "notes": "Altered course to port, now in safe water"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "safety-alert-uuid",
      "acknowledged": true,
      "acknowledgedAt": "2024-01-15T10:30:15Z",
      "userAction": "course_changed",
      "responseTime": 30
    }
  },
  "message": "Safety alert acknowledged",
  "timestamp": "2024-01-15T10:30:15Z"
}
```

## Error Handling

### Standard Error Format

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid latitude value",
    "details": {
      "field": "latitude",
      "value": "invalid",
      "constraint": "Must be between -90 and 90"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid-for-support"
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (duplicate) |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Common Error Codes

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `INVALID_COORDINATES` | Invalid latitude/longitude | Check coordinate format and ranges |
| `VESSEL_NOT_FOUND` | Specified vessel doesn't exist | Verify vessel ID or register vessel |
| `INSUFFICIENT_DEPTH_DATA` | Not enough data for analysis | Try larger radius or different location |
| `EXTERNAL_API_UNAVAILABLE` | External service (NOAA) unavailable | Retry later or use cached data |
| `SAFETY_SYSTEM_OFFLINE` | Safety monitoring unavailable | Use manual navigation with caution |

## Rate Limiting

### Rate Limit Headers

All responses include rate limiting information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1642248600
X-RateLimit-Window: 3600
```

### Rate Limit Tiers

| User Type | Requests/Hour | Burst Limit |
|-----------|---------------|-------------|
| Free User | 100 | 20 |
| Premium User | 1000 | 50 |
| Captain | 5000 | 100 |
| Commercial | 10000 | 200 |

## SDKs and Examples

### JavaScript/TypeScript SDK

```typescript
import { WavesApiClient } from '@waves/api-client';

const client = new WavesApiClient({
  baseUrl: 'https://api.wavesapp.com/v1',
  apiKey: 'your-api-key'
});

// Get depth readings
const depthData = await client.depth.getReadings({
  latitude: 37.7749,
  longitude: -122.4194,
  radius: 2000
});

// Submit depth reading
const result = await client.depth.submit({
  latitude: 37.7750,
  longitude: -122.4195,
  depth: 12.8,
  confidence: 0.9
});
```

### Python SDK

```python
from waves_api import WavesClient

client = WavesClient(
    base_url='https://api.wavesapp.com/v1',
    api_key='your-api-key'
)

# Get marine weather
weather = client.weather.get_marine(
    latitude=37.7749,
    longitude=-122.4194,
    include_forecast=True
)

# Calculate route
route = client.navigation.calculate_route(
    start={'latitude': 37.7749, 'longitude': -122.4194},
    end={'latitude': 37.8044, 'longitude': -122.4078},
    vessel={'draft': 2.0, 'type': 'sailboat'}
)
```

This API documentation provides comprehensive coverage of all Waves platform endpoints with practical examples, error handling, and integration guidance for developers building marine navigation applications.