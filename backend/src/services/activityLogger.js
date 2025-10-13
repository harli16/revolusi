const ActivityLog = require("../models/ActivityLog");

async function logActivity(userId, type, details = {}) {
  try {
    await ActivityLog.create({
      userId,
      type,
      details,
    });
  } catch (err) {
    console.error("❌ Gagal mencatat aktivitas:", err.message);
  }
}

module.exports = { logActivity };
