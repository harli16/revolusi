// services/wa.js
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const EventEmitter = require("events");

const cfg = require("../config");
const logger = require("../logger");

// models
const Blast = require("../models/Blast");
const MessageLog = require("../models/MessageLog");
const Contact = require("../models/Contact");
const Chat = require("../models/Chat");

let io = null; // di-set dari index.js
let cachedBaileysVersion = [2, 3000, 1]; // fallback
let defaultOwnerUserId = null; // kompabilitas sementara: "pemilik" sesi default

/** Utils */
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}
function jidFromPhone(phone) {
  return phone.includes("@s.whatsapp.net") ? phone : `${phone}@s.whatsapp.net`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ambil versi terbaru Baileys sekali di awal */
(async () => {
  try {
    const v = await fetchLatestBaileysVersion();
    if (v?.version) cachedBaileysVersion = v.version;
  } catch (e) {
    logger.warn({ e: String(e) }, "WA: fetchLatestBaileysVersion failed; using fallback version");
  }
})();

/**
 * Satu sesi WhatsApp untuk satu userId
 */
class SingleWASession extends EventEmitter {
  constructor(userId) {
    super();
    this.userId = userId;
    this.sock = null;
    this.state = cfg.simulation ? "SIMULATED" : "DISCONNECTED";
    this.qrPng = null;
    this.qrAt = 0;
    this.initPromise = null;
    this.reconnectTimer = null;
    this.registered = false;
  }

  isRegistered() { return !!this.registered; }
  getState() { return this.state; }
  isConnected() { return this.state === "CONNECTED"; }
  hasQr() { return !!this.qrPng && !(this.registered || this.sock?.user); }
  getQrPng() { return this.qrPng; }

  async init() {
    if (this.initPromise) return this.initPromise;
    if (cfg.simulation) {
      this.state = "SIMULATED";
      this.initPromise = Promise.resolve();
      return this.initPromise;
    }
    this.initPromise = this._init();
    return this.initPromise;
  }

  async _init() {
    const tokensDir = cfg.tokensDir || "./tokens";
    const authDir = ensureDir(path.join(tokensDir, String(this.userId), "baileys_auth"));

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    this.registered = !!(state.creds && state.creds.registered);

    this.sock = makeWASocket({
      version: cachedBaileysVersion,
      auth: state,
      keepAliveIntervalMs: 30000,
      browser: ["WABLASH", "Chrome", "1.0"],
    });

    // ===== Credentials update
    this.sock.ev.on("creds.update", async () => {
      try { await saveCreds(); } catch {}
      this.registered = !!(state.creds && state.creds.registered);
      if (this.registered) {
        this.qrPng = null;
        this.qrAt = 0;
      }
    });

    // ===== Connection update
    this.sock.ev.on("connection.update", async (u) => {
      const { connection, lastDisconnect, qr } = u;

      // ===== QR muncul =====
      if (qr) {
        try {
          this.qrPng = await qrcode.toBuffer(qr, { width: 300, margin: 1 });
          this.qrAt = Date.now();
        } catch (e) {
          logger.error({ e }, "QR encode failed");
        }
        if (io) io.to(this.userId.toString()).emit("wa:qr", { at: this.qrAt });
        this.emit("qr", { at: this.qrAt });
      }

      // ===== Koneksi terbuka =====
      if (connection === "open") {
        this.state = "CONNECTED";
        if (this.sock?.user) this.registered = true;
        this.qrPng = null;
        this.qrAt = 0;
        if (io) io.to(this.userId.toString()).emit("wa:ready", { connected: true });
        this.emit("ready");
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

      // ===== Sedang menyambung =====
      } else if (connection === "connecting") {
        this.state = "CONNECTING";

      // ===== Koneksi tertutup =====
      } else if (connection === "close") {
        const reasonCode =
          lastDisconnect?.error?.output?.statusCode ||
          lastDisconnect?.error?.statusCode ||
          lastDisconnect?.error?.code ||
          0;
        const reasonMsg =
          lastDisconnect?.error?.message ||
          String(lastDisconnect?.error || "unknown");

        logger.warn({ userId: this.userId, reasonCode, reasonMsg }, "WA connection closed");

        this.state = "DISCONNECTED";
        this.qrPng = null;
        this.qrAt = 0;
        this.initPromise = null;

        // 🧹 kalau logout atau unauthorized (401) → hapus session lama
        if (reasonCode === 401 || reasonMsg.toLowerCase().includes("logout") || reasonMsg.toLowerCase().includes("loggedout")) {
          const tokensDir = cfg.tokensDir || "./tokens";
          const authDir = path.join(tokensDir, String(this.userId), "baileys_auth");
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
            logger.info({ userId: this.userId }, "🧹 Deleted old Baileys session (logged out)");
          } catch (err) {
            logger.error({ err: String(err), userId: this.userId }, "Failed to delete old session");
          }

          if (io) io.to(this.userId.toString()).emit("wa:disconnected");
        }

        // 🔄 auto reconnect biar QR baru langsung muncul
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        const delay = 2000 + Math.floor(Math.random() * 2000);
        this.reconnectTimer = setTimeout(() => {
          this._init().catch((e) =>
            logger.error({ e: String(e) }, "WA re-init failed")
          );
          this.reconnectTimer = null;
        }, delay);
      }
    });

    // ===== Incoming messages (riwayat chat)
    this.sock.ev.on("messages.upsert", async (msg) => {
      try {
        const m = msg.messages?.[0];
        if (!m || !m.message) return;

        const from = m.key.remoteJid;
        if (!from || from === "status@broadcast") return;

        const waNumber = String(from).split("@")[0];

        // 🚫 Skip kalau pesan dari user sendiri (outgoing)
        // ⚙️ Fix untuk multi-device: hanya skip kalau benar-benar dari kita
        if (m.key.fromMe && !m.key.participant) return;

        // ====== Ambil isi pesan / caption / media label
        const text =
          m.message?.conversation ||
          m.message?.extendedTextMessage?.text ||
          m.message?.imageMessage?.caption ||
          m.message?.videoMessage?.caption ||
          m.message?.documentMessage?.caption ||
          "";

        const mediaLabel =
          m.message?.imageMessage
            ? "[Image]"
            : m.message?.videoMessage
            ? "[Video]"
            : m.message?.documentMessage
            ? "[Document]"
            : m.message?.audioMessage
            ? "[Audio]"
            : null;

        const content = text || mediaLabel || "";
        if (!content) return; // 🚫 Lewat kalau gak ada isi pesan

        // ====== Cek kontak di DB
        const contact = await Contact.findOne({
          userId: this.userId,
          waNumber,
        }).lean();

        // ====== Cegah duplikat berlebihan (misal "Ok" dikirim 2x cepat)
        const fiveSecondsAgo = new Date(Date.now() - 5000);
        const exists = await Chat.findOne({
          userId: this.userId,
          waNumber,
          message: content,
          direction: "in",
          createdAt: { $gte: fiveSecondsAgo }, // cuma skip kalau muncul dalam 5 detik terakhir
        });

        if (exists) {
          console.log("⏩ Skip duplikat pesan masuk (5s window):", content);
          return;
        }

        // ====== Simpan pesan masuk
        const chat = await Chat.create({
          userId: this.userId,
          waNumber,
          message: content,
          direction: "in",
          read: false,
        });

        // ====== Emit realtime ke FE (live chat)
        if (io) {
          io.to(this.userId.toString()).emit("chat:new", {
            ...(chat.toObject?.() ?? {
              userId: this.userId,
              waNumber,
              message: content,
              direction: "in",
              read: false,
            }),
            waName: contact?.name || m.pushName || waNumber,
          });
          console.log("📩 Emit chat:new ke FE:", content);
        }

        // ====== Auto kirim read receipt ke WA (biar di HP target jadi centang 2 biru)
        try {
          await Chat.updateMany(
            {
              userId: this.userId,
              waNumber,
              direction: "in",
              read: false,
            },
            { $set: { read: true } }
          );
        } catch (err) {
          console.warn("⚠️ gagal auto-read:", err.message);
        }
      } catch (err) {
        logger.error({ err: String(err) }, "WA messages.upsert error");
      }
    });

    // ===== Status perubahan pesan (blast)
    this.sock.ev.on("messages.update", async (updates) => {
      try {
        for (const update of updates) {
          if (!update?.key) continue;
          const waMsgId = update.key.id;
          const status = update.status ?? update.update?.status;

          let newStatus = null;
          if (status === 1) newStatus = "sent";        // 1 = sent
          if (status === 2) newStatus = "delivered";  // 2 = delivered
          if (status === 3) newStatus = "read";       // 3 = read
          if (status === 4) newStatus = "played";     // 4 = played (voice note)

          if (!newStatus) continue;

          // Update Blast
          await Blast.updateOne(
            { userId: this.userId, "recipients.waMsgId": waMsgId },
            {
              $set: {
                "recipients.$.status": newStatus,
                [`recipients.$.timestamps.${newStatus}At`]: new Date(),
              },
              $inc: { [`totals.${newStatus}`]: 1 },
            }
          );

          // Update MessageLog
          await MessageLog.updateOne(
            { userId: this.userId, providerId: waMsgId },
            {
              $set: {
                status: newStatus,
                [`timestamps.${newStatus}At`]: new Date(),
              },
            }
          );

          // ✅ Update juga ke Chat agar status & read-nya persist
          const chatUpdate = {
            $set: {
              status: newStatus,
              [`timestamps.${newStatus}At`]: new Date(),
            },
          };

          // tambahkan flag read true kalau statusnya read / played
          if (newStatus === "read" || newStatus === "played") {
            chatUpdate.$set.read = true;
          }

          await Chat.updateMany(
            { userId: this.userId, providerId: waMsgId },
            chatUpdate
          );

          // ... sisanya tetap (emit ke FE, log, dll)
          const logDoc = await MessageLog.findOne(
            { userId: this.userId, providerId: waMsgId },
            { _id: 1 }
          );

          const blastDoc = await Blast.findOne(
            { userId: this.userId, "recipients.waMsgId": waMsgId },
            { _id: 1, "recipients.$": 1 }
          );

          let phone = "-";
          let name = "";
          if (blastDoc?.recipients?.[0]) {
            phone = blastDoc.recipients[0].phone;
            name = blastDoc.recipients[0].name || "";
          }

          if (io) {
            console.log(
              `🔥 Emit message:status to room=${this.userId.toString()} | status=${newStatus} | phone=${phone} | providerId=${waMsgId}`
            );

            io.to(this.userId.toString()).emit("message:status", {
              providerId: waMsgId,
              logId: logDoc?._id,
              status: newStatus,
              phone,
              name,
              blastId: blastDoc?._id?.toString(),
            });
          }
        }
      } catch (err) {
        logger.error({ err: String(err) }, "WA messages.update error");
      }
    });

    // ===== Read receipts
    this.sock.ev.on("readReceipts.update", async (updates) => {
      try {
        for (const rr of updates) {
          const waMsgId = rr.key?.id;
          if (!waMsgId) continue;

          // Update Blast
          await Blast.updateOne(
            { userId: this.userId, "recipients.waMsgId": waMsgId },
            {
              $set: {
                "recipients.$.status": "read",
                "recipients.$.timestamps.readAt": new Date(),
              },
              $inc: { "totals.read": 1 }, // ✅ aktifkan increment read lagi
            }
          );

          // Update MessageLog
          await MessageLog.updateOne(
            { userId: this.userId, providerId: waMsgId },
            {
              $set: {
                status: "read",
                "timestamps.readAt": new Date(),
              },
            }
          );

          // ✅ Update juga ke Chat agar status read/played tetap setelah refresh
          await Chat.updateMany(
            { userId: this.userId, providerId: waMsgId },
            {
              $set: {
                status: "read",
                "timestamps.readAt": new Date(),
              },
            }
          );

          // Ambil recipient dari Blast biar bisa emit nama + nomor
          const blastDoc = await Blast.findOne(
            { userId: this.userId, "recipients.waMsgId": waMsgId },
            { "recipients.$": 1 }
          );

          let phone = "-";
          let name = "";
          if (blastDoc?.recipients?.[0]) {
            phone = blastDoc.recipients[0].phone;
            name = blastDoc.recipients[0].name || "";
          }

          if (io) {
            console.log("🔥 Emit message:status", {
              providerId: waMsgId,
              status: "read",
              phone,
              name,
            });
            io.to(this.userId.toString()).emit("message:status", {
              providerId: waMsgId,
              status: "read",
              phone,
              name,
            });
          }
        }
      } catch (err) {
        logger.error({ err: String(err) }, "WA readReceipts.update error");
      }
    });

  }
  async reset() {
    const tokensDir = cfg.tokensDir || "./tokens";
    const authDir = path.join(tokensDir, String(this.userId), "baileys_auth");
    try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
    this.qrPng = null;
    this.qrAt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      try { await this.sock.logout?.(); } catch {}
    }
    this.sock = null;
    this.state = cfg.simulation ? "SIMULATED" : "DISCONNECTED";
    this.initPromise = null;
    this.registered = false;
    return this.init();
  }

  /**
   * Kirim teks
   * @param {string} to - nomor tujuan (tanpa @s.whatsapp.net)
   * @param {string} text - pesan
   * @param {object} opts - { blastId?, logId? }
   */
  async sendText(to, text, opts = {}) {
    const { blastId, logId } = opts;

    if (cfg.simulation) {
      const providerId = "sim_" + Math.random().toString(36).slice(2);

      await Chat.create({
        userId: this.userId,
        waNumber: to,
        message: text,
        direction: "out",
        read: true,
        assignedTo: this.userId,
      });

      if (io) {
        io.to(this.userId.toString()).emit("chat:new", {
          waNumber: to,
          message: text,
          direction: "out",
          read: true,
          providerId,
          status: "pending",        // ✅ default status
          createdAt: new Date(),    // ✅ timestamp biar FE rapi
        });
      }
      return { providerId };
    }

    if (!this.sock) throw new Error("WA not initialized (session missing)");
    const sent = await this.sock.sendMessage(jidFromPhone(to), { text });
    const providerId = sent?.key?.id || null;

    // 🚫 jangan insert ke DB di sini, cukup emit ke FE
    if (io) {
      io.to(this.userId.toString()).emit("chat:new", {
        waNumber: to,
        message: text,
        direction: "out",
        read: true,
        providerId,
        status: "pending",
        createdAt: new Date(),
      });
    }


    // 🔥 update log + blast kalau ada ID
    if (logId) {
      const update = {
        $set: {
          providerId,                     // ✅ selalu simpan providerId
          "timestamps.sentAt": new Date(),
        },
      };

      // Kalau status di log masih pending → set jadi sent
      update.$set.status = "sent";

      await MessageLog.updateOne({ _id: logId }, update);
    }


    if (blastId) {
      await Blast.updateOne(
        { _id: blastId, "recipients.phone": to },
        {
          $set: {
            "recipients.$.status": "sent",
            "recipients.$.waMsgId": providerId,
            "recipients.$.timestamps.sentAt": new Date(),
          },
          // $inc: { "totals.sent": 1 },
        }
      );
    }

    if (io) {
      io.to(this.userId.toString()).emit("chat:new", {
        waNumber: to,
        message: text,
        direction: "out",
        read: true,
        providerId,
        status: "pending",        // ✅ FE bisa tampil centang ⏳
        createdAt: new Date(),    // ✅ biar timestamp gak null
      });
    }

    return { providerId };
  }

  /**
   * Kirim media (gambar, video, dokumen, audio)
   * @param {string} to
   * @param {Buffer} fileBuf
   * @param {string} mimetype
   * @param {string} filename
   * @param {string} caption
   * @param {object} opts - { blastId?, logId? }
   */
  async sendMedia(to, fileBuf, mimetype, filename, caption = "", opts = {}) {
    const { blastId, logId } = opts;

    // ==========================
    // 🧪 Mode simulasi
    // ==========================
    if (cfg.simulation) {
      const providerId = "sim_" + Math.random().toString(36).slice(2);

      // Simulasi boleh simpan ke DB karena gak ada event update dari WA
      await Chat.create({
        userId: this.userId,
        waNumber: to,
        message: caption || "[Media]",
        direction: "out",
        read: true,
        assignedTo: this.userId,
        status: "sent",
      });

      if (io) {
        io.to(this.userId.toString()).emit("chat:new", {
          waNumber: to,
          message: caption || "[Media]",
          direction: "out",
          read: true,
          providerId,
          status: "sent",
          createdAt: new Date(),
        });
      }
      return { providerId };
    }

    // ==========================
    // 🚀 Kirim ke WhatsApp asli
    // ==========================
    if (!this.sock) throw new Error("WA not initialized (session missing)");

    const optsMsg = {};

    if (/^image\//i.test(mimetype)) {
      optsMsg.image = fileBuf;
    } else if (/^video\//i.test(mimetype)) {
      optsMsg.video = fileBuf;
    } else if (/^audio\//i.test(mimetype)) {
      optsMsg.audio = fileBuf;
      optsMsg.ptt = false;
      optsMsg.mimetype = mimetype;
    } else {
      optsMsg.document = fileBuf;
      optsMsg.mimetype = mimetype;
      optsMsg.fileName = filename || "file";
    }

    if (caption) optsMsg.caption = caption;

    // kirim pesan ke WA
    const sent = await this.sock.sendMessage(jidFromPhone(to), optsMsg);
    const providerId = sent?.key?.id || null;

    // 🚫 Jangan insert langsung ke DB, biar messages.update yang update
    // cukup emit ke FE agar realtime
    if (io) {
      io.to(this.userId.toString()).emit("chat:new", {
        waNumber: to,
        message: caption || "[Media]",
        direction: "out",
        read: true,
        providerId,
        status: "pending", // awalnya pending, nanti di-update oleh messages.update
        createdAt: new Date(),
      });
    }

    // ==========================
    // 🔥 Update MessageLog & Blast
    // ==========================
    if (logId) {
      await MessageLog.updateOne(
        { _id: logId },
        {
          $set: {
            providerId,
            status: "sent",
            "timestamps.sentAt": new Date(),
          },
        }
      );
    }

    if (blastId) {
      await Blast.updateOne(
        { _id: blastId, "recipients.phone": to },
        {
          $set: {
            "recipients.$.status": "sent",
            "recipients.$.waMsgId": providerId,
            "recipients.$.timestamps.sentAt": new Date(),
          },
        }
      );
    }
    return { providerId };
  }
}

