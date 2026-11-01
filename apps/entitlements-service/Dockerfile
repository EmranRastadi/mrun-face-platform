# Monorepo build (context = repository root).
# Build: docker build -f apps/entitlements-service/Dockerfile -t mrun/entitlements-service .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/observability/package.json packages/observability/
COPY apps/entitlements-service/package.json apps/entitlements-service/
RUN pnpm install --no-frozen-lockfile --filter entitlements-service...
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/observability packages/observability
COPY apps/entitlements-service apps/entitlements-service
RUN pnpm --filter @mrun/contracts build && pnpm --filter @mrun/observability build && pnpm --filter entitlements-service build

FROM node:22-alpine AS production
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/observability/package.json packages/observability/
COPY apps/entitlements-service/package.json apps/entitlements-service/
RUN pnpm install --no-frozen-lockfile --prod --filter entitlements-service...
COPY --from=build /repo/packages/contracts packages/contracts
COPY --from=build /repo/packages/observability packages/observability
COPY --from=build /repo/apps/entitlements-service/dist apps/entitlements-service/dist
WORKDIR /repo/apps/entitlements-service
EXPOSE 3000
CMD ["node", "dist/main.js"]
