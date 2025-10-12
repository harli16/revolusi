const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const router = express.Router();
const MessageLog = require("../models/MessageLog");
const { authenticateToken } = require("../middleware/auth");

const Chat = require("../models/Chat");
const wa = require("../services/wa");

// Konfigurasi multer (simpen file di memory, max 15MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ==========================
// Semua route chat butuh login
// ==========================
router.use(authenticateToken);

/**
 * @route   GET /api/chat/history/:waNumber
 * @desc    Ambil riwayat chat dengan kontak tertentu
 */
// routes/chat.js

router.get("/history/:waNumber", async (req, res) => {
  try {
    const { waNumber } = req.params;
    if (!waNumber) {
      return res.status(400).json({ ok: false, message: "waNumber required" });
    }

    const userObjectId = new mongoose.Types.ObjectId(req.user.id || req.user._id);

    // Ambil semua chat
    const chats = await Chat.find({
      userId: userObjectId,
      waNumber,
    }).sort({ createdAt: 1 }).lean();

    // Ambil semua log WA untuk kontak ini
    const logs = await MessageLog.find({
      userId: userObjectId,
      to: waNumber,
    }).lean();

    // Bikin map cepat dari providerId
    const logMap = {};
    logs.forEach((log) => {
      if (log.providerId) logMap[log.providerId] = log;
    });

    // Gabungkan status ke chat out (utamakan data dari Chat)
    const result = chats.map((c) => {
      // ambil nilai asli dari Chat dulu
      let status = c.status || "pending";
      let providerId = c.providerId || null;

      if (c.direction === "out") {
        // Kalau punya providerId dan ada di logMap → sinkronin status
        if (providerId && logMap[providerId]) {
          status = logMap[providerId].status || status;
        } else {
          // fallback: cari log manual berdasarkan pesan & tujuan
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

      return {
        ...c,
        status,
        providerId,
      };
    });

    res.json({ ok: true, data: result });
  } catch (err) {
    console.error("❌ Error GET /chat/history:", err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

/**
 * @route   POST /api/chat/send
 * @desc    Kirim balasan chat (teks/media)
 */
router.post("/send", upload.single("file"), async (req, res) => {
  try {
    const { waNumber, message } = req.body;
    const file = req.file;

    if (!waNumber && !file) {
      return res.status(400).json({
        ok: false,
        message: "waNumber required, message/file required",
      });
    }

    let sent;
    if (file) {
      sent = await wa.sendMedia(
        req.user.id,
        waNumber,
        file.buffer,
        file.mimetype,
        file.originalname,
        message || ""
      );
    } else {
      if (!message) {
        return res
          .status(400)
          .json({ ok: false, message: "Message required for text send" });
      }
      sent = await wa.sendText(req.user.id, waNumber, message);
    }

    // ✅ Ambil providerId (dari Baileys response)
    const providerId = sent?.key?.id || sent?.providerId || null;

    // ✅ Simpan ke Chat DB
    await Chat.create({
      userId: req.user.id,
      waNumber,
      message: message || (file ? "[Media]" : ""),
      direction: "out",
      providerId,
      status: "sent", // langsung set sent
      read: false,
      assignedTo: req.user.id,
    });

    // ✅ Emit event realtime ke FE (optional)
    if (req.io) {
      req.io.to(req.user.id.toString()).emit("chat:new", {
        waNumber,
        message,
        direction: "out",
        providerId,
        status: "sent",
        fromSelf: true,
      });
    }

    res.json({
      ok: true,
      data: {
        waNumber,
        message: message || (file ? "[Media]" : ""),
        direction: "out",
        providerId,
      },
    });
  } catch (err) {
    console.error("❌ Error POST /chat/send:", err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

/**
 * @route   GET /api/chat/contacts
 * @desc    Ambil daftar kontak unik + last message + unread count
 */
router.get("/contacts", async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(
      req.user.id || req.user._id
    );

    const contacts = await Chat.aggregate([
      { $match: { userId: userObjectId } },
      { $sort: { createdAt: 1 } }, // ✅ urutin dulu biar $last bener2 pesan terbaru
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

    // Tambahin unread count
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

/**
 * @route   POST /api/chat/read/:waNumber
 * @desc    Tandai semua pesan kontak ini jadi read:true
 */
router.post("/read/:waNumber", async (req, res) => {
  try {
    const { waNumber } = req.params;
    const userObjectId = new mongoose.Types.ObjectId(
      req.user.id || req.user._id
    );

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

/**
 * @route   GET /api/chat/unread
 * @desc    Ambil total unread semua kontak untuk user
 */
router.get("/unread", async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(
      req.user.id || req.user._id
    );

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

module.exports = router;
