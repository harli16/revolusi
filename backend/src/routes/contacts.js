const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { authenticateToken } = require("../middleware/auth");
const Contact = require("../models/Contact");
const { Parser } = require("json2csv");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const { toTitleCase } = require("../utils/string")

const upload = multer({ dest: "uploads/" });

// Semua route di bawah butuh login
router.use(authenticateToken);

/**
 * ===========================
 * Ambil list kontak
 * ===========================
 */
router.get("/", async (req, res) => {
  console.log("🔥 /contacts list oleh:", {
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
  });

  try {
    const { search, school, kelas, tahun, page = 1, limit = 20 } = req.query;
    const q = {};

    if (req.user.role !== "admin") {
      // ✅ hanya tampilkan kontak milik user ini
      q.userId = new mongoose.Types.ObjectId(req.user.id);
    }

    // 🔍 Filter pencarian nama / nomor
    if (search) {
      q.$or = [
        { waNumber: new RegExp(search, "i") },
        { name: new RegExp(search, "i") },
      ];
    }

    // 🏫 Filter asal sekolah (jika dikirim)
    if (school) {
      q.school = new RegExp(`^${school}$`, "i"); // exact match, ignore case
    }

    // 🎓 Filter kelas (jika dikirim)
    if (kelas) {
      q.kelas = new RegExp(`^${kelas}$`, "i");
    }

    // 🎓 Filter tauhun lulus (jika dikirim)
    if (tahun) {
      q.tahunLulus = new RegExp(`^${tahun}$`, "i");
    }

    // 🔑 Debug log filter query
    console.log("🔎 Query filter yang dipakai:", JSON.stringify(q, null, 2));

    const p = parseInt(page);
    const l = Math.min(parseInt(limit), 100);

    const [items, total] = await Promise.all([
      Contact.find(q)
        .sort({ updatedAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      Contact.countDocuments(q),
    ]);

    console.log(`📦 Hasil contacts: ${items.length} dari total ${total}`);

    res.json({ ok: true, page: p, limit: l, total, items });
  } catch (err) {
    console.error("❌ Error get contacts:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil kontak" });
  }
});

/**
 * ===========================
 * Export kontak ke CSV
 * ===========================
 */
router.get("/export", async (req, res) => {
  try {
    const q = {};
    if (req.user.role !== "admin") {
      q.userId = new mongoose.Types.ObjectId(req.user.id);
    }

    const contacts = await Contact.find(q).lean();
    const fields = ["waNumber", "name"];
    const parser = new Parser({ fields });
    const csv = parser.parse(contacts);

    res.header("Content-Type", "text/csv");
    res.attachment("contacts.csv");
    return res.send(csv);
  } catch (err) {
    console.error("❌ Error export contacts:", err);
    res.status(500).json({ ok: false, message: "Gagal export kontak" });
  }
});

/**
 * ===========================
 * Import kontak via Excel/CSV
 * ===========================
 */
router.post("/import", upload.single("file"), async (req, res) => {
  console.log("🔥 /import dipanggil oleh:", req.user.id, req.user.username);
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "File wajib diupload" });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let imported = 0;
    for (const row of rows) {
      let rawNumber = String(row["NO HANDPHONE"] || row["waNumber"] || "").replace(/\D/g, "");
      if (!rawNumber) continue;
      if (rawNumber.startsWith("0")) rawNumber = "62" + rawNumber.slice(1);

      await Contact.updateOne(
      { userId: new mongoose.Types.ObjectId(req.user.id), waNumber: rawNumber },
      {
        $setOnInsert: {
          // 🔥 standarisasi nama ke Title Case
          name: toTitleCase(row["NAMA LENGKAP"] || row["name"] || rawNumber),
          school: toTitleCase(row["ASAL SEKOLAH"] || row["school"] || ""),
          kelas: (row["KELAS"] || row["kelas"] || "").toString(),
          tahunLulus: (row["TAHUN LULUS"] || row["tahunLulus"] || "").toString(),
        },
      },
      { upsert: true }
    );
      imported++;
    }

    // Hapus file upload sementara
    fs.unlinkSync(req.file.path);

    res.json({ ok: true, imported });
  } catch (err) {
    console.error("❌ Error import contacts:", err);
    res.status(500).json({ ok: false, message: "Gagal import kontak" });
  }
});

/**
 * ===========================
 * Edit kontak
 * ===========================
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, waNumber } = req.body;

    const q = { _id: id };
    if (req.user.role !== "admin") {
      q.userId = new mongoose.Types.ObjectId(req.user.id);
    }

    const updated = await Contact.findOneAndUpdate(
      q,
      { name, waNumber },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ ok: false, message: "Kontak tidak ditemukan" });
    }

    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error("❌ Error update contact:", err);
    res.status(500).json({ ok: false, message: "Gagal update kontak" });
  }
});

/**
 * ===========================
 * Delete kontak
 * ===========================
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const q = { _id: id };
    if (req.user.role !== "admin") {
      q.userId = new mongoose.Types.ObjectId(req.user.id);
    }

    const deleted = await Contact.findOneAndDelete(q);

    if (!deleted) {
      return res.status(404).json({ ok: false, message: "Kontak tidak ditemukan" });
    }

    res.json({ ok: true, message: "Kontak berhasil dihapus" });
  } catch (err) {
    console.error("❌ Error delete contact:", err);
    res.status(500).json({ ok: false, message: "Gagal hapus kontak" });
  }
});

module.exports = router;
