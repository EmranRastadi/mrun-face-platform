FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
# Install ALL deps (including @nestjs/cli) so the build stage has them
RUN npm ci
COPY . .

# ---------- Build ----------
FROM base AS build
RUN npm run build

# ---------- Production ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
# Install only production deps
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist

RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
  && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]