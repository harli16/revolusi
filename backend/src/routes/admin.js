// src/routes/admin.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const User = require("../models/User");
const MessageLog = require("../models/MessageLog");
const Blast = require("../models/Blast");
const ActivityLog = require("../models/ActivityLog");
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

    // Agregasi pesan bulan ini per user
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
          total: { $add: ["$sent", "$failed"] },
        },
      },
    ]);

    const monthMap = new Map(perUserMonthAgg.map((a) => [String(a._id), a]));

    const [todaySent, last7dSent, thisMonthSent, failedToday] = await Promise.all([
      MessageLog.countDocuments({
        status: { $in: SENT_STATUSES },
        createdAt: { $gte: startToday },
      }),
      MessageLog.countDocuments({
        status: { $in: SENT_STATUSES },
        createdAt: { $gte: start7d },
      }),
      MessageLog.countDocuments({
        status: { $in: SENT_STATUSES },
        createdAt: { $gte: monthStart },
      }),
      MessageLog.countDocuments({
        status: { $in: FAIL_STATUSES },
        createdAt: { $gte: startToday },
      }),
    ]);

    const usersOut = users.map((u) => {
      const m = monthMap.get(String(u._id)) || { total: 0, sent: 0, failed: 0 };
      return {
        _id: u._id,
        username: u.username,
        active: u.active,
        quotaDaily: u.quotaDaily || 0,
        totalPesan: m.total,
        terkirim: m.sent,
        gagal: m.failed,
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
          thisMonth: thisMonthSent,
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
 * ======================================================
 */
router.get("/users/:id/stats", async (req, res) => {
  try {
    const userId = req.params.id;
    const oid = new mongoose.Types.ObjectId(userId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const user = await User.findById(userId)
      .select("_id username active quotaDaily")
      .lean();
    if (!user)
      return res.status(404).json({ ok: false, message: "User tidak ditemukan" });

    const totalsAgg = await MessageLog.aggregate([
      { $match: { userId: oid, createdAt: { $gte: monthStart, $lte: now } } },
      { $group: { _id: "$status", c: { $sum: 1 } } },
    ]);

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
      else if (SENT_STATUSES.includes(k)) totals[k] = (totals[k] || 0) + v;
    }

    const sentAll = totals.sent + totals.delivered + totals.read + totals.played;
    totals.total = sentAll + totals.failed;
    totals.successRate =
      totals.total > 0 ? Math.round((sentAll / totals.total) * 100) : 0;

    const dailyAgg = await MessageLog.aggregate([
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

    const daily = dailyAgg.map((d) => {
      const map = Object.fromEntries(d.items.map((x) => [x.k, x.v]));
      const sent =
        (map.sent || 0) +
        (map.delivered || 0) +
        (map.read || 0) +
        (map.played || 0);
      const failed = (map.failed || 0) + (map.gagal || 0);
      return { date: d._id, total: sent + failed, sent, failed };
    });

    res.json({
      ok: true,
      data: {
        user,
        totals,
        daily,
        waStatus: wa.getState ? wa.getState(userId) : "UNKNOWN",
        queueDepth: wa.getQueueDepth ? wa.getQueueDepth(userId) : 0,
        period: { from: monthStart, to: now },
      },
    });
  } catch (err) {
    console.error("❌ /api/admin/users/:id/stats error:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil detail user" });
  }
});

/**
 * ======================================================
 * ⚙️ WhatsApp Control & Queue
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

/**
 * ======================================================
 * 📜 GET /api/admin/activity/:userId
 * ======================================================
 */
router.get("/activity/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const activities = await ActivityLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ ok: true, activities });
  } catch (err) {
    console.error("❌ /api/admin/activity/:userId error:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil aktivitas user" });
  }
});

/**
 * ======================================================
 * 📋 GET /api/admin/blasts
 * ======================================================
 */
router.get("/blasts", async (req, res) => {
  try {
    const blasts = await Blast.find({})
      .populate("userId", "username")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = blasts.map((b) => {
      const targetCount = b.recipients?.length || 0;
      const sent = b.totals?.sent || 0;
      const failed = b.totals?.failed || 0;

      let statusLabel = "Tidak Dikenal";
      if (b.status === "done" || b.endTime) statusLabel = "Selesai";
      else if (b.status === "active" || b.status === "running") statusLabel = "Berjalan";
      else if (b.schedule) statusLabel = "Dijadwalkan";
      else if (failed > 0 && sent === 0) statusLabel = "Gagal";

      return {
        _id: b._id,
        campaignName: b.meta?.randomTemplate
          ? `Blast Random (${b.templates?.length || 0} template)`
          : b.content?.text?.substring(0, 50) || "(Tanpa Judul)",
        username: b.userId?.username || "Tanpa Pemilik",
        status: statusLabel,
        createdAt: b.createdAt,
        scheduledAt: b.schedule || b.startTime || b.createdAt,
        targetCount,
        sent,
        failed,
      };
    });

    res.json({ ok: true, blasts: formatted });
  } catch (err) {
    console.error("❌ /api/admin/blasts error:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil data blast" });
  }
});