/**
 * Session Manager
 */
const sessions = new Map(); // userId(string) -> SingleWASession

function setSocketIO(_io) { io = _io; }
function setOwnerUser(userId) { defaultOwnerUserId = userId ? String(userId) : null; }

async function startSession(userId) {
  const key = String(userId);
  if (sessions.has(key)) return sessions.get(key);
  const s = new SingleWASession(key);
  sessions.set(key, s);
  await s.init();
  return s;
}
function getSession(userId) {
  const key = String(userId);
  return sessions.get(key) || null;
}
function isConnected(userId) {
  const s = getSession(userId);
  return s ? s.isConnected() : false;
}
function getState(userId) {
  const s = getSession(userId);
  return s ? s.getState() : (cfg.simulation ? "SIMULATED" : "DISCONNECTED");
}
function isRegistered(userId) {
  const s = getSession(userId);
  return s ? s.isRegistered() : false;
}
function hasQr(userId) {
  const s = getSession(userId);
  return s ? s.hasQr() : false;
}
function getQrPng(userId) {
  const s = getSession(userId);
  return s ? s.getQrPng() : null;
}
async function reset(userId) {
  const s = getSession(userId);
  if (!s) return startSession(userId);
  return s.reset();
}

/** API kirim pesan (per user) */
async function sendText(userId, to, text, opts = {}) {
  const s = getSession(userId) || (await startSession(userId));
  return s.sendText(to, text, opts);
}
async function sendMedia(userId, to, fileBuf, mimetype, filename, caption = "", opts = {}) {
  const s = getSession(userId) || (await startSession(userId));
  return s.sendMedia(to, fileBuf, mimetype, filename, caption, opts);
}

