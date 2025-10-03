# ==========================
# Backend Dockerfile
# ==========================

FROM node:20-alpine

WORKDIR /app

# Copy package.json (+ lockfile kalau ada)
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --legacy-peer-deps

# Copy seluruh source code backend
COPY . .

# Expose port backend
EXPOSE 3001

# Start app
CMD ["npm", "start"]
