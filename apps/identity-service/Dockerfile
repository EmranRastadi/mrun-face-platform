FROM node:22-alpine AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable
RUN pnpm config set ignore-scripts true && pnpm install --no-frozen-lockfile
COPY . .

# ---------- Build ----------
FROM base AS build
RUN pnpm build

# ---------- Production ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm config set ignore-scripts true && pnpm install --prod --no-frozen-lockfile
COPY --from=build /app/dist ./dist

RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
  && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]