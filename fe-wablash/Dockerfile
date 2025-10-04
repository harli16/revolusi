# ==========================
# Stage 1: Build React (Vite)
# ==========================
FROM node:20-alpine AS builder
WORKDIR /app

# Salin file konfigurasi package
COPY package*.json ./

# Install dependencies (gunakan cache layer agar lebih cepat)
RUN npm install

# Salin semua source code ke container
COPY . .

# Build project untuk production
RUN npm run build

# ==========================
# Stage 2: Serve hasil build dengan Nginx
# ==========================
FROM nginx:alpine AS production
WORKDIR /usr/share/nginx/html

# Hapus file default bawaan Nginx
RUN rm -rf ./*

# Salin hasil build dari stage builder
COPY --from=builder /app/dist .

# Copy custom konfigurasi Nginx (jika ada)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port untuk Nginx
EXPOSE 80

# Jalankan Nginx di foreground
CMD ["nginx", "-g", "daemon off;"]
