const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const MessageLog = require("../models/MessageLog");

// semua route butuh login
router.use(authenticateToken);

/**
 * ================================
 *  GET /api/stats/summary
 *  Statistik ringkas user
 * ================================
 */
router.get("/summary", async (req, res) => {
  try {
    const userId = req.user.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // reset ke awal hari

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // ✅ total terkirim hari ini
    const sentToday = await MessageLog.countDocuments({
      userId,
      status: { $in: ["sent", "delivered", "read", "played"] },
      createdAt: { $gte: today },
    });

    // ✅ total pesan terkirim bulan ini
    const sentThisMonth = await MessageLog.countDocuments({
      userId,
      status: { $in: ["sent", "delivered", "read", "played"] },
      createdAt: { $gte: startOfMonth },
    });

    // ✅ total gagal bulan ini
    const failed = await MessageLog.countDocuments({
      userId,
      status: { $in: ["failed", "gagal"] },
      createdAt: { $gte: startOfMonth }, // 🔥 filter bulan ini aja
    });

    res.json({
      ok: true,
      data: {
        sentToday,
        sentThisMonth,
        failed,
      },
    });
  } catch (err) {
    console.error("❌ Error summary stats:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil statistik" });
  }
});

/**
 * ================================
 *  GET /api/stats/weekly
 *  Statistik 7 hari terakhir
 * ================================
 */
router.get("/weekly", async (req, res) => {
  try {
    const userId = new (require("mongoose").Types.ObjectId)(req.user.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // reset ke awal hari
    const last7 = new Date(today);
    last7.setDate(today.getDate() - 6);

    const logs = await MessageLog.aggregate([
      {
        $match: {
          userId: userId, // ✅ fix: pakai ObjectId
          status: { $in: ["sent", "delivered", "read", "played"] },
          createdAt: { $gte: last7, $lte: new Date() },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const logMap = {};
    logs.forEach((l) => {
      logMap[l._id] = l.count;
    });

    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split("T")[0];
      result.push({
        _id: key,
        count: logMap[key] || 0,
      });
    }

    res.json({ ok: true, data: result });
  } catch (err) {
    console.error("❌ Error weekly stats:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil data weekly" });
  }
});


module.exports = router;
