// utils/stats.js
const mongoose = require("mongoose");
const MessageLog = require("../models/MessageLog");

async function getUserStats(userId, range = "month") {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "30d") {
    start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  }

  const oid = new mongoose.Types.ObjectId(userId);

  const agg = await MessageLog.aggregate([
    { $match: { userId: oid, createdAt: { $gte: start, $lte: now } } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const stats = {
    total: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    played: 0,
    failed: 0,
  };
  for (const row of agg) {
    stats[row._id] = row.count;
    stats.total += row.count;
  }

  const sentTotal = stats.sent + stats.delivered + stats.read + stats.played;
  stats.successRate = stats.total > 0 ? Math.round((sentTotal / stats.total) * 100) : 0;

  return stats;
}

module.exports = { getUserStats };
