# Monorepo build (context = repository root).
# Build: docker build -f apps/analytics-service/Dockerfile -t mrun/analytics-service .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/events/package.json packages/events/
COPY apps/analytics-service/package.json apps/analytics-service/
RUN pnpm install --no-frozen-lockfile --filter analytics-service...
COPY tsconfig.base.json ./
COPY packages/events packages/events
COPY apps/analytics-service apps/analytics-service
RUN pnpm --filter @mrun/events build && pnpm --filter analytics-service build

FROM node:22-alpine AS production
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/events/package.json packages/events/
COPY apps/analytics-service/package.json apps/analytics-service/
RUN pnpm install --no-frozen-lockfile --prod --filter analytics-service...
COPY --from=build /repo/packages/events packages/events
COPY --from=build /repo/apps/analytics-service/dist apps/analytics-service/dist
WORKDIR /repo/apps/analytics-service
EXPOSE 3005
CMD ["node", "dist/main.js"]
