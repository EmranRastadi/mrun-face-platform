




# ---------- Base ----------
FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm install

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

COPY package.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

CMD ["node", "dist/main.js"]