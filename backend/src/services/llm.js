const OpenAI = require('openai');
const config = require('../config/env');

const DEFAULT_MODEL = config.defaultModel;
const OPENROUTER_BASE = config.openRouter.baseUrl;
const OPENROUTER_API_KEY = config.openRouter.apiKey;
const OPENROUTER_HEADERS = {
  'HTTP-Referer': config.openRouter.referer,
  'X-Title': 'Meu Super AI',
};

const G4F_BASE = config.g4f.baseUrl ? `${config.g4f.baseUrl.replace(/\/$/, '')}/v1` : null;

function isG4FModel(model) {
  if (!model) return true;
  return model.startsWith('gpt-') || model.startsWith('g4f:');
}

async function callOpenRouter(model, messages, temperature) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY ausente');
  }

  const client = new OpenAI({ baseURL: OPENROUTER_BASE, apiKey: OPENROUTER_API_KEY, defaultHeaders: OPENROUTER_HEADERS });
  const response = await client.chat.completions.create({ model, messages, temperature });
  const content = response.choices?.[0]?.message?.content || '';
  return { content, provider: 'openrouter', usage: response.usage || {} };
}

async function callG4F(model, messages, temperature) {
  if (!G4F_BASE) {
    throw new Error('G4F_API_URL ausente');
  }

  const url = `${G4F_BASE}/chat/completions`;
  const payload = {
    model: model || 'gpt-4o-mini',
    messages,
    stream: false,
    temperature,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`G4F falhou (${response.status})`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content || choice?.delta?.content || data.message?.content || '';
  return { content, provider: 'g4f', usage: data.usage || {} };
}

async function generateChat({ model, messages, temperature = 0.7 }) {
  const modelId = model || DEFAULT_MODEL;
  const preferG4F = G4F_BASE && isG4FModel(modelId);

  if (preferG4F) {
    try {
      return await callG4F(modelId, messages, temperature);
    } catch (err) {
      if (!OPENROUTER_API_KEY) throw err;
      // Fallback silencioso para OpenRouter
      return await callOpenRouter(modelId, messages, temperature);
    }
  }

  return callOpenRouter(modelId, messages, temperature);
}

module.exports = { generateChat };
