techteam@monitoring:~/nguliks/revolusi/fe-wablash$ cat Dockerfile 
# Stage 1: Build React Vite
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build production
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# hapus default config
RUN rm -rf ./*

# Copy build hasil dari stage builder
COPY --from=builder /app/dist .

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
