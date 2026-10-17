# ---------- Base ----------
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install --no-audit --no-fund

# ---------- Development ----------
FROM base AS development
COPY . .
CMD ["npm", "run", "start:dev"]

# ---------- Build ----------
FROM base AS build
COPY . .
RUN npm run build

# ---------- Production ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev --no-audit --no-fund \
  && npm cache clean --force
COPY --from=build /app/dist ./dist

# Best practice: non-root + minimal surface.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
  && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
