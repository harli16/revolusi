const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// semua route ini butuh login + role admin/superadmin
router.use(authenticateToken, requireAdmin);

// ==========================
// GET /users -> ambil semua user
// ==========================
router.get('/', async (req, res) => {
  try {
    const users = await User.find({})
      .select('_id username role active isOnline lastActive createdAt')
      .lean()
      .exec();
    res.json({ ok: true, users });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ==========================
// GET /users/:id -> ambil detail user
// ==========================
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('_id username role active isOnline lastActive createdAt')
      .lean()
      .exec();
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ==========================
// POST /users -> buat user baru
// ==========================
router.post('/', async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'username/password required' });
  }

  try {
    const created = await User.createWithPassword(username, password, role || 'user');
    res.json({
      ok: true,
      user: {
        id: created._id,
        username: created.username,
        role: created.role,
        active: created.active,
        isOnline: created.isOnline,
        lastActive: created.lastActive,
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ==========================
// PUT /users/:id -> update user (username, role, password optional)
// ==========================
router.put('/:id', async (req, res) => {
  const { username, role, password } = req.body || {};
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    if (username) user.username = username;
    if (role) user.role = role;
    if (password) await user.setPassword(password); // method dari model User

    await user.save();

    res.json({
      ok: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        active: user.active,
        isOnline: user.isOnline,
        lastActive: user.lastActive,
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ==========================
// PATCH /users/:id/status -> suspend / aktifkan user
// ==========================
router.patch('/:id/status', async (req, res) => {
  const { active } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { active },
      { new: true, select: '_id username role active isOnline lastActive createdAt' }
    );
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ==========================
// DELETE /users/:id -> hapus user
// ==========================
router.delete('/:id', async (req, res) => {
  try {
    const result = await User.deleteOne({ _id: req.params.id }).exec();
    if (result.deletedCount === 0) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }
    res.json({ ok: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
