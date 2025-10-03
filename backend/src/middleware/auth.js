const { verifyJwt } = require("../lib/jwt");
const User = require("../models/User");

async function authenticateToken(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }

  // ✅ sekarang pakai id, bukan sub
  const user = await User.findById(payload.id).lean().exec();
  if (!user) {
    return res.status(401).json({ ok: false, message: "User not found" });
  }

  // simpan data user di req.user
  req.user = {
    id: user._id.toString(),
    username: user.username,
    role: user.role,
  };

  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ ok: false, message: "Forbidden" });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin };
