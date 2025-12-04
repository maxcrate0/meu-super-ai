const express = require('express');
const GlobalConfig = require('../../models/GlobalConfig');
const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');

const router = express.Router();
const execAsync = promisify(exec);

// Cache para modelos OpenRouter
let OPENROUTER_MODELS_CACHE = null;
let OPENROUTER_CACHE_TIME = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora

// Função para carregar modelos gratuitos do OpenRouter dinamicamente
async function loadOpenRouterModels() {
  // Retorna cache se ainda válido
  if (OPENROUTER_MODELS_CACHE && OPENROUTER_CACHE_TIME && 
      (Date.now() - OPENROUTER_CACHE_TIME < CACHE_DURATION)) {
    return OPENROUTER_MODELS_CACHE;
  }

  return new Promise((resolve) => {
    https.get('https://openrouter.ai/api/v1/models', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          const freeModels = response.data
            .filter(m => m.pricing?.prompt === '0' && m.pricing?.completion === '0')
            .map(m => {
              // Inferir tipo
              let type = 'chat';
              const nameL = m.name.toLowerCase();
              if (nameL.includes('vision') || nameL.includes('vl')) type = 'vision';
              else if (nameL.includes('coder') || nameL.includes('code')) type = 'code';
              else if (nameL.includes('image') || nameL.includes('dall-e') || nameL.includes('flux')) type = 'image';
              
              return {
                id: m.id,
                name: m.name,
                provider: 'openrouter',
                type,
                context: m.context_length
              };
            });
          
          OPENROUTER_MODELS_CACHE = freeModels;
          OPENROUTER_CACHE_TIME = Date.now();
          console.log(`✅ Carregados ${freeModels.length} modelos gratuitos OpenRouter`);
          resolve(freeModels);
        } catch (error) {
          console.error('❌ Erro ao parsear OpenRouter:', error.message);
          resolve(getFallbackOpenRouterModels());
        }
      });
    }).on('error', (error) => {
      console.error('❌ Erro ao carregar OpenRouter:', error.message);
      resolve(getFallbackOpenRouterModels());
    });
  });
}

// Fallback de modelos OpenRouter em caso de erro
function getFallbackOpenRouterModels() {
  return [
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'openrouter', type: 'chat' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'openrouter', type: 'chat' },
    { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', provider: 'openrouter', type: 'chat' },
  ];
}

