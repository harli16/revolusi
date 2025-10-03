const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const schema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    active: {
      type: Boolean,
      default: true, // ✅ user aktif secara default
    },

    // 🔥 tambahan tracking login
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastActive: {
      type: Date,
      default: null,
    },

    // 🔥 field tambahan untuk profil
    name: { type: String, default: "" },
    email: { type: String, default: "" }, // optional kalau mau bedain login vs profil
    phone: { type: String, default: "" }, // nomor WA blasting
    jabatan: { type: String, default: "" },
    ttl: { type: String, default: "" }, // tempat, tanggal lahir
    pendidikan: { type: String, default: "" },
    jenisKelamin: { type: String, enum: ["Laki-laki", "Perempuan", ""], default: "" },
    photo: { type: String, default: "" }, // URL foto profil
  },
  { timestamps: true }
);

// ===== Methods =====
schema.methods.verifyPassword = function (pw) {
  return bcrypt.compare(pw, this.passwordHash);
};

schema.methods.setPassword = async function (pw) {
  this.passwordHash = await bcrypt.hash(pw, 10);
};

// ===== Statics =====
schema.statics.createWithPassword = async function (username, password, role = 'user') {
  const hash = await bcrypt.hash(password, 10);
  return this.create({ username, passwordHash: hash, role });
};

module.exports = mongoose.model('User', schema);
