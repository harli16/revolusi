const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const Template = require("../models/Template");

// Semua route butuh login
router.use(authenticateToken);

/**
 * ===========================
 * GET semua template milik user login
 * ===========================
 */
router.get("/", async (req, res) => {
  try {
    const templates = await Template.find({ userId: req.user.id }) // ✅ fix
      .sort({ createdAt: -1 });

    res.json({ ok: true, templates });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * ===========================
 * POST buat template baru
 * ===========================
 */
router.post("/", async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ ok: false, message: "title & message required" });
    }

    const tpl = await Template.create({
      userId: req.user.id, // ✅ fix
      title,
      message,
    });

    res.json({ ok: true, template: tpl });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * ===========================
 * PUT update template milik user login
 * ===========================
 */
router.put("/:id", async (req, res) => {
  try {
    const { title, message } = req.body;
    const tpl = await Template.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id }, // ✅ fix
      { title, message },
      { new: true }
    );

    if (!tpl) {
      return res.status(404).json({ ok: false, message: "Template not found" });
    }

    res.json({ ok: true, template: tpl });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * ===========================
 * DELETE hapus template milik user login
 * ===========================
 */
router.delete("/:id", async (req, res) => {
  try {
    const tpl = await Template.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id, // ✅ fix
    });

    if (!tpl) {
      return res.status(404).json({ ok: false, message: "Template not found" });
    }

    res.json({ ok: true, message: "Template deleted" });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
