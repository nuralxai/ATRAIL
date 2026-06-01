# Atrail Production Deployment Guide

## Overview

This guide covers deploying the Atrail platform to production using Docker containers.

## Prerequisites

- Docker and Docker Compose installed
- At least 4GB available disk space
- Ports 3000 (web), 4000 (API), 5435 (PostgreSQL), 6378 (Redis) available

## Quick Start

### Automated Deployment

```bash
cd /home/ubuntu/atrail
chmod +x deploy.sh
./deploy.sh
```

This script will:
1. Build Docker images for API and web applications
2. Stop any existing containers
3. Start fresh production containers
4. Run database migrations
5. Verify all services are healthy

### Manual Deployment

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec api pnpm exec prisma migrate deploy

# Check status
docker-compose -f docker-compose.prod.yml ps
```

## Configuration

### Environment Variables

Edit `.env.production` to configure production settings:

```bash
# Database
DB_USER=atrail_prod
DB_PASSWORD=secure_password_here
DB_NAME=atrail_prod

# Frontend URL
FRONTEND_URL=https://app.atrail.in

# API URL
NEXT_PUBLIC_API_URL=https://api.atrail.in/api/v1

# Secrets (IMPORTANT: Change these!)
JWT_ACCESS_SECRET=change_this_secret_min_32_chars
JWT_REFRESH_SECRET=change_this_secret_min_32_chars

# Optional: External Service Integrations
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
MICROSOFT_CLIENT_ID=your_microsoft_client_id
# ... etc
```

### Database Setup

PostgreSQL database is automatically created by Docker Compose:
- Default user: `postgres`
- Default password: `postgres`
- Database: `amgi`
- Port: `5435`

To connect from host:
```bash
psql -h localhost -p 5435 -U postgres -d amgi
```

### Redis Configuration

Redis is automatically started and persists data to `atrail_redisdata_prod` volume.

## Services

### API Container
- **Image**: `atrail_api:latest`
- **Port**: `4000`
- **Endpoint**: `http://localhost:4000`
- **Health Check**: `http://localhost:4000/health`

### Web Container
- **Image**: `atrail_web:latest`
- **Port**: `3000`
- **Endpoint**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000`

### Database
- **Image**: `postgres:16-alpine`
- **Port**: `5435`
- **Data Volume**: `atrail_pgdata_prod`

### Cache
- **Image**: `redis:7-alpine`
- **Port**: `6378`
- **Data Volume**: `atrail_redisdata_prod`

## Logging

View service logs:

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f web
docker-compose -f docker-compose.prod.yml logs -f postgres

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 api
```

## Maintenance

### Stopping Services

```bash
docker-compose -f docker-compose.prod.yml stop
```

### Restarting Services

```bash
docker-compose -f docker-compose.prod.yml restart
```

### Complete Cleanup (Removes containers but keeps volumes)

```bash
docker-compose -f docker-compose.prod.yml down
```

### Complete Cleanup (Removes containers and volumes - DESTRUCTIVE)

```bash
docker-compose -f docker-compose.prod.yml down -v
```

### Database Backups

Export database:
```bash
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres amgi > backup.sql
```

Restore database:
```bash
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres amgi < backup.sql
```

## Monitoring

### Check Container Health

```bash
docker-compose -f docker-compose.prod.yml ps
```

### Test API Endpoint

```bash
curl http://localhost:4000/health
```

### Test Web App

```bash
curl http://localhost:3000
```

### Check Disk Usage

```bash
docker system df
docker system prune -a  # Remove unused images/containers
```

## Troubleshooting

### Port Already in Use

If port 3000 or 4000 is already in use:

```bash
# Find process using port
lsof -i :3000
lsof -i :4000

# Kill process
kill -9 <PID>
```

### Database Connection Issues

```bash
# Check database is running
docker-compose -f docker-compose.prod.yml logs postgres

# Verify connection
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres
```

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs <service-name>

# Rebuild image
docker-compose -f docker-compose.prod.yml build --no-cache <service-name>
```

## Performance Optimization

### Production Best Practices

1. **Use a reverse proxy** (nginx, caddy) in front of the containers
2. **Enable SSL/TLS** for HTTPS connections
3. **Configure logging** to external service (ELK, Datadog, etc.)
4. **Set up monitoring** and alerting (Prometheus, Grafana)
5. **Use persistent volumes** for data durability
6. **Configure resource limits** in docker-compose.prod.yml

### Docker Resource Limits

Edit docker-compose.prod.yml to add resource limits:

```yaml
services:
  api:
    ...
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Scaling

### Multiple API Instances

```bash
docker-compose -f docker-compose.prod.yml up -d --scale api=3
```

Then use a load balancer (nginx, HAProxy) to distribute traffic.

## Security Notes

⚠️ **IMPORTANT**: Before going to production:

1. Change all default passwords
2. Set strong JWT secrets (min 32 characters)
3. Enable SSL/TLS
4. Set `NODE_ENV=production`
5. Use a secrets manager (Vault, AWS Secrets Manager)
6. Restrict database access
7. Enable firewall rules
8. Set up regular backups
9. Configure CORS properly
10. Enable authentication on all APIs

## Support

For issues or questions:
- Check logs: `docker-compose -f docker-compose.prod.yml logs -f`
- Review configuration: `cat .env.production`
- Inspect running containers: `docker-compose -f docker-compose.prod.yml ps -a`

