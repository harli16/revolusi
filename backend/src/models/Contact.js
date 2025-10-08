const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true // 🔥 wajib, tiap kontak pasti punya pemilik
    },
    waNumber: { 
      type: String, 
      required: true 
    },
    name: { 
      type: String, 
      default: "" 
    },
    school: { 
      type: String, 
      default: "" 
    },
    kelas: { 
      type: String, 
      default: "" 
    },
    tahunLulus: { 
      type: String,
      default: "" 
    },
  },
  { timestamps: true } // otomatis createdAt & updatedAt
);

// ❌ Jangan bikin unique index, biar 1 nomor bisa masuk berkali-kali
// contactSchema.index({ userId: 1, waNumber: 1 }, { unique: true });

module.exports = mongoose.model("Contact", contactSchema);
