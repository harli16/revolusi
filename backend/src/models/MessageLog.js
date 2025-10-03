const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Nomor tujuan
    to: { type: String, required: true },

    // Nama penerima (opsional, dari excel/csv)
    recipientName: { type: String },

    // Isi pesan teks
    message: { type: String },

    // Media file (kalau ada)
    mediaUrl: { type: String },

    // Status pengiriman
    status: {
      type: String,
      enum: [
        'queued',     // baru dimasukin ke antrian
        'pending',    // siap dikirim (belum ada response WA)
        'sent',       // sudah terkirim ke server WA
        'delivered',  // sudah diterima device penerima
        'read',       // sudah dibaca penerima
        'played',     // kalau voice note / audio sudah diputar
        'failed'      // gagal kirim
      ],
      default: 'queued',
    },

    // ID dari provider (misalnya WhatsApp msgId)
    providerId: { type: String },

    // Error log kalau gagal
    error: { type: mongoose.Schema.Types.Mixed }, // bisa string / object
  },
  { timestamps: true }
);

module.exports = mongoose.model('MessageLog', schema);
