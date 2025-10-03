# WABLASH Backend (Express + MongoDB + Baileys)

Fitur: JWT login, users admin, QR scan, reset sesi, kirim pesan teks, logs.

## Quick Start (Docker)
```
cp .env.example .env
docker compose up -d --build
docker compose exec backend npm run seed:admin
```
Lalu buka:
- GET /api/wa/health
- GET /api/wa/qr.png
- POST /api/message/send
```)

