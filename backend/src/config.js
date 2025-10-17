const dotenv = require("dotenv");
dotenv.config();

// 🔒 Validasi wajib ada MONGO_URI
if (!process.env.MONGO_URI) {
  throw new Error("❌ MONGO_URI is not defined in .env");
}

module.exports = {
  env: process.env.NODE_ENV || "development",

  // Server
  port: Number(process.env.PORT || 3001),

  // Database
  mongoUri: process.env.MONGO_URI,

  // JWT
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",

  // WhatsApp Service
  tokensDir: process.env.TOKENS_DIR || "./tokens",
  simulation:
    String(process.env.SIMULATION_MODE || "false").toLowerCase() === "true",

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim()),
};