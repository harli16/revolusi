// routes/adminLogs.js
const express = require("express");
const router = express.Router();
const { authenticateToken, isAdmin } = require("../middleware/auth");
const MessageLog = require("../models/MessageLog");
const User = require("../models/User");

router.use(authenticateToken, isAdmin);

/**
 * ===========================================
 * ✅ Log Pengiriman Blast (lengkap dengan user)
 * ===========================================
 */
router.get("/logs/blasts", async (req, res) => {
  try {
    const data = await MessageLog.aggregate([
      // Gabungkan dengan koleksi user
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // Gabungkan juga dengan kontak biar bisa munculkan namaCalonMahasiswa, sekolah, kelas, dll (kalau ada)
      {
        $lookup: {
          from: "contacts",
          localField: "waNumber",
          foreignField: "waNumber",
          as: "contact",
        },
      },
      { $unwind: { path: "$contact", preserveNullAndEmptyArrays: true } },

      // Proyeksi field yang mau ditampilkan ke FE
      {
        $project: {
          userName: "$user.name",
          userEmail: "$user.email",
          waNumber: 1,
          message: 1,
          status: 1,
          createdAt: 1,
          // data kontak
          contactName: "$contact.name",
          school: "$contact.school",
          kelas: "$contact.kelas",
          tahunLulus: "$contact.tahunLulus",
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 500 }, // batasin biar gak berat
    ]);

    res.json({ ok: true, data });
  } catch (err) {
    console.error("❌ Error /logs/blasts:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil log blast" });
  }
});

module.exports = router;
