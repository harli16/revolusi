// routes/message.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const mime = require('mime');
const { authenticateToken } = require('../middleware/auth');
const { normalizePhone, isValidIndoNumber } = require('../utils/phone');
const MessageLog = require('../models/MessageLog');
const Contact = require("../models/Contact");
const Blast = require('../models/Blast');
const wa = require('../services/wa');
const queue = require('../services/queue'); // <-- queue in-memory yang lo pasang

// Multer: simpan file di memory (buffer), limit 15MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Semua route di bawah ini butuh auth
router.use(authenticateToken);

/**
 * ===========================
 * Kirim pesan teks (enqueue)
 * ===========================
 */
router.post('/send', async (req, res) => {
  console.log("🔥 /send dipanggil oleh:", req.user.id, req.user.username);
  let { number, message, name } = req.body || {};
  if (!number || !message) {
    return res.status(400).json({ ok: false, message: 'number and message required' });
  }

  // Normalisasi ke array penerima
  const numbers = Array.isArray(number) ? number : [number];
  const recipients = numbers
    .map((n, i) => {
      const to = normalizePhone(n);
      if (!isValidIndoNumber(to)) return null;
      return {
        phone: to,
        name: Array.isArray(name) ? name[i] : name || null,
        status: 'queued',
        timestamps: { queuedAt: new Date() },
      };
    })
    .filter(Boolean);

  if (!recipients.length) {
    return res.status(400).json({ ok: false, message: 'Invalid numbers' });
  }

  // Buat dokumen Blast
  const blast = await Blast.create({
    userId: req.user.id,
    type: recipients.length > 1 ? 'blast' : 'single',
    channel: 'whatsapp',
    content: { text: message },
    recipients,
    totals: { queued: recipients.length },
    meta: { ip: req.ip, userAgent: req.headers['user-agent'] },
  });

  // Update / insert kontak
  for (const rec of recipients) {
    await Contact.updateOne(
      { waNumber: rec.phone, userId: req.user.id },
      { $setOnInsert: { name: rec.name || rec.phone, userId: req.user.id } },
      { upsert: true }
    );
  }

  // Masukkan tiap penerima ke queue (buat MessageLog dulu)
  const queuedResults = [];
  for (const rec of recipients) {
    const log = await MessageLog.create({
      userId: req.user.id,
      to: rec.phone,
      recipientName: rec.name || null,
      message,
      status: "pending",
      timestamps: { queuedAt: new Date() },
    });

    // job shape: queue implementation lo yg bakal consume (text/media)
    const job = {
      type: "text",
      userId: req.user.id,
      to: rec.phone,
      message,
      blastId: blast._id,
      logId: log._id,
      BlastModel: Blast, // optional: queue worker bisa gunakan model ref untuk update
      MessageLogModel: MessageLog,
      meta: {
        queuedAt: new Date(),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    };

    queue.addJob(job);
    queuedResults.push({ phone: rec.phone, queued: true, logId: log._id });
  }

  res.json({ ok: true, blastId: blast._id, queued: queuedResults.length, items: queuedResults });
});

/**
 * ===========================
 * Kirim pesan media (enqueue)
 * ===========================
 */
router.post('/send-media', upload.single('file'), async (req, res) => {
  const { number, caption, name } = req.body || {};
  if (!number || !req.file) {
    return res.status(400).json({ ok: false, message: 'number dan file wajib' });
  }

  const to = normalizePhone(number);
  if (!isValidIndoNumber(to)) {
    return res.status(400).json({ ok: false, message: 'Invalid number' });
  }

  const fileBuf = req.file.buffer;
  const mimetype =
    req.file.mimetype ||
    mime.getType(req.file.originalname) ||
    'application/octet-stream';
  const filename =
    req.file.originalname ||
    `file.${mime.getExtension(mimetype) || 'bin'}`;

  const log = await MessageLog.create({
    userId: req.user.id,
    to,
    recipientName: name || null,
    message: caption || '',
    mediaUrl: filename,
    status: 'pending',
    timestamps: { queuedAt: new Date() },
  });

  const blast = await Blast.create({
    userId: req.user.id,
    type: 'single',
    channel: 'whatsapp',
    content: { text: caption || '', mediaUrl: filename, caption },
    recipients: [
      {
        phone: to,
        name: name || null,
        status: 'queued',
        timestamps: { queuedAt: new Date() },
      },
    ],
    totals: { queued: 1 },
    meta: { ip: req.ip, userAgent: req.headers['user-agent'] },
  });

  // enqueue job media
  const job = {
    type: "media",
    userId: req.user.id,
    to,
    fileBuf,      // buffer
    mimetype,
    filename,
    caption: caption || '',
    blastId: blast._id,
    logId: log._id,
    BlastModel: Blast,
    MessageLogModel: MessageLog,
    meta: {
      queuedAt: new Date(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
  };

  queue.addJob(job);

  res.json({
    ok: true,
    queued: true,
    blastId: blast._id,
    to,
    waMsgId: null,
    kind: 'media',
    filename,
    mimetype,
    verified: wa.isConnected(req.user.id),
    logId: log._id,
  });
});

/**
 * ===========================
 * Ambil log pengiriman pesan
 * ===========================
 */
router.get('/logs', async (req, res) => {
  try {
    const { start, end, userId, search } = req.query;
    const q = {};

    // User biasa hanya lihat log miliknya
    if (req.user.role !== 'admin') {
      q.userId = req.user.id;
    } else if (userId) {
      q.userId = userId;
    }

    // Filter tanggal
    if (start || end) {
      q.createdAt = {};
      if (start) q.createdAt.$gte = new Date(start + 'T00:00:00');
      if (end) q.createdAt.$lte = new Date(end + 'T23:59:59.999');
    }

    // Filter pencarian
    if (search) {
      q.$or = [
        { to: new RegExp(search, 'i') },
        { recipientName: new RegExp(search, 'i') },
        { message: new RegExp(search, 'i') },
      ];
    }

    const logs = await MessageLog.find(q)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec();

    res.json({ ok: true, items: logs });
  } catch (err) {
    console.error('❌ Error ambil message logs:', err);
    res.status(500).json({ ok: false, message: 'Gagal ambil logs' });
  }
});

module.exports = router;