/**
 * ======================================================
 * 📋 GET /api/admin/blast-users
 * ======================================================
 */
router.get("/blast-users", async (req, res) => {
  try {
    const blasts = await Blast.find({})
      .populate("userId", "username avatar photoURL")
      .lean();

    if (!blasts || blasts.length === 0) {
      return res.json({ ok: true, users: [] });
    }

    const userStats = {};

    for (const b of blasts) {
      const userObj = b.userId || {};
      // 👉 unify Tanpa Pemilik jadi satu user
      const uid = userObj._id ? String(userObj._id) : "noUser";
      const username = userObj.username || "Tanpa Pemilik";
      const avatar = userObj.avatar || userObj.photoURL || null;

      if (!userStats[uid]) {
        userStats[uid] = {
          userId: uid,
          username,
          avatar,
          campaignCount: 0,
          totalSent: 0,
          totalFailed: 0,
        };
      }

      const sent = b.totals?.sent || 0;
      const failed = b.totals?.failed || 0;

      userStats[uid].campaignCount += 1;
      userStats[uid].totalSent += sent;
      userStats[uid].totalFailed += failed;
    }

    const usersOut = Object.values(userStats).sort(
      (a, b) => b.totalSent - a.totalSent
    );

    res.json({ ok: true, users: usersOut });
  } catch (err) {
    console.error("❌ /api/admin/blast-users error:", err);
    res.status(500).json({
      ok: false,
      message: "Gagal ambil daftar pengguna",
      error: err.message,
    });
  }
});

/**
 * ======================================================
 * 📋 GET /api/admin/user/:id/blasts
 * (Asli — untuk halaman Detail Blast Admin)
 * ======================================================
 */
router.get("/user/:id/blasts", async (req, res) => {
  try {
    const { id } = req.params;

    const blasts = await Blast.find({ userId: id })
      .populate("userId", "username")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = blasts.map((b) => {
      const targetCount = b.recipients?.length || 0;
      const sent = b.totals?.sent || 0;
      const failed = b.totals?.failed || 0;
      const totalDelivered =
        sent +
        (b.totals?.delivered || 0) +
        (b.totals?.read || 0) +
        (b.totals?.played || 0);

      let statusLabel = "Tidak Dikenal";
      if (b.status === "done" || b.endTime || totalDelivered >= targetCount)
        statusLabel = "Selesai";
      else if (b.status === "active" || b.status === "running")
        statusLabel = "Berjalan";
      else if (b.schedule)
        statusLabel = "Dijadwalkan";
      else if (failed > 0 && totalDelivered === 0)
        statusLabel = "Gagal";

      return {
        _id: b._id,
        campaignName: b.meta?.randomTemplate
          ? `Blast Random (${b.templates?.length || 0} template)`
          : b.content?.text?.substring(0, 50) || "(Tanpa Judul)",
        username: b.userId?.username || "Tanpa Pemilik",
        status: statusLabel,
        createdAt: b.createdAt,
        scheduledAt: b.schedule || b.startTime || b.createdAt,
        targetCount,
        sent,
        failed,
      };
    });

    res.json({ ok: true, blasts: formatted });
  } catch (err) {
    console.error("❌ /api/admin/user/:id/blasts error:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil riwayat blast user" });
  }
});

/**
 * ======================================================
 * 📋 GET /api/admin/user/:id/logs
 * (BARU — untuk halaman Log Pengiriman Admin)
 * ======================================================
 */