/**
 * Helper untuk queue worker
 * Menerima job shape dari routes/message.js:
 * {
 *   type: "text" | "media",
 *   userId, to, message,
 *   fileBuf?, mimetype?, filename?, caption?,
 *   blastId?, logId?
 * }
 */
async function processJob(job) {
  const { type, userId, to, message, fileBuf, mimetype, filename, caption, blastId, logId } = job || {};
  if (!userId || !to) throw new Error("processJob: userId/to kosong");

  try {
    if (type === "text") {
      const r = await sendText(userId, to, message || "", { blastId, logId });
      return { ok: true, providerId: r?.providerId || null };
    } else if (type === "media") {
      const r = await sendMedia(userId, to, fileBuf, mimetype, filename, caption || "", { blastId, logId });
      return { ok: true, providerId: r?.providerId || null };
    }
    throw new Error("processJob: tipe job tidak dikenal");
  } catch (e) {
    // tandai failed di Blast & MessageLog
    if (blastId) {
      await Blast.updateOne(
        { _id: blastId, "recipients.phone": to },
        {
          $set: {
            "recipients.$.status": "failed",
            "recipients.$.error": { code: "SEND_FAIL", message: String(e.message || e) },
            "recipients.$.timestamps.failedAt": new Date(),
          },
          $inc: { "totals.failed": 1 },
        }
      );
    }
    if (logId) {
      await MessageLog.updateOne(
        { _id: logId },
        {
          $set: {
            status: "failed",
            "timestamps.failedAt": new Date(),
            error: { code: "SEND_FAIL", message: String(e.message || e) },
          },
        }
      );
    }
    throw e;
  }
}

