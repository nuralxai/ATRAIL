# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages/
COPY apps/api ./apps/api/

# Copy .env file for Prisma schema loading
COPY apps/api/.env ./apps/api/.env

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Build shared package
RUN pnpm --filter=shared build

# Generate Prisma client
WORKDIR /app/apps/api
RUN pnpm prisma generate

# Build API
WORKDIR /app
RUN pnpm --filter=api build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages/
COPY apps/api ./apps/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder (including generated Prisma client)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy Prisma schema (needed for runtime)
COPY apps/api/prisma ./apps/api/prisma/

WORKDIR /app/apps/api

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:4000/health || exit 1

# Start API
CMD ["node", "dist/index.js"]