router.get("/user/:id/logs", async (req, res) => {
  try {
    const { id } = req.params;

    const logs = await MessageLog.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(id) } },

      // 🔍 Gabungkan dengan koleksi contacts berdasarkan nomor (dengan berbagai format)
      {
        $lookup: {
          from: "contacts",
          let: { num: "$to" }, // biasanya di MessageLog field penerima = "to"
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$waNumber", "$$num"] },
                    {
                      $eq: [
                        "$waNumber",
                        { $concat: ["62", { $substr: ["$$num", 1, -1] }] },
                      ],
                    },
                    {
                      $eq: [
                        "$waNumber",
                        { $concat: ["0", { $substr: ["$$num", 2, -1] }] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "contact",
        },
      },

      { $unwind: { path: "$contact", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          to: 1, // tampilkan nomor penerima
          message: 1,
          status: 1,
          createdAt: 1,
          campaignName: "$meta.campaignName",
          contactName: "$contact.name",
          school: "$contact.school",
          kelas: "$contact.kelas",
          tahunLulus: "$contact.tahunLulus",
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    res.json({ ok: true, logs });
  } catch (err) {
    console.error("❌ /api/admin/user/:id/logs error:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil log pengiriman user" });
  }
});

/**
 * ======================================================
 * 📄 GET /api/admin/blast/:id
 * Detail satu blast (dipanggil dari modal FE admin)
 * ======================================================
 */
router.get("/blast/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const blast = await Blast.findById(id)
      .populate("userId", "username")
      .lean();

    if (!blast) {
      return res.status(404).json({ ok: false, message: "Blast tidak ditemukan" });
    }

    // 🔍 Kalau blast pakai random template, tampilkan semua template-nya
    const isRandom = blast.meta?.randomTemplate;
    const messageContent = isRandom
      ? blast.templates?.join("\n\n---\n\n") || "(Tidak ada template)"
      : blast.content?.text || "(Tidak ada isi pesan)";

    const details = {
      _id: blast._id,
      campaignName:
        isRandom
          ? `Blast Random (${blast.templates?.length || 0} template)`
          : blast.content?.text?.substring(0, 80) || "(Tanpa Judul)",
      message: messageContent,
      username: blast.userId?.username || "Tanpa Pemilik",
      scheduledAt: blast.schedule || blast.startTime || blast.createdAt,
      targetCount: blast.recipients?.length || 0,
      totals: blast.totals || {},
      status: blast.status,
      createdAt: blast.createdAt,
      isRandom,
    };

    res.json({ ok: true, details });
  } catch (err) {
    console.error("❌ /api/admin/blast/:id error:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil detail blast" });
  }
});

/**
 * ======================================================
 * 👥 GET /api/admin/blast/:id/targets
 * Daftar kontak tujuan blast (termasuk fallback kalau belum ada MessageLog)
 * ======================================================
 */
router.get("/blast/:id/targets", async (req, res) => {
  try {
    const { id } = req.params;

    // 🔍 Cari semua log pesan berdasarkan blastId
    const targets = await MessageLog.aggregate([
      { $match: { blastId: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "contacts",
          let: { num: "$to" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$waNumber", "$$num"] },
                    { $eq: ["$waNumber", { $concat: ["62", { $substr: ["$$num", 1, -1] }] }] },
                    { $eq: ["$waNumber", { $concat: ["0", { $substr: ["$$num", 2, -1] }] }] },
                    { $eq: ["$waNumber", { $substr: ["$$num", 2, -1] }] },
                  ],
                },
              },
            },
          ],
          as: "contact",
        },
      },
      { $unwind: { path: "$contact", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ["$contact.name", "$recipientName"] },
          waNumber: "$to",
          school: "$contact.school",
          kelas: "$contact.kelas",
          tahunLulus: "$contact.tahunLulus",
          message: 1,
          status: 1,
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    // ✅ Kalau messageLogs kosong → fallback ke blast.recipients tapi join ke contacts
    if (targets.length === 0) {
      const blast = await Blast.findById(id).lean();
      if (!blast) return res.status(404).json({ ok: false, message: "Blast tidak ditemukan" });

      // Ambil semua nomor dari recipients
      const phones = (blast.recipients || []).map((r) => r.phone);

      // Ambil kontak yang matching berdasarkan waNumber
      const contacts = await mongoose.model("Contact").find({
        waNumber: { $in: phones },
      }).lean();

      const contactMap = new Map(contacts.map(c => [c.waNumber, c]));

      const fallbackTargets = (blast.recipients || []).map((r) => {
        const c = contactMap.get(r.phone) || {};
        return {
          name: r.name || c.name || "-",
          waNumber: r.phone,
          school: c.school || "",
          kelas: c.kelas || "",
          tahunLulus: c.tahunLulus || "",
          message: blast.content?.text || "",
          status: r.status || "pending",
          createdAt: r.timestamps?.queuedAt || blast.createdAt,
        };
      });

      return res.json({ ok: true, targets: fallbackTargets });
    }

    // ✅ Kalau ada messageLogs, kirim hasil agregasi aslinya
    res.json({ ok: true, targets });
  } catch (err) {
    console.error("❌ /api/admin/blast/:id/targets error:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil target blast" });
  }
});

module.exports = router;
