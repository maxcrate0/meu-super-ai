const express = require('express');
const GlobalConfig = require('../../models/GlobalConfig');

const router = express.Router();

// Modelos base por provedor com categorias
const BASE_MODELS = [
  // OpenRouter - Text/Chat
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'openrouter', type: 'chat' },
  { id: 'google/gemini-2.5-pro-exp-03-25:free', name: 'Gemini 2.5 Pro', provider: 'openrouter', type: 'chat' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'openrouter', type: 'chat' },
  { id: 'meta-llama/llama-4-scout:free', name: 'Llama 4 Scout', provider: 'openrouter', type: 'chat' },
  { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek V3', provider: 'openrouter', type: 'chat' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', provider: 'openrouter', type: 'chat' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B', provider: 'openrouter', type: 'chat' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', provider: 'openrouter', type: 'chat' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B', provider: 'openrouter', type: 'chat' },
  
  // OpenRouter - Code
  { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B', provider: 'openrouter', type: 'code' },
  { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder', provider: 'openrouter', type: 'code' },
  
  // OpenRouter - Vision
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Vision', provider: 'openrouter', type: 'image' },
  { id: 'meta-llama/llama-3.2-90b-vision-instruct:free', name: 'Llama 3.2 90B Vision', provider: 'openrouter', type: 'image' },
  
  // Groq
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', provider: 'groq', type: 'chat' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', provider: 'groq', type: 'chat' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', type: 'chat' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B', provider: 'groq', type: 'chat' },
  { id: 'whisper-large-v3-turbo', name: 'Whisper Large Turbo', provider: 'groq', type: 'audio' },
  { id: 'llama-3.3-70b-specdec', name: 'Llama 3.3 70B SpecDec', provider: 'groq', type: 'chat' },
  
  // Cloudflare Workers AI
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B (CF)', provider: 'cloudflare', type: 'chat' },
  { id: '@cf/qwen/qwen1.5-14b-chat-awq', name: 'Qwen 1.5 14B (CF)', provider: 'cloudflare', type: 'chat' },
  { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base (CF)', provider: 'cloudflare', type: 'image' },
  { id: '@cf/openai/whisper', name: 'Whisper (CF)', provider: 'cloudflare', type: 'audio' },
];

// Modelos G4F padrão (serão expandidos pelo endpoint /models/g4f-updated)
const G4F_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'g4f', type: 'chat' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'g4f', type: 'chat' },
  { id: 'gpt-4', name: 'GPT-4', provider: 'g4f', type: 'chat' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'g4f', type: 'chat' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'g4f', type: 'chat' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'g4f', type: 'chat' },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'g4f', type: 'chat' },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', provider: 'g4f', type: 'chat' },
  { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'g4f', type: 'chat' },
  { id: 'dall-e-3', name: 'DALL-E 3', provider: 'g4f', type: 'image' },
  { id: 'midjourney', name: 'Midjourney', provider: 'g4f', type: 'image' },
  { id: 'stable-diffusion-3', name: 'Stable Diffusion 3', provider: 'g4f', type: 'image' },
];

// G4F Python local models
const G4F_PYTHON_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Python)', provider: 'g4f-python', type: 'chat' },
  { id: 'gpt-4o', name: 'GPT-4o (Python)', provider: 'g4f-python', type: 'chat' },
  { id: 'gpt-4', name: 'GPT-4 (Python)', provider: 'g4f-python', type: 'chat' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus (Python)', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B (Python)', provider: 'g4f-python', type: 'chat' },
  { id: 'gemini-pro', name: 'Gemini Pro (Python)', provider: 'g4f-python', type: 'chat' },
];

function filterHidden(models, hidden) {
  if (!hidden || !hidden.length) return models;
  return models.filter((m) => !hidden.includes(`${m.provider}:${m.id}`));
}

// Retorna todos os modelos base (OpenRouter, Groq, Cloudflare)
router.get('/models', async (_req, res) => {
  try {
    const hiddenCfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
    const hidden = hiddenCfg?.value || [];
    res.json(filterHidden(BASE_MODELS, hidden));
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar modelos', details: err.message });
  }
});

// Retorna modelos G4F (inclui g4f e g4f-python)
router.get('/models/g4f', async (_req, res) => {
  try {
    const hiddenCfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
    const hidden = hiddenCfg?.value || [];
    const allG4F = [...G4F_MODELS, ...G4F_PYTHON_MODELS];
    res.json(filterHidden(allG4F, hidden));
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar modelos G4F', details: err.message });
  }
});

// Retorna TODOS os modelos combinados
router.get('/models/all', async (_req, res) => {
  try {
    const hiddenCfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
    const hidden = hiddenCfg?.value || [];
    const allModels = [...BASE_MODELS, ...G4F_MODELS, ...G4F_PYTHON_MODELS];
    res.json(filterHidden(allModels, hidden));
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar todos modelos', details: err.message });
  }
});

// Lista por provedor específico
router.get('/models/provider/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const hiddenCfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
    const hidden = hiddenCfg?.value || [];
    const allModels = [...BASE_MODELS, ...G4F_MODELS, ...G4F_PYTHON_MODELS];
    const filtered = allModels.filter(m => m.provider === provider);
    res.json(filterHidden(filtered, hidden));
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar modelos', details: err.message });
  }
});

// Lista por tipo (chat, image, audio, video, code)
router.get('/models/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const hiddenCfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
    const hidden = hiddenCfg?.value || [];
    const allModels = [...BASE_MODELS, ...G4F_MODELS, ...G4F_PYTHON_MODELS];
    const filtered = allModels.filter(m => m.type === type);
    res.json(filterHidden(filtered, hidden));
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar modelos', details: err.message });
  }
});

module.exports = router;
