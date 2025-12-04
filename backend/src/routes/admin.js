const express = require('express');
const User = require('../../models/User');
const Chat = require('../../models/Chat');
const GlobalConfig = require('../../models/GlobalConfig');
const ModelUsage = require('../../models/ModelUsage');

const router = express.Router();

router.get('/admin/stats', async (_req, res) => {
  const users = await User.countDocuments();
  const chats = await Chat.countDocuments();
  const usages = await ModelUsage.countDocuments();
  res.json({ users, chats, usages });
});

router.get('/admin/models/stats', async (_req, res) => {
  const total = await ModelUsage.countDocuments();
  const errors = await ModelUsage.countDocuments({ success: false });
  res.json({ total, errors });
});

router.get('/admin/users', async (_req, res) => {
  const users = await User.find()
    .select('_id username role createdAt')
    .sort({ createdAt: -1 })
    .lean();
  res.json(users);
});

router.get('/admin/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('_id username role createdAt usage displayName')
    .lean();
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(user);
});

router.get('/admin/users/:id/chats', async (req, res) => {
  const chats = await Chat.find({ userId: req.params.id })
    .select('_id title updatedAt')
    .sort({ updatedAt: -1 })
    .lean();
  res.json(chats);
});

router.get('/admin/models/hidden', async (_req, res) => {
  const cfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
  res.json(cfg?.value || []);
});

router.post('/admin/models/toggle-visibility', async (req, res) => {
  const { modelId, provider, hidden } = req.body;
  if (!modelId || !provider) return res.status(400).json({ error: 'Parâmetros inválidos' });

  const key = `${provider}:${modelId}`;
  const cfg = (await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' })) || new GlobalConfig({ key: 'HIDDEN_MODELS', value: [] });
  let list = cfg.value || [];

  const exists = list.includes(key);
  if (hidden && !exists) list.push(key);
  if (!hidden) list = list.filter((k) => k !== key);

  cfg.value = list;
  await cfg.save();
  res.json({ saved: true, hidden: list });
});

router.post('/admin/models/unhide', async (req, res) => {
  const { modelKey } = req.body;
  if (!modelKey) return res.status(400).json({ error: 'Parâmetro ausente' });
  const cfg = (await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' })) || new GlobalConfig({ key: 'HIDDEN_MODELS', value: [] });
  cfg.value = (cfg.value || []).filter((k) => k !== modelKey);
  await cfg.save();
  res.json({ saved: true });
});

router.get('/admin/api-keys', async (_req, res) => {
  const cfg = await GlobalConfig.findOne({ key: 'API_KEYS' }).lean();
  res.json(cfg?.value || {});
});

router.post('/admin/api-keys', async (req, res) => {
  await GlobalConfig.findOneAndUpdate(
    { key: 'API_KEYS' },
    { key: 'API_KEYS', value: req.body || {}, updatedAt: new Date() },
    { upsert: true }
  );
  res.json({ saved: true });
});

module.exports = router;
