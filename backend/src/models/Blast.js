// models/Blast.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

// ====================
// Recipient sub-schema
// ====================
const RecipientSchema = new Schema(
  {
    contactId: { type: Schema.Types.ObjectId, ref: "Contact" },
    name: String,
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "queued",
        "pending",
        "sent",
        "delivered",
        "read",
        "played",
        "failed",
        "cancelled",
      ],
      default: "queued",
    },
    waMsgId: String,
    error: {
      code: String,
      message: String,
    },
    timestamps: {
      queuedAt: Date,
      sentAt: Date,
      deliveredAt: Date,
      readAt: Date,
      playedAt: Date,
      failedAt: Date,
    },
  },
  { _id: false }
);

// ====================
// Meta sub-schema (🔥 patch terbaru)
// ====================
const MetaSchema = new Schema(
  {
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },

    // 🔥 konfigurasi random template
    randomTemplate: { type: Boolean, default: false },
    randomMode: {
      type: String,
      enum: ["per_message", "per_n"],
      default: "per_message",
    },
    perN: { type: Number, default: 0 },
    selectedTemplates: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

// ====================
// Blast main schema
// ====================
const BlastSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },

    type: { type: String, enum: ["blast", "single"], default: "blast" },
    channel: { type: String, enum: ["whatsapp"], default: "whatsapp" },

    schedule: { type: Date }, // null = langsung kirim

    // Konten utama
    content: {
      text: String, // default message (jika tidak pakai templates)
      mediaUrl: String,
      caption: String,
      templateName: String,
      variables: Schema.Types.Mixed,
    },

    // Variasi pesan (anti-banned)
    templates: [String], // array template, pilih random saat kirim

    // Recipients
    recipients: [RecipientSchema],

    // Statistik
    totals: {
      queued: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      read: { type: Number, default: 0 },
      played: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      cancelled: { type: Number, default: 0 },
    },

    // 🔥 Status blast global
    status: {
      type: String,
      enum: ["active", "paused", "stopped", "cancelled", "completed"],
      default: "active",
    },

    // Anti-banned settings
    delayMin: { type: Number, default: 2 }, // detik
    delayMax: { type: Number, default: 5 }, // detik
    pauseEvery: { type: Number, default: 20 }, // setiap X pesan
    pauseDuration: { type: Number, default: 120 }, // detik
    maxPerBatch: { type: Number, default: 50 }, // pesan sekali jalan
    maxPerDay: { type: Number, default: 300 }, // pesan per hari

   // 🕓 Waktu eksekusi blast
   startTime: { type: Date, default: null },  // kapan blast mulai dijalankan
   endTime: { type: Date, default: null },    // kapan blast selesai total

    // ✅ Meta data lengkap (dulu cuma ip & userAgent)
    meta: { type: MetaSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// ====================
// Index buat query cepat
// ====================
BlastSchema.index({ userId: 1, createdAt: -1 });
BlastSchema.index({ "recipients.phone": 1 });
BlastSchema.index({ "recipients.status": 1 });

// ====================
// Export model
// ====================
module.exports = mongoose.model("Blast", BlastSchema);