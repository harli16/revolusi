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
 * Tambah kontak manual
 * ===========================
 */
router.post("/", async (req, res) => {
  try {
    const { name, waNumber, school, kelas, tahunLulus } = req.body;
    if (!waNumber || !name) {
      return res.status(400).json({ ok: false, message: "Nama dan nomor wajib diisi." });
    }

    // Standarisasi nomor WA (otomatis ganti 0 -> 62)
    let cleanNumber = waNumber.replace(/\D/g, "");
    if (cleanNumber.startsWith("0")) {
      cleanNumber = "62" + cleanNumber.slice(1);
    }

    const contact = await Contact.create({
      userId: req.user.id,
      name: toTitleCase(name),
      waNumber: cleanNumber,
      school: toTitleCase(school || ""),
      kelas: kelas || "",
      tahunLulus: tahunLulus || "",
    });

    res.json({ ok: true, data: contact });
  } catch (err) {
    console.error("❌ Gagal menambah kontak manual:", err);
    res.status(500).json({ ok: false, message: "Gagal menambah kontak." });
  }
});

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
    const { search, school, kelas, tahun, page = 1, limit = 5000 } = req.query;
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
/**
 * ===========================
 * Export kontak ke CSV (pakai filter aktif)
 * ===========================
 */
router.get("/export", async (req, res) => {
  try {
    const { search, school, kelas, tahun } = req.query;
    const q = {};

    // 🔐 Batasi per user (kecuali admin)
    if (req.user.role !== "admin") {
      q.userId = new mongoose.Types.ObjectId(req.user.id);
    }

    // 🔍 Terapkan filter jika dikirim dari FE
    if (search) {
      q.$or = [
        { waNumber: new RegExp(search, "i") },
        { name: new RegExp(search, "i") },
      ];
    }

    if (school) {
      q.school = new RegExp(`^${school}$`, "i");
    }

    if (kelas) {
      q.kelas = new RegExp(`^${kelas}$`, "i");
    }

    if (tahun) {
      q.tahunLulus = new RegExp(`^${tahun}$`, "i");
    }

    console.log("📤 Filter export yang digunakan:", q);

    // 🧾 Ambil data sesuai filter
    const contacts = await Contact.find(q).sort({ name: 1 }).lean();

    // 🎯 Format kolom ekspor (header + mapping)
    const fields = [
      { label: "Nomor WA", value: "waNumber" },
      { label: "Nama Lengkap", value: "name" },
      { label: "Asal Sekolah", value: "school" },
      { label: "Kelas", value: "kelas" },
      { label: "Tahun Lulus", value: "tahunLulus" },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(contacts);

    // 📦 Kirim file hasil ekspor
    res.header("Content-Type", "text/csv");
    res.attachment("contacts_filtered.csv");
    return res.send(csv);
  } catch (err) {
    console.error("❌ Error export contacts:", err);
    res.status(500).json({ ok: false, message: "Gagal export kontak" });
  }
})

/**
 * ===========================
 * Ambil daftar sekolah unik (per user)
 * ===========================
 */
router.get("/schools", async (req, res) => {
  try {
    const q = {};
    if (req.user.role !== "admin") {
      q.userId = new mongoose.Types.ObjectId(req.user.id);
    }

    // Ambil daftar sekolah unik berdasarkan user
    const schools = await Contact.distinct("school", q);

    // Bersihkan data: buang kosong/null, ubah ke huruf besar semua, urutkan abjad
    const clean = schools
      .filter((s) => s && s.trim() !== "")
      .map((s) => s.trim().toUpperCase())
      .sort();

    res.json({ ok: true, data: clean });
  } catch (err) {
    console.error("❌ Error get distinct schools:", err);
    res.status(500).json({ ok: false, message: "Gagal ambil daftar sekolah" });
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