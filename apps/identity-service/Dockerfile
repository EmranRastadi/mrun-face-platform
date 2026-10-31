# Monorepo build (context = repository root).
# Build: docker build -f apps/identity-service/Dockerfile -t mrun/identity-service .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/observability/package.json packages/observability/
COPY apps/identity-service/package.json apps/identity-service/
RUN pnpm install --no-frozen-lockfile --filter identity-service...
COPY tsconfig.base.json ./
COPY packages/observability packages/observability
COPY apps/identity-service apps/identity-service
RUN pnpm --filter @mrun/observability build && pnpm --filter identity-service build

FROM node:22-alpine AS production
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/observability/package.json packages/observability/
COPY apps/identity-service/package.json apps/identity-service/
RUN pnpm install --no-frozen-lockfile --prod --filter identity-service...
COPY --from=build /repo/packages/observability packages/observability
COPY --from=build /repo/apps/identity-service/dist apps/identity-service/dist
WORKDIR /repo/apps/identity-service

# Best practice: non-root + minimal surface.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
  && chown -R appuser:appgroup /repo
USER appuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