// ===============================
// 🔧 ADMIN HELPER UNTUK MONITORING DAN KONTROL
// ===============================
const queues = new Map(); // optional: nanti bisa diisi dari queue.js kalau sudah pakai sistem antrian global
const _queueDepth = new Map(); // userId -> jumlah job di antrian

/**
 * Catatan: panggil setQueueDepth(userId, n)
 * di tempat yang enqueue job (biasanya di services/queue.js)
 */
function setQueueDepth(userId, n) {
  _queueDepth.set(String(userId), n);
}
function getQueueDepth(userId) {
  return _queueDepth.get(String(userId)) || 0;
}

/**
 * Pause/Resume queue per user
 * Catatan: implementasi queue lo sekarang masih di file lain,
 * jadi ini sementara dummy hook aja, nanti bisa disambung ke service queue.js
 */
function pauseQueue(userId) {
  const q = queues.get(String(userId));
  if (q) q.paused = true;
  console.log(`⏸️ Queue paused for user ${userId}`);
}
function resumeQueue(userId) {
  const q = queues.get(String(userId));
  if (q) q.paused = false;
  console.log(`▶️ Queue resumed for user ${userId}`);
}

/**
 * Force logout sesi WA user (hapus auth + disconnect)
 */
async function forceLogout(userId) {
  const key = String(userId);
  const s = sessions.get(key);
  if (s?.sock?.logout) {
    try {
      await s.sock.logout();
      console.log(`🚪 WA logout success for user ${userId}`);
    } catch (err) {
      console.warn(`⚠️ WA logout failed for user ${userId}: ${err.message}`);
    }
  }

  // hapus folder token biar QR baru nanti muncul
  try {
    const tokensDir = cfg.tokensDir || "./tokens";
    const authDir = path.join(tokensDir, key, "baileys_auth");
    fs.rmSync(authDir, { recursive: true, force: true });
    console.log(`🧹 Deleted old session folder for user ${userId}`);
  } catch (err) {
    console.warn(`⚠️ Failed to remove auth folder for ${userId}: ${err.message}`);
  }

  // ubah state jadi disconnected
  const sess = sessions.get(key);
  if (sess) {
    sess.state = "DISCONNECTED";
    sess.qrPng = null;
    sess.qrAt = 0;
    sess.registered = false;
  }
}

