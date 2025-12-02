/**
 * ============ SISTEMA DE PROVIDERS DE IA ============
 * Arquitetura modular para diferentes provedores de IA
 * Cada provider tem sua própria configuração e lógica
 */

const OpenAI = require('openai');
const axios = require('axios');

// Cache de clients para evitar re-instanciação
const clientCache = new Map();

// URL do servidor G4F Python (pode ser local ou remoto)
const G4F_PYTHON_API_URL = process.env.G4F_API_URL || 'http://meu-super-ai-g4f.southcentralus.azurecontainer.io:8080';

/**
 * Configuração dos providers disponíveis
 */
const PROVIDERS = {
  // OpenRouter - API paga com muitos modelos
  openrouter: {
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    keyEnvVar: 'OPENROUTER_API_KEY',
    supportsTools: true,
    supportsStreaming: true,
    headers: (referer = 'https://meu-super-ai.vercel.app') => ({
      'HTTP-Referer': referer,
      'X-Title': 'Meu Super AI'
    }),
    defaultModel: 'google/gemini-2.0-flash-exp:free'
  },

  // Groq - Ultra rápido, API gratuita com limites
  groq: {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    requiresKey: true,
    keyEnvVar: 'GROQ_API_KEY',
    supportsTools: true,
    supportsStreaming: true,
    defaultModel: 'llama-3.3-70b-versatile',
    // Limites oficiais do Groq por modelo (RPM, RPD, TPM, TPD)
    // Atualizado em Dez 2024 - Alguns modelos usam prefixos (openai/, meta-llama/, etc)
    rateLimits: {
      'gemma2-9b-it': { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
      'llama-3.3-70b-versatile': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
      'llama-3.1-8b-instant': { rpm: 30, rpd: 14400, tpm: 20000, tpd: 500000 },
      'meta-llama/llama-4-maverick-17b-128e-instruct': { rpm: 30, rpd: 1000, tpm: 6000, tpd: 200000 },
      'meta-llama/llama-4-scout-17b-16e-instruct': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
      'meta-llama/llama-guard-4-12b': { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
      'llama-guard-3-8b': { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
      'mixtral-8x7b-32768': { rpm: 30, rpd: 14400, tpm: 5000, tpd: 500000 },
      'whisper-large-v3': { rpm: 20, rpd: 2000, tpm: null, tpd: null },
      'whisper-large-v3-turbo': { rpm: 20, rpd: 2000, tpm: null, tpd: null },
      'distil-whisper-large-v3-en': { rpm: 20, rpd: 2000, tpm: null, tpd: null },
      'playai-tts': { rpm: 30, rpd: 14400, tpm: 10000, tpd: null },
      'playai-tts-arabic': { rpm: 30, rpd: 14400, tpm: 10000, tpd: null },
      'qwen-qwq-32b': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
      'qwen-2.5-coder-32b': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
      'qwen-2.5-32b': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
      'qwen/qwen3-32b': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
      'mistral-saba-24b': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
      'deepseek-r1-distill-qwen-32b': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
      'deepseek-r1-distill-llama-70b': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
      'groq/compound': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
      'groq/compound-mini': { rpm: 30, rpd: 14400, tpm: 20000, tpd: 500000 },
      'openai/gpt-oss-120b': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
      'openai/gpt-oss-20b': { rpm: 30, rpd: 14400, tpm: 20000, tpd: 500000 },
      'moonshotai/kimi-k2-instruct-0905': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 }
    }
  },

  // Cerebras - Rápido, API gratuita
  cerebras: {
    name: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    requiresKey: true,
    keyEnvVar: 'CEREBRAS_API_KEY',
    supportsTools: false,
    supportsStreaming: true,
    defaultModel: 'llama3.1-70b'
  },

  // Pollinations - Gratuito, sem API key
  pollinations: {
    name: 'Pollinations AI',
    baseURL: 'https://text.pollinations.ai/openai',
    requiresKey: false,
    supportsTools: true,
    supportsStreaming: false,
    supportsImages: true,
    imageEndpoint: 'https://image.pollinations.ai/prompt/',
    defaultModel: 'gpt-5-nano'
  },

  // DeepInfra - Modelos open source
  deepinfra: {
    name: 'DeepInfra',
    baseURL: 'https://api.deepinfra.com/v1/openai',
    requiresKey: false, // Tem tier gratuito limitado
    supportsTools: true,
    supportsStreaming: true,
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct'
  },

  // Cloudflare Workers AI
  cloudflare: {
    name: 'Cloudflare AI',
    baseURL: 'https://g4f.dev/api/worker',
    requiresKey: false,
    supportsTools: false,
    supportsStreaming: false,
    defaultModel: '@cf/meta/llama-3.1-8b-instruct'
  },

  // HuggingFace Inference
  huggingface: {
    name: 'HuggingFace',
    baseURL: 'https://api-inference.huggingface.co/v1',
    requiresKey: true,
    keyEnvVar: 'HUGGINGFACE_API_KEY',
    supportsTools: false,
    supportsStreaming: true,
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct'
  },

  // GPT4Free Python - Acessa TODOS os providers do g4f Python
  // Requer que o servidor g4f-server esteja rodando (docker-compose up)
  g4f_python: {
    name: 'GPT4Free (Python)',
    baseURL: G4F_PYTHON_API_URL + '/v1',
    requiresKey: false,
    supportsTools: false,
    supportsStreaming: true,
    supportsImages: true,
    isG4FPython: true,
    // Providers Python disponíveis (os principais que funcionam)
    pythonProviders: [
      'Copilot', 'Bing', 'DeepInfra', 'HuggingChat', 'HuggingFace',
      'OpenaiChat', 'Gemini', 'GeminiPro', 'MetaAI', 'You',
      'PollinationsAI', 'Cloudflare', 'DDG', 'Blackbox',
      'TeachAnything', 'Puter', 'Qwen', 'GLM'
    ],
    defaultModel: 'gpt-4o'
  }
};

/**
 * Retorna a configuração de um provider
 */
function getProviderConfig(providerName) {
  return PROVIDERS[providerName] || null;
}

/**
 * Lista todos os providers disponíveis
 */
function listProviders() {
  return Object.entries(PROVIDERS).map(([id, config]) => ({
    id,
    name: config.name,
    requiresKey: config.requiresKey,
    supportsTools: config.supportsTools,
    supportsStreaming: config.supportsStreaming,
    supportsImages: config.supportsImages || false,
    defaultModel: config.defaultModel
  }));
}

/**
 * Cria um client OpenAI-compatible para um provider
 */
function createClient(providerName, apiKey = null) {
  const config = PROVIDERS[providerName];
  if (!config) {
    throw new Error(`Provider não encontrado: ${providerName}`);
  }

  // Verifica se precisa de API key
  if (config.requiresKey && !apiKey) {
    // Tenta pegar do ambiente
    apiKey = process.env[config.keyEnvVar];
    if (!apiKey) {
      throw new Error(`API key necessária para ${config.name}. Configure ${config.keyEnvVar}`);
    }
  }

  const cacheKey = `${providerName}:${apiKey || 'nokey'}`;
  
  // Retorna do cache se existir
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }

  // Cria novo client
  const clientConfig = {
    baseURL: config.baseURL,
    apiKey: apiKey || 'dummy', // Alguns providers não precisam
    defaultHeaders: config.headers ? config.headers() : {}
  };

  const client = new OpenAI(clientConfig);
  
  // Adiciona metadata ao client
  client._providerName = providerName;
  client._providerConfig = config;

  // Cacheia
  clientCache.set(cacheKey, client);

  return client;
}

/**
 * Faz uma chamada de chat para qualquer provider
 */
async function chat(providerName, options) {
  const {
    model,
    messages,
    tools,
    apiKey,
    stream = false,
    ...rest
  } = options;

  const config = PROVIDERS[providerName];
  if (!config) {
    throw new Error(`Provider não encontrado: ${providerName}`);
  }

  const client = createClient(providerName, apiKey);
  const modelToUse = model || config.defaultModel;

  const params = {
    model: modelToUse,
    messages,
    stream,
    ...rest
  };

  // Adiciona tools se suportado
  if (tools && config.supportsTools) {
    params.tools = tools;
    params.tool_choice = 'auto';
  }

  try {
    const response = await client.chat.completions.create(params);
    
    // Normaliza resposta
    if (response?.choices?.[0]?.message) {
      const msg = response.choices[0].message;
      msg._provider = providerName;
      msg._model = modelToUse;
      msg._tokens = response.usage?.total_tokens || 0;
      return msg;
    }

    throw new Error('Resposta inválida do provider');
  } catch (error) {
    error._provider = providerName;
    error._model = modelToUse;
    throw error;
  }
}

/**
 * Faz uma chamada com fallback para múltiplos providers
 */
async function chatWithFallback(providers, options) {
  const errors = [];

  for (const providerName of providers) {
    try {
      console.log(`[Provider] Tentando ${providerName}...`);
      return await chat(providerName, options);
    } catch (error) {
      console.log(`[Provider] ${providerName} falhou: ${error.message}`);
      errors.push({ provider: providerName, error: error.message });
      continue;
    }
  }

  throw new Error(`Todos os providers falharam: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`);
}

/**
 * Detecta o provider ideal baseado no modelo
 */
function detectProvider(model) {
  if (!model) return 'pollinations';

  // Groq models
  if (model.includes('llama-3.3') || model.includes('llama-3.1') || 
      model.includes('mixtral') || model.includes('gemma2') ||
      model.includes('whisper') || model.includes('playai-tts')) {
    return 'groq';
  }

  // Cloudflare
  if (model.startsWith('@cf/') || model.startsWith('@hf/')) {
    return 'cloudflare';
  }

  // OpenRouter (modelos com :free ou formato org/model)
  if (model.includes(':free') || model.includes('/')) {
    return 'openrouter';
  }

  // DeepInfra
  if (model.includes('meta-llama/') || model.includes('Qwen/') || model.includes('deepseek-ai/')) {
    return 'deepinfra';
  }

  // HuggingFace
  if (model.includes('HuggingFace') || model.includes('huggingface')) {
    return 'huggingface';
  }

  // Default
  return 'pollinations';
}

/**
 * Retorna os rate limits do Groq para um modelo
 */
function getGroqRateLimits(model) {
  return PROVIDERS.groq.rateLimits[model] || null;
}

// ============ FUNÇÕES DO G4F PYTHON ============

/**
 * Verifica se o servidor G4F Python está online
 */
async function isG4FPythonAvailable() {
  try {
    const response = await axios.get(`${G4F_PYTHON_API_URL}/`, { timeout: 5000 });
    return response.data?.status === 'online';
  } catch {
    return false;
  }
}

/**
 * Lista os modelos disponíveis no G4F Python
 */
async function listG4FPythonModels() {
  try {
    const response = await axios.get(`${G4F_PYTHON_API_URL}/v1/models`, { timeout: 10000 });
    return response.data?.data || [];
  } catch (e) {
    console.error('[G4F Python] Erro ao listar modelos:', e.message);
    return [];
  }
}

/**
 * Lista os providers Python disponíveis
 */
async function listG4FPythonProviders() {
  try {
    const response = await axios.get(`${G4F_PYTHON_API_URL}/v1/providers`, { timeout: 10000 });
    return response.data?.data || [];
  } catch (e) {
    console.error('[G4F Python] Erro ao listar providers:', e.message);
    return [];
  }
}

/**
 * Faz uma chamada de chat via G4F Python
 */
async function chatG4FPython(options) {
  let { model, messages, stream = false, provider = null } = options;
  
  // Remove prefixo 'g4f:' se presente
  if (model && model.startsWith('g4f:')) {
    model = model.replace('g4f:', '');
  }
  
  try {
    const payload = {
      model: model || 'auto',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream,
      provider
    };

    if (stream) {
      // Retorna um stream generator
      const response = await axios.post(
        `${G4F_PYTHON_API_URL}/v1/chat/completions`,
        payload,
        { 
          responseType: 'stream',
          timeout: 120000,
          headers: { 'Accept': 'text/event-stream' }
        }
      );
      return response.data;
    } else {
      const response = await axios.post(
        `${G4F_PYTHON_API_URL}/v1/chat/completions`,
        payload,
        { timeout: 120000 }
      );
      return response.data;
    }
  } catch (e) {
    console.error('[G4F Python] Erro no chat:', e.message);
    throw e;
  }
}

/**
 * Gera imagem via G4F Python
 */
async function generateImageG4FPython(prompt, model = 'flux', provider = null) {
  try {
    const response = await axios.post(
      `${G4F_PYTHON_API_URL}/v1/images/generations`,
      { prompt, model, provider },
      { timeout: 120000 }
    );
    return response.data;
  } catch (e) {
    console.error('[G4F Python] Erro na geração de imagem:', e.message);
    throw e;
  }
}

module.exports = {
  PROVIDERS,
  getProviderConfig,
  listProviders,
  createClient,
  chat,
  chatWithFallback,
  detectProvider,
  getGroqRateLimits,
  // Funções do G4F Python
  G4F_PYTHON_API_URL,
  isG4FPythonAvailable,
  listG4FPythonModels,
  listG4FPythonProviders,
  chatG4FPython,
  generateImageG4FPython
};
