# Monorepo build (context = repository root).
# Build: docker build -f apps/notification-service/Dockerfile -t mrun/notification-service .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/events/package.json packages/events/
COPY apps/notification-service/package.json apps/notification-service/
RUN pnpm install --no-frozen-lockfile --filter notification-service...
COPY tsconfig.base.json ./
COPY packages/events packages/events
COPY apps/notification-service apps/notification-service
RUN pnpm --filter @mrun/events build && pnpm --filter notification-service build

FROM node:22-alpine AS production
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/events/package.json packages/events/
COPY apps/notification-service/package.json apps/notification-service/
RUN pnpm install --no-frozen-lockfile --prod --filter notification-service...
COPY --from=build /repo/packages/events packages/events
COPY --from=build /repo/apps/notification-service/dist apps/notification-service/dist
WORKDIR /repo/apps/notification-service
EXPOSE 3004
CMD ["node", "dist/main.js"]
