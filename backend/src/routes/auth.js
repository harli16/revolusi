const express = require("express");
const router = express.Router();

const User = require("../models/User");
const { signJwt } = require("../lib/jwt");
const { logActivity } = require("../services/activityLogger"); // 🆕 Tambahan logger

// Helper bikin URL foto absolute
const makePhotoUrl = (req, photoPath) => {
  if (!photoPath) return null;
  const baseUrl =
    process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}${photoPath}`;
};

// ==========================
// POST /auth/login
// ==========================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "username/password required" });
    }

    const user = await User.findOne({ username }).exec();
    if (!user) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    // ✅ Cek apakah user aktif
    if (!user.active) {
      return res
        .status(403)
        .json({ ok: false, message: "User suspended / disabled" });
    }

    const ok = await user.verifyPassword(password);
    if (!ok) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    // 🔥 Tandai user online
    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();

    // 📝 Catat aktivitas login
    await logActivity(user._id, "LOGIN", { ip: req.ip });

    // ✅ Konsisten pakai "id" untuk JWT payload
    const token = signJwt({
      id: user._id.toString(),
      username: user.username,
      role: user.role,
    });

    res.json({
      ok: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isOnline: user.isOnline,
        lastActive: user.lastActive,
        photo: user.photo ? makePhotoUrl(req, user.photo) : null,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

// ==========================
// POST /auth/logout
// ==========================
router.post("/logout", async (req, res) => {
  try {
    const { userId } = req.body || {};

    if (!userId) {
      return res
        .status(400)
        .json({ ok: false, message: "userId required for logout" });
    }

    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    // 🔥 Tandai user offline
    user.isOnline = false;
    user.lastActive = new Date();
    await user.save();

    // 📝 Catat aktivitas logout
    await logActivity(user._id, "LOGOUT", { message: "User logged out" });

    res.json({
      ok: true,
      message: "Logout successful",
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isOnline: user.isOnline,
        lastActive: user.lastActive,
        photo: user.photo ? makePhotoUrl(req, user.photo) : null,
      },
    });
  } catch (err) {
    console.error("❌ Logout error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

// ==========================
// POST /auth/register
// ==========================
router.post("/register", async (req, res) => {
  try {
    const { username, password, role } = req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "username/password required" });
    }

    const count = await User.countDocuments({}).exec();
    if (count > 0) {
      return res.status(403).json({
        ok: false,
        message: "Registration closed. Ask admin to create user.",
      });
    }

    const created = await User.createWithPassword(
      username,
      password,
      role || "admin"
    );

    // 📝 Catat aktivitas register
    await logActivity(created._id, "REGISTER", { username: created.username });

    res.json({
      ok: true,
      user: {
        id: created._id,
        username: created.username,
        role: created.role,
        isOnline: created.isOnline,
        lastActive: created.lastActive,
        photo: null, // default user baru belum ada foto
      },
    });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

module.exports = router;