const OpenAI = require('openai');

const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'google/gemini-2.0-flash-exp:free';
const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const G4F_BASE = process.env.G4F_API_URL ? `${process.env.G4F_API_URL.replace(/\/$/, '')}/v1` : null;

function buildClient(baseURL, apiKey, extraHeaders = {}) {
  return new OpenAI({
    baseURL,
    apiKey,
    defaultHeaders: extraHeaders,
  });
}

function pickProvider(model) {
  if (G4F_BASE && model?.startsWith('gpt')) {
    return { provider: 'g4f', baseURL: G4F_BASE, apiKey: 'not-needed', headers: {} };
  }
  return {
    provider: 'openrouter',
    baseURL: OPENROUTER_BASE,
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://jgsp.me',
      'X-Title': 'Meu Super AI',
    },
  };
}

async function generateChat({ model, messages, temperature = 0.7 }) {
  const modelId = model || DEFAULT_MODEL;
  const { provider, baseURL, apiKey, headers } = pickProvider(modelId);
  if (!apiKey && provider === 'openrouter') {
    throw new Error('OPENROUTER_API_KEY ausente');
  }

  const client = buildClient(baseURL, apiKey, headers);
  const response = await client.chat.completions.create({
    model: modelId,
    messages,
    temperature,
  });

  const content = response.choices?.[0]?.message?.content || '';
  const usage = response.usage || {};
  return { content, provider, usage };
}

module.exports = { generateChat };
