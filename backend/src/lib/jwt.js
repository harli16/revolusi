const jwt = require("jsonwebtoken");
const cfg = require("../config");

/**
 * Buat JWT token
 * @param {Object} user - data user yang mau dimasukin ke token
 * @param {string} user.id - MongoDB _id
 * @param {string} user.username - nama user
 * @param {string} user.role - role user
 */
function signJwt(user) {
  // hanya ambil field yang perlu, ga usah ada "sub"
  const payload = {
    id: user.id || user._id?.toString(), // pastikan id ada
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, cfg.jwtSecret, { expiresIn: cfg.jwtExpiresIn || "7d" });
}

/**
 * Verifikasi JWT token
 * @param {string} token - token JWT
 * @returns {Object|null} - decoded payload atau null jika invalid
 */
function verifyJwt(token) {
  try {
    return jwt.verify(token, cfg.jwtSecret);
  } catch {
    return null;
  }
}

module.exports = { signJwt, verifyJwt };
