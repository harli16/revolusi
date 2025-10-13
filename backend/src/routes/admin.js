const express = require("express");
const router = express.Router();
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const mongoose = require("mongoose");
const User = require("../models/User");
const MessageLog = require("../models/MessageLog");

// semua endpoint admin harus login + admin
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/stats
 * Struktur response:
 * {
 *   ok: true,
 *   data: {
 *     users: [{ username, totalPesan }],
 *     totalUserAktif,
 *     totalPesan,
 *     kuota
 *   }
 * }
 */
router.get("/stats", async (req, res) => {
  try {
    // ambil semua user role "user"
    const users = await User.find({ role: "user" })
      .select("_id username active")
      .lean();

    // hitung total pesan bulan ini per user dari MessageLog
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const agg = await MessageLog.aggregate([
      {
        $match: {
          createdAt: { $gte: monthStart, $lte: now },
        },
      },
      {
        $group: {
          _id: "$userId",
          total: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(agg.map((a) => [String(a._id), a.total]));

    const usersOut = users.map((u) => ({
      username: u.username,
      totalPesan: countMap.get(String(u._id)) || 0,
    }));

    const totalUserAktif = users.filter((u) => u.active === true).length;
    const totalPesan = usersOut.reduce((acc, u) => acc + u.totalPesan, 0);

    // Kuota: sementara dummy 0, nanti bisa lo isi dari config/DB
    const kuota = 0;

    res.json({
      ok: true,
      data: {
        users: usersOut,
        totalUserAktif,
        totalPesan,
        kuota,
      },
    });
  } catch (err) {
    console.error("❌ /api/admin/stats error:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil statistik admin" });
  }
});

module.exports = router;
