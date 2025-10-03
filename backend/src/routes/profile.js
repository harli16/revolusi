const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const router = express.Router();
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");

// semua route profil butuh login
router.use(authenticateToken);

// ==========================
// Konfigurasi upload foto profil
// ==========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/avatar/");
  },
  filename: (req, file, cb) => {
    cb(null, req.user.id + "_" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024 }, // max 1MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya JPG/PNG yang diizinkan"));
    }
  },
});

// Helper buat bikin URL foto absolute
const makePhotoUrl = (req, photoPath) => {
  if (!photoPath) return "";
  const baseUrl =
    process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}${photoPath}`;
};

// ==========================
// GET /api/profile -> ambil profil user login
// ==========================
router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select(
        "_id username name phone jabatan ttl pendidikan jenisKelamin role active isOnline lastActive createdAt updatedAt photo"
      )
      .lean()
      .exec();

    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    if (user.photo) {
      user.photo = makePhotoUrl(req, user.photo);
    }

    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ==========================
// PUT /api/profile -> update profil user
// ==========================
router.put("/", async (req, res) => {
  try {
    const allowed = [
      "username",
      "name",
      "phone",
      "jabatan",
      "ttl",
      "pendidikan",
      "jenisKelamin",
    ];

    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    let updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
      fields:
        "_id username name phone jabatan ttl pendidikan jenisKelamin role active isOnline lastActive createdAt updatedAt photo",
    }).lean();

    if (!updatedUser) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    if (updatedUser.photo) {
      updatedUser.photo = makePhotoUrl(req, updatedUser.photo);
    }

    res.json({ ok: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ==========================
// PUT /api/profile/password -> ganti password user
// ==========================
router.put("/password", async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ ok: false, message: "Password baru minimal 6 karakter" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return res
        .status(400)
        .json({ ok: false, message: "Password lama salah" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ ok: true, message: "Password berhasil diubah" });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ==========================
// PUT /api/profile/photo -> upload foto profil
// ==========================
router.put("/photo", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ ok: false, message: "File foto tidak ditemukan" });
    }

    // Path asli dari multer
    const inputPath = req.file.path;

    // Buat nama file baru hasil resize
    const filename =
      req.user.id + "_" + Date.now() + path.extname(req.file.originalname);
    const outputPath = path.join("uploads", "avatar", filename);

    // Resize dengan sharp → hasil simpan ke outputPath
    await sharp(inputPath)
      .resize(300, 300) // resize max 300x300 px
      .jpeg({ quality: 80 }) // kompres
      .toFile(outputPath);

    // Hapus file asli (biar gak numpuk)
    fs.unlinkSync(inputPath);

    // Simpan path hasil resize
    const photoPath = "/uploads/avatar/" + filename;

    let user = await User.findByIdAndUpdate(
      req.user.id,
      { photo: photoPath },
      {
        new: true,
        fields:
          "_id username name phone jabatan ttl pendidikan jenisKelamin role active isOnline lastActive createdAt updatedAt photo",
      }
    ).lean();

    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    user.photo = `${req.protocol}://${req.get("host")}${user.photo}`;

    res.json({ ok: true, user });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
