const express = require('express');
const User = require('../../models/User');
const Chat = require('../../models/Chat');
const GlobalConfig = require('../../models/GlobalConfig');
const ModelUsage = require('../../models/ModelUsage');

const router = express.Router();

// ---------- Users ----------
router.get('/admin/users', async (_req, res) => {
  const users = await User.find().select('_id username role createdAt').sort({ createdAt: -1 }).lean();
  res.json(users);
});

router.get('/admin/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id).select('_id username role createdAt usage').lean();
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(user);
});

router.get('/admin/users/:id/chats', async (req, res) => {
  const chats = await Chat.find({ userId: req.params.id }).select('_id title updatedAt').sort({ updatedAt: -1 }).lean();
  res.json(chats);
});

router.post('/admin/users/:id/message', async (_req, res) => {
  res.json({ sent: true });
});

// ---------- Models ----------
router.get('/admin/models/hidden', async (_req, res) => {
  const cfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
  res.json(cfg?.value || []);
});

router.post('/admin/models/toggle-visibility', async (req, res) => {
  const { modelId, provider, hidden } = req.body;
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
  const cfg = (await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' })) || new GlobalConfig({ key: 'HIDDEN_MODELS', value: [] });
  cfg.value = (cfg.value || []).filter((k) => k !== modelKey);
  await cfg.save();
  res.json({ saved: true });
});

router.post('/admin/models/defaults', async (req, res) => {
  await GlobalConfig.findOneAndUpdate(
    { key: 'DEFAULT_MODELS' },
    { key: 'DEFAULT_MODELS', value: req.body || {}, updatedAt: new Date() },
    { upsert: true }
  );
  res.json({ saved: true });
});

router.get('/admin/models/stats', async (_req, res) => {
  const total = await ModelUsage.countDocuments();
  const errors = await ModelUsage.countDocuments({ success: false });
  res.json({ total, errors });
});

router.get('/admin/models/test-results', async (_req, res) => {
  const cfg = await GlobalConfig.findOne({ key: 'MODEL_TEST_RESULTS' }).lean();
  res.json(cfg?.value || null);
});

router.post('/admin/models/test-all', async (_req, res) => {
  await GlobalConfig.findOneAndUpdate(
    { key: 'MODEL_TEST_RESULTS' },
    { key: 'MODEL_TEST_RESULTS', value: { timestamp: new Date(), status: 'queued' } },
    { upsert: true }
  );
  res.json({ queued: true });
});

// ---------- Groq (stubs) ----------
const GROQ_SAMPLE = [
  { id: 'llama-3.3-70b-versatile', hidden: false },
  { id: 'gemma2-9b-it', hidden: false },
];

router.get('/admin/groq/models', async (_req, res) => {
  const hiddenCfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
  const hidden = hiddenCfg?.value || [];
  const models = GROQ_SAMPLE.map((m) => ({ ...m, hidden: hidden.includes(`groq:${m.id}`) }));
  res.json(models);
});

router.post('/admin/groq/toggle-visibility', async (req, res) => {
  const { modelId, hidden } = req.body;
  const key = `groq:${modelId}`;
  const cfg = (await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' })) || new GlobalConfig({ key: 'HIDDEN_MODELS', value: [] });
  let list = cfg.value || [];
  const exists = list.includes(key);
  if (hidden && !exists) list.push(key);
  if (!hidden) list = list.filter((k) => k !== key);
  cfg.value = list;
  await cfg.save();
  res.json({ saved: true, hidden: list });
});

router.get('/admin/groq/stats', async (_req, res) => {
  res.json({ modelUsage: [], topUsersGeneral: [] });
});

// ---------- API Keys ----------
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

// ---------- Stats ----------
router.get('/admin/stats', async (_req, res) => {
  const users = await User.countDocuments();
  const chats = await Chat.countDocuments();
  const usages = await ModelUsage.countDocuments();
  res.json({ users, chats, usages });
});

module.exports = router;
