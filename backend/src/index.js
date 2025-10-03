const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

const cfg = require("./config");
const app = require("./app");
const logger = require("./logger");
const wa = require("./services/wa");

(async function startServer() {
  try {
    // ==========================
    // Connect ke MongoDB
    // ==========================
    await mongoose.connect(cfg.mongoUri, {
      // ⚠️ opsi ini deprecated di driver MongoDB v6, 
      // tapi biarin aman kalo versi lu masih butuh
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info("✅ MongoDB connected");

    // ==========================
    // Buat HTTP server dari Express app
    // ==========================
    const server = http.createServer(app);

    // ==========================
    // Init Socket.IO
    // ==========================
    const io = new Server(server, {
      cors: {
        // TODO: sebaiknya ganti ke cfg.corsOrigins biar secure
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    // Debug koneksi socket
    io.on("connection", (socket) => {
      logger.info(`🔌 Socket connected: ${socket.id}`);

      // ✅ FE harus kirim event join dengan userId setelah login
      socket.on("join", (userId) => {
        if (!userId) return;
        socket.join(userId.toString());
        logger.info(`👤 User ${userId} joined room ${userId}`);
      });

      socket.on("disconnect", (reason) => {
        logger.info(`❌ Socket disconnected: ${socket.id} (${reason})`);
      });
    });

    // ==========================
    // Inject io ke WA service
    // ==========================
    wa.setSocketIO(io);

    // ==========================
    // Start server (bind ke 0.0.0.0 biar bisa diakses LAN)
    // ==========================
    server.listen(cfg.port, "0.0.0.0", () => {
      logger.info(`🚀 Server listening on 0.0.0.0:${cfg.port}`);
    });
  } catch (err) {
    logger.error("❌ Failed to start server:", err);
    process.exit(1);
  }
})();
