# Monorepo build (context = repository root).
# Build: docker build -f apps/users-service/Dockerfile -t mrun/users-service .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/observability/package.json packages/observability/
COPY apps/users-service/package.json apps/users-service/
RUN pnpm install --no-frozen-lockfile --filter users-service...
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/observability packages/observability
COPY apps/users-service apps/users-service
RUN pnpm --filter @mrun/contracts build && pnpm --filter @mrun/observability build && pnpm --filter users-service build

FROM node:22-alpine AS production
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/observability/package.json packages/observability/
COPY apps/users-service/package.json apps/users-service/
RUN pnpm install --no-frozen-lockfile --prod --filter users-service...
COPY --from=build /repo/packages/contracts packages/contracts
COPY --from=build /repo/packages/observability packages/observability
COPY --from=build /repo/apps/users-service/dist apps/users-service/dist
WORKDIR /repo/apps/users-service
EXPOSE 3000
CMD ["node", "dist/main.js"]
