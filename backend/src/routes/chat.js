const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const router = express.Router();

const MessageLog = require("../models/MessageLog");
const Chat = require("../models/Chat");
const { authenticateToken } = require("../middleware/auth");
const wa = require("../services/wa");

// ==========================
// Semua route chat butuh login
// ==========================
router.use(authenticateToken);

// ===============================
// 📎 Ambil media dari chat (FIXED)
// ===============================
router.get("/:waNumber/media", authenticateToken, async (req, res) => {
  try {
    const { waNumber } = req.params;
    const { type } = req.query;

    const filter = { waNumber };

    // 🎯 Bedain berdasarkan kategori
    if (type === "media") {
      // hanya image / video / audio
      filter.fileUrl = { $ne: null };
      filter.mimeType = { $regex: "^(image|video|audio)/", $options: "i" };
    } else if (type === "document") {
      // semua file yang bukan image/video/audio
      filter.fileUrl = { $ne: null };
      filter.mimeType = { $not: { $regex: "^(image|video|audio)/", $options: "i" } };
    } else if (type === "link") {
      // pesan teks yang mengandung tautan
      filter.fileUrl = null;
      filter.message = { $regex: "https?://", $options: "i" };
    }

    const medias = await Chat.find(filter)
      .sort({ createdAt: -1 })
      .select("fileUrl fileName mimeType createdAt message");

    console.log("📤 Hasil query media:", filter, "->", medias.length, "item");

    res.json({ ok: true, medias });
  } catch (err) {
    console.error("❌ Error get media:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ==========================
// 🗂️ Konfigurasi penyimpanan file (multer)
// ==========================
const baseUploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(baseUploadDir)) fs.mkdirSync(baseUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subDir = "files";

    if (file.mimetype.startsWith("image/")) subDir = "images";
    else if (file.mimetype.startsWith("video/")) subDir = "videos";
    else if (file.mimetype.startsWith("audio/")) subDir = "audios";
    else if (file.mimetype === "application/pdf") subDir = "docs";

    const dest = path.join(baseUploadDir, subDir);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// ==========================
// 📜 GET /api/chat/history/:waNumber
// ==========================
router.get("/history/:waNumber", async (req, res) => {
  try {
    const { waNumber } = req.params;
    if (!waNumber) {
      return res.status(400).json({ ok: false, message: "waNumber required" });
    }

    const userObjectId = new mongoose.Types.ObjectId(req.user.id || req.user._id);

    const chats = await Chat.find({ userId: userObjectId, waNumber })
      .sort({ createdAt: 1 })
      .lean();

    const logs = await MessageLog.find({ userId: userObjectId, to: waNumber }).lean();

    const logMap = {};
    logs.forEach((log) => {
      if (log.providerId) logMap[log.providerId] = log;
    });

    const result = chats.map((c) => {
      let status = c.status || "pending";
      let providerId = c.providerId || null;

      if (c.direction === "out") {
        if (providerId && logMap[providerId]) {
          status = logMap[providerId].status || status;
        } else {
          const log = logs.find(
            (l) =>
              l.to === waNumber &&
              l.message === c.message &&
              String(l.userId) === String(userObjectId)
          );
          if (log) {
            status = log.status || status;
            providerId = providerId || log.providerId || null;
          }
        }
      }

      return { ...c, status, providerId };
    });

    res.json({ ok: true, data: result });
  } catch (err) {
    console.error("❌ Error GET /chat/history:", err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

// ==========================
// 📩 POST /api/chat/send (teks / media)
// ==========================
router.post("/send", upload.single("file"), async (req, res) => {
  try {
    const { waNumber, message } = req.body;
    const file = req.file;

    if (!waNumber) {
      return res.status(400).json({
        ok: false,
        message: "Nomor WhatsApp (waNumber) wajib diisi.",
      });
    }

    // === Persiapan variabel ===
    let sent = null;
    let fileUrl = null;
    let fileName = null;
    let mimeType = null;

    // === Jika pesan berisi file ===
    if (file) {
      const BASE_URL = process.env.BASE_URL || "http://10.10.30.13:3001";
      fileName = file.originalname;
      mimeType = file.mimetype;

      // Buat path publik untuk FE (tanpa encode aneh)
      const relPath = path.relative(baseUploadDir, file.path).replace(/\\/g, "/");
      fileUrl = `${BASE_URL}/uploads/${relPath}`;

      // Kirim file via Baileys
      const buffer = fs.readFileSync(file.path);
      sent = await wa.sendMedia(
        req.user.id,
        waNumber,
        buffer,
        mimeType,
        file.originalname,
        message || ""
      );
    } else {
      // === Jika pesan teks biasa ===
      if (!message || message.trim() === "") {
        return res.status(400).json({ ok: false, message: "Pesan teks wajib diisi jika tidak ada file." });
      }
      sent = await wa.sendText(req.user.id, waNumber, message.trim());
    }

    const providerId = sent?.key?.id || sent?.providerId || null;

    // === Simpan ke MongoDB ===
    const chatDoc = await Chat.create({
      userId: req.user.id,
      waNumber,
      message: message || (file ? "[Media]" : ""),
      fileUrl,
      fileName,
      mimeType,
      direction: "out",
      providerId,
      status: "sent",
      read: false,
      assignedTo: req.user.id,
    });

    // === Emit realtime ke FE via socket.io ===
    if (req.io) {
      req.io.to(req.user.id.toString()).emit("chat:new", {
        ...chatDoc.toObject(),
        fromSelf: true,
      });
    }

    res.json({
      ok: true,
      data: chatDoc,
    });
  } catch (err) {
    console.error("❌ Error POST /chat/send:", err);
    res.status(500).json({
      ok: false,
      message: "Internal server error",
      error: err.message,
    });
  }
});

// ==========================
// 📞 GET /api/chat/contacts
// ==========================
router.get("/contacts", async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id || req.user._id);

    const contacts = await Chat.aggregate([
      { $match: { userId: userObjectId } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: "$waNumber",
          lastMessage: { $last: "$message" },
          lastDirection: { $last: "$direction" },
          lastAt: { $last: "$createdAt" },
        },
      },
      { $sort: { lastAt: -1 } },
      {
        $lookup: {
          from: "contacts",
          let: { wa: "$_id", uid: userObjectId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$waNumber", "$$wa"] },
                    { $eq: ["$userId", "$$uid"] },
                  ],
                },
              },
            },
          ],
          as: "contactInfo",
        },
      },
      {
        $addFields: {
          name: { $arrayElemAt: ["$contactInfo.name", 0] },
        },
      },
    ]);

    const unreadCounts = await Chat.aggregate([
      {
        $match: {
          userId: userObjectId,
          direction: "in",
          read: false,
        },
      },
      { $group: { _id: "$waNumber", total: { $sum: 1 } } },
    ]);

    const unreadMap = unreadCounts.reduce((acc, u) => {
      acc[u._id] = u.total;
      return acc;
    }, {});

    const withUnread = contacts.map((c) => ({
      ...c,
      unread: unreadMap[c._id] || 0,
    }));

    res.json({ ok: true, data: withUnread });
  } catch (err) {
    console.error("❌ Error GET /chat/contacts:", err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

// ==========================
// ✅ POST /api/chat/read/:waNumber
// ==========================
router.post("/read/:waNumber", async (req, res) => {
  try {
    const { waNumber } = req.params;
    const userObjectId = new mongoose.Types.ObjectId(req.user.id || req.user._id);

    await Chat.updateMany(
      { userId: userObjectId, waNumber, direction: "in", read: false },
      { $set: { read: true } }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error POST /chat/read:", err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

// ==========================
// 🔔 GET /api/chat/unread
// ==========================
router.get("/unread", async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id || req.user._id);

    const count = await Chat.countDocuments({
      userId: userObjectId,
      direction: "in",
      read: false,
    });

    res.json({ ok: true, totalUnread: count });
  } catch (err) {
    console.error("❌ Error GET /chat/unread:", err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

// ==========================
// 🔍 GET /api/chat/search?q=...
// ==========================
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === "") {
      return res.json({ ok: true, data: [] });
    }

    const userObjectId = new mongoose.Types.ObjectId(req.user.id || req.user._id);

    const results = await Chat.aggregate([
      {
        $match: {
          userId: userObjectId,
          message: { $regex: q, $options: "i" },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$waNumber",
          lastMatch: { $first: "$message" },
          lastAt: { $first: "$createdAt" },
        },
      },
      {
        $lookup: {
          from: "contacts",
          let: { wa: "$_id", uid: userObjectId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$waNumber", "$$wa"] },
                    { $eq: ["$userId", "$$uid"] },
                  ],
                },
              },
            },
          ],
          as: "contactInfo",
        },
      },
      {
        $addFields: {
          name: { $arrayElemAt: ["$contactInfo.name", 0] },
        },
      },
      { $project: { contactInfo: 0 } },
      { $sort: { lastAt: -1 } },
    ]);

    res.json({ ok: true, data: results });
  } catch (err) {
    console.error("❌ Error GET /chat/search:", err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

// ==========================
// 🗑️ DELETE /api/chat/:id
// ==========================
router.delete("/:id", async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!chat) {
      return res.status(404).json({ ok: false, message: "Chat tidak ditemukan." });
    }

    res.json({ ok: true, message: "Chat berhasil dihapus." });
  } catch (err) {
    console.error("❌ Error DELETE /chat/:id:", err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

module.exports = router;