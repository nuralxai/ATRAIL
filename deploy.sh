#!/bin/bash

set -e

echo "=========================================="
echo "ATRAIL Production Deployment"
echo "=========================================="
echo

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Build Docker images
echo -e "${YELLOW}Step 1: Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build

# Step 2: Stop and remove old containers
echo -e "${YELLOW}Step 2: Cleaning up old containers...${NC}"
docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true

# Step 3: Start services
echo -e "${YELLOW}Step 3: Starting production services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Step 4: Wait for services to be healthy
echo -e "${YELLOW}Step 4: Waiting for services to be healthy...${NC}"
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
  if docker-compose -f docker-compose.prod.yml ps | grep -q "atrail_postgres_prod.*Up" && \
     docker-compose -f docker-compose.prod.yml ps | grep -q "atrail_redis_prod.*Up"; then
    echo -e "${GREEN}✓ Database and Redis are healthy${NC}"
    break
  fi
  echo "Waiting for database... (attempt $attempt/$max_attempts)"
  attempt=$((attempt + 1))
  sleep 2
done

# Step 5: Run migrations
echo -e "${YELLOW}Step 5: Running database migrations...${NC}"
docker-compose -f docker-compose.prod.yml exec -T api pnpm exec prisma migrate deploy || echo "Migrations already up to date"

# Step 6: Check API health
echo -e "${YELLOW}Step 6: Waiting for API to be ready...${NC}"
attempt=1
while [ $attempt -le $max_attempts ]; do
  if docker-compose -f docker-compose.prod.yml ps | grep "atrail_api_prod" | grep -q "Up"; then
    if curl -s http://localhost:4000/health > /dev/null; then
      echo -e "${GREEN}✓ API is healthy${NC}"
      break
    fi
  fi
  echo "Waiting for API... (attempt $attempt/$max_attempts)"
  attempt=$((attempt + 1))
  sleep 2
done

# Step 7: Check web app health
echo -e "${YELLOW}Step 7: Waiting for web app to be ready...${NC}"
attempt=1
while [ $attempt -le $max_attempts ]; do
  if docker-compose -f docker-compose.prod.yml ps | grep "atrail_web_prod" | grep -q "Up"; then
    if curl -s http://localhost:3000 > /dev/null; then
      echo -e "${GREEN}✓ Web app is healthy${NC}"
      break
    fi
  fi
  echo "Waiting for web app... (attempt $attempt/$max_attempts)"
  attempt=$((attempt + 1))
  sleep 2
done

# Final status
echo
echo -e "${GREEN}=========================================="
echo "Deployment Completed Successfully!"
echo "==========================================${NC}"
echo
echo "Services running:"
docker-compose -f docker-compose.prod.yml ps
echo
echo "Access your application:"
echo -e "${GREEN}API:     http://localhost:4000${NC}"
echo -e "${GREEN}Web App: http://localhost:3000${NC}"
echo -e "${GREEN}API Docs: http://localhost:4000/api/v1${NC}"
echo
echo "To view logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f api"
echo "  docker-compose -f docker-compose.prod.yml logs -f web"
echo
