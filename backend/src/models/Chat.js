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
  },
  { timestamps: true }
);

// Index biar query cepat
ChatSchema.index({ userId: 1, waNumber: 1, createdAt: -1 });
ChatSchema.index({ userId: 1, direction: 1, read: 1 });

module.exports = mongoose.model("Chat", ChatSchema);
