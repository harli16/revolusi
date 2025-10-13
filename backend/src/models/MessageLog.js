const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },

    // Nomor tujuan (WA)
    to: { type: String, required: true },

    // Nama penerima (opsional, dari Excel/CSV)
    recipientName: { type: String },

    // Isi pesan teks
    message: { type: String },

    // Media file (kalau ada)
    mediaUrl: { type: String },

    // Status pengiriman
    status: {
      type: String,
      enum: [
        "queued",     // baru dimasukin ke antrian
        "pending",    // siap dikirim (belum ada response WA)
        "sent",       // sudah terkirim ke server WA
        "delivered",  // sudah diterima device penerima
        "read",       // sudah dibaca penerima
        "played",     // kalau voice note / audio sudah diputar
        "failed",     // gagal kirim
      ],
      default: "queued",
    },

    // ID dari provider (misalnya WhatsApp msgId)
    providerId: { type: String },

    // Error log kalau gagal
    error: { type: mongoose.Schema.Types.Mixed }, // bisa string / object
  },
  { timestamps: true }
);

/**
 * 🔍 Indexes untuk performa query
 * - kombinasi userId + status + createdAt: cepat untuk statistik & dashboard
 * - index createdAt: cepat untuk sort & filter tanggal
 */
schema.index({ userId: 1, status: 1, createdAt: -1 });
schema.index({ createdAt: -1 });

module.exports = mongoose.model("MessageLog", schema);
