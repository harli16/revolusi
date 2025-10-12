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
        origin: "*", // ⚠️ ubah ke cfg.corsOrigins kalau udah di production
        methods: ["GET", "POST"],
      },
    });

    // ==========================
    // Socket connection handler
    // ==========================
    io.on("connection", (socket) => {
      logger.info(`🔌 Socket connected: ${socket.id}`);

      // FE wajib kirim event "join" setelah login
      socket.on("join", (userId) => {
        if (!userId) {
          logger.warn(`⚠️ Socket ${socket.id} join tanpa userId`);
          return;
        }

        const roomId = userId.toString();
        socket.join(roomId);
        logger.info(`👤 User ${userId} joined room ${roomId}`);

        // kirim konfirmasi balik ke FE
        socket.emit("joined", { roomId });
      });

      // debug event masuk (buat tracing sementara)
      socket.onAny((event, data) => {
        if (["ping", "pong"].includes(event)) return; // biar gak spam
        logger.debug(`📨 Socket event: ${event}`, data);
      });

      socket.on("disconnect", (reason) => {
        logger.info(`❌ Socket disconnected: ${socket.id} (${reason})`);
      });
    });

    // ==========================
    // Inject io ke WhatsApp service
    // ==========================
    wa.setSocketIO(io);

    // ==========================
    // Start server (bind ke semua interface)
    // ==========================
    server.listen(cfg.port, "0.0.0.0", () => {
      logger.info(`🚀 Server running on http://0.0.0.0:${cfg.port}`);
    });

  } catch (err) {
    logger.error("❌ Failed to start server:", err);
    process.exit(1);
  }
})();
