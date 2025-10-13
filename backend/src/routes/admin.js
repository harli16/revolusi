// src/routes/admin.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const User = require("../models/User");
const MessageLog = require("../models/MessageLog");
const wa = require("../services/wa");

// Semua endpoint admin harus login & admin
router.use(authenticateToken, requireAdmin);

// ===== Status set: samakan dengan sisi USER =====
const SENT_STATUSES = ["sent", "delivered", "read", "played"];
const FAIL_STATUSES = ["failed", "gagal"];

/**
 * ======================================================
 * 📊 GET /api/admin/stats
 * Dashboard Admin — disinkronkan dengan logika USER
 * - Periode bulan berjalan (monthStart)
 * - terkirim = SENT_STATUSES
 * - gagal = FAIL_STATUSES
 * - totalPesan = terkirim + gagal
 * ======================================================
 */
router.get("/stats", async (req, res) => {
  try {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Ambil semua user role=user
    const users = await User.find({ role: "user" })
      .select("_id username active quotaDaily")
      .lean();

    // Agregasi per user untuk BULAN INI — match user
    const perUserMonthAgg = await MessageLog.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      {
        $group: {
          _id: "$userId",
          sent: {
            $sum: {
              $cond: [{ $in: ["$status", SENT_STATUSES] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $in: ["$status", FAIL_STATUSES] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          sent: 1,
          failed: 1,
          total: { $add: ["$sent", "$failed"] }, // totalPesan = terkirim + gagal
        },
      },
    ]);

    const monthMap = new Map(perUserMonthAgg.map((a) => [String(a._id), a]));

    // KPI — match gaya user
    const [todaySent, last7dSent, thisMonthSent, failedToday] = await Promise.all([
      // terkirim hari ini
      MessageLog.countDocuments({
        status: { $in: SENT_STATUSES },
        createdAt: { $gte: startToday },
      }),
      // terkirim 7 hari terakhir
      MessageLog.countDocuments({
        status: { $in: SENT_STATUSES },
        createdAt: { $gte: start7d },
      }),
      // terkirim bulan ini
      MessageLog.countDocuments({
        status: { $in: SENT_STATUSES },
        createdAt: { $gte: monthStart },
      }),
      // gagal hari ini
      MessageLog.countDocuments({
        status: { $in: FAIL_STATUSES },
        createdAt: { $gte: startToday },
      }),
    ]);

    // Mapping user rows
    const usersOut = users.map((u) => {
      const m = monthMap.get(String(u._id)) || { total: 0, sent: 0, failed: 0 };
      return {
        _id: u._id,
        username: u.username,
        active: u.active,
        quotaDaily: u.quotaDaily || 0,

        // === angka bulan ini (match user) ===
        totalPesan: m.total,   // = sent + failed
        terkirim: m.sent,
        gagal: m.failed,

        // Status operasional
        waStatus: wa.getState ? wa.getState(String(u._id)) : "UNKNOWN",
        queueDepth: wa.getQueueDepth ? wa.getQueueDepth(String(u._id)) : 0,
      };
    });

    res.json({
      ok: true,
      data: {
        kpi: {
          today: todaySent,
          last7d: last7dSent,
          thisMonth: thisMonthSent, // ⬅️ ganti nama biar jelas
          failedToday,
        },
        users: usersOut,
        totalUserAktif: users.filter((u) => u.active).length,
        period: {
          type: "month",
          from: monthStart,
          to: now,
          note:
            "Perhitungan admin mengikuti user: 'terkirim' = sent+delivered+read+played; 'gagal' = failed+gagal; periode = bulan berjalan.",
        },
      },
    });
  } catch (err) {
    console.error("❌ /api/admin/stats error:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil statistik admin" });
  }
});

/**
 * ======================================================
 * 📈 GET /api/admin/users/:id/stats
 * Detail per user — disamakan dgn user (bulan berjalan)
 * ======================================================
 */
router.get("/users/:id/stats", async (req, res) => {
  try {
    const userId = req.params.id;
    const oid = new mongoose.Types.ObjectId(userId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Profil user
    const user = await User.findById(userId)
      .select("_id username active quotaDaily")
      .lean();
    if (!user) {
      return res.status(404).json({ ok: false, message: "User tidak ditemukan" });
    }

    // Totals bulan ini — match user
    const totalsAgg = await MessageLog.aggregate([
      { $match: { userId: oid, createdAt: { $gte: monthStart, $lte: now } } },
      {
        $group: {
          _id: "$status",
          c: { $sum: 1 },
        },
      },
    ]);

    // Bentuk angka konsisten
    const totals = {
      sent: 0,
      delivered: 0,
      read: 0,
      played: 0,
      failed: 0,
      total: 0,
      successRate: 0,
    };
    for (const row of totalsAgg) {
      const k = row._id;
      const v = row.c || 0;
      if (k === "failed" || k === "gagal") totals.failed += v;
      else if (k === "sent" || k === "delivered" || k === "read" || k === "played") {
        totals[k] = (totals[k] || 0) + v;
      }
    }
    const sentAll = totals.sent + totals.delivered + totals.read + totals.played;
    totals.total = sentAll + totals.failed; // totalPesan = terkirim + gagal
    totals.successRate = totals.total > 0 ? Math.round((sentAll / totals.total) * 100) : 0;

    // Timeline harian bulan ini (boleh tampil "sent" & "failed" saja biar ringkas)
    const daily = await MessageLog.aggregate([
      { $match: { userId: oid, createdAt: { $gte: monthStart, $lte: now } } },
      {
        $group: {
          _id: {
            d: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            s: "$status",
          },
          c: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.d",
          items: { $push: { k: "$_id.s", v: "$c" } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dailyOut = daily.map((d) => {
      const map = Object.fromEntries(d.items.map((x) => [x.k, x.v]));
      const sent =
        (map.sent || 0) +
        (map.delivered || 0) +
        (map.read || 0) +
        (map.played || 0);
      const failed = (map.failed || 0) + (map.gagal || 0);
      return {
        date: d._id,
        total: sent + failed,
        sent,
        failed,
      };
    });

    res.json({
      ok: true,
      data: {
        user,
        totals,
        daily: dailyOut,
        waStatus: wa.getState ? wa.getState(userId) : "UNKNOWN",
        queueDepth: wa.getQueueDepth ? wa.getQueueDepth(userId) : 0,
        period: {
          type: "month",
          from: monthStart,
          to: now,
          note:
            "Perhitungan admin mengikuti user: 'terkirim' = sent+delivered+read+played; 'gagal' = failed+gagal; periode = bulan berjalan.",
        },
      },
    });
  } catch (err) {
    console.error("❌ /api/admin/users/:id/stats error:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil detail user" });
  }
});

/**
 * ======================================================
 * ⚙️ Kontrol Sesi WhatsApp & Queue
 * ======================================================
 */
router.post("/users/:id/wa/logout", async (req, res) => {
  try {
    if (wa.forceLogout) await wa.forceLogout(String(req.params.id));
    res.json({ ok: true, message: "WA session user telah di-logout." });
  } catch (err) {
    console.error("WA logout error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.post("/users/:id/queue/pause", async (req, res) => {
  try {
    if (wa.pauseQueue) wa.pauseQueue(String(req.params.id));
    res.json({ ok: true, message: "Queue user dipause." });
  } catch (err) {
    console.error("Queue pause error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.post("/users/:id/queue/resume", async (req, res) => {
  try {
    if (wa.resumeQueue) wa.resumeQueue(String(req.params.id));
    res.json({ ok: true, message: "Queue user dilanjutkan." });
  } catch (err) {
    console.error("Queue resume error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
