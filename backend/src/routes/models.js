const express = require('express');
const GlobalConfig = require('../../models/GlobalConfig');

const router = express.Router();

const BASE_MODELS = [
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'openrouter' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'openrouter' },
  { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek V3', provider: 'openrouter' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openrouter' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (G4F)', provider: 'g4f' },
];

const G4F_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'g4f' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'g4f' },
  { id: 'gpt-4', name: 'GPT-4 (proxy)', provider: 'g4f' },
];

router.get('/models', async (_req, res) => {
  try {
    const hiddenCfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
    const hidden = hiddenCfg?.value || [];
    const filtered = BASE_MODELS.filter((m) => !hidden.includes(`${m.provider}:${m.id}`));
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar modelos', details: err.message });
  }
});

router.get('/models/g4f', async (_req, res) => {
  res.json(G4F_MODELS);
});

module.exports = router;
