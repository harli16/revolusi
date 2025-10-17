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
// Utils: Random Template (PATCHED)
// =========================
function pickMessage(templates, recipient, fallbackText, opts = {}) {
  if (!templates || templates.length === 0) {
    return applyPlaceholders(fallbackText || "", recipient);
  }

  const { randomEnabled, mode, perN, selectedTemplates, index } = opts;

  // 🔧 Normalisasi sumber template
  // - Jika templates adalah array string => anggap sudah dipre-filter oleh FE
  // - Jika templates berisi objek => boleh filter dgn selectedTemplates (ID / text)
  let sourceTemplates = templates;

  if (
    Array.isArray(selectedTemplates) &&
    selectedTemplates.length > 0 &&
    typeof templates[0] === "object"
  ) {
    const selectedSet = new Set(selectedTemplates.map(String));
    sourceTemplates = templates.filter((t) => {
      const key =
        (t && t._id && String(t._id)) ||
        (t && t.id && String(t.id)) ||
        (t && t.text) ||
        (t && t.message) ||
        String(t);
      return selectedSet.has(key);
    });
  }

  // kalau setelah filter kosong, fallback ke templates awal
  if (!sourceTemplates || sourceTemplates.length === 0) {
    sourceTemplates = templates;
  }

  // ambil string pesan dari entry (objek/teks)
  const getText = (tpl) => {
    if (typeof tpl === "string") return tpl;
    if (!tpl || typeof tpl !== "object") return "";
    return tpl.text || tpl.message || String(tpl);
  };

  let chosen = "";

  if (randomEnabled) {
    if (mode === "per_n" && perN > 0) {
      const blockIndex =
        Math.floor((index || 0) / perN) % sourceTemplates.length;
      chosen = getText(sourceTemplates[blockIndex]);
    } else if (mode === "per_message") {
      chosen = getText(
        sourceTemplates[
          Math.floor(Math.random() * sourceTemplates.length)
        ]
      );
    } else {
      chosen = getText(
        sourceTemplates[
          Math.floor(Math.random() * sourceTemplates.length)
        ]
      );
    }
  } else {
    chosen = getText(sourceTemplates[0]);
  }

  if (!chosen || String(chosen).trim() === "") {
    chosen = fallbackText || "";
  }

  return applyPlaceholders(chosen, recipient);
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
    blast.endTime = new Date(); // 🏁 waktu selesai blast
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
    // 🔧 Normalisasi dan validasi nomor
    function normalizePhone(raw) {
      if (!raw && raw !== 0) return "";
      let phoneStr = String(raw).trim();

      // Deteksi format scientific (misal 8.82E+11) → langsung invalid
      if (/e/i.test(phoneStr)) return "";

      // Hapus karakter non-digit
      phoneStr = phoneStr.replace(/\D/g, "");

      // Invalid kalau terlalu pendek
      if (!phoneStr || phoneStr.length < 9 || phoneStr.length > 15) return "";

      // Formatkan prefix Indonesia
      if (phoneStr.startsWith("62")) return phoneStr;
      if (phoneStr.startsWith("0")) return "62" + phoneStr.slice(1);
      if (phoneStr.startsWith("8")) return "62" + phoneStr;
      return "";
    }

    // 🧩 Buat daftar recipients (valid + failed)
    const recipients = [];
    const failedRecipients = [];

    for (const c of contacts || []) {
      const rawInput = c.phone || c.waNumber;
      if (!rawInput || String(rawInput).trim() === "") {
        // ⚠️ Nomor kosong → di-skip total
        continue;
      }

      const phone = normalizePhone(rawInput);

        if (!phone) {
        // ❌ Nomor rusak / format Excel salah → langsung tandai failed
        failedRecipients.push({
          phone: rawInput,
          name: c.name || "-",
          school: c.school || "",
          kelas: c.kelas || "",
          lulus: c.lulus || "",
          status: "failed",
          timestamps: { failedAt: new Date() },
          error: {
            code: "INVALID_NUMBER",
            message: "Bukan Nomor WhatsApp (format salah atau rusak dari Excel)",
          },
        });

        // ⚠️ Tambahan log agar mudah dilacak di terminal
        console.warn(
          `⚠️ Invalid nomor terdeteksi dari Excel: "${rawInput}" → ditandai failed (Bukan Nomor WhatsApp)`
        );

        continue;
      }

      // ✅ Nomor valid → masuk daftar untuk dikirim
      recipients.push({
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
      });
    }

    if (recipients.length === 0 && failedRecipients.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "Tidak ada nomor valid di file Excel.",
      });
    }

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
        ...failedRecipients, // tambahkan failed langsung di DB
      ],
      totals: {
        queued: batchRecipients.length,
        sent: 0,
        failed: failedRecipients.length, // hitung failed awal
        delivered: 0,
        read: 0,
        cancelled: 0,
      },
      delayMin,
      delayMax,
      pauseEvery,
      pauseDuration,
      maxPerBatch,
      maxPerDay,
      schedule: schedule ? new Date(schedule) : null,
      startTime: new Date(), // ⏰ waktu mulai blast
      meta: {
        ip: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        randomTemplate: Boolean(req.body?.randomTemplate),
        randomMode: ["per_message", "per_n"].includes(req.body?.randomMode)
          ? req.body.randomMode
          : "per_message",
        perN: Number(req.body?.perN) > 0 ? Number(req.body.perN) : 0,
        selectedTemplates: Array.isArray(req.body?.selectedTemplates)
          ? req.body.selectedTemplates
          : [],
        // otomatis biar keliatan rapih di DB & FE
        summary: Boolean(req.body?.randomTemplate)
          ? `Mode: ${req.body?.randomMode || "per_message"}, perN: ${
              req.body?.perN || 0
            }, Templates: ${(req.body?.selectedTemplates || []).length}`
          : "Random nonaktif",
      },
    });
    console.log("🚀 [NEW BLAST]", {
      user: req.user.username || req.user.id,
      id: blast._id.toString(),
      totalRecipients: recipients.length,
      queued: batchRecipients.length,
      pending: deferredRecipients.length,
      random: blast.meta?.randomTemplate
        ? `${blast.meta.randomMode} (perN=${blast.meta.perN})`
        : "off",
      templates: templates?.length || 0,
      startTime: blast.startTime, // 🕓 tampilkan di log
    });

    if (!schedule) {
    // 🔧 ambil opsi random template dari FE (opsional)
    const randomEnabled = req.body?.randomTemplate === true;                 // boolean
    const randomMode = req.body?.randomMode || "per_message";                // "per_message" | "per_n"
    const perN = Number(req.body?.perN || 0);                                // angka untuk mode per_n
    const selectedTemplates = Array.isArray(req.body?.selectedTemplates)     // subset template yg dicentang
      ? req.body.selectedTemplates
      : [];

    // proses batch yg langsung dikirim (queued)
    for (const [idx, rec] of batchRecipients.entries()) {
      // 🎲 Pilih isi pesan sesuai mode random
      const msg = pickMessage(
        templates,
        rec,
        content?.text,
        {
          randomEnabled: req.body?.randomTemplate === true,
          mode: req.body?.randomMode || "per_message", // bisa "per_message" atau "per_n"
          perN: Number(req.body?.perN) || 0,
          selectedTemplates: Array.isArray(req.body?.selectedTemplates)
            ? req.body.selectedTemplates
            : [],
          index: idx, // index penerima di batch (penting untuk mode per_n)
        }
      );
      
      // 📝 Simpan log pesan
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

      // ✅ Update atau buat kontak baru
      await Contact.updateOne(
        { userId: req.user.id, waNumber: rec.phone },
        {
          $set: {
            name: toTitleCase(rec.name || rec.phone),
            school: (rec.school || "").toUpperCase(),
            kelas: (rec.kelas || "").toUpperCase(),
            tahunLulus: rec.lulus || rec.tahunLulus || "",
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );


      // 🚀 Tambah job ke queue (media atau teks)
      const jobBase = {
        userId: req.user.id,
        to: rec.phone,
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
      };

      if (content?.mediaUrl) {
        // === Kirim Media / Dokumen ===
        const filePath = path.join(__dirname, "..", "uploads", content.mediaUrl);
        const fileBuf = fs.readFileSync(filePath);

        queue.addJob({
          ...jobBase,
          type: "media",
          fileBuf,
          mimetype: content?.mimetype || "application/octet-stream",
          filename: content.mediaUrl,
          caption: msg, // 🔥 caption ikut hasil random template
        });
        // ===========================
        // 💬 Simpan ke koleksi Chat (biar muncul di Live Chat user)
        // ===========================
        try {
          const Chat = require("../models/Chat");
          await Chat.create({
            userId: req.user.id,
            waNumber: rec.phone,
            message: msg,
            direction: "out",
            read: true, // karena dikirim sendiri
            assignedTo: req.user.id,
            createdAt: new Date(),
          });

          // 🔥 Emit ke socket Live Chat user biar realtime juga
          const io = req.app.get("io");
          if (io) {
            io.to(String(req.user.id)).emit("chat:new", {
              waNumber: rec.phone,
              message: msg,
              direction: "out",
              fromSelf: true,
              createdAt: new Date(),
              status: "sent",
            });
          }
        } catch (err) {
          console.error("❌ Gagal insert Chat dari blast:", err.message);
        }
      } else {
        // === Kirim Pesan Teks ===
        queue.addJob({
          ...jobBase,
          type: "text",
          message: msg, // 🔥 isi pesan hasil random template
        });

        // ===========================
        // 💬 Simpan ke koleksi Chat (biar muncul di Live Chat user)
        // ===========================
        try {
          const Chat = require("../models/Chat");
          await Chat.create({
            userId: req.user.id,
            waNumber: rec.phone,
            message: msg,
            direction: "out",
            read: true,
            assignedTo: req.user.id,
            createdAt: new Date(),
          });

          const io = req.app.get("io");
          if (io) {
            io.to(String(req.user.id)).emit("chat:new", {
              waNumber: rec.phone,
              message: msg,
              direction: "out",
              fromSelf: true,
              createdAt: new Date(),
              status: "sent",
            });
          }
        } catch (err) {
          console.error("❌ Gagal insert Chat dari blast:", err.message);
        }
      }
      // 🔍 Optional log untuk debug
      console.log(
        `📨 [QUEUE ADD] to=${rec.phone}, mode=${req.body?.randomMode}, templatePreview="${msg.slice(0, 50)}..."`
      );
    }
  }
  console.log(
    `🚀 [NEW BLAST] user=${req.user.username || req.user.id}, total=${recipients.length}, batch=${batchRecipients.length}, pending=${deferredRecipients.length}, random=${req.body?.randomTemplate}, mode=${req.body?.randomMode}`
  );
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
// CONTINUE pending batch (lanjutkan batch tertunda)
// ===========================
router.post("/continue/:blastId", authenticateToken, async (req, res) => {
  try {
    const blast = await Blast.findById(req.params.blastId);
    if (!blast) {
      return res.status(404).json({ ok: false, message: "Blast not found" });
    }

    const pendingRecipients = blast.recipients.filter((r) => r.status === "pending");
    if (pendingRecipients.length === 0) {
      return res.json({
        ok: false,
        message: "Tidak ada recipients pending untuk dilanjutkan.",
      });
    }

    // 🔥 Hitung berapa yang sudah terkirim sebelumnya
    const prevCount = blast.recipients.filter((r) =>
      ["sent", "delivered", "read", "played", "failed"].includes(r.status)
    ).length;

    console.log(
      `▶️ [CONTINUE] Blast ${blast._id} | User=${blast.userId} | Mode=${blast.meta?.randomMode} | Pending=${pendingRecipients.length} | MulaiIndex=${prevCount}`
    );

    let resumedCount = 0;
    let index = prevCount;

    for (const rec of pendingRecipients) {
      const msg = pickMessage(blast.templates, rec, blast.content?.text, {
        randomEnabled: blast.meta?.randomTemplate || false,
        mode: blast.meta?.randomMode || "per_message",
        perN: blast.meta?.perN || 0,
        selectedTemplates: blast.meta?.selectedTemplates || [],
        index,
      });

      console.log(
        `🎲 [RANDOM] index=${index}, mode=${blast.meta?.randomMode}, perN=${blast.meta?.perN}, to=${rec.phone}, templatePreview="${msg.slice(0, 60)}..."`
      );

      index++;

      const log = await MessageLog.create({
        userId: blast.userId,
        blastId: blast._id,
        to: rec.phone,
        recipientName: rec.name,
        message: msg,
        status: "queued",
        createdAt: new Date(),
      });

      // 🔧 Tambahan log tiap job dimasukkan ke queue
      console.log(
        `📨 [QUEUE ADD] to=${rec.phone}, jobType=${blast.content?.mediaUrl ? "media" : "text"}`
      );

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
        {
          $set: {
            "recipients.$.status": "queued",
            "recipients.$.timestamps.queuedAt": new Date(),
          },
        }
      );

      resumedCount++;
    }

    console.log(`✅ [CONTINUE DONE] Blast ${blast._id} | TotalResumed=${resumedCount}`);

    res.json({ ok: true, resumed: resumedCount });
  } catch (err) {
    console.error("❌ Blast continue error:", err);
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