/**
 * ====== KOMPATIBILITAS SEMENTARA (fungsi tanpa userId) ======
 * Route lama / tools lama bisa tetap jalan untuk 1 user default.
 */
async function _compat_init() { return true; }
function _compat_getState() {
  return defaultOwnerUserId ? getState(defaultOwnerUserId) : (cfg.simulation ? "SIMULATED" : "DISCONNECTED");
}
function _compat_isConnected() { return defaultOwnerUserId ? isConnected(defaultOwnerUserId) : false; }
function _compat_isRegistered() { return defaultOwnerUserId ? isRegistered(defaultOwnerUserId) : false; }
function _compat_hasQr() { return defaultOwnerUserId ? hasQr(defaultOwnerUserId) : false; }
function _compat_getQrPng() { return defaultOwnerUserId ? getQrPng(defaultOwnerUserId) : null; }
async function _compat_reset() {
  if (!defaultOwnerUserId) throw new Error("No default owner set. Call setOwnerUser(userId) first.");
  return reset(defaultOwnerUserId);
}

module.exports = {
  // Manager API (pakai ini di kode baru)
  setSocketIO,
  setOwnerUser,
  startSession,
  getSession,
  isConnected,
  getState,
  isRegistered,
  hasQr,
  getQrPng,
  reset,
  sendText,
  sendMedia,
  processJob,

  // Admin helpers
  setQueueDepth,
  getQueueDepth,
  pauseQueue,
  resumeQueue,
  forceLogout,


  // Kompat lama
  init: _compat_init,
  getState_compat: _compat_getState,
  isConnected_compat: _compat_isConnected,
  isRegistered_compat: _compat_isRegistered,
  hasQr_compat: _compat_hasQr,
  getQrPng_compat: _compat_getQrPng,
  reset_compat: _compat_reset,
};