// TODOS os modelos GRATUITOS do OpenRouter (mantidos como fallback)
const BASE_MODELS_FALLBACK = [
  // OpenRouter Free Models - Chat
  { id: 'amazon/nova-2-lite-v1:free', name: 'Amazon Nova 2 Lite', provider: 'openrouter', type: 'chat' },
  { id: 'arcee-ai/trinity-mini:free', name: 'Arcee Trinity Mini', provider: 'openrouter', type: 'chat' },
  { id: 'tngtech/tng-r1t-chimera:free', name: 'TNG R1T Chimera', provider: 'openrouter', type: 'chat' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'openrouter', type: 'chat' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'openrouter', type: 'chat' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', provider: 'openrouter', type: 'chat' },
  
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

// Modelos Groq e Cloudflare (estáticos)
const OTHER_MODELS = [
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

// Cache para modelos G4F Python (carregados dinamicamente)
let G4F_PYTHON_MODELS_CACHE = null;
let G4F_PYTHON_CACHE_TIME = null;

// Função para carregar modelos G4F Python dinamicamente
async function loadG4FPythonModels() {
  // Retorna cache se ainda válido
  if (G4F_PYTHON_MODELS_CACHE && G4F_PYTHON_CACHE_TIME && 
      (Date.now() - G4F_PYTHON_CACHE_TIME < CACHE_DURATION)) {
    return G4F_PYTHON_MODELS_CACHE;
  }

  try {
    const { stdout } = await execAsync(`python3 -c "
import g4f
from g4f.models import ModelUtils
import json

models = []
for model_id in sorted(ModelUtils.convert.keys()):
    # Inferir tipo baseado no nome do modelo
    model_type = 'chat'
    lower_id = model_id.lower()
    
    if any(x in lower_id for x in ['flux', 'dall-e', 'sdxl', 'sd-', 'stable-diffusion', 'midjourney']):
        model_type = 'image'
    elif any(x in lower_id for x in ['coder', 'code']):
        model_type = 'code'
    elif any(x in lower_id for x in ['whisper', 'tts', 'audio']):
        model_type = 'audio'
    elif 'vision' in lower_id or 'vl' in lower_id or 'multimodal' in lower_id:
        model_type = 'vision'
    
    # Formatar nome legível
    name = model_id.replace('-', ' ').replace('_', ' ').title()
    
    models.append({
        'id': model_id,
        'name': name,
        'provider': 'g4f-python',
        'type': model_type
    })

print(json.dumps(models))
" 2>/dev/null`);

    const models = JSON.parse(stdout);
    G4F_PYTHON_MODELS_CACHE = models;
    G4F_PYTHON_CACHE_TIME = Date.now();
    
    console.log(`✅ Carregados ${models.length} modelos G4F Python dinamicamente`);
    return models;
  } catch (error) {
    console.error('❌ Erro ao carregar modelos G4F Python:', error.message);
    // Fallback para lista mínima em caso de erro
    const fallback = [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'g4f-python', type: 'chat' },
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'g4f-python', type: 'chat' },
      { id: 'gpt-4', name: 'GPT-4', provider: 'g4f-python', type: 'chat' },
    ];
    return fallback;
  }
}

function filterHidden(models, hidden) {
  if (!hidden || !hidden.length) return models;
  return models.filter((m) => !hidden.includes(`${m.provider}:${m.id}`));
}

// Retorna todos os modelos base (OpenRouter dinâmico, Groq, Cloudflare)
router.get('/models', async (_req, res) => {
  try {
    const hiddenCfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
    const hidden = hiddenCfg?.value || [];
    const openrouterModels = await loadOpenRouterModels();
    const allBase = [...openrouterModels, ...OTHER_MODELS];
    res.json(filterHidden(allBase, hidden));
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar modelos', details: err.message });
  }
});

// Retorna modelos G4F (inclui g4f e g4f-python dinamicamente)
router.get('/models/g4f', async (_req, res) => {
  try {
    const hiddenCfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
    const hidden = hiddenCfg?.value || [];
    const pythonModels = await loadG4FPythonModels();
    const allG4F = [...G4F_MODELS, ...pythonModels];
    res.json(filterHidden(allG4F, hidden));
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar modelos G4F', details: err.message });
  }
});

// Retorna TODOS os modelos combinados (dinâmicos)
router.get('/models/all', async (_req, res) => {
  try {
    const hiddenCfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
    const hidden = hiddenCfg?.value || [];
    const [openrouterModels, pythonModels] = await Promise.all([
      loadOpenRouterModels(),
      loadG4FPythonModels()
    ]);
    const allModels = [...openrouterModels, ...OTHER_MODELS, ...G4F_MODELS, ...pythonModels];
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
    const [openrouterModels, pythonModels] = await Promise.all([
      loadOpenRouterModels(),
      loadG4FPythonModels()
    ]);
    const allModels = [...openrouterModels, ...OTHER_MODELS, ...G4F_MODELS, ...pythonModels];
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
    const [openrouterModels, pythonModels] = await Promise.all([
      loadOpenRouterModels(),
      loadG4FPythonModels()
    ]);
    const allModels = [...openrouterModels, ...OTHER_MODELS, ...G4F_MODELS, ...pythonModels];
    const filtered = allModels.filter(m => m.type === type);
    res.json(filterHidden(filtered, hidden));
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar modelos', details: err.message });
  }
});

// Força atualização do cache de modelos G4F Python e OpenRouter
router.post('/models/refresh', async (_req, res) => {
  try {
    G4F_PYTHON_MODELS_CACHE = null;
    G4F_PYTHON_CACHE_TIME = null;
    OPENROUTER_MODELS_CACHE = null;
    OPENROUTER_CACHE_TIME = null;
    
    const [pythonModels, openrouterModels] = await Promise.all([
      loadG4FPythonModels(),
      loadOpenRouterModels()
    ]);
    
    res.json({ 
      success: true, 
      message: 'Cache atualizado com sucesso',
      g4fPython: pythonModels.length,
      openrouter: openrouterModels.length,
      total: pythonModels.length + openrouterModels.length + OTHER_MODELS.length + G4F_MODELS.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao atualizar cache', details: err.message });
  }
});

// Pre-load dos modelos no startup (executa em background)
Promise.all([loadG4FPythonModels(), loadOpenRouterModels()]).catch(err => {
  console.error('⚠️ Aviso: Erro ao carregar modelos no startup:', err.message);
});

module.exports = router;
