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

// Lista completa de modelos G4F Python (fallback quando Python não está disponível)
const G4F_PYTHON_MODELS_FALLBACK = [
  // GPT Models
  { id: 'gpt-4', name: 'GPT-4', provider: 'g4f-python', type: 'chat' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'g4f-python', type: 'chat' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'g4f-python', type: 'chat' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'g4f-python', type: 'chat' },
  { id: 'gpt-4.5', name: 'GPT-4.5', provider: 'g4f-python', type: 'chat' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'g4f-python', type: 'chat' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'g4f-python', type: 'chat' },
  { id: 'gpt-4o-mini-audio-preview', name: 'GPT-4o Mini Audio', provider: 'g4f-python', type: 'audio' },
  { id: 'gpt-4o-mini-tts', name: 'GPT-4o Mini TTS', provider: 'g4f-python', type: 'tts' },
  { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'g4f-python', type: 'chat' },
  
  // O1/O3/O4 Models
  { id: 'o1', name: 'O1', provider: 'g4f-python', type: 'chat' },
  { id: 'o1-mini', name: 'O1 Mini', provider: 'g4f-python', type: 'chat' },
  { id: 'o3-mini', name: 'O3 Mini', provider: 'g4f-python', type: 'chat' },
  { id: 'o3-mini-high', name: 'O3 Mini High', provider: 'g4f-python', type: 'chat' },
  { id: 'o4-mini', name: 'O4 Mini', provider: 'g4f-python', type: 'chat' },
  { id: 'o4-mini-high', name: 'O4 Mini High', provider: 'g4f-python', type: 'chat' },
  
  // DeepSeek Models
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'g4f-python', type: 'chat' },
  { id: 'deepseek-r1-0528', name: 'DeepSeek R1 0528', provider: 'g4f-python', type: 'chat' },
  { id: 'deepseek-r1-0528-turbo', name: 'DeepSeek R1 Turbo', provider: 'g4f-python', type: 'chat' },
  { id: 'deepseek-r1-turbo', name: 'DeepSeek R1 Turbo', provider: 'g4f-python', type: 'chat' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B', provider: 'g4f-python', type: 'chat' },
  { id: 'deepseek-r1-distill-qwen-1.5b', name: 'DeepSeek R1 Distill Qwen 1.5B', provider: 'g4f-python', type: 'chat' },
  { id: 'deepseek-r1-distill-qwen-14b', name: 'DeepSeek R1 Distill Qwen 14B', provider: 'g4f-python', type: 'chat' },
  { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill Qwen 32B', provider: 'g4f-python', type: 'chat' },
  { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'g4f-python', type: 'chat' },
  { id: 'deepseek-v3-0324', name: 'DeepSeek V3 0324', provider: 'g4f-python', type: 'chat' },
  { id: 'deepseek-v3-0324-turbo', name: 'DeepSeek V3 Turbo', provider: 'g4f-python', type: 'chat' },
  { id: 'deepseek-prover-v2', name: 'DeepSeek Prover V2', provider: 'g4f-python', type: 'code' },
  { id: 'deepseek-prover-v2-671b', name: 'DeepSeek Prover V2 671B', provider: 'g4f-python', type: 'code' },
  
  // Gemini Models
  { id: 'gemini-2.0', name: 'Gemini 2.0', provider: 'g4f-python', type: 'chat' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'g4f-python', type: 'chat' },
  { id: 'gemini-2.0-flash-thinking', name: 'Gemini 2.0 Flash Thinking', provider: 'g4f-python', type: 'chat' },
  { id: 'gemini-2.0-flash-thinking-with-apps', name: 'Gemini 2.0 Flash Apps', provider: 'g4f-python', type: 'chat' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'g4f-python', type: 'chat' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'g4f-python', type: 'chat' },
  
  // Gemma Models
  { id: 'gemma-2b', name: 'Gemma 2B', provider: 'g4f-python', type: 'chat' },
  { id: 'gemma-1.1-7b', name: 'Gemma 1.1 7B', provider: 'g4f-python', type: 'chat' },
  { id: 'gemma-2-9b', name: 'Gemma 2 9B', provider: 'g4f-python', type: 'chat' },
  { id: 'gemma-2-27b', name: 'Gemma 2 27B', provider: 'g4f-python', type: 'chat' },
  { id: 'gemma-3-4b', name: 'Gemma 3 4B', provider: 'g4f-python', type: 'chat' },
  { id: 'gemma-3-12b', name: 'Gemma 3 12B', provider: 'g4f-python', type: 'chat' },
  { id: 'gemma-3-27b', name: 'Gemma 3 27B', provider: 'g4f-python', type: 'chat' },
  { id: 'gemma-3n-e4b', name: 'Gemma 3n E4B', provider: 'g4f-python', type: 'chat' },
  
  // Llama Models
  { id: 'llama-2-7b', name: 'Llama 2 7B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-2-70b', name: 'Llama 2 70B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-3-8b', name: 'Llama 3 8B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-3-70b', name: 'Llama 3 70B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-3.2-1b', name: 'Llama 3.2 1B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-3.2-3b', name: 'Llama 3.2 3B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-3.2-11b', name: 'Llama 3.2 11B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-3.2-90b', name: 'Llama 3.2 90B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-4-scout', name: 'Llama 4 Scout', provider: 'g4f-python', type: 'chat' },
  { id: 'llama-4-maverick', name: 'Llama 4 Maverick', provider: 'g4f-python', type: 'chat' },
  
  // Qwen Models
  { id: 'qwen-1.5-7b', name: 'Qwen 1.5 7B', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-2-72b', name: 'Qwen 2 72B', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-2-vl-7b', name: 'Qwen 2 VL 7B', provider: 'g4f-python', type: 'image' },
  { id: 'qwen-2-vl-72b', name: 'Qwen 2 VL 72B', provider: 'g4f-python', type: 'image' },
  { id: 'qwen-2.5', name: 'Qwen 2.5', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-2.5-7b', name: 'Qwen 2.5 7B', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-2.5-72b', name: 'Qwen 2.5 72B', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-2.5-1m', name: 'Qwen 2.5 1M', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-2.5-max', name: 'Qwen 2.5 Max', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', provider: 'g4f-python', type: 'code' },
  { id: 'qwen-2.5-vl-72b', name: 'Qwen 2.5 VL 72B', provider: 'g4f-python', type: 'image' },
  { id: 'qwen-3-0.6b', name: 'Qwen 3 0.6B', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-3-1.7b', name: 'Qwen 3 1.7B', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-3-4b', name: 'Qwen 3 4B', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-3-14b', name: 'Qwen 3 14B', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-3-30b', name: 'Qwen 3 30B', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-3-32b', name: 'Qwen 3 32B', provider: 'g4f-python', type: 'chat' },
  { id: 'qwen-3-235b', name: 'Qwen 3 235B', provider: 'g4f-python', type: 'chat' },
  { id: 'qwq-32b', name: 'QwQ 32B', provider: 'g4f-python', type: 'chat' },
  
  // Grok Models
  { id: 'grok-2', name: 'Grok 2', provider: 'g4f-python', type: 'chat' },
  { id: 'grok-3', name: 'Grok 3', provider: 'g4f-python', type: 'chat' },
  { id: 'grok-3-r1', name: 'Grok 3 R1', provider: 'g4f-python', type: 'chat' },
  
  // Mistral Models
  { id: 'mistral-7b', name: 'Mistral 7B', provider: 'g4f-python', type: 'chat' },
  { id: 'mistral-nemo', name: 'Mistral Nemo', provider: 'g4f-python', type: 'chat' },
  { id: 'mistral-small-24b', name: 'Mistral Small 24B', provider: 'g4f-python', type: 'chat' },
  { id: 'mistral-small-3.1-24b', name: 'Mistral Small 3.1 24B', provider: 'g4f-python', type: 'chat' },
  { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'g4f-python', type: 'chat' },
  
  // Phi Models
  { id: 'phi-3.5-mini', name: 'Phi 3.5 Mini', provider: 'g4f-python', type: 'chat' },
  { id: 'phi-4', name: 'Phi 4', provider: 'g4f-python', type: 'chat' },
  { id: 'phi-4-multimodal', name: 'Phi 4 Multimodal', provider: 'g4f-python', type: 'image' },
  { id: 'phi-4-reasoning-plus', name: 'Phi 4 Reasoning+', provider: 'g4f-python', type: 'chat' },
  
  // Other Models
  { id: 'airoboros-70b', name: 'Airoboros 70B', provider: 'g4f-python', type: 'chat' },
  { id: 'aria', name: 'Aria', provider: 'g4f-python', type: 'chat' },
  { id: 'codegemma-7b', name: 'CodeGemma 7B', provider: 'g4f-python', type: 'code' },
  { id: 'command-a', name: 'Command A', provider: 'g4f-python', type: 'chat' },
  { id: 'command-r', name: 'Command R', provider: 'g4f-python', type: 'chat' },
  { id: 'command-r-plus', name: 'Command R+', provider: 'g4f-python', type: 'chat' },
  { id: 'command-r7b', name: 'Command R7B', provider: 'g4f-python', type: 'chat' },
  { id: 'dolphin-2.6', name: 'Dolphin 2.6', provider: 'g4f-python', type: 'chat' },
  { id: 'dolphin-2.9', name: 'Dolphin 2.9', provider: 'g4f-python', type: 'chat' },
  { id: 'evil', name: 'Evil', provider: 'g4f-python', type: 'chat' },
  { id: 'hermes-2-dpo', name: 'Hermes 2 DPO', provider: 'g4f-python', type: 'chat' },
  { id: 'janus-pro-7b', name: 'Janus Pro 7B', provider: 'g4f-python', type: 'chat' },
  { id: 'kimi-k2', name: 'Kimi K2', provider: 'g4f-python', type: 'chat' },
  { id: 'lzlv-70b', name: 'LZLV 70B', provider: 'g4f-python', type: 'chat' },
  { id: 'meta-ai', name: 'Meta AI', provider: 'g4f-python', type: 'chat' },
  { id: 'nemotron-70b', name: 'Nemotron 70B', provider: 'g4f-python', type: 'chat' },
  { id: 'r1-1776', name: 'R1 1776', provider: 'g4f-python', type: 'chat' },
  { id: 'sonar', name: 'Sonar', provider: 'g4f-python', type: 'chat' },
  { id: 'sonar-pro', name: 'Sonar Pro', provider: 'g4f-python', type: 'chat' },
  { id: 'sonar-reasoning', name: 'Sonar Reasoning', provider: 'g4f-python', type: 'chat' },
  { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', provider: 'g4f-python', type: 'chat' },
  { id: 'wizardlm-2-7b', name: 'WizardLM 2 7B', provider: 'g4f-python', type: 'chat' },
  { id: 'wizardlm-2-8x22b', name: 'WizardLM 2 8x22B', provider: 'g4f-python', type: 'chat' },
  
  // Image Generation Models
  { id: 'dall-e-3', name: 'DALL-E 3', provider: 'g4f-python', type: 'image' },
  { id: 'flux', name: 'Flux', provider: 'g4f-python', type: 'image' },
  { id: 'flux-canny', name: 'Flux Canny', provider: 'g4f-python', type: 'image' },
  { id: 'flux-depth', name: 'Flux Depth', provider: 'g4f-python', type: 'image' },
  { id: 'flux-dev', name: 'Flux Dev', provider: 'g4f-python', type: 'image' },
  { id: 'flux-dev-lora', name: 'Flux Dev LoRA', provider: 'g4f-python', type: 'image' },
  { id: 'flux-kontext', name: 'Flux Kontext', provider: 'g4f-python', type: 'image' },
  { id: 'flux-pro', name: 'Flux Pro', provider: 'g4f-python', type: 'image' },
  { id: 'flux-redux', name: 'Flux Redux', provider: 'g4f-python', type: 'image' },
  { id: 'flux-schnell', name: 'Flux Schnell', provider: 'g4f-python', type: 'image' },
  { id: 'gpt-image', name: 'GPT Image', provider: 'g4f-python', type: 'image' },
  { id: 'sd-3.5-large', name: 'SD 3.5 Large', provider: 'g4f-python', type: 'image' },
  { id: 'sdxl-turbo', name: 'SDXL Turbo', provider: 'g4f-python', type: 'image' },
];
async function loadG4FPythonModels() {
  // Retorna cache se ainda válido
  if (G4F_PYTHON_MODELS_CACHE && G4F_PYTHON_CACHE_TIME && 
      (Date.now() - G4F_PYTHON_CACHE_TIME < CACHE_DURATION)) {
    return G4F_PYTHON_MODELS_CACHE;
  }

  try {
    console.log('🔄 Carregando modelos G4F Python dinamicamente...');
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
    // Fallback para lista completa hardcoded
    G4F_PYTHON_MODELS_CACHE = G4F_PYTHON_MODELS_FALLBACK;
    G4F_PYTHON_CACHE_TIME = Date.now();
    console.log(`⚠️ Usando fallback com ${G4F_PYTHON_MODELS_FALLBACK.length} modelos G4F Python`);
    return G4F_PYTHON_MODELS_FALLBACK;
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
    console.log('📡 Requisição recebida para /models/g4f');
    const hiddenCfg = await GlobalConfig.findOne({ key: 'HIDDEN_MODELS' }).lean();
    const hidden = hiddenCfg?.value || [];
    console.log('🔄 Carregando modelos G4F Python...');
    const pythonModels = await loadG4FPythonModels();
    console.log(`📊 Modelos G4F Python carregados: ${pythonModels.length}`);
    const allG4F = [...G4F_MODELS, ...pythonModels];
    console.log(`📊 Total modelos G4F: ${allG4F.length}`);
    const filtered = filterHidden(allG4F, hidden);
    console.log(`📊 Modelos G4F após filtro: ${filtered.length}`);
    res.json(filtered);
  } catch (err) {
    console.error('❌ Erro na rota /models/g4f:', err);
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

// Pre-load dos modelos no startup (executa em background, mas não bloqueia)
setTimeout(() => {
  Promise.all([loadG4FPythonModels(), loadOpenRouterModels()]).catch(err => {
    console.error('⚠️ Aviso: Erro ao carregar modelos no startup:', err.message);
  });
}, 1000);

module.exports = router;
