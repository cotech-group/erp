FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker-node/package.json apps/worker-node/
RUN pnpm install --frozen-lockfile --filter=@ina-erp/worker-node

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker-node/node_modules ./apps/worker-node/node_modules
COPY . .
RUN pnpm turbo build --filter=@ina-erp/worker-node

# Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker
COPY --from=builder /app/apps/worker-node/dist ./dist
COPY --from=builder /app/apps/worker-node/node_modules ./node_modules
COPY --from=builder /app/apps/worker-node/package.json ./

USER worker
CMD ["node", "dist/main.js"]
