const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const config = require('../config/env');

async function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente' });

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.id).lean();
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito' });
  }
  return next();
}

module.exports = { authRequired, adminOnly };
