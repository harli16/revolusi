const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // 🔑 tiap chat wajib ada pemiliknya
    },
    waNumber: { 
      type: String, 
      required: true 
    }, // nomor WA kontak
    message: { 
      type: String, 
      required: true 
    },  // isi pesan
    direction: { 
      type: String, 
      enum: ["in", "out"], 
      required: true 
    }, // masuk / keluar

    // ✅ tambahan baru
    read: { 
      type: Boolean, 
      default: false 
    }, // false = belum dibaca, true = sudah dibaca

    assignedTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      default: null 
    }, // staff yg handle (opsional)

    // ✅ tambahkan field providerId biar sinkron sama message log
    providerId: {
      type: String,
      default: null,
      index: true, // supaya cepat dicari waktu update status
    },

    // ✅ tambahkan field status biar bisa simpan "sent", "delivered", "read", "played"
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "played", "failed"],
      default: "pending",
    },

    // ✅ opsional: timestamps per status
    timestamps: {
      sentAt: Date,
      deliveredAt: Date,
      readAt: Date,
      playedAt: Date,
      failedAt: Date,
    },
  },
  { timestamps: true }
);

// Index biar query cepat
ChatSchema.index({ userId: 1, waNumber: 1, createdAt: -1 });
ChatSchema.index({ userId: 1, direction: 1, read: 1 });
ChatSchema.index({ userId: 1, providerId: 1 }); // ✅ tambahkan ini
ChatSchema.index({ providerId: 1 }); // ✅ tambahan aman buat updateMany()

module.exports = mongoose.model("Chat", ChatSchema);
