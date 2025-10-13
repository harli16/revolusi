const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");

const cfg = require("./config");
const templateRoutes = require("./routes/template");
const profileRoutes = require("./routes/profile");
const contactsRoutes = require("./routes/contacts");

const app = express();

// ==========================
// Security & basic middleware
// ==========================
app.use(
  helmet({
    crossOriginResourcePolicy: false, // ⬅️ izinkan load img/video dari domain lain
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("tiny"));

// ==========================
// CORS config (pakai .env CORS_ORIGINS)
// ==========================
const allowedSet = new Set(cfg.corsOrigins || ["*"]);

const corsOpt = {
  origin: (origin, cb) => {
    // ✅ izinkan kalau origin undefined (contoh: Postman / curl)
    if (!origin) return cb(null, true);

    // ✅ kalau di .env = * → semua origin diizinkan
    if (allowedSet.has("*")) return cb(null, true);

    // ✅ cek whitelist
    if (allowedSet.has(origin)) return cb(null, true);

    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOpt));
app.options("*", cors(corsOpt));

// ==========================
// Pastikan folder uploads/avatar ada
// ==========================
const uploadDir = path.join(__dirname, "..", "uploads", "avatar");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📂 Folder uploads/avatar dibuat otomatis");
}

// ==========================
// Expose folder uploads ke publik
// ==========================
const publicUploads = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(publicUploads));
console.log(`📂 Static files served from: ${publicUploads}`);

// ==========================
// Rate limit khusus endpoint kirim pesan
// ==========================
app.use(
  "/api/message/send",
  rateLimit({
    windowMs: 60 * 1000, // 1 menit
    limit: 120, // max 120 request per menit
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ==========================
// Health check
// ==========================
app.get("/api/health", (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

// ==========================
// Routes utama
// ==========================
app.use("/api/chat", require("./routes/chat"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/wa", require("./routes/wa"));
app.use("/api/message", require("./routes/message"));
app.use("/api/logs", require("./routes/logs"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/templates", templateRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/blasts", require("./routes/blasts"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/contacts", contactsRoutes);
app.use("/api/upload", require("./routes/upload"));

// ==========================
// 🔥 Tambahan baru: adminLogs
// ==========================
try {
  const adminLogsRoutes = require("./routes/adminLogs");
  app.use("/api/admin", adminLogsRoutes);
  console.log("✅ Route adminLogs terpasang di /api/admin");
} catch (err) {
  console.warn("⚠️ Route adminLogs tidak ditemukan atau error:", err.message);
}

// ==========================
// 404 handler
// ==========================
app.use((req, res) => {
  res.status(404).json({ ok: false, message: "Not found" });
});

// ==========================
// Error handler global
// ==========================
app.use((err, req, res, next) => {
  console.error("❌ Error Handler:", err);
  res
    .status(500)
    .json({ ok: false, message: err.message || "Server error" });
});

module.exports = app;
