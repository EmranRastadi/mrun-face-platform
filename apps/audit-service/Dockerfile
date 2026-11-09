# Monorepo build (context = repository root).
# Build: docker build -f apps/audit-service/Dockerfile -t mrun/audit-service .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/events/package.json packages/events/
COPY packages/observability/package.json packages/observability/
COPY apps/audit-service/package.json apps/audit-service/
RUN pnpm install --no-frozen-lockfile --filter audit-service...
COPY tsconfig.base.json ./
COPY packages/events packages/events
COPY packages/observability packages/observability
COPY apps/audit-service apps/audit-service
RUN pnpm --filter @mrun/events build && pnpm --filter @mrun/observability build && pnpm --filter audit-service build

FROM node:22-alpine AS production
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/events/package.json packages/events/
COPY packages/observability/package.json packages/observability/
COPY apps/audit-service/package.json apps/audit-service/
RUN pnpm install --no-frozen-lockfile --prod --filter audit-service...
# Copy only build outputs. Copying the whole package would overwrite the
# production node_modules symlinks created by pnpm with build-stage ones.
COPY --from=build /repo/packages/events/dist packages/events/dist
COPY --from=build /repo/packages/observability/dist packages/observability/dist
COPY --from=build /repo/apps/audit-service/dist apps/audit-service/dist
WORKDIR /repo/apps/audit-service
EXPOSE 3003
CMD ["node", "dist/main.js"]
