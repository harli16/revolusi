const express = require('express');
const router = express.Router();
const wa = require('../services/wa');
const { authenticateToken } = require('../middleware/auth');

// Semua route di bawah ini wajib login
router.use(authenticateToken);

/**
 * ===========================
 * Cek status koneksi WA user
 * ===========================
 */
router.get('/status', (req, res) => {
  const userId = req.user.id;
  res.json({
    ok: true,
    state: wa.getState(userId),
    connected: wa.isConnected(userId),
    registered: wa.isRegistered(userId),
    hasQr: wa.hasQr(userId),
  });
});

/**
 * ===========================
 * Mulai session / connect WA
 * (akan memicu QR kalau belum scan)
 * ===========================
 */
router.post('/connect', async (req, res) => {
  await wa.startSession(req.user.id);
  res.json({ ok: true, message: 'Session started' });
});

/**
 * ===========================
 * Ambil QR Code user ini
 * ===========================
 */
router.get('/qr.png', (req, res) => {
  const buf = wa.getQrPng(req.user.id);
  if (!buf) {
    return res.status(404).send('QR not available');
  }
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(buf);
});

/**
 * ===========================
 * Reset session user (logout WA)
 * ===========================
 */
router.post('/reset', async (req, res) => {
  await wa.reset(req.user.id);
  res.json({ ok: true, message: 'Session reset for current user' });
});

module.exports = router;
