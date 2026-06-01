# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages/
COPY apps/web ./apps/web/

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Build shared package
RUN pnpm --filter=shared build

# Build web app
WORKDIR /app/apps/web
RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve to run Next.js in production
RUN npm install -g serve

# Copy package files
COPY package.json ./

# Copy built app from builder
COPY --from=builder /app/apps/web/.next /app/.next
COPY --from=builder /app/apps/web/public /app/public

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000 || exit 1

# Start web app
CMD ["serve", "-s", ".next", "-l", "3000"]
