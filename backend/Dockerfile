# ==========================
# Backend Dockerfile (multi-stage)
# ==========================

# ---------- Stage 1: base ----------
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# Install semua dependency (termasuk devDependencies)
RUN npm install --legacy-peer-deps

# Copy seluruh source code
COPY . .

# ---------- Stage 2: development ----------
FROM base AS development
ENV NODE_ENV=development
# 🔥 pastikan nodemon tersedia di path global
RUN npm install -g nodemon
CMD ["npm", "run", "dev"]

# ---------- Stage 3: production ----------
FROM base AS production
ENV NODE_ENV=production
CMD ["npm", "start"]

EXPOSE 3001
