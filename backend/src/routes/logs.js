const express = require("express");
const router = express.Router();
const Log = require("../models/Log");
const MessageLog = require("../models/MessageLog");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

/**
 * =========================================
 * 1️⃣ GET /api/logs/:userId
 *    Ambil log milik user tertentu (buat ActivityPage)
 * =========================================
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Cari log untuk userId:", userId); // debug

    const logs = await Log.find({ userId }).sort({ createdAt: -1 }).exec();
    console.log("Hasil query logs:", logs.length);

    res.json({ ok: true, logs });
  } catch (err) {
    console.error("❌ Error ambil log user:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * =========================================
 * 2️⃣ GET /api/logs/messages/all
 *    Ambil semua log pesan (khusus admin)
 *    Dipakai di FE → halaman "Detail Blast"
 * =========================================
 */
router.get("/messages/all", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "500", 10), 1000);

    const logs = await MessageLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("to status createdAt")
      .lean();

    const mapped = logs.map((log) => ({
      phone: log.to,
      status: log.status,
      createdAt: log.createdAt,
    }));

    res.json({ ok: true, logs: mapped });
  } catch (err) {
    console.error("❌ Error ambil semua message log:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil data message logs" });
  }
});

module.exports = router;
