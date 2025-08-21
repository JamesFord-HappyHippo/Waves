# Waves Backend

Marine navigation backend service with PostGIS geospatial processing for crowdsourced depth data and real-time navigation assistance.

## Overview

The Waves backend provides a comprehensive API for marine navigation applications, featuring:

- **Geospatial Processing**: PostGIS-powered depth data aggregation and analysis
- **Real-time Updates**: WebSocket-based live navigation and safety alerts
- **Marine Data Integration**: NOAA tides/currents and weather service integration
- **Safety-First Design**: Maritime safety compliance and navigation warnings
- **Scalable Architecture**: Docker-based deployment with Redis caching

## Technology Stack

- **Runtime**: Node.js 22 with TypeScript
- **Framework**: Fastify with comprehensive plugin ecosystem
- **Database**: PostgreSQL 16 + PostGIS + TimescaleDB
- **Caching**: Redis for sessions and real-time data
- **Authentication**: JWT with refresh token rotation
- **External APIs**: NOAA, OpenWeatherMap, Stormglass integration

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 22+ (for local development)
- API keys for external services (optional for basic functionality)

### Development Setup

1. **Clone and Setup**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start with Docker Compose**
   ```bash
   # Start all services
   docker-compose up -d

   # View logs
   docker-compose logs -f backend

   # Stop services
   docker-compose down
   ```

3. **API Access**
   - Backend API: http://localhost:8080
   - API Documentation: http://localhost:8080/api/docs
   - Health Check: http://localhost:8080/api/health
   - PgAdmin (dev): http://localhost:8081
   - Redis Commander (dev): http://localhost:8082

### Local Development

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Run migrations and seeds
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

## API Documentation

### Authentication

```bash
# Register new user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sailor@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Sailor"
  }'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sailor@example.com",
    "password": "SecurePass123"
  }'
```

### Depth Data

```bash
# Submit depth reading
curl -X POST http://localhost:8080/api/depth/report \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "location": {"latitude": 37.8199, "longitude": -122.4783},
    "depthMeters": 15.2,
    "vesselId": "vessel-uuid"
  }'

# Get depth data for area
curl "http://localhost:8080/api/depth/area?northEast[latitude]=37.85&northEast[longitude]=-122.45&southWest[latitude]=37.80&southWest[longitude]=-122.50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Navigation

```bash
# Plan route
curl -X POST http://localhost:8080/api/navigation/route \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startPoint": {"latitude": 37.8199, "longitude": -122.4783},
    "endPoint": {"latitude": 37.7749, "longitude": -122.4194},
    "vesselId": "vessel-uuid",
    "vesselDraft": 1.8
  }'
```

### Weather & Marine Data

```bash
# Get current weather
curl "http://localhost:8080/api/weather/current?latitude=37.8199&longitude=-122.4783&marine=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get tide information
curl "http://localhost:8080/api/weather/tides?latitude=37.8199&longitude=-122.4783" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:8080/ws/navigation', {
  headers: { Authorization: 'Bearer YOUR_JWT_TOKEN' }
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});

// Subscribe to vessel tracking
ws.send(JSON.stringify({
  type: 'subscribe_vessel',
  data: { vesselId: 'your-vessel-uuid' }
}));
```

## Configuration

### Environment Variables

Key configuration options:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Redis
REDIS_URL=redis://host:port

# Authentication
JWT_SECRET=your-secure-secret
JWT_REFRESH_SECRET=your-refresh-secret

# External APIs
MAPBOX_ACCESS_TOKEN=your-mapbox-token
NOAA_API_KEY=your-noaa-key
OPENWEATHER_API_KEY=your-openweather-key
STORMGLASS_API_KEY=your-stormglass-key

# Safety Settings
MIN_DEPTH_THRESHOLD=1.0
SAFETY_MARGIN_METERS=0.5
```

### Database Migrations

```bash
# Run migrations
npm run db:migrate

# Check migration status
npm run db:migrate status

# Rollback migration (if rollback file exists)
npm run db:migrate rollback 002_example.sql
```

### Database Seeding

```bash
# Seed database
npm run db:seed

# Check seed status
npm run db:seed status

# Reset and re-seed (destructive!)
CONFIRM_RESET=true npm run db:seed reset
```

## Production Deployment

### Docker Production

```bash
# Build production image
docker build -t waves-backend:latest .

# Run with production compose
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Security Considerations

1. **Environment Secrets**
   - Use strong JWT secrets (min 32 characters)
   - Rotate API keys regularly
   - Use environment-specific configurations

2. **Database Security**
   - Enable SSL for database connections
   - Use connection pooling limits
   - Regular backups and point-in-time recovery

3. **API Security**
   - Rate limiting configured per endpoint
   - CORS properly configured
   - Security headers via Helmet
   - Input validation on all endpoints

4. **SSL/TLS**
   - HTTPS-only in production
   - Valid SSL certificates
   - HSTS headers enabled

## Development

### Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration and database setup
│   ├── controllers/     # Request handlers (future use)
│   ├── middleware/      # Authentication, error handling
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic and external APIs
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── database/
│   ├── migrations/      # SQL migration files
│   └── seeds/          # Initial data files
├── docker/             # Docker configuration files
├── scripts/            # Deployment and utility scripts
└── tests/              # Test suites
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User authentication |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/depth/report` | Submit depth reading |
| GET | `/api/depth/area` | Get depth data for area |
| POST | `/api/navigation/route` | Plan navigation route |
| GET | `/api/weather/current` | Current weather conditions |
| GET | `/api/weather/marine` | Marine weather conditions |
| GET | `/api/marine/alerts` | Safety alerts |
| WS | `/ws/navigation` | Real-time navigation updates |

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-uuid",
    "version": "1.0.0"
  }
}
```

## Safety & Compliance

### Navigation Disclaimers

All navigation-related responses include safety notices:
- Crowdsourced data limitations
- Official chart verification requirements
- Maritime safety regulation compliance

### Data Privacy

- User location data privacy controls
- GDPR compliance for EU users
- Anonymized data aggregation
- User consent management

## Support

### Troubleshooting

1. **Database Connection Issues**
   - Verify DATABASE_URL format
   - Check PostgreSQL service status
   - Confirm PostGIS extension installation

2. **Redis Connection Issues**
   - Verify REDIS_URL format
   - Check Redis service status
   - Review Redis memory settings

3. **API Key Issues**
   - Verify external API key validity
   - Check API quota limits
   - Review service-specific documentation

### Monitoring

- Health check endpoint: `/api/health`
- Detailed health: `/api/health/detailed`
- Application logs in `logs/` directory
- Database performance monitoring via PgAdmin

### Contributing

1. Follow TypeScript and ESLint configurations
2. Add tests for new features
3. Update documentation for API changes
4. Follow maritime safety best practices
5. Test with real navigation scenarios

## License

MIT License - see LICENSE file for details.

---

**🌊 Safer waters through community-driven navigation intelligence** ⚓