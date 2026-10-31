# Monorepo build (context = repository root).
# Build: docker build -f apps/api-gateway/Dockerfile -t mrun/api-gateway .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/observability/package.json packages/observability/
COPY apps/api-gateway/package.json apps/api-gateway/
RUN pnpm install --no-frozen-lockfile --filter api-gateway...
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/observability packages/observability
COPY apps/api-gateway apps/api-gateway
RUN pnpm --filter @mrun/contracts build && pnpm --filter @mrun/observability build && pnpm --filter api-gateway build

FROM node:22-alpine AS production
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/observability/package.json packages/observability/
COPY apps/api-gateway/package.json apps/api-gateway/
RUN pnpm install --no-frozen-lockfile --prod --filter api-gateway...
COPY --from=build /repo/packages/contracts packages/contracts
COPY --from=build /repo/packages/observability packages/observability
COPY --from=build /repo/apps/api-gateway/dist apps/api-gateway/dist
WORKDIR /repo/apps/api-gateway

# Best practice: non-root + minimal surface.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
  && chown -R appuser:appgroup /repo
USER appuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
