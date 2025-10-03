// routes/blasts.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const Blast = require("../models/Blast");
const Contact = require("../models/Contact");
const MessageLog = require("../models/MessageLog");
const { authenticateToken } = require("../middleware/auth");
const { applyPlaceholders } = require("../utils/placeholder");
const { toTitleCase } = require("../utils/string");
const queue = require("../services/queue");

// =========================
// Utils
// =========================
function pickMessage(templates, recipient, fallbackText) {
  let msg;
  if (templates && templates.length > 0) {
    msg = templates[Math.floor(Math.random() * templates.length)];
  } else {
    msg = fallbackText || "";
  }
  return applyPlaceholders(msg, recipient);
}

// ===========================
// STOP blast
// ===========================
router.post("/:blastId/stop", authenticateToken, async (req, res) => {
  try {
    const blast = await Blast.findById(req.params.blastId);
    if (!blast) {
      return res.status(404).json({ ok: false, message: "Blast not found" });
    }

    if (["stopped", "cancelled"].includes(blast.status)) {
      return res.json({
        ok: true,
        message: "Blast sudah dihentikan sebelumnya",
        stopped: 0,
        status: blast.status,
      });
    }

    let stoppedCount = 0;
    blast.recipients.forEach((r) => {
      if (["queued", "pending"].includes(r.status)) {
        r.status = "cancelled";
        stoppedCount++;
      }
    });

    blast.status = "stopped";
    await blast.save();

    console.log(
      `🚫 Blast ${blast._id} dihentikan. ${stoppedCount} recipient dibatalkan.`
    );

    return res.json({
      ok: true,
      message: "Blast berhasil dihentikan",
      stopped: stoppedCount,
      status: blast.status,
    });
  } catch (err) {
    console.error("❌ Stop blast error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ===========================
// PAUSE blast
// ===========================
router.post("/:blastId/pause", authenticateToken, async (req, res) => {
  try {
    const blast = await Blast.findById(req.params.blastId);
    if (!blast) {
      return res.status(404).json({ ok: false, message: "Blast not found" });
    }

    if (blast.status === "paused") {
      return res.json({ ok: true, message: "Blast sudah dijeda", status: blast.status });
    }

    blast.status = "paused";
    await blast.save();

    console.log(`⏸️ Blast ${blast._id} dijeda user.`);

    return res.json({ ok: true, message: "Blast berhasil dijeda", status: blast.status });
  } catch (err) {
    console.error("❌ Pause blast error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ===========================
// RESUME blast
// ===========================
router.post("/:blastId/resume", authenticateToken, async (req, res) => {
  try {
    const blast = await Blast.findById(req.params.blastId);
    if (!blast) {
      return res.status(404).json({ ok: false, message: "Blast not found" });
    }

    if (blast.status === "active") {
      return res.json({ ok: true, message: "Blast sudah aktif", status: blast.status });
    }

    blast.status = "active";
    await blast.save();

    console.log(`▶️ Blast ${blast._id} dilanjutkan user.`);

    return res.json({ ok: true, message: "Blast berhasil dilanjutkan", status: blast.status });
  } catch (err) {
    console.error("❌ Resume blast error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ===========================
// LIST ringkas
// ===========================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { userId, from, to, page = 1, limit = 20 } = req.query;
    const match = {};
    if (userId) match.userId = userId;
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const p = parseInt(page);
    const l = Math.min(parseInt(limit), 100);

    const [items, total] = await Promise.all([
      Blast.find(match)
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .select("userId content.text content.mediaUrl templates totals createdAt schedule channel type")
        .populate("userId", "username role")
        .lean(),
      Blast.countDocuments(match),
    ]);

    res.json({ ok: true, page: p, limit: l, total, items });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// ===========================
// DETAIL (dengan recipients)
// ===========================
router.get("/:blastId", authenticateToken, async (req, res) => {
  try {
    const blast = await Blast.findById(req.params.blastId)
      .populate("userId", "username role")
      .lean();
    if (!blast) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true, blast });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// 🔥 Normalisasi nomor HP
function normalizePhone(raw) {
  if (!raw) return "";
  let phoneStr = String(raw).trim().replace(/\D/g, ""); // buang non-digit

  // Kalau sudah +62 / 62 di depan
  if (phoneStr.startsWith("62")) return phoneStr;
  if (phoneStr.startsWith("0")) return "62" + phoneStr.slice(1);

  // Kalau cuma "818xxx" (tanpa 0 di depan), tambahin 62
  if (phoneStr.startsWith("8")) return "62" + phoneStr;

  return phoneStr;
}


// ===========================
// CREATE blast + enqueue
// ===========================
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      templates,
      content,
      contacts,
      delayMin,
      delayMax,
      pauseEvery,
      pauseDuration,
      maxPerBatch,
      maxPerDay,
      schedule,
    } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sentToday = await MessageLog.countDocuments({
      userId: req.user.id,
      createdAt: { $gte: today, $lt: tomorrow },
      status: { $in: ["sent", "delivered", "read"] },
    });
    console.log("🚀 Contacts diterima dari FE:", contacts);
    // 🔥 Recipients dipastikan nomor hp valid string
    const recipients = (contacts || []).map((c) => {
      const phone = normalizePhone(c.phone || c.waNumber);

      return {
        phone,
        name: c.name || phone,
        school: c.school || "",
        lulus: c.lulus || "",
        beasiswa: c.beasiswa || "",
        kelas: c.kelas || "",
        prestasi: c.prestasi || "",
        orangtua: c.orangtua || "",
        birthdate: c.birthdate || "",
        status: "queued",
        timestamps: { queuedAt: new Date() },
      };
    });
    console.log("🚀 Recipients final sebelum simpan:", recipients);
    if (maxPerDay && sentToday >= maxPerDay) {
      return res.status(400).json({
        ok: false,
        message: `Batas harian sudah tercapai (${sentToday}/${maxPerDay})`,
      });
    }

    const batchLimit =
      maxPerBatch && maxPerBatch > 0 ? maxPerBatch : recipients.length;
    const batchRecipients = recipients.slice(0, batchLimit);
    const deferredRecipients = recipients.slice(batchLimit);

    let availableQuota = maxPerDay ? maxPerDay - sentToday : recipients.length;
    if (availableQuota < batchRecipients.length) {
      deferredRecipients.push(...batchRecipients.splice(availableQuota));
    }

    const blast = await Blast.create({
      userId: req.user.id,
      templates,
      content,
      recipients: [
        ...batchRecipients.map((r) => ({ ...r, status: "queued" })),
        ...deferredRecipients.map((r) => ({ ...r, status: "pending" })),
      ],
      totals: {
        queued: batchRecipients.length,
        sent: 0,
        failed: 0,
        delivered: 0,
        read: 0,
      },
      delayMin,
      delayMax,
      pauseEvery,
      pauseDuration,
      maxPerBatch,
      maxPerDay,
      schedule: schedule ? new Date(schedule) : null,
      meta: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    if (!schedule) {
      for (const rec of batchRecipients) {
        const msg = pickMessage(templates, rec, content?.text);

        const log = await MessageLog.create({
          userId: req.user.id,
          blastId: blast._id,
          to: rec.phone,
          recipientName: rec.name,
          message: msg,
          mediaUrl: content?.mediaUrl || null,
          status: "queued",
          createdAt: new Date(),
        });

        // ✅ Simpan ke Contacts biar LiveChat bisa ambil nama + sekolah + kelas
        await Contact.updateOne(
          { userId: req.user.id, waNumber: rec.phone }, // cari kontak existing
          {
            $set: {
              name: toTitleCase(rec.name || rec.phone), // 🔥 nama konsisten Title Case
              school: (rec.school || "").toUpperCase(), // tetap CAPS
              kelas: (rec.kelas || "").toUpperCase(),   // tetap CAPS
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        );

        if (content?.mediaUrl) {
          const filePath = path.join(__dirname, "..", "uploads", content.mediaUrl);
          const fileBuf = fs.readFileSync(filePath);

          queue.addJob({
            type: "media",
            userId: req.user.id,
            to: rec.phone,
            fileBuf,
            mimetype: content?.mimetype || "application/octet-stream",
            filename: content.mediaUrl,
            caption: msg,
            blastId: blast._id,
            logId: log._id,
            delay: {
              mode: delayMin !== delayMax ? "random" : "fixed",
              min: delayMin,
              max: delayMax,
              value: delayMin,
            },
            pauseEvery,
            pauseDuration,
            maxPerBatch,
          });
        } else {
          queue.addJob({
            type: "text",
            userId: req.user.id,
            to: rec.phone,
            message: msg,
            blastId: blast._id,
            logId: log._id,
            delay: {
              mode: delayMin !== delayMax ? "random" : "fixed",
              min: delayMin,
              max: delayMax,
              value: delayMin,
            },
            pauseEvery,
            pauseDuration,
            maxPerBatch,
          });
        }
      }
    }

    res.json({ ok: true, blastId: blast._id });
  } catch (e) {
    console.error("Blast create error:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// ===========================
// UPDATE recipient status
// ===========================
router.post("/:blastId/status", authenticateToken, async (req, res) => {
  try {
    const { phone, status } = req.body;

    const blast = await Blast.findById(req.params.blastId);
    if (!blast) return res.status(404).json({ ok: false, message: "Blast not found" });

    const recipient = blast.recipients.find((r) => r.phone === phone);
    if (!recipient) return res.status(404).json({ ok: false, message: "Recipient not found" });

    recipient.status = status;
    recipient.timestamps[`${status}At`] = new Date();

    if (!blast.totals) blast.totals = {};
    if (["sent", "delivered", "read", "played", "failed"].includes(status)) {
      blast.totals[status] = (blast.totals[status] || 0) + 1;
    }

    await blast.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ===========================
// CONTINUE pending batch
// ===========================
router.post("/continue/:blastId", authenticateToken, async (req, res) => {
  try {
    const blast = await Blast.findById(req.params.blastId);
    if (!blast) return res.status(404).json({ ok: false, message: "Blast not found" });

    const pendingRecipients = blast.recipients.filter((r) => r.status === "pending");

    if (pendingRecipients.length === 0) {
      return res.json({ ok: false, message: "Tidak ada recipients pending untuk dilanjutkan." });
    }

    let resumedCount = 0;

    for (const rec of pendingRecipients) {
      const msg = pickMessage(blast.templates, rec, blast.content?.text);

      const log = await MessageLog.create({
        userId: blast.userId,
        blastId: blast._id,
        to: rec.phone,
        recipientName: rec.name,
        message: msg,
        status: "queued",
        createdAt: new Date(),
      });

      queue.addJob({
        type: blast.content?.mediaUrl ? "media" : "text",
        userId: blast.userId,
        to: rec.phone,
        message: msg,
        blastId: blast._id,
        logId: log._id,
        delay: {
          mode: blast.delayMin !== blast.delayMax ? "random" : "fixed",
          min: blast.delayMin,
          max: blast.delayMax,
          value: blast.delayMin,
        },
        pauseEvery: blast.pauseEvery,
        pauseDuration: blast.pauseDuration,
        maxPerBatch: blast.maxPerBatch,
      });

      await Blast.updateOne(
        { _id: blast._id, "recipients.phone": rec.phone },
        { $set: { "recipients.$.status": "queued", "recipients.$.timestamps.queuedAt": new Date() } }
      );

      resumedCount++;
    }

    res.json({ ok: true, resumed: resumedCount });
  } catch (err) {
    console.error("Blast continue error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ===========================
// CANCEL blast
// ===========================
router.post("/:blastId/cancel", authenticateToken, async (req, res) => {
  try {
    const blast = await Blast.findById(req.params.blastId);
    if (!blast) {
      return res.status(404).json({ ok: false, message: "Blast not found" });
    }

    let cancelledCount = 0;
    blast.recipients.forEach((r) => {
      if (r.status === "queued" || r.status === "pending") {
        r.status = "cancelled";
        cancelledCount++;
      }
    });
    await blast.save();

    return res.json({ ok: true, cancelled: cancelledCount });
  } catch (err) {
    console.error("Cancel blast error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
