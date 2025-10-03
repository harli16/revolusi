const express = require("express");
const router = express.Router();
const Log = require("../models/Log");

// GET: /api/logs/:userId
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const logs = await Log.find({ userId }).sort({ createdAt: -1 }).exec();

    res.json({ ok: true, logs });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Cari log untuk userId:", userId); // debug

    const logs = await Log.find({ userId }).sort({ createdAt: -1 }).exec();
    console.log("Hasil query logs:", logs.length);

    res.json({ ok: true, logs });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
