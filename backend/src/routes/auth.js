const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function sign(user) {
  const payload = { id: user._id, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'change-me', { expiresIn: '7d' });
  return token;
}

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Informe usuário e senha' });

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Usuário já existe' });

    const hash = await bcrypt.hash(password, 10);
    const isFirstUser = (await User.countDocuments()) === 0;
    const user = await User.create({ username, password: hash, role: isFirstUser ? 'admin' : 'user' });
    const token = sign(user);
    res.json({ token, username: user.username, role: user.role, theme: user.theme, _id: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao registrar', details: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = sign(user);
    res.json({ token, username: user.username, role: user.role, theme: user.theme, _id: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao autenticar', details: err.message });
  }
});

router.get('/me', authRequired, async (req, res) => {
  res.json({
    _id: req.user._id,
    username: req.user.username,
    role: req.user.role,
    theme: req.user.theme,
    displayName: req.user.displayName,
  });
});

module.exports = router;
