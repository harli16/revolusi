const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const ChatSchema = new mongoose.Schema(
  {
    // 🔑 Pemilik chat
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 📞 Nomor WA kontak
    waNumber: {
      type: String,
      required: true,
    },

    // 💬 Isi pesan teks
    message: {
      type: String,
      required: true,
    },

    // 🔁 Arah pesan (in = masuk, out = keluar)
    direction: {
      type: String,
      enum: ["in", "out"],
      required: true,
    },

    // 👁️ Status baca pesan
    read: {
      type: Boolean,
      default: false,
    },

    // 👤 Staff yang menangani
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // 🔗 ID dari provider (Baileys message ID)
    providerId: {
      type: String,
      default: null,
      index: true,
    },

    // 🚦 Status pengiriman pesan
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "played", "failed"],
      default: "pending",
    },

    // 🕓 Timestamp status detail
    timestamps: {
      sentAt: Date,
      deliveredAt: Date,
      readAt: Date,
      playedAt: Date,
      failedAt: Date,
    },

    // 🧩 Jenis pesan (buat deteksi gallery, link, dokumen, dll)
    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "document", "link"],
      default: "text",
      index: true,
    },

    // 📎 Informasi file/media (kalau pesan berupa gambar/video/dokumen)
    fileUrl: {
      type: String,
      default: null, // contoh: /uploads/images/17394933123.png
    },
    fileName: {
      type: String,
      default: null,
    },
    mimeType: {
      type: String,
      default: null, // contoh: image/png, application/pdf
    },
  },
  { timestamps: true }
);

// ⚡ Index biar query cepat
ChatSchema.index({ userId: 1, waNumber: 1, createdAt: -1 });
ChatSchema.index({ userId: 1, direction: 1, read: 1 });
ChatSchema.index({ userId: 1, providerId: 1 });
ChatSchema.index({ providerId: 1 });
ChatSchema.index({ waNumber: 1, type: 1 }); // 🔍 buat filter media/link/dokumen per kontak

// 🧹 Cleanup file fisik saat chat dihapus
ChatSchema.post("findOneAndDelete", (doc) => {
  try {
    if (doc?.fileUrl) {
      // Ambil path lokal dari fileUrl (/uploads/...)
      const relPath = decodeURIComponent(
        doc.fileUrl.split("/uploads/")[1] || ""
      );
      if (relPath) {
        const localPath = path.join(__dirname, "../../uploads", relPath);
        fs.unlink(localPath, (err) => {
          if (err) {
            console.warn("⚠️ Gagal hapus file:", localPath);
          } else {
            console.log("🧹 File chat terhapus:", localPath);
          }
        });
      }
    }
  } catch (err) {
    console.warn("⚠️ Cleanup error:", err.message);
  }
});

module.exports = mongoose.model("Chat", ChatSchema);
