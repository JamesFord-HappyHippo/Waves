# Waves Backend Dockerfile
# Multi-stage build for production optimization

# Build stage
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY database/ ./database/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Set environment
ENV NODE_ENV=production

# Create app user
RUN addgroup -g 1001 -S waves && \
    adduser -S waves -u 1001

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    tini \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/database ./database

# Create logs directory
RUN mkdir -p logs && chown -R waves:waves logs

# Create uploads directory
RUN mkdir -p uploads && chown -R waves:waves uploads

# Change ownership of app directory
RUN chown -R waves:waves /app

# Switch to non-root user
USER waves

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# Labels for metadata
LABEL maintainer="Waves Team" \
      description="Waves Marine Navigation Backend Service" \
      version="1.0.0" \
      org.opencontainers.image.title="waves-backend" \
      org.opencontainers.image.description="Marine navigation backend with PostGIS geospatial processing" \
      org.opencontainers.image.source="https://github.com/waves/backend" \
      org.opencontainers.image.licenses="MIT"