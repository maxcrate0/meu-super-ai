require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai');
const axios = require('axios');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const util = require('util');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');

// ============ SISTEMA DE CACHE EM MEMÓRIA (alternativa ao Redis) ============
class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
    }
    
    set(key, value, ttlSeconds = 300) {
        // Limpa timer anterior se existir
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }
        
        this.cache.set(key, {
            value,
            createdAt: Date.now(),
            ttl: ttlSeconds * 1000
        });
        
        // Auto-expiração
        const timer = setTimeout(() => {
            this.cache.delete(key);
            this.timers.delete(key);
        }, ttlSeconds * 1000);
        
        this.timers.set(key, timer);
        return true;
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        // Verifica se expirou
        if (Date.now() - item.createdAt > item.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }
    
    del(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        return this.cache.delete(key);
    }
    
    // Limpa caches que começam com um prefixo
    delByPrefix(prefix) {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.del(key);
                count++;
            }
        }
        return count;
    }
    
    // Estatísticas do cache
    stats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

const cache = new MemoryCache();

// GPT4Free - carrega o client direto do g4f.dev
let g4fClients = null;

async function loadG4F() {
    if (!g4fClients) {
        const g4fModule = await import('./g4f-client.mjs');
        g4fClients = {
            Client: g4fModule.Client,
            PollinationsAI: g4fModule.PollinationsAI,
            DeepInfra: g4fModule.DeepInfra,
            Together: g4fModule.Together,
            HuggingFace: g4fModule.HuggingFace,
            Worker: g4fModule.Worker,
            Audio: g4fModule.Audio,
            // Providers que requerem API key gratuita
            Groq: g4fModule.Groq,
            Cerebras: g4fModule.Cerebras,
            OpenRouterFree: g4fModule.OpenRouterFree
        };
    }
    return g4fClients;
}

const User = require('./models/User');
const Chat = require('./models/Chat');
const CustomTool = require('./models/CustomTool');
const GlobalConfig = require('./models/GlobalConfig');
const PageContent = require('./models/PageContent');
const ModelUsage = require('./models/ModelUsage');

const execPromise = util.promisify(exec);
const app = express();

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|txt|md|js|jsx|ts|tsx|py|json|csv|html|css|xml|yaml|yml/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mime = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('text/');
        if (ext || mime) cb(null, true);
        else cb(new Error('Tipo de arquivo não suportado'));
    }
});

// Middlewares
app.use(compression());
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false // Desabilita CSP para permitir recursos externos
}));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] }));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate Limiting Global (100 requests por minuto por IP)
const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 100,
    message: { error: 'Muitas requisições. Aguarde um momento.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/ping' // Não limita health check
});
app.use('/api/', globalLimiter);

// Rate Limiting mais restritivo para chat (30 req/min por IP)
const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Limite de mensagens atingido. Aguarde 1 minuto.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate Limiting para auth (10 tentativas por 15 min)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meu-super-ai';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

// Cache para modelos (atualiza a cada 5 minutos)
let modelsCache = { data: [], lastFetch: 0 };
let g4fModelsCache = { data: [], lastFetch: 0 };
const MODELS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Conexão MongoDB com pooling otimizado
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 50, // Aumentado para mais conexões simultâneas
            minPoolSize: 10, // Mantém conexões mínimas abertas
            maxIdleTimeMS: 30000, // Fecha conexões idle após 30s
            retryWrites: false, // Desabilitado para compatibilidade com Azure CosmosDB
            w: 'majority'
        });
        console.log('MongoDB Conectado (pool: 10-50)');
        // Cria admin padrão se não existir
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
            await User.create({ username: 'admin', password: hash, role: 'admin' });
            console.log('Admin padrão criado');
        }
    } catch (err) {
        console.error('Erro MongoDB:', err.message);
    }
};
connectDB();

// Middleware de autenticação com cache
const auth = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Tenta buscar do cache primeiro
        const cacheKey = `user:${decoded.id}`;
        let user = cache.get(cacheKey);
        
        if (!user) {
            user = await User.findById(decoded.id).lean();
            if (user) {
                // Cacheia por 5 minutos
                cache.set(cacheKey, user, 300);
            }
        }
        
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
        req.user = user;
        req.user._id = decoded.id; // Garante que _id está disponível como string
        next();
    } catch (e) {
        res.status(401).json({ error: 'Token inválido' });
    }
};

// Middleware de admin
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
};

// Helper para obter API Key (com cache)
const getApiKey = async (user) => {
    if (user.personal_api_key) return user.personal_api_key;
    
    // Tenta cache primeiro
    const cacheKey = 'config:OPENROUTER_API_KEY';
    let apiKey = cache.get(cacheKey);
    
    if (apiKey === null) {
        await connectDB();
        const globalKey = await GlobalConfig.findOne({ key: 'OPENROUTER_API_KEY' }).lean();
        apiKey = globalKey?.value || process.env.GLOBAL_API_KEY || '';
        // Cacheia por 10 minutos
        cache.set(cacheKey, apiKey, 600);
    }
    
    return apiKey;
};

// Helper para obter Groq API Key (com cache)
const getGroqApiKey = async () => {
    const cacheKey = 'config:GROQ_API_KEY';
    let groqKey = cache.get(cacheKey);
    
    if (groqKey === null) {
        await connectDB();
        const keyConfig = await GlobalConfig.findOne({ key: 'GROQ_API_KEY' }).lean();
        groqKey = keyConfig?.value || process.env.GROQ_API_KEY || '';
        cache.set(cacheKey, groqKey, 600);
    }
    
    return groqKey;
};

// Helper para obter System Prompt Global (com cache)
const getGlobalSystemPrompt = async () => {
    const cacheKey = 'config:GLOBAL_SYSTEM_PROMPT';
    let prompt = cache.get(cacheKey);
    
    if (prompt === null) {
        await connectDB();
        const config = await GlobalConfig.findOne({ key: 'GLOBAL_SYSTEM_PROMPT' }).lean();
        prompt = config?.value || '';
        cache.set(cacheKey, prompt, 600);
    }
    
    return prompt;
};

// ============ ROTAS PÚBLICAS ============

app.get('/api/ping', (req, res) => res.send('pong'));

// Health check detalhado
app.get('/api/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cache: cache.stats(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    };
    res.json(health);
});

// Modelos OpenRouter (com cache otimizado)
app.get('/api/models', async (req, res) => {
    const cacheKey = 'models:openrouter';
    let models = cache.get(cacheKey);
    
    if (models) {
        return res.json(models);
    }
    
    try {
        const response = await axios.get('https://openrouter.ai/api/v1/models', { timeout: 10000 });
        const freeModels = response.data.data
            .filter(m => {
                const promptPrice = parseFloat(m.pricing?.prompt || '1');
                const completionPrice = parseFloat(m.pricing?.completion || '1');
                return promptPrice === 0 && completionPrice === 0;
            })
            .map(m => ({
                id: m.id,
                name: m.name || m.id,
                context: m.context_length || 4096,
                description: m.description || ''
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        
        // Cache por 5 minutos
        cache.set(cacheKey, freeModels, 300);
        res.json(freeModels);
    } catch (e) {
        console.error('Erro ao buscar modelos:', e.message);
        // Tenta cache antigo ou retorna vazia
        res.json(modelsCache.data.length > 0 ? modelsCache.data : []);
    }
});

// Modelos GPT4Free - busca modelos de múltiplos provedores
app.get('/api/models/g4f', async (req, res) => {
    const now = Date.now();
    
    // Retorna cache se ainda válido (cache de 30 minutos para g4f)
    const G4F_CACHE_TTL = 30 * 60 * 1000;
    if (g4fModelsCache.data.length > 0 && (now - g4fModelsCache.lastFetch) < G4F_CACHE_TTL) {
        return res.json(g4fModelsCache.data);
    }
    
    try {
        // Buscar modelos do Pollinations diretamente (API mais confiável)
        const [textModelsRes, imageModelsRes] = await Promise.all([
            axios.get('https://text.pollinations.ai/models').catch(() => ({ data: [] })),
            axios.get('https://image.pollinations.ai/models').catch(() => ({ data: [] }))
        ]);
        
        const allModels = [];
        
        // Processar modelos de texto do Pollinations
        if (textModelsRes.data && Array.isArray(textModelsRes.data)) {
            textModelsRes.data.forEach(m => {
                allModels.push({
                    id: m.name,
                    name: m.description || m.name,
                    provider: 'pollinations-ai',
                    type: 'chat',
                    tools: m.tools || false,
                    vision: m.vision || false,
                    aliases: m.aliases || []
                });
            });
        }
        
        // Processar modelos de imagem do Pollinations
        if (imageModelsRes.data && Array.isArray(imageModelsRes.data)) {
            imageModelsRes.data.forEach(modelId => {
                const names = { flux: 'Flux', turbo: 'SDXL Turbo', gptimage: 'GPT Image' };
                allModels.push({
                    id: modelId,
                    name: names[modelId] || modelId,
                    provider: 'pollinations-ai',
                    type: 'image'
                });
            });
        }
        
        // Adicionar modelos do DeepInfra (gratuitos)
        const deepinfraModels = [
            { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B Instruct', type: 'chat' },
            { id: 'meta-llama/Llama-3.2-90B-Vision-Instruct', name: 'Llama 3.2 90B Vision', type: 'chat', vision: true },
            { id: 'meta-llama/Llama-3.2-11B-Vision-Instruct', name: 'Llama 3.2 11B Vision', type: 'chat', vision: true },
            { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B Instruct', type: 'chat' },
            { id: 'Qwen/QwQ-32B', name: 'Qwen QwQ 32B', type: 'chat' },
            { id: 'microsoft/WizardLM-2-8x22B', name: 'WizardLM 2 8x22B', type: 'chat' },
            { id: 'mistralai/Mixtral-8x22B-Instruct-v0.1', name: 'Mixtral 8x22B', type: 'chat' },
            { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', type: 'chat' },
            { id: 'nvidia/Llama-3.1-Nemotron-70B-Instruct', name: 'Nemotron 70B', type: 'chat' },
            { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', type: 'chat' },
        ];
        deepinfraModels.forEach(m => {
            allModels.push({ ...m, provider: 'deepinfra' });
        });
        
        // Adicionar modelos do Cloudflare Worker (gratuitos!)
        const cloudflareModels = [
            // Modelos de texto grandes
            { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B (CF)', type: 'chat' },
            { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 32B (CF)', type: 'chat' },
            { id: '@cf/qwen/qwq-32b', name: 'Qwen QwQ 32B (CF)', type: 'chat' },
            { id: '@cf/qwen/qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B (CF)', type: 'chat' },
            { id: '@cf/qwen/qwen3-30b-a3b-fp8', name: 'Qwen 3 30B (CF)', type: 'chat' },
            { id: '@cf/mistralai/mistral-small-3.1-24b-instruct', name: 'Mistral Small 24B (CF)', type: 'chat' },
            { id: '@cf/aisingapore/gemma-sea-lion-v4-27b-it', name: 'Gemma Sea Lion 27B (CF)', type: 'chat' },
            { id: '@cf/google/gemma-3-12b-it', name: 'Gemma 3 12B (CF)', type: 'chat' },
            { id: '@cf/ibm-granite/granite-4.0-h-micro', name: 'IBM Granite 4.0 (CF)', type: 'chat' },
            { id: '@cf/meta/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B (CF)', type: 'chat' },
            // Modelos com visão
            { id: '@cf/meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision (CF)', type: 'chat', vision: true },
            // Modelos de código
            { id: '@hf/thebloke/deepseek-coder-6.7b-instruct-awq', name: 'DeepSeek Coder 6.7B (CF)', type: 'chat' },
            // Modelos de imagem
            { id: '@cf/black-forest-labs/flux-1-schnell', name: 'Flux Schnell (CF)', type: 'image' },
            { id: '@cf/black-forest-labs/flux-2-dev', name: 'Flux 2 Dev (CF)', type: 'image' },
            { id: '@cf/bytedance/stable-diffusion-xl-lightning', name: 'SDXL Lightning (CF)', type: 'image' },
            { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base (CF)', type: 'image' },
            { id: '@cf/lykon/dreamshaper-8-lcm', name: 'Dreamshaper 8 (CF)', type: 'image' },
            { id: '@cf/leonardo/phoenix-1.0', name: 'Leonardo Phoenix (CF)', type: 'image' },
            { id: '@cf/leonardo/lucid-origin', name: 'Leonardo Lucid (CF)', type: 'image' },
        ];
        cloudflareModels.forEach(m => {
            allModels.push({ ...m, provider: 'cloudflare' });
        });
        
        // ============ PROVIDERS COM API KEY GRATUITA ============
        
        // Groq - Ultra rápido! (se tiver API key configurada no env ou banco)
        // Obter key gratuita em: https://console.groq.com/keys
        const groqKey = await getGroqApiKey();
        if (groqKey) {
            const groqModels = [
                { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq - Ultra Fast)', type: 'chat', speed: 'ultra-fast' },
                { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Groq)', type: 'chat', speed: 'very-fast' },
                { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Groq)', type: 'chat', speed: 'instant' },
                { id: 'gemma2-9b-it', name: 'Gemma 2 9B (Groq)', type: 'chat', speed: 'very-fast' },
                { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)', type: 'chat', speed: 'fast' },
            ];
            groqModels.forEach(m => {
                allModels.push({ ...m, provider: 'groq' });
            });
        }
        
        // Cerebras - Rápido (se tiver API key configurada)
        // Obter key gratuita em: https://cloud.cerebras.ai/
        if (process.env.CEREBRAS_API_KEY) {
            const cerebrasModels = [
                { id: 'llama3.1-70b', name: 'Llama 3.1 70B (Cerebras - Fast)', type: 'chat', speed: 'fast' },
                { id: 'llama3.1-8b', name: 'Llama 3.1 8B (Cerebras)', type: 'chat', speed: 'very-fast' },
                { id: 'llama-3.3-70b', name: 'Llama 3.3 70B (Cerebras)', type: 'chat', speed: 'fast' },
                { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (Cerebras)', type: 'chat', speed: 'fast' },
            ];
            cerebrasModels.forEach(m => {
                allModels.push({ ...m, provider: 'cerebras' });
            });
        }
        
        if (allModels.length > 0) {
            g4fModelsCache = { data: allModels, lastFetch: now };
            
            // Salva no MongoDB para persistência
            await connectDB();
            await mongoose.connection.db.collection('g4f_cache').updateOne(
                { _id: 'g4f_data' },
                { $set: { models: allModels, updated_at: new Date() } },
                { upsert: true }
            );
            
            return res.json(allModels);
        }
    } catch (e) {
        console.error('Erro ao buscar modelos g4f:', e.message);
    }
    
    // Fallback: Tenta buscar do MongoDB
    try {
        await connectDB();
        const g4fData = await mongoose.connection.db.collection('g4f_cache').findOne({ _id: 'g4f_data' });
        if (g4fData && g4fData.models && g4fData.models.length > 0) {
            g4fModelsCache = { data: g4fData.models, lastFetch: now };
            return res.json(g4fData.models);
        }
    } catch (e) {
        console.log('G4F cache não encontrado');
    }
    
    // Fallback final: Lista de modelos conhecidos
    const g4fModels = [
        // Pollinations - Texto
        { id: 'deepseek', name: 'DeepSeek V3.1', provider: 'pollinations-ai', type: 'chat', tools: true },
        { id: 'gemini', name: 'Gemini 2.5 Flash Lite', provider: 'pollinations-ai', type: 'chat', tools: true, vision: true },
        { id: 'openai', name: 'GPT-5 Nano', provider: 'pollinations-ai', type: 'chat', tools: true, vision: true },
        { id: 'mistral', name: 'Mistral Small 3.2 24B', provider: 'pollinations-ai', type: 'chat', tools: true },
        { id: 'qwen-coder', name: 'Qwen 2.5 Coder 32B', provider: 'pollinations-ai', type: 'chat', tools: true },
        // Pollinations - Imagem
        { id: 'flux', name: 'Flux', provider: 'pollinations-ai', type: 'image' },
        { id: 'turbo', name: 'SDXL Turbo', provider: 'pollinations-ai', type: 'image' },
        { id: 'gptimage', name: 'GPT Image', provider: 'pollinations-ai', type: 'image' },
        // DeepInfra
        { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B', provider: 'deepinfra', type: 'chat' },
        { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', provider: 'deepinfra', type: 'chat' },
        { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', provider: 'deepinfra', type: 'chat' },
        // Cloudflare Worker
        { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B (CF)', provider: 'cloudflare', type: 'chat' },
        { id: '@cf/qwen/qwq-32b', name: 'Qwen QwQ 32B (CF)', provider: 'cloudflare', type: 'chat' },
    ];
    
    g4fModelsCache = { data: g4fModels, lastFetch: now };
    res.json(g4fModels);
});

// ============ AUTH (com rate limiting) ============

app.post('/api/register', authLimiter, async (req, res) => {
    await connectDB();
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username e password são obrigatórios' });
    if (await User.findOne({ username })) return res.status(400).json({ error: 'Usuário já existe' });
    
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash });
    res.json({ 
        token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' }), 
        role: user.role, 
        username: user.username,
        theme: user.theme,
        displayName: user.displayName,
        bio: user.bio
    });
});

app.post('/api/login', authLimiter, async (req, res) => {
    await connectDB();
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(400).json({ error: 'Credenciais inválidas' });
    }
    res.json({ 
        token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' }), 
        role: user.role, 
        username: user.username,
        theme: user.theme,
        displayName: user.displayName,
        bio: user.bio,
        hasPersonalKey: !!user.personal_api_key
    });
});

// ============ USUÁRIO LOGADO ============

// Obter perfil do usuário
app.get('/api/user/profile', auth, async (req, res) => {
    res.json({
        username: req.user.username,
        displayName: req.user.displayName,
        bio: req.user.bio,
        theme: req.user.theme,
        role: req.user.role,
        hasPersonalKey: !!req.user.personal_api_key,
        usage: req.user.usage
    });
});

// Atualizar perfil do usuário
app.patch('/api/user/profile', auth, async (req, res) => {
    await connectDB();
    const { displayName, bio, theme, personal_api_key } = req.body;
    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (theme !== undefined && ['dark', 'light'].includes(theme)) updates.theme = theme;
    if (personal_api_key !== undefined) updates.personal_api_key = personal_api_key;
    
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    
    // Invalida cache do usuário
    cache.del(`user:${req.user._id}`);
    
    res.json({
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        theme: user.theme,
        hasPersonalKey: !!user.personal_api_key
    });
});

// ============ FERRAMENTAS CUSTOMIZADAS DO USUÁRIO ============

// Listar ferramentas do usuário
app.get('/api/tools', auth, async (req, res) => {
    try {
        await connectDB();
        const tools = await CustomTool.find({ userId: req.user._id });
        res.json(tools);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar ferramentas: ' + err.message });
    }
});

// Criar nova ferramenta
app.post('/api/tools', auth, async (req, res) => {
    try {
        await connectDB();
        const { name, description, code, parameters } = req.body;
        
        if (!name || !description || !code) {
            return res.status(400).json({ error: 'Nome, descrição e código são obrigatórios' });
        }
        
        const tool = await CustomTool.create({
            userId: req.user._id,
            name: name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
            description,
            code,
            parameters: parameters || {}
        });
        
        res.json(tool);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Já existe uma ferramenta com esse nome' });
        }
        res.status(500).json({ error: 'Erro ao criar ferramenta: ' + err.message });
    }
});

// Obter ferramenta específica
app.get('/api/tools/:id', auth, async (req, res) => {
    try {
        await connectDB();
        const tool = await CustomTool.findOne({ _id: req.params.id, userId: req.user._id });
        if (!tool) return res.status(404).json({ error: 'Ferramenta não encontrada' });
        res.json(tool);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar ferramenta: ' + err.message });
    }
});

// Atualizar ferramenta
app.patch('/api/tools/:id', auth, async (req, res) => {
    try {
        await connectDB();
        const { name, description, code, parameters, isActive } = req.body;
        const updates = { updatedAt: Date.now() };
        
        if (name) updates.name = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        if (description) updates.description = description;
        if (code) updates.code = code;
        if (parameters) updates.parameters = parameters;
        if (typeof isActive === 'boolean') updates.isActive = isActive;
        
        const tool = await CustomTool.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            updates,
            { new: true }
        );
        
        if (!tool) return res.status(404).json({ error: 'Ferramenta não encontrada' });
        res.json(tool);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar ferramenta: ' + err.message });
    }
});

// Deletar ferramenta
app.delete('/api/tools/:id', auth, async (req, res) => {
    try {
        await connectDB();
        const result = await CustomTool.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!result) return res.status(404).json({ error: 'Ferramenta não encontrada' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao deletar ferramenta: ' + err.message });
    }
});

// ============ UPLOAD DE ARQUIVOS ============

app.post('/api/upload', auth, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }
        
        const uploadedFiles = req.files.map(file => {
            const isImage = file.mimetype.startsWith('image/');
            const isText = file.mimetype.startsWith('text/') || 
                           /\.(txt|md|js|jsx|ts|tsx|py|json|csv|html|css|xml|yaml|yml)$/i.test(file.originalname);
            
            let content = null;
            if (isText) {
                try {
                    content = fs.readFileSync(file.path, 'utf8').substring(0, 100000); // Max 100KB de texto
                } catch(e) {}
            }
            
            return {
                type: isImage ? 'image' : 'file',
                name: file.originalname,
                url: `/uploads/${file.filename}`,
                mimeType: file.mimetype,
                size: file.size,
                content
            };
        });
        
        res.json({ files: uploadedFiles });
    } catch (err) {
        res.status(500).json({ error: 'Erro no upload: ' + err.message });
    }
});

// ============ CHATS ============

app.get('/api/chats', auth, async (req, res) => {
    await connectDB();
    const chats = await Chat.find({ userId: req.user._id })
        
        .select('title model updatedAt')
        .limit(50);
    res.json(chats);
});

app.post('/api/chats', auth, async (req, res) => {
    await connectDB();
    try {
        const chat = await Chat.create({
            userId: req.user._id,
            title: 'Novo Chat',
            model: req.body.model || 'google/gemini-2.0-flash-exp:free',
            userSystemPrompt: req.body.systemPrompt || ''
        });
        res.json(chat);
    } catch (e) {
        console.error('Erro ao criar chat:', e);
        res.status(500).json({ error: 'Erro ao criar chat: ' + e.message });
    }
});

app.get('/api/chats/:id', auth, async (req, res) => {
    await connectDB();
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) return res.status(404).json({ error: 'Chat não encontrado' });
    res.json(chat);
});

app.patch('/api/chats/:id', auth, async (req, res) => {
    await connectDB();
    const chat = await Chat.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { updatedAt: Date.now(), ...req.body },
        { new: true }
    );
    res.json(chat);
});

app.delete('/api/chats/:id', auth, async (req, res) => {
    await connectDB();
    await Chat.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
});

// ============ CHAT COM IA (com rate limiting) ============

// Helper para chamada GPT4Free usando g4f.dev client
const callG4F = async (model, messages, preferredProvider = null) => {
    const g4f = await loadG4F();
    
    // Extrai o provedor do modelo se estiver no formato "provider/model"
    let provider = preferredProvider;
    let modelName = model;
    
    if (model.includes('/')) {
        const parts = model.split('/');
        provider = parts[0];
        modelName = parts.slice(1).join('/');
    }
    
    // Determina qual client usar baseado no provider ou no nome do modelo
    const providersToTry = [];
    
    // Cloudflare Worker - modelos começam com @cf/ ou @hf/
    if (provider === 'cloudflare' || model.startsWith('@cf/') || model.startsWith('@hf/')) {
        providersToTry.push({ name: 'cloudflare', client: new g4f.Worker(), isWorker: true });
    }
    // DeepInfra - modelos com formato "org/model"
    else if (provider === 'deepinfra' || modelName.includes('meta-llama') || modelName.includes('Qwen') || modelName.includes('deepseek-ai')) {
        providersToTry.push({ name: 'deepinfra', client: new g4f.DeepInfra() });
    }
    // Groq - ultra rápido (precisa de API key do banco ou env)
    else if (provider === 'groq') {
        const groqKey = await getGroqApiKey();
        if (groqKey) {
            providersToTry.push({ name: 'groq', client: new g4f.Groq({ apiKey: groqKey }) });
        }
    }
    // Cerebras - rápido (precisa de API key)
    else if (provider === 'cerebras' && process.env.CEREBRAS_API_KEY) {
        providersToTry.push({ name: 'cerebras', client: new g4f.Cerebras({ apiKey: process.env.CEREBRAS_API_KEY }) });
    }
    
    // Fallbacks
    // Se tiver Groq configurado, usa como fallback (é muito rápido)
    const groqKeyFallback = await getGroqApiKey();
    if (groqKeyFallback && !providersToTry.some(p => p.name === 'groq')) {
        providersToTry.push({ name: 'groq', client: new g4f.Groq({ apiKey: groqKeyFallback }) });
    }
    
    // Pollinations sempre como fallback final (funciona sempre)
    providersToTry.push({ name: 'pollinations-ai', client: new g4f.PollinationsAI() });
    
    const errors = [];
    
    for (const { name, client, isWorker } of providersToTry) {
        try {
            console.log(`Tentando G4F com provedor: ${name}, modelo: ${model}`);
            
            const response = await client.chat.completions.create({
                model: model, // Usa o modelo completo para Cloudflare
                messages: messages,
            });
            
            // Cloudflare Worker retorna em formato diferente
            if (isWorker && response?.response) {
                console.log(`G4F sucesso com provedor: ${name} (Worker)`);
                return { role: 'assistant', content: response.response, _provider: name };
            }
            
            if (response?.choices?.[0]?.message) {
                console.log(`G4F sucesso com provedor: ${name}`);
                const msg = response.choices[0].message;
                msg._provider = name;
                msg._tokens = response.usage?.total_tokens || 0;
                return msg;
            }
        } catch (e) {
            console.log(`G4F provedor ${name} falhou:`, e.message);
            errors.push(`${name}: ${e.message}`);
            continue;
        }
    }
    
    throw new Error(`Todos os provedores GPT4Free falharam: ${errors.join('; ')}`);
};

// Helper para chamada GPT4Free COM SUPORTE A TOOLS
const callG4FWithTools = async (model, messages, tools, preferredProvider = null) => {
    const g4f = await loadG4F();
    
    // Extrai o provedor do modelo se estiver no formato "provider/model"
    let provider = preferredProvider;
    let modelName = model;
    
    if (model.includes('/')) {
        const parts = model.split('/');
        provider = parts[0];
        modelName = parts.slice(1).join('/');
    }
    
    // Determina qual client usar
    const providersToTry = [];
    
    // Cloudflare Worker não suporta tools, vai direto para o fallback
    if (provider === 'cloudflare' || model.startsWith('@cf/') || model.startsWith('@hf/')) {
        // Cloudflare não suporta tools, tenta sem
        console.log('Cloudflare Worker não suporta tools, tentando sem...');
        return await callG4F(model, messages, preferredProvider);
    }
    
    // DeepInfra
    if (provider === 'deepinfra' || modelName.includes('meta-llama') || modelName.includes('Qwen') || modelName.includes('deepseek-ai')) {
        providersToTry.push({ name: 'deepinfra', client: new g4f.DeepInfra() });
    }
    
    // Pollinations sempre como fallback
    providersToTry.push({ name: 'pollinations-ai', client: new g4f.PollinationsAI() });
    
    const errors = [];
    
    for (const { name, client } of providersToTry) {
        try {
            console.log(`Tentando G4F com tools - provedor: ${name}, modelo: ${model}`);
            
            const response = await client.chat.completions.create({
                model: model,
                messages: messages,
                tools: tools,
                tool_choice: "auto"
            });
            
            if (response?.choices?.[0]?.message) {
                console.log(`G4F com tools sucesso com provedor: ${name}`);
                const msg = response.choices[0].message;
                msg._provider = name;
                msg._tokens = response.usage?.total_tokens || 0;
                return msg;
            }
        } catch (e) {
            console.log(`G4F com tools - provedor ${name} falhou:`, e.message);
            errors.push(`${name}: ${e.message}`);
            continue;
        }
    }
    
    // Fallback: tenta sem tools se nenhum provedor com tools funcionou
    console.log('Nenhum provedor G4F suportou tools, tentando sem tools...');
    try {
        return await callG4F(model, messages, preferredProvider);
    } catch (fallbackError) {
        throw new Error(`G4F falhou mesmo sem tools: ${fallbackError.message}. Erros anteriores: ${errors.join('; ')}`);
    }
};

app.post('/api/chat', auth, chatLimiter, async (req, res) => {
    const { chatId, messages, model, userSystemPrompt, provider } = req.body;
    
    // Se usar GPT4Free
    if (provider === 'g4f') {
        // Obtém system prompt global (com cache)
        const globalSystemPrompt = await getGlobalSystemPrompt();
        
        const systemContent = [];
        if (globalSystemPrompt) systemContent.push(globalSystemPrompt);
        if (userSystemPrompt) systemContent.push(userSystemPrompt);
        if (req.user.bio) systemContent.push(`Informações sobre o usuário: ${req.user.bio}`);
        
        const msgs = systemContent.length > 0 
            ? [{ role: "system", content: systemContent.join('\n\n') }, ...messages]
            : [...messages];
        
        try {
            const msg = await callG4F(model, msgs);
            res.json({ role: msg.role, content: msg.content });
            
            // Incrementa uso e salva histórico
            User.findByIdAndUpdate(req.user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
            
            // Rastreia uso do modelo (para estatísticas Groq)
            if (msg._provider) {
                new ModelUsage({
                    modelId: model,
                    provider: msg._provider,
                    userId: req.user._id,
                    username: req.user.username,
                    tokens: msg._tokens || 0,
                    timestamp: new Date()
                }).save().catch(err => console.error('Erro ao rastrear uso:', err));
            }
            
            if (chatId) {
                Chat.findOne({ _id: chatId, userId: req.user._id }).then(async (chat) => {
                    if (chat) {
                        chat.messages.push(messages[messages.length - 1]);
                        chat.messages.push({ role: msg.role, content: msg.content });
                        chat.model = model;
                        chat.updatedAt = Date.now();
                        await chat.save();
                    }
                }).catch(err => console.error('Erro ao salvar histórico:', err));
            }
            return;
        } catch (e) {
            console.error('Erro G4F:', e.message);
            return res.status(500).json({ error: e.message });
        }
    }
    
    // OpenRouter (padrão)
    const apiKey = await getApiKey(req.user);
    
    if (!apiKey) {
        return res.status(400).json({ error: 'Nenhuma API Key configurada. Configure sua chave pessoal ou peça ao admin.' });
    }

    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
            "HTTP-Referer": "https://meu-super-ai.vercel.app",
            "X-Title": "jgspAI"
        }
    });

    // Obtém system prompt global (com cache)
    const globalSystemPrompt = await getGlobalSystemPrompt();
    
    // Monta mensagens com system prompt (global tem prioridade)
    const systemContent = [];
    if (globalSystemPrompt) systemContent.push(globalSystemPrompt); // Prioridade máxima
    if (userSystemPrompt) systemContent.push(userSystemPrompt);
    if (req.user.bio) systemContent.push(`Informações sobre o usuário: ${req.user.bio}`);
    
    const msgs = systemContent.length > 0 
        ? [{ role: "system", content: systemContent.join('\n\n') }, ...messages]
        : [...messages];

    try {
        const resp = await openai.chat.completions.create({
            model: model || "google/gemini-2.0-flash-exp:free",
            messages: msgs
        });

        const msg = resp.choices[0].message;
        res.json(msg);

        // Incrementa uso e salva histórico em background
        User.findByIdAndUpdate(req.user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
        
        if (chatId) {
            Chat.findOne({ _id: chatId, userId: req.user._id }).then(async (chat) => {
                if (chat) {
                    chat.messages.push(messages[messages.length - 1]);
                    chat.messages.push(msg);
                    chat.model = model;
                    chat.updatedAt = Date.now();
                    await chat.save();
                }
            }).catch(err => console.error('Erro ao salvar histórico:', err));
        }
    } catch (e) {
        console.error('Erro na API:', e.message);
        res.status(500).json({ error: e.message, details: e.response?.data });
    }
});

// ============ SISTEMA SWARM AVANÇADO ============

// Definição das ferramentas disponíveis para a IA (incluindo swarm)
const getAvailableTools = (userId) => [
    // ============ FERRAMENTAS SWARM ============
    {
        type: "function",
        function: {
            name: "swarm_delegate",
            description: `Executa múltiplas tarefas em PARALELO usando agentes IA secundários. Use quando precisar fazer várias coisas ao mesmo tempo, comparar tópicos, ou pesquisar múltiplos assuntos.

EXEMPLO: Para pesquisar Python e JavaScript, use:
task1="Pesquise sobre Python" e task2="Pesquise sobre JavaScript"`,
            parameters: {
                type: "object",
                properties: {
                    task1: { type: "string", description: "Primeira tarefa/instrução para um agente executar" },
                    task2: { type: "string", description: "Segunda tarefa/instrução (opcional)" },
                    task3: { type: "string", description: "Terceira tarefa/instrução (opcional)" },
                    task4: { type: "string", description: "Quarta tarefa/instrução (opcional)" },
                    task5: { type: "string", description: "Quinta tarefa/instrução (opcional)" }
                },
                required: ["task1"]
            }
        }
    },

    // ============ GERAÇÃO DE MÍDIA ============
    {
        type: "function",
        function: {
            name: "generate_image",
            description: "Gera uma imagem com base em uma descrição textual (prompt). Use para criar ilustrações, diagramas, fotos, etc.",
            parameters: {
                type: "object",
                properties: {
                    prompt: { type: "string", description: "Descrição detalhada da imagem a ser gerada" }
                },
                required: ["prompt"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_audio",
            description: "Gera um áudio (fala ou música) com base em uma descrição ou texto.",
            parameters: {
                type: "object",
                properties: {
                    prompt: { type: "string", description: "Texto para fala ou descrição do som" },
                    type: { type: "string", enum: ["speech", "music"], description: "Tipo de áudio" }
                },
                required: ["prompt"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_video",
            description: "Gera um vídeo curto com base em uma descrição.",
            parameters: {
                type: "object",
                properties: {
                    prompt: { type: "string", description: "Descrição do vídeo" }
                },
                required: ["prompt"]
            }
        }
    },
    
    // ============ FERRAMENTA DE CRIAÇÃO DE FERRAMENTAS ============
    {
        type: "function",
        function: {
            name: "create_custom_tool",
            description: `Cria uma nova ferramenta personalizada para o usuário. A ferramenta ficará salva e poderá ser usada em conversas futuras.
Use quando o usuário pedir para criar uma ferramenta, script, automação ou funcionalidade reutilizável.
O código deve ser JavaScript válido que retorna um resultado.`,
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Nome único da ferramenta (sem espaços, use underscore). Ex: 'calcular_imc', 'formatar_cpf'"
                    },
                    description: {
                        type: "string", 
                        description: "Descrição clara do que a ferramenta faz"
                    },
                    code: {
                        type: "string",
                        description: "Código JavaScript da ferramenta. Deve ser uma função que recebe 'params' e retorna resultado. Ex: 'const {peso, altura} = params; return peso / (altura * altura);'"
                    },
                    parameters: {
                        type: "object",
                        description: "Schema dos parâmetros que a ferramenta aceita",
                        properties: {
                            type: { type: "string", default: "object" },
                            properties: { type: "object" },
                            required: { type: "array", items: { type: "string" } }
                        }
                    }
                },
                required: ["name", "description", "code"]
            }
        }
    },
    
    // ============ FERRAMENTA DE EXECUÇÃO DE FERRAMENTAS CUSTOMIZADAS ============
    {
        type: "function",
        function: {
            name: "execute_custom_tool",
            description: `Executa uma ferramenta personalizada criada anteriormente pelo usuário.
Liste as ferramentas disponíveis com list_custom_tools antes de usar.`,
            parameters: {
                type: "object",
                properties: {
                    tool_name: { type: "string", description: "Nome da ferramenta a executar" },
                    params: { type: "object", description: "Parâmetros para passar à ferramenta" }
                },
                required: ["tool_name"]
            }
        }
    },
    
    // ============ LISTAR FERRAMENTAS DO USUÁRIO ============
    {
        type: "function",
        function: {
            name: "list_custom_tools",
            description: "Lista todas as ferramentas personalizadas criadas pelo usuário atual.",
            parameters: { type: "object", properties: {} }
        }
    },
    
    // ============ DELETAR FERRAMENTA ============
    {
        type: "function",
        function: {
            name: "delete_custom_tool",
            description: "Remove uma ferramenta personalizada do usuário.",
            parameters: {
                type: "object",
                properties: {
                    tool_name: { type: "string", description: "Nome da ferramenta a deletar" }
                },
                required: ["tool_name"]
            }
        }
    },
    
    // ============ FERRAMENTA DE TERMINAL BASH ============
    {
        type: "function",
        function: {
            name: "execute_bash",
            description: `Executa comandos no terminal bash do servidor. 
Use para: instalar pacotes, manipular arquivos, executar scripts, verificar sistema.
ATENÇÃO: Comandos perigosos como rm -rf / são bloqueados.
Timeout: 30 segundos.`,
            parameters: {
                type: "object",
                properties: {
                    command: { 
                        type: "string", 
                        description: "Comando bash a executar. Ex: 'ls -la', 'echo hello', 'python script.py'" 
                    },
                    working_directory: {
                        type: "string",
                        description: "Diretório onde executar o comando (opcional, default: /tmp)"
                    }
                },
                required: ["command"]
            }
        }
    },
    
    // ============ FERRAMENTA DE PESQUISA WEB ============
    {
        type: "function",
        function: {
            name: "web_search",
            description: `Faz uma pesquisa na web e retorna os resultados.
Use para buscar informações atualizadas, notícias, dados em tempo real.
Retorna título, link e snippet dos resultados.`,
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Termo de busca" },
                    num_results: { type: "number", description: "Número de resultados (max 10, default 5)" }
                },
                required: ["query"]
            }
        }
    },
    
    // ============ FERRAMENTA DE SCRAPING WEB ============
    {
        type: "function", 
        function: {
            name: "web_scrape",
            description: `Acessa uma URL e extrai o conteúdo da página.
Use para: ler artigos, extrair dados, verificar conteúdo de sites.
Retorna o texto principal da página.`,
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL completa da página a acessar" },
                    selector: { type: "string", description: "Seletor CSS opcional para extrair elemento específico" },
                    get_links: { type: "boolean", description: "Se true, retorna também os links da página" }
                },
                required: ["url"]
            }
        }
    },
    
    // ============ FERRAMENTA DE CONSOLE DO NAVEGADOR ============
    {
        type: "function",
        function: {
            name: "browser_console",
            description: `Executa JavaScript no console de um site usando Puppeteer.
Use para: interagir com páginas, extrair dados dinâmicos, testar código JS em contexto de página.
Retorna o resultado da execução.`,
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL do site onde executar o código" },
                    code: { type: "string", description: "Código JavaScript a executar no console" },
                    wait_for: { type: "string", description: "Seletor CSS para aguardar antes de executar (opcional)" }
                },
                required: ["url", "code"]
            }
        }
    },
    
    // ============ FERRAMENTA DE NETWORK/REQUESTS ============
    {
        type: "function",
        function: {
            name: "network_monitor",
            description: `Monitora as requisições de rede feitas por uma página.
Use para: analisar APIs chamadas por um site, capturar dados de requisições XHR/Fetch.
Retorna lista de requisições com URL, método, status e headers.`,
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL do site para monitorar" },
                    filter_type: { 
                        type: "string", 
                        enum: ["xhr", "fetch", "script", "image", "all"],
                        description: "Tipo de requisição para filtrar (default: all)" 
                    },
                    wait_time: { type: "number", description: "Tempo em ms para aguardar requisições (default: 5000)" },
                    capture_body: { type: "boolean", description: "Se true, captura também o corpo das respostas" }
                },
                required: ["url"]
            }
        }
    },
    
    // ============ FERRAMENTA DE HTTP REQUEST ============
    {
        type: "function",
        function: {
            name: "http_request",
            description: `Faz uma requisição HTTP customizada.
Use para: chamar APIs, enviar dados, testar endpoints.`,
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL da requisição" },
                    method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], description: "Método HTTP" },
                    headers: { type: "object", description: "Headers da requisição" },
                    body: { type: "object", description: "Corpo da requisição (para POST/PUT/PATCH)" },
                    timeout: { type: "number", description: "Timeout em ms (default: 30000)" }
                },
                required: ["url"]
            }
        }
    }
];

// Função para executar um agente Swarm individual (memória volátil)
const executeSwarmAgent = async (apiKey, task, model) => {
    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
            "HTTP-Referer": "https://meu-super-ai.vercel.app",
            "X-Title": "jgspAI - Swarm Agent"
        }
    });

    const systemPrompt = `Você é um agente Swarm especializado - uma IA auxiliar com memória volátil.

IMPORTANTE:
- Você NÃO tem memória de conversas anteriores
- Execute APENAS a tarefa solicitada
- Seja DIRETO e EFICIENTE na resposta
- Retorne APENAS o resultado, sem explicações desnecessárias
- Se um formato de saída foi especificado, siga-o rigorosamente

${task.output_format ? `FORMATO DE SAÍDA ESPERADO: ${task.output_format}` : ''}`;

    const userContent = task.context 
        ? `TAREFA: ${task.instruction}\n\nCONTEXTO/DADOS:\n${task.context}`
        : task.instruction;

    try {
        const resp = await openai.chat.completions.create({
            model: model || "google/gemini-2.0-flash-exp:free",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent }
            ],
            max_tokens: 4000
        });
        
        return {
            id: task.id,
            success: true,
            result: resp.choices[0].message.content
        };
    } catch (e) {
        return {
            id: task.id,
            success: false,
            error: e.message
        };
    }
};

// Função para executar ações do pipeline
const executePipelineAction = async (action) => {
    try {
        switch (action.type) {
            case 'http_get':
                const getResp = await axios.get(action.params.url, { timeout: 15000 });
                return { success: true, data: typeof getResp.data === 'string' ? getResp.data : JSON.stringify(getResp.data) };
            
            case 'http_post':
                const postResp = await axios.post(action.params.url, action.params.body || {}, { timeout: 15000 });
                return { success: true, data: typeof postResp.data === 'string' ? postResp.data : JSON.stringify(postResp.data) };
            
            case 'calculate':
                // Avaliação segura de expressões matemáticas
                const expr = action.params.expression.replace(/[^0-9+\-*/().%\s]/g, '');
                const calcResult = Function('"use strict"; return (' + expr + ')')();
                return { success: true, data: String(calcResult) };
            
            case 'generate_data':
                return { success: true, data: JSON.stringify(action.params.data || {}) };
            
            default:
                return { success: false, error: 'Tipo de ação desconhecido: ' + action.type };
        }
    } catch (e) {
        return { success: false, error: e.message };
    }
};

// Processa chamadas de ferramentas (incluindo swarm)
const processToolCalls = async (toolCalls, apiKey, model, userId, modelsConfig = {}) => {
    const results = [];
    
    for (const toolCall of toolCalls) {
        const funcName = toolCall.function.name;
        let args;
        
        try {
            args = JSON.parse(toolCall.function.arguments);
        } catch (e) {
            results.push({
                tool_call_id: toolCall.id,
                role: "tool",
                content: JSON.stringify({ error: "Erro ao parsear argumentos: " + e.message })
            });
            continue;
        }

        try {
            let result;
            
            switch (funcName) {
                case 'swarm_delegate': {
                    // Suporta formato simplificado (task1, task2...) e formato array
                    let taskArray = [];
                    
                    // Formato simplificado: task1, task2, task3...
                    if (args.task1 || args.task2 || args.task3) {
                        for (let i = 1; i <= 10; i++) {
                            const taskKey = `task${i}`;
                            if (args[taskKey]) {
                                taskArray.push({
                                    id: taskKey,
                                    instruction: args[taskKey]
                                });
                            }
                        }
                    }
                    // Formato array (compatibilidade)
                    else if (args.tasks) {
                        const tasks = Array.isArray(args.tasks) ? args.tasks : [args.tasks];
                        taskArray = tasks.map((t, i) => ({
                            id: t.id || `task_${i + 1}`,
                            instruction: t.instruction || t.task || t.prompt || String(t)
                        }));
                    }
                    // Formato string única
                    else if (args.task) {
                        taskArray = [{ id: 'task_1', instruction: args.task }];
                    }
                    
                    if (taskArray.length === 0) {
                        result = { error: "Nenhuma tarefa fornecida. Use task1, task2, etc." };
                        break;
                    }
                    
                    const normalizedTasks = taskArray.map((t, i) => ({
                        id: t.id || `task_${i + 1}`,
                        instruction: t.instruction || '',
                        context: t.context || '',
                        output_format: t.output_format || ''
                    }));
                    
                    const taskPromises = normalizedTasks.map(task => executeSwarmAgent(apiKey, task, model));
                    const taskResults = await Promise.all(taskPromises);
                    
                    result = {
                        swarm_results: taskResults,
                        tasks_completed: taskResults.filter(r => r.success).length,
                        tasks_failed: taskResults.filter(r => !r.success).length
                    };
                    break;
                }

                case 'generate_image': {
                    try {
                        let imageModel = modelsConfig.image;
                        if (!imageModel) {
                            const defaults = await GlobalConfig.findOne({ key: 'DEFAULT_MODELS' });
                            imageModel = defaults?.value?.image;
                        }
                        
                        if (!imageModel) {
                            result = { error: "Nenhum modelo de imagem configurado." };
                            break;
                        }

                        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                            model: imageModel,
                            messages: [{ role: 'user', content: args.prompt }]
                        }, {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json',
                                'HTTP-Referer': 'https://meu-super-ai.com',
                                'X-Title': 'Meu Super AI'
                            }
                        });
                        
                        const content = response.data.choices[0].message.content;
                        result = { success: true, content: content, model: imageModel };
                        
                    } catch (err) {
                        result = { error: `Erro ao gerar imagem: ${err.message}` };
                    }
                    break;
                }

                case 'generate_audio': {
                    try {
                        let audioModel = modelsConfig.audio;
                        if (!audioModel) {
                            const defaults = await GlobalConfig.findOne({ key: 'DEFAULT_MODELS' });
                            audioModel = defaults?.value?.audio;
                        }
                        
                        if (!audioModel) {
                            result = { error: "Nenhum modelo de áudio configurado." };
                            break;
                        }
                        
                        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                            model: audioModel,
                            messages: [{ role: 'user', content: args.prompt }]
                        }, {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json',
                                'HTTP-Referer': 'https://meu-super-ai.com',
                                'X-Title': 'Meu Super AI'
                            }
                        });
                        
                        const content = response.data.choices[0].message.content;
                        result = { success: true, content: content, model: audioModel };
                    } catch (err) {
                        result = { error: `Erro ao gerar áudio: ${err.message}` };
                    }
                    break;
                }

                case 'generate_video': {
                    try {
                        let videoModel = modelsConfig.video;
                        if (!videoModel) {
                            const defaults = await GlobalConfig.findOne({ key: 'DEFAULT_MODELS' });
                            videoModel = defaults?.value?.video;
                        }
                        
                        if (!videoModel) {
                            result = { error: "Nenhum modelo de vídeo configurado." };
                            break;
                        }
                        
                        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                            model: videoModel,
                            messages: [{ role: 'user', content: args.prompt }]
                        }, {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json',
                                'HTTP-Referer': 'https://meu-super-ai.com',
                                'X-Title': 'Meu Super AI'
                            }
                        });
                        
                        const content = response.data.choices[0].message.content;
                        result = { success: true, content: content, model: videoModel };
                    } catch (err) {
                        result = { error: `Erro ao gerar vídeo: ${err.message}` };
                    }
                    break;
                }
                
                case 'create_custom_tool': {
                    const toolName = args.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
                    const newTool = await CustomTool.create({
                        userId,
                        name: toolName,
                        description: args.description,
                        code: args.code,
                        parameters: args.parameters || {}
                    });
                    result = { 
                        success: true, 
                        message: `Ferramenta "${toolName}" criada com sucesso!`,
                        tool: { name: newTool.name, description: newTool.description }
                    };
                    break;
                }
                
                case 'execute_custom_tool': {
                    const tool = await CustomTool.findOne({ userId, name: args.tool_name });
                    if (!tool) {
                        result = { error: `Ferramenta "${args.tool_name}" não encontrada` };
                        break;
                    }
                    
                    try {
                        // Executa o código da ferramenta em sandbox
                        const fn = new Function('params', tool.code);
                        const execResult = fn(args.params || {});
                        
                        // Atualiza estatísticas
                        await CustomTool.findByIdAndUpdate(tool._id, { 
                            $inc: { executionCount: 1 },
                            lastExecuted: new Date()
                        });
                        
                        result = { success: true, result: execResult };
                    } catch (execErr) {
                        result = { error: `Erro ao executar ferramenta: ${execErr.message}` };
                    }
                    break;
                }
                
                case 'list_custom_tools': {
                    const tools = await CustomTool.find({ userId, isActive: true })
                        .select('name description parameters executionCount');
                    result = { 
                        tools: tools.map(t => ({
                            name: t.name,
                            description: t.description,
                            parameters: t.parameters,
                            uses: t.executionCount
                        })),
                        count: tools.length
                    };
                    break;
                }
                
                case 'delete_custom_tool': {
                    const deleted = await CustomTool.findOneAndDelete({ userId, name: args.tool_name });
                    if (!deleted) {
                        result = { error: `Ferramenta "${args.tool_name}" não encontrada` };
                    } else {
                        result = { success: true, message: `Ferramenta "${args.tool_name}" deletada` };
                    }
                    break;
                }
                
                case 'execute_bash': {
                    // Lista de comandos bloqueados por segurança
                    const blockedPatterns = [
                        /rm\s+-rf\s+\//, /rm\s+-rf\s+\*/, /mkfs/, /dd\s+if=/, 
                        /:\(\)\{.*\}/, /fork\s*bomb/, />\s*\/dev\/sd/,
                        /chmod\s+-R\s+777\s+\//, /wget.*\|.*sh/, /curl.*\|.*sh/
                    ];
                    
                    const cmd = args.command;
                    if (blockedPatterns.some(p => p.test(cmd))) {
                        result = { error: "Comando bloqueado por segurança" };
                        break;
                    }
                    
                    const workDir = args.working_directory || '/tmp';
                    try {
                        const { stdout, stderr } = await execPromise(cmd, { 
                            cwd: workDir, 
                            timeout: 30000,
                            maxBuffer: 1024 * 1024 // 1MB max output
                        });
                        result = { 
                            success: true, 
                            stdout: stdout.substring(0, 50000), 
                            stderr: stderr.substring(0, 10000) 
                        };
                    } catch (execErr) {
                        result = { 
                            error: execErr.message,
                            stdout: execErr.stdout?.substring(0, 10000),
                            stderr: execErr.stderr?.substring(0, 10000)
                        };
                    }
                    break;
                }
                
                case 'web_search': {
                    // Usa DuckDuckGo HTML para busca (não requer API key)
                    try {
                        const query = encodeURIComponent(args.query);
                        const numResults = Math.min(args.num_results || 5, 10);
                        
                        const response = await axios.get(`https://html.duckduckgo.com/html/?q=${query}`, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                            timeout: 15000
                        });
                        
                        const $ = cheerio.load(response.data);
                        const searchResults = [];
                        
                        $('.result').slice(0, numResults).each((i, el) => {
                            const title = $(el).find('.result__title').text().trim();
                            const link = $(el).find('.result__url').attr('href') || $(el).find('a').attr('href');
                            const snippet = $(el).find('.result__snippet').text().trim();
                            
                            if (title && link) {
                                searchResults.push({ title, link, snippet });
                            }
                        });
                        
                        result = { 
                            success: true, 
                            query: args.query,
                            results: searchResults,
                            count: searchResults.length
                        };
                    } catch (searchErr) {
                        result = { error: `Erro na busca: ${searchErr.message}` };
                    }
                    break;
                }
                
                case 'web_scrape': {
                    try {
                        const response = await axios.get(args.url, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                            timeout: 20000,
                            maxContentLength: 5 * 1024 * 1024 // 5MB max
                        });
                        
                        const $ = cheerio.load(response.data);
                        
                        // Remove scripts e styles
                        $('script, style, noscript, iframe').remove();
                        
                        let content;
                        if (args.selector) {
                            content = $(args.selector).text().trim();
                        } else {
                            // Tenta extrair conteúdo principal
                            content = $('article, main, .content, #content, .post, .article').first().text().trim();
                            if (!content) content = $('body').text().trim();
                        }
                        
                        // Limpa espaços extras
                        content = content.replace(/\s+/g, ' ').substring(0, 50000);
                        
                        const links = args.get_links ? 
                            $('a[href]').map((i, el) => ({ 
                                text: $(el).text().trim().substring(0, 100), 
                                href: $(el).attr('href') 
                            })).get().slice(0, 50) : undefined;
                        
                        result = { 
                            success: true,
                            url: args.url,
                            title: $('title').text().trim(),
                            content,
                            links
                        };
                    } catch (scrapeErr) {
                        result = { error: `Erro ao acessar página: ${scrapeErr.message}` };
                    }
                    break;
                }
                
                case 'browser_console': {
                    try {
                        const puppeteer = require('puppeteer');
                        const browser = await puppeteer.launch({ 
                            headless: 'new',
                            args: ['--no-sandbox', '--disable-setuid-sandbox']
                        });
                        
                        const page = await browser.newPage();
                        await page.goto(args.url, { waitUntil: 'networkidle2', timeout: 30000 });
                        
                        if (args.wait_for) {
                            await page.waitForSelector(args.wait_for, { timeout: 10000 });
                        }
                        
                        const consoleResult = await page.evaluate(args.code);
                        await browser.close();
                        
                        result = { 
                            success: true,
                            url: args.url,
                            result: consoleResult
                        };
                    } catch (browserErr) {
                        result = { error: `Erro no browser: ${browserErr.message}` };
                    }
                    break;
                }
                
                case 'network_monitor': {
                    try {
                        const puppeteer = require('puppeteer');
                        const browser = await puppeteer.launch({ 
                            headless: 'new',
                            args: ['--no-sandbox', '--disable-setuid-sandbox']
                        });
                        
                        const page = await browser.newPage();
                        const requests = [];
                        
                        // Intercepta requisições
                        await page.setRequestInterception(true);
                        
                        page.on('request', request => {
                            const resourceType = request.resourceType();
                            const filterType = args.filter_type || 'all';
                            
                            if (filterType === 'all' || 
                                (filterType === 'xhr' && resourceType === 'xhr') ||
                                (filterType === 'fetch' && resourceType === 'fetch') ||
                                (filterType === 'script' && resourceType === 'script') ||
                                (filterType === 'image' && resourceType === 'image')) {
                                
                                requests.push({
                                    url: request.url(),
                                    method: request.method(),
                                    resourceType,
                                    headers: request.headers()
                                });
                            }
                            request.continue();
                        });
                        
                        page.on('response', async response => {
                            const req = requests.find(r => r.url === response.url());
                            if (req) {
                                req.status = response.status();
                                req.statusText = response.statusText();
                                
                                if (args.capture_body) {
                                    try {
                                        const text = await response.text();
                                        req.body = text.substring(0, 10000);
                                    } catch(e) {}
                                }
                            }
                        });
                        
                        await page.goto(args.url, { waitUntil: 'networkidle2', timeout: 30000 });
                        
                        // Aguarda tempo adicional para capturar mais requisições
                        await new Promise(resolve => setTimeout(resolve, args.wait_time || 5000));
                        
                        await browser.close();
                        
                        result = { 
                            success: true,
                            url: args.url,
                            requests: requests.slice(0, 100),
                            count: requests.length
                        };
                    } catch (netErr) {
                        result = { error: `Erro no monitor: ${netErr.message}` };
                    }
                    break;
                }
                
                case 'http_request': {
                    try {
                        const config = {
                            url: args.url,
                            method: args.method || 'GET',
                            headers: args.headers || {},
                            timeout: args.timeout || 30000
                        };
                        
                        if (['POST', 'PUT', 'PATCH'].includes(config.method) && args.body) {
                            config.data = args.body;
                        }
                        
                        const response = await axios(config);
                        
                        result = {
                            success: true,
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers,
                            data: typeof response.data === 'string' ? 
                                response.data.substring(0, 50000) : 
                                JSON.stringify(response.data).substring(0, 50000)
                        };
                    } catch (httpErr) {
                        result = { 
                            error: httpErr.message,
                            status: httpErr.response?.status,
                            data: httpErr.response?.data
                        };
                    }
                    break;
                }
                
                default:
                    result = { error: `Ferramenta desconhecida: ${funcName}` };
            }
            
            results.push({
                tool_call_id: toolCall.id,
                role: "tool",
                content: JSON.stringify(result)
            });
            
        } catch (err) {
            results.push({
                tool_call_id: toolCall.id,
                role: "tool",
                content: JSON.stringify({ error: `Erro na ferramenta ${funcName}: ${err.message}` })
            });
        }
    }
    
    return results;
};

// Endpoint legado do Swarm (mantido para compatibilidade)
app.post('/api/swarm', auth, async (req, res) => {
    const { task, model } = req.body;
    const apiKey = await getApiKey(req.user);
    
    if (!apiKey) {
        return res.status(400).json({ error: 'Nenhuma API Key configurada.' });
    }

    try {
        const result = await executeSwarmAgent(apiKey, { 
            id: 'direct_task', 
            instruction: task 
        }, model);
        
        User.findByIdAndUpdate(req.user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
        res.json({ role: 'assistant', content: result.result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoint de chat com suporte a ferramentas Swarm (com rate limiting)
app.post('/api/chat/tools', auth, chatLimiter, async (req, res) => {
    const { chatId, messages, model, models, userSystemPrompt, enableSwarm = true, provider } = req.body;
    
    // Se usar GPT4Free
    if (provider === 'g4f') {
        // Obtém system prompt global (com cache)
        const globalSystemPrompt = await getGlobalSystemPrompt();
        
        const systemContent = [];
        if (globalSystemPrompt) systemContent.push(globalSystemPrompt);
        
        // Adiciona instruções de ferramentas se Swarm estiver habilitado
        if (enableSwarm) {
            systemContent.push(`Você é um assistente de IA avançado com acesso a ferramentas poderosas.

## FERRAMENTAS DISPONÍVEIS (G4F)

Nota: Nem todos os provedores G4F suportam ferramentas avançadas. Se uma ferramenta não estiver disponível, informe ao usuário.

### 🎨 GERAÇÃO DE MÍDIA
- **generate_image**: Gera imagens com base em descrições
- **generate_audio**: Gera áudio (fala ou música) com base em texto ou descrição  
- **generate_video**: Gera vídeos curtos com base em descrições

### 🛠️ FERRAMENTAS CUSTOMIZADAS
- **create_custom_tool**: Cria uma nova ferramenta reutilizável para o usuário
- **execute_custom_tool**: Executa uma ferramenta criada anteriormente
- **list_custom_tools**: Lista ferramentas do usuário
- **delete_custom_tool**: Remove uma ferramenta

### 💻 TERMINAL
- **execute_bash**: Executa comandos no terminal bash (com segurança)

### 🌐 WEB
- **web_search**: Pesquisa na web (DuckDuckGo)
- **web_scrape**: Extrai conteúdo de páginas web
- **http_request**: Faz requisições HTTP customizadas

### 🔍 NAVEGADOR AVANÇADO
- **browser_console**: Executa JavaScript no console de um site
- **network_monitor**: Monitora requisições de rede de uma página

Use as ferramentas quando apropriado, mas esteja ciente de que nem todas podem funcionar no modo G4F.`);
        } else {
            systemContent.push('Você é um assistente de IA avançado. As ferramentas avançadas não estão disponíveis neste modo.');
        }
        
        if (userSystemPrompt) systemContent.push(userSystemPrompt);
        if (req.user.bio) systemContent.push(`Informações sobre o usuário: ${req.user.bio}`);
        
        const msgs = [{ role: "system", content: systemContent.join('\n\n') }, ...messages];
        const tools = enableSwarm ? getAvailableTools(req.user._id) : undefined;

        console.log('=== DEBUG G4F TOOLS ===');
        console.log('enableSwarm:', enableSwarm);
        console.log('tools defined:', !!tools);
        console.log('tools count:', tools ? tools.length : 0);
        console.log('model:', model);

        try {
            let assistantMessage;
            
            if (enableSwarm && tools) {
                // Tenta usar tools
                assistantMessage = await callG4FWithTools(model, msgs, tools);
                console.log('G4F tool_calls:', !!assistantMessage.tool_calls);
            } else {
                // Chat simples sem tools
                assistantMessage = await callG4F(model, msgs);
            }
            
            // Processa tool calls se houver
            let iterations = 0;
            const maxIterations = 5; // Menos iterações para G4F
            
            while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
                iterations++;
                console.log(`G4F tool iteration ${iterations}`);
                
                // Adiciona a mensagem do assistente com tool_calls
                msgs.push(assistantMessage);
                
                // Processa as ferramentas (passa userId para ferramentas customizadas)
                const toolResults = await processToolCalls(assistantMessage.tool_calls, null, model, req.user._id, models);
                
                // Adiciona os resultados das ferramentas
                msgs.push(...toolResults);
                
                // Incrementa uso
                User.findByIdAndUpdate(req.user._id, { 
                    $inc: { 'usage.requests': toolResults.length } 
                }).catch(() => {});
                
                // Faz nova chamada para processar os resultados
                if (enableSwarm && tools) {
                    assistantMessage = await callG4FWithTools(model, msgs, tools);
                } else {
                    assistantMessage = await callG4F(model, msgs);
                }
            }

            // Prepara resposta final
            const finalResponse = {
                role: 'assistant',
                content: assistantMessage.content || '',
                swarm_used: iterations > 0,
                swarm_iterations: iterations,
                provider: 'g4f'
            };

            res.json(finalResponse);

            // Incrementa uso e salva histórico
            User.findByIdAndUpdate(req.user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
            
            // Rastreia uso do modelo (para estatísticas Groq)
            if (assistantMessage._provider) {
                new ModelUsage({
                    modelId: model,
                    provider: assistantMessage._provider,
                    userId: req.user._id,
                    username: req.user.username,
                    tokens: assistantMessage._tokens || 0,
                    timestamp: new Date()
                }).save().catch(err => console.error('Erro ao rastrear uso:', err));
            }
            
            if (chatId) {
                Chat.findOne({ _id: chatId, userId: req.user._id }).then(async (chat) => {
                    if (chat) {
                        chat.messages.push(messages[messages.length - 1]);
                        chat.messages.push({ role: 'assistant', content: finalResponse.content });
                        chat.model = model;
                        chat.updatedAt = Date.now();
                        await chat.save();
                    }
                }).catch(err => console.error('Erro ao salvar histórico G4F:', err));
            }
            return;
        } catch (e) {
            console.error('Erro G4F:', e.message);
            return res.status(500).json({ error: e.message });
        }
    }
    
    // OpenRouter com ferramentas
    const apiKey = await getApiKey(req.user);
    
    if (!apiKey) {
        return res.status(400).json({ error: 'Nenhuma API Key configurada. Configure sua chave pessoal ou peça ao admin.' });
    }

    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
            "HTTP-Referer": "https://meu-super-ai.vercel.app",
            "X-Title": "jgspAI"
        }
    });

    // System prompt com todas as ferramentas disponíveis
    const toolsInstructions = enableSwarm ? `

## FERRAMENTAS DISPONÍVEIS

Você tem acesso a um poderoso conjunto de ferramentas. Use-as quando necessário:

### 🔄 SISTEMA SWARM (Agentes Paralelos)
- **swarm_delegate**: Executa múltiplas tarefas em PARALELO usando agentes IA.

**COMO USAR SWARM:**
Use parâmetros simples: task1, task2, task3, etc.
Exemplo: swarm_delegate(task1="Pesquise Python", task2="Pesquise JavaScript", task3="Pesquise Rust")

**QUANDO USAR:**
- Pesquisar múltiplos tópicos ao mesmo tempo
- Comparar diferentes assuntos
- Analisar dados de diferentes perspectivas

### 🎨 GERAÇÃO DE MÍDIA
- **generate_image**: Gera imagens com base em descrições (DALL-E, Stable Diffusion, etc.)
- **generate_audio**: Gera áudio (fala ou música) com base em texto ou descrição
- **generate_video**: Gera vídeos curtos com base em descrições

### 🛠️ FERRAMENTAS CUSTOMIZADAS  
- **create_custom_tool**: Cria uma nova ferramenta reutilizável para o usuário
- **execute_custom_tool**: Executa uma ferramenta criada anteriormente
- **list_custom_tools**: Lista ferramentas do usuário
- **delete_custom_tool**: Remove uma ferramenta

### 💻 TERMINAL
- **execute_bash**: Executa comandos no terminal bash (com segurança)

### 🌐 WEB
- **web_search**: Pesquisa na web (DuckDuckGo)
- **web_scrape**: Extrai conteúdo de páginas web
- **http_request**: Faz requisições HTTP customizadas

### 🔍 NAVEGADOR AVANÇADO (Puppeteer)
- **browser_console**: Executa JavaScript no console de um site
- **network_monitor**: Monitora requisições de rede de uma página

---

## LISTA COMPLETA DE FERRAMENTAS (13 ferramentas):

1. **swarm_delegate** - Delega tarefas para múltiplos agentes IA em PARALELO
2. **generate_image** - Gera imagens a partir de descrições
3. **generate_audio** - Gera áudio/fala/música
4. **generate_video** - Gera vídeos curtos
5. **create_custom_tool** - Cria ferramentas personalizadas
6. **execute_custom_tool** - Executa ferramentas criadas
7. **list_custom_tools** - Lista suas ferramentas
8. **delete_custom_tool** - Remove ferramentas
9. **execute_bash** - Executa comandos no terminal
10. **web_search** - Pesquisa na web
11. **web_scrape** - Extrai conteúdo de sites
12. **http_request** - Faz requisições HTTP
13. **browser_console** - Executa JS em sites
14. **network_monitor** - Monitora requisições de rede

---

### QUANDO USAR CADA FERRAMENTA:
- Usuário quer gerar imagem → **generate_image**
- Usuário quer gerar áudio/música → **generate_audio** 
- Usuário quer gerar vídeo → **generate_video**
- Usuário quer criar automação/script → **create_custom_tool**
- Precisa de informação atualizada → **web_search**
- Quer dados de um site específico → **web_scrape** ou **browser_console**
- Quer analisar APIs de um site → **network_monitor**
- Precisa executar código local → **execute_bash**
- Múltiplas tarefas independentes → **swarm_delegate**

### CRIANDO FERRAMENTAS:
Quando o usuário pedir para criar uma ferramenta, use create_custom_tool com:
- name: nome_em_snake_case
- description: O que a ferramenta faz
- code: Código JavaScript que recebe 'params' e retorna resultado
- parameters: Schema dos parâmetros aceitos

Exemplo de código para ferramenta:
\`\`\`javascript
const { valor1, valor2 } = params;
return valor1 + valor2;
\`\`\`
` : '';

    // Obtém system prompt global (com cache)
    const globalSystemPrompt = await getGlobalSystemPrompt();
    
    const systemContent = [];
    if (globalSystemPrompt) systemContent.push(globalSystemPrompt); // Prioridade máxima - admin
    systemContent.push(`Você é um assistente de IA avançado com acesso a ferramentas poderosas.${toolsInstructions}`);
    if (userSystemPrompt) systemContent.push(userSystemPrompt);
    if (req.user.bio) systemContent.push(`Informações sobre o usuário: ${req.user.bio}`);
    
    const msgs = [{ role: "system", content: systemContent.join('\n\n') }, ...messages];
    const tools = enableSwarm ? getAvailableTools(req.user._id) : undefined;

    try {
        let resp = await openai.chat.completions.create({
            model: model || "google/gemini-2.0-flash-exp:free",
            messages: msgs,
            tools,
            tool_choice: enableSwarm ? "auto" : undefined
        });

        let assistantMessage = resp.choices[0].message;
        
        // Processa tool calls se houver
        let iterations = 0;
        const maxIterations = 10; // Aumentado para permitir mais iterações
        
        while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
            iterations++;
            
            // Adiciona a mensagem do assistente com tool_calls
            msgs.push(assistantMessage);
            
            // Processa as ferramentas (passa userId para ferramentas customizadas)
            const toolResults = await processToolCalls(assistantMessage.tool_calls, apiKey, model, req.user._id, models);
            
            // Adiciona os resultados das ferramentas
            msgs.push(...toolResults);
            
            // Incrementa uso para cada chamada de agente
            User.findByIdAndUpdate(req.user._id, { 
                $inc: { 'usage.requests': toolResults.length } 
            }).catch(() => {});
            
            // Faz nova chamada para a IA processar os resultados
            resp = await openai.chat.completions.create({
                model: model || "google/gemini-2.0-flash-exp:free",
                messages: msgs,
                tools,
                tool_choice: "auto"
            });
            
            assistantMessage = resp.choices[0].message;
        }

        // Prepara resposta final
        const finalResponse = {
            role: 'assistant',
            content: assistantMessage.content || '',
            swarm_used: iterations > 0,
            swarm_iterations: iterations
        };

        res.json(finalResponse);

        // Incrementa uso e salva histórico em background
        User.findByIdAndUpdate(req.user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
        
        if (chatId) {
            Chat.findOne({ _id: chatId, userId: req.user._id }).then(async (chat) => {
                if (chat) {
                    chat.messages.push(messages[messages.length - 1]);
                    chat.messages.push({ role: 'assistant', content: finalResponse.content });
                    chat.model = model;
                    chat.updatedAt = Date.now();
                    await chat.save();
                }
            }).catch(err => console.error('Erro ao salvar histórico:', err));
        }
    } catch (e) {
        console.error('Erro na API:', e.message);
        res.status(500).json({ error: e.message, details: e.response?.data });
    }
});

// ============ ADMIN - USUÁRIOS ============

app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
    await connectDB();
    const users = await User.find({}, '-password');
    res.json(users);
});

app.get('/api/admin/user/:id', auth, adminOnly, async (req, res) => {
    await connectDB();
    const user = await User.findById(req.params.id, '-password');
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    
    const tools = await CustomTool.find({ userId: req.params.id });
    const chats = await Chat.find({ userId: req.params.id }).select('title model updatedAt');
    res.json({ user, tools, chats });
});

app.delete('/api/admin/user/:id', auth, adminOnly, async (req, res) => {
    await connectDB();
    if (req.params.id === req.user._id.toString()) {
        return res.status(400).json({ error: 'Não pode deletar a si mesmo' });
    }
    await Chat.deleteMany({ userId: req.params.id });
    await CustomTool.deleteMany({ userId: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// ============ ADMIN - CHATS ============

app.get('/api/admin/chat/:id', auth, adminOnly, async (req, res) => {
    await connectDB();
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat não encontrado' });
    res.json(chat);
});

app.delete('/api/admin/chat/:id', auth, adminOnly, async (req, res) => {
    await connectDB();
    await Chat.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// ============ ADMIN - FERRAMENTAS ============

// Deletar ferramenta de qualquer usuário
app.delete('/api/admin/tool/:id', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const tool = await CustomTool.findByIdAndDelete(req.params.id);
        if (!tool) return res.status(404).json({ error: 'Ferramenta não encontrada' });
        res.json({ success: true, message: `Ferramenta "${tool.name}" deletada` });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao deletar ferramenta: ' + err.message });
    }
});

// ============ ADMIN - MENSAGENS PARA USUÁRIOS ============

// Enviar mensagem para usuário
app.post('/api/admin/user/:id/message', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { message } = req.body;
        
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Mensagem não pode estar vazia' });
        }
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            {
                adminMessage: {
                    content: message.trim(),
                    sentAt: new Date(),
                    read: false
                }
            },
            { new: true }
        );
        
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        
        res.json({ success: true, message: 'Mensagem enviada com sucesso' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao enviar mensagem: ' + err.message });
    }
});

// Limpar mensagem do usuário (admin)
app.delete('/api/admin/user/:id/message', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        await User.findByIdAndUpdate(req.params.id, {
            adminMessage: { content: '', read: true }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao limpar mensagem: ' + err.message });
    }
});

// Endpoint para usuário verificar se tem mensagem do admin
app.get('/api/user/admin-message', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user.adminMessage?.content && !user.adminMessage?.read) {
            res.json({
                hasMessage: true,
                message: user.adminMessage.content,
                sentAt: user.adminMessage.sentAt
            });
        } else {
            res.json({ hasMessage: false });
        }
    } catch (err) {
        res.json({ hasMessage: false });
    }
});

// Endpoint para usuário marcar mensagem como lida
app.post('/api/user/admin-message/read', auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            'adminMessage.read': true
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao marcar como lida' });
    }
});

// ============ ADMIN - CONFIGURAÇÕES GLOBAIS ============

app.get('/api/admin/config', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const apiKeyConfig = await GlobalConfig.findOne({ key: 'OPENROUTER_API_KEY' });
        const groqKeyConfig = await GlobalConfig.findOne({ key: 'GROQ_API_KEY' });
        const defaultModelConfig = await GlobalConfig.findOne({ key: 'DEFAULT_MODEL' });
        const defaultModelsConfig = await GlobalConfig.findOne({ key: 'DEFAULT_MODELS' });
        const globalSystemPromptConfig = await GlobalConfig.findOne({ key: 'GLOBAL_SYSTEM_PROMPT' });
        res.json({
            hasGlobalApiKey: !!apiKeyConfig?.value,
            globalApiKeyPreview: apiKeyConfig?.value ? '****' + apiKeyConfig.value.slice(-4) : null,
            hasGroqApiKey: !!groqKeyConfig?.value,
            groqApiKeyPreview: groqKeyConfig?.value ? '****' + groqKeyConfig.value.slice(-4) : null,
            defaultModel: defaultModelConfig?.value || 'google/gemini-2.0-flash-exp:free',
            defaultModels: defaultModelsConfig?.value || {},
            globalSystemPrompt: globalSystemPromptConfig?.value || ''
        });
    } catch (err) {
        console.error('Erro ao carregar config:', err);
        res.status(500).json({ error: 'Erro ao carregar configurações: ' + err.message });
    }
});

// Endpoint público para obter modelo padrão (usado pelo frontend)
app.get('/api/config/default-model', async (req, res) => {
    try {
        await connectDB();
        const defaultModelConfig = await GlobalConfig.findOne({ key: 'DEFAULT_MODEL' });
        const defaultModelsConfig = await GlobalConfig.findOne({ key: 'DEFAULT_MODELS' });
        res.json({
            defaultModel: defaultModelConfig?.value || 'google/gemini-2.0-flash-exp:free',
            defaultModels: defaultModelsConfig?.value || {}
        });
    } catch (err) {
        console.error('Erro ao obter modelo padrão:', err);
        res.json({ defaultModel: 'google/gemini-2.0-flash-exp:free', defaultModels: {} });
    }
});

app.post('/api/admin/config/apikey', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { apiKey, groqApiKey } = req.body;
        
        // Salvar OpenRouter API Key se fornecida
        if (apiKey !== undefined) {
            await GlobalConfig.findOneAndUpdate(
                { key: 'OPENROUTER_API_KEY' },
                { key: 'OPENROUTER_API_KEY', value: apiKey || '', updatedAt: new Date() },
                { upsert: true, new: true }
            );
            // Invalida cache
            cache.del('config:OPENROUTER_API_KEY');
        }
        
        // Salvar Groq API Key se fornecida
        if (groqApiKey !== undefined) {
            await GlobalConfig.findOneAndUpdate(
                { key: 'GROQ_API_KEY' },
                { key: 'GROQ_API_KEY', value: groqApiKey || '', updatedAt: new Date() },
                { upsert: true, new: true }
            );
            // Invalida cache
            cache.del('config:GROQ_API_KEY');
        }
        
        // Buscar valores atualizados
        const openRouterConfig = await GlobalConfig.findOne({ key: 'OPENROUTER_API_KEY' });
        const groqConfig = await GlobalConfig.findOne({ key: 'GROQ_API_KEY' });
        
        res.json({ 
            success: true, 
            hasGlobalApiKey: !!openRouterConfig?.value,
            globalApiKeyPreview: openRouterConfig?.value ? '****' + openRouterConfig.value.slice(-4) : null,
            hasGroqApiKey: !!groqConfig?.value,
            groqApiKeyPreview: groqConfig?.value ? '****' + groqConfig.value.slice(-4) : null
        });
    } catch (err) {
        console.error('Erro ao salvar API key:', err);
        res.status(500).json({ error: 'Erro ao salvar API key: ' + err.message });
    }
});

// Salvar modelos padrão por categoria
app.post('/api/admin/config/default-models', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { textModel, imageModel, audioModel, videoModel } = req.body;
        
        const defaults = {
            text: textModel,
            image: imageModel,
            audio: audioModel,
            video: videoModel
        };

        await GlobalConfig.findOneAndUpdate(
            { key: 'DEFAULT_MODELS' },
            { key: 'DEFAULT_MODELS', value: defaults },
            { upsert: true, new: true }
        );
        
        res.json({ 
            success: true, 
            defaultModels: defaults
        });
    } catch (err) {
        console.error('Erro ao salvar modelos padrão:', err);
        res.status(500).json({ error: 'Erro ao salvar modelos: ' + err.message });
    }
});

// Salvar system prompt global (invisível aos usuários)
app.post('/api/admin/config/system-prompt', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { systemPrompt } = req.body;
        
        await GlobalConfig.findOneAndUpdate(
            { key: 'GLOBAL_SYSTEM_PROMPT' },
            { key: 'GLOBAL_SYSTEM_PROMPT', value: systemPrompt || '', updatedAt: new Date() },
            { upsert: true, new: true }
        );
        
        // Invalida cache
        cache.del('config:GLOBAL_SYSTEM_PROMPT');
        
        res.json({ 
            success: true, 
            globalSystemPrompt: systemPrompt || ''
        });
    } catch (err) {
        console.error('Erro ao salvar system prompt global:', err);
        res.status(500).json({ error: 'Erro ao salvar system prompt: ' + err.message });
    }
});

// ============ ESTATÍSTICAS ADMIN (com cache de 1 minuto) ============

app.get('/api/admin/stats', auth, adminOnly, async (req, res) => {
    try {
        const cacheKey = 'admin:stats';
        let stats = cache.get(cacheKey);
        
        if (!stats) {
            await connectDB();
            const [totalUsers, totalChats, totalRequestsResult] = await Promise.all([
                User.countDocuments(),
                Chat.countDocuments(),
                User.aggregate([
                    { $group: { _id: null, total: { $sum: '$usage.requests' } } }
                ])
            ]);
            
            stats = {
                totalUsers,
                totalChats,
                totalRequests: totalRequestsResult[0]?.total || 0
            };
            
            // Cache por 1 minuto
            cache.set(cacheKey, stats, 60);
        }
        
        res.json(stats);
    } catch (err) {
        console.error('Erro ao carregar stats:', err);
        res.status(500).json({ error: 'Erro ao carregar estatísticas: ' + err.message });
    }
});

// Endpoint admin para limpar cache
app.post('/api/admin/cache/clear', auth, adminOnly, (req, res) => {
    const { prefix } = req.body;
    
    if (prefix) {
        const count = cache.delByPrefix(prefix);
        res.json({ success: true, message: `${count} itens removidos com prefixo "${prefix}"` });
    } else {
        // Limpa todo o cache
        const stats = cache.stats();
        cache.cache.clear();
        cache.timers.forEach(t => clearTimeout(t));
        cache.timers.clear();
        res.json({ success: true, message: `Cache limpo. ${stats.size} itens removidos.` });
    }
});

// Endpoint admin para ver status do cache
app.get('/api/admin/cache/stats', auth, adminOnly, (req, res) => {
    res.json(cache.stats());
});

// Endpoint admin para status do servidor
app.get('/api/admin/server-status', auth, adminOnly, (req, res) => {
    const used = process.memoryUsage();
    res.json({
        uptime: process.uptime(),
        memory: {
            heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
            external: Math.round(used.external / 1024 / 1024) + ' MB',
            rss: Math.round(used.rss / 1024 / 1024) + ' MB'
        },
        cache: cache.stats(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        nodeVersion: process.version,
        platform: process.platform
    });
});

// ============ CONTEÚDO DAS PÁGINAS (PÚBLICO) ============

// Obter conteúdo de uma página (público)
app.get('/api/content/:page', async (req, res) => {
    try {
        await connectDB();
        const { page } = req.params;
        
        if (!['homepage', 'docs'].includes(page)) {
            return res.status(400).json({ error: 'Página inválida' });
        }
        
        const content = await PageContent.findOne({ page });
        
        if (!content) {
            // Retorna conteúdo padrão se não existir customização
            return res.json({ 
                page, 
                sections: [],
                isDefault: true
            });
        }
        
        res.json(content);
    } catch (err) {
        console.error('Erro ao buscar conteúdo:', err);
        res.status(500).json({ error: 'Erro ao buscar conteúdo' });
    }
});

// ============ ADMIN - EDIÇÃO DE CONTEÚDO ============

// Listar todas as páginas editáveis
app.get('/api/admin/content', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const pages = await PageContent.find({});
        
        // Retorna as páginas existentes ou placeholder para as padrão
        const result = ['homepage', 'docs'].map(pageName => {
            const existing = pages.find(p => p.page === pageName);
            return existing || { page: pageName, sections: [], isDefault: true };
        });
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar páginas' });
    }
});

// Obter conteúdo de uma página específica (admin)
app.get('/api/admin/content/:page', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { page } = req.params;
        
        if (!['homepage', 'docs'].includes(page)) {
            return res.status(400).json({ error: 'Página inválida' });
        }
        
        let content = await PageContent.findOne({ page });
        
        if (!content) {
            // Cria conteúdo padrão
            content = await PageContent.create({
                page,
                sections: getDefaultSections(page),
                updatedBy: req.user._id
            });
        }
        
        res.json(content);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar conteúdo' });
    }
});

// Atualizar conteúdo de uma página
app.put('/api/admin/content/:page', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { page } = req.params;
        const { sections } = req.body;
        
        if (!['homepage', 'docs'].includes(page)) {
            return res.status(400).json({ error: 'Página inválida' });
        }
        
        const content = await PageContent.findOneAndUpdate(
            { page },
            { 
                page,
                sections,
                updatedAt: new Date(),
                updatedBy: req.user._id
            },
            { upsert: true, new: true }
        );
        
        res.json({ success: true, content });
    } catch (err) {
        console.error('Erro ao atualizar conteúdo:', err);
        res.status(500).json({ error: 'Erro ao atualizar conteúdo' });
    }
});

// Adicionar seção a uma página
app.post('/api/admin/content/:page/section', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { page } = req.params;
        const section = req.body;
        
        if (!section.id) {
            section.id = 'section_' + Date.now();
        }
        
        let content = await PageContent.findOne({ page });
        
        if (!content) {
            content = await PageContent.create({
                page,
                sections: [section],
                updatedBy: req.user._id
            });
        } else {
            content.sections.push(section);
            content.updatedAt = new Date();
            content.updatedBy = req.user._id;
            await content.save();
        }
        
        res.json({ success: true, section, content });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao adicionar seção' });
    }
});

// Atualizar seção específica
app.patch('/api/admin/content/:page/section/:sectionId', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { page, sectionId } = req.params;
        const updates = req.body;
        
        const content = await PageContent.findOne({ page });
        if (!content) {
            return res.status(404).json({ error: 'Página não encontrada' });
        }
        
        const sectionIndex = content.sections.findIndex(s => s.id === sectionId);
        if (sectionIndex === -1) {
            return res.status(404).json({ error: 'Seção não encontrada' });
        }
        
        Object.assign(content.sections[sectionIndex], updates);
        content.updatedAt = new Date();
        content.updatedBy = req.user._id;
        await content.save();
        
        res.json({ success: true, section: content.sections[sectionIndex] });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar seção' });
    }
});

// Deletar seção
app.delete('/api/admin/content/:page/section/:sectionId', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { page, sectionId } = req.params;
        
        const content = await PageContent.findOne({ page });
        if (!content) {
            return res.status(404).json({ error: 'Página não encontrada' });
        }
        
        content.sections = content.sections.filter(s => s.id !== sectionId);
        content.updatedAt = new Date();
        content.updatedBy = req.user._id;
        await content.save();
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao deletar seção' });
    }
});

// Função para obter seções padrão
function getDefaultSections(page) {
    if (page === 'homepage') {
        return [
            {
                id: 'hero',
                type: 'hero',
                title: 'jgspAI',
                subtitle: 'Plataforma de Inteligência Artificial avançada com múltiplas ferramentas para potencializar sua produtividade.',
                visible: true,
                order: 0
            },
            {
                id: 'features',
                type: 'feature',
                title: 'Recursos Poderosos',
                visible: true,
                order: 1
            }
        ];
    } else if (page === 'docs') {
        return [
            {
                id: 'intro',
                type: 'text',
                title: 'Introdução',
                content: '# Bem-vindo ao jgspAI\n\nDocumentação completa da plataforma.',
                visible: true,
                order: 0
            }
        ];
    }
    return [];
}

// ============ GROQ ADMIN ROUTES ============

// Cache para modelos Groq da API
let groqModelsCache = { data: null, lastFetch: 0 };
const GROQ_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Buscar modelos Groq dinamicamente da API
app.get('/api/admin/groq/models', auth, adminOnly, async (req, res) => {
    try {
        const groqKey = await getGroqApiKey();
        if (!groqKey) {
            return res.status(400).json({ error: 'Groq API Key não configurada' });
        }
        
        const now = Date.now();
        
        // Verificar cache
        if (groqModelsCache.data && (now - groqModelsCache.lastFetch) < GROQ_CACHE_TTL) {
            return res.json(groqModelsCache.data);
        }
        
        // Limites OFICIAIS da documentação do Groq (tier Free)
        // Fonte: https://console.groq.com/docs/rate-limits (Dezembro 2024)
        // Formato: { rpm, rpd, tpm, tpd } (requests/tokens per minute/day)
        const knownLimits = {
            // ===== MODELOS DE TEXTO =====
            'allam-2-7b': { rpm: 30, rpd: 7000, tpm: 6000, tpd: 500000 },
            'llama-3.1-8b-instant': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 500000 },
            'llama-3.3-70b-versatile': { rpm: 30, rpd: 1000, tpm: 12000, tpd: 100000 },
            
            // Llama 4 Models
            'meta-llama/llama-4-maverick-17b-128e-instruct': { rpm: 30, rpd: 1000, tpm: 6000, tpd: 500000 },
            'meta-llama/llama-4-scout-17b-16e-instruct': { rpm: 30, rpd: 1000, tpm: 30000, tpd: 500000 },
            
            // Llama Guard / Prompt Guard
            'meta-llama/llama-guard-4-12b': { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
            'meta-llama/llama-prompt-guard-2-22m': { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
            'meta-llama/llama-prompt-guard-2-86m': { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
            
            // Kimi K2 (MoonshotAI)
            'moonshotai/kimi-k2-instruct': { rpm: 60, rpd: 1000, tpm: 10000, tpd: 300000 },
            'moonshotai/kimi-k2-instruct-0905': { rpm: 60, rpd: 1000, tpm: 10000, tpd: 300000 },
            
            // OpenAI GPT-OSS
            'openai/gpt-oss-120b': { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200000 },
            'openai/gpt-oss-20b': { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200000 },
            'openai/gpt-oss-safeguard-20b': { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200000 },
            
            // Qwen
            'qwen/qwen3-32b': { rpm: 60, rpd: 1000, tpm: 6000, tpd: 500000 },
            
            // Compound (Agents)
            'groq/compound': { rpm: 30, rpd: 250, tpm: 70000, tpd: 0 },
            'groq/compound-mini': { rpm: 30, rpd: 250, tpm: 70000, tpd: 0 },
            
            // ===== MODELOS DE ÁUDIO (TTS) =====
            'playai-tts': { rpm: 10, rpd: 100, tpm: 1200, tpd: 3600 },
            'playai-tts-arabic': { rpm: 10, rpd: 100, tpm: 1200, tpd: 3600 },
            
            // ===== MODELOS DE ÁUDIO (STT) =====
            // ASH = Audio Seconds per Hour, ASD = Audio Seconds per Day
            'whisper-large-v3': { rpm: 20, rpd: 2000, tpm: 0, tpd: 0, ash: 7200, asd: 28800 },
            'whisper-large-v3-turbo': { rpm: 20, rpd: 2000, tpm: 0, tpd: 0, ash: 7200, asd: 28800 },
            
            // ===== MODELOS LEGACY (ainda suportados) =====
            'llama-3.1-70b-versatile': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
            'llama3-70b-8192': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 },
            'llama3-8b-8192': { rpm: 30, rpd: 14400, tpm: 30000, tpd: 500000 },
            'gemma2-9b-it': { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
            'mixtral-8x7b-32768': { rpm: 30, rpd: 14400, tpm: 5000, tpd: 500000 },
            
            // Limites padrão para modelos não listados
            '_default': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 200000 }
        };
        
        // Buscar modelos da API do Groq
        const response = await axios.get('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${groqKey}` },
            timeout: 10000
        });
        
        // Buscar modelos ocultos do banco
        await connectDB();
        const hiddenConfig = await GlobalConfig.findOne({ key: 'GROQ_HIDDEN_MODELS' });
        const hiddenModels = hiddenConfig?.value || [];
        
        // Processar modelos
        const models = response.data.data
            .filter(m => m.id && !m.id.includes('whisper')) // Filtrar whisper (audio)
            .map(m => {
                const modelLimits = knownLimits[m.id] || knownLimits['_default'];
                return {
                    id: m.id,
                    name: m.id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    owned_by: m.owned_by,
                    context_window: m.context_window || 8192,
                    created: m.created,
                    hidden: hiddenModels.includes(m.id),
                    limits: {
                        requestsPerMinute: modelLimits.rpm,
                        requestsPerDay: modelLimits.rpd,
                        tokensPerMinute: modelLimits.tpm,
                        tokensPerDay: modelLimits.tpd
                    }
                };
            });
        
        groqModelsCache = { data: models, lastFetch: now };
        res.json(models);
        
    } catch (e) {
        console.error('Erro ao buscar modelos Groq:', e.message);
        
        // Fallback: retornar modelos conhecidos com limites oficiais
        const fallbackModels = [
            { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', context_window: 128000, limits: { requestsPerMinute: 30, requestsPerDay: 1000, tokensPerMinute: 12000, tokensPerDay: 100000 } },
            { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', context_window: 128000, limits: { requestsPerMinute: 30, requestsPerDay: 14400, tokensPerMinute: 6000, tokensPerDay: 500000 } },
            { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', context_window: 128000, limits: { requestsPerMinute: 30, requestsPerDay: 1000, tokensPerMinute: 6000, tokensPerDay: 500000 } },
            { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', context_window: 128000, limits: { requestsPerMinute: 30, requestsPerDay: 1000, tokensPerMinute: 30000, tokensPerDay: 500000 } },
            { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2 Instruct', context_window: 128000, limits: { requestsPerMinute: 60, requestsPerDay: 1000, tokensPerMinute: 10000, tokensPerDay: 300000 } },
            { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', context_window: 128000, limits: { requestsPerMinute: 30, requestsPerDay: 1000, tokensPerMinute: 8000, tokensPerDay: 200000 } },
            { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', context_window: 128000, limits: { requestsPerMinute: 30, requestsPerDay: 1000, tokensPerMinute: 8000, tokensPerDay: 200000 } },
            { id: 'qwen/qwen3-32b', name: 'Qwen3 32B', context_window: 32768, limits: { requestsPerMinute: 60, requestsPerDay: 1000, tokensPerMinute: 6000, tokensPerDay: 500000 } },
            { id: 'allam-2-7b', name: 'Allam 2 7B', context_window: 8192, limits: { requestsPerMinute: 30, requestsPerDay: 7000, tokensPerMinute: 6000, tokensPerDay: 500000 } },
        ];
        res.json(fallbackModels);
    }
});

// Buscar limites de uso do Groq
app.get('/api/admin/groq/limits', auth, adminOnly, async (req, res) => {
    try {
        const groqKey = await getGroqApiKey();
        if (!groqKey) {
            return res.status(400).json({ error: 'Groq API Key não configurada' });
        }
        
        // A API do Groq não tem endpoint público de limites, então vamos simular baseado na documentação
        // Limites típicos do tier gratuito: https://console.groq.com/docs/rate-limits
        const defaultLimits = {
            tier: 'free',
            requests_per_minute: 30,
            requests_per_day: 14400,
            tokens_per_minute: 6000,
            tokens_per_day: 500000,
            models: {
                'llama-3.3-70b-versatile': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 131072 },
                'llama-3.1-70b-versatile': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 131072 },
                'llama-3.1-8b-instant': { rpm: 30, rpd: 14400, tpm: 20000, tpd: 500000 },
                'llama3-70b-8192': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 500000 },
                'llama3-8b-8192': { rpm: 30, rpd: 14400, tpm: 30000, tpd: 500000 },
                'gemma2-9b-it': { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
                'mixtral-8x7b-32768': { rpm: 30, rpd: 14400, tpm: 5000, tpd: 500000 },
            }
        };
        
        res.json(defaultLimits);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Estatísticas de uso dos modelos
app.get('/api/admin/groq/stats', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        
        const { period = '7d' } = req.query;
        const periodMs = {
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
            'all': 365 * 24 * 60 * 60 * 1000
        };
        
        const startDate = new Date(Date.now() - (periodMs[period] || periodMs['7d']));
        
        // Uso por modelo
        const modelUsage = await ModelUsage.aggregate([
            { $match: { provider: 'groq', timestamp: { $gte: startDate } } },
            { $group: { 
                _id: '$modelId', 
                count: { $sum: 1 },
                tokens: { $sum: '$tokens' },
                users: { $addToSet: '$userId' }
            }},
            { $project: { 
                modelId: '$_id', 
                count: 1, 
                tokens: 1, 
                uniqueUsers: { $size: '$users' }
            }},
            { $sort: { count: -1 } }
        ]);
        
        // Ranking de usuários por modelo
        const usersByModel = await ModelUsage.aggregate([
            { $match: { provider: 'groq', timestamp: { $gte: startDate } } },
            { $group: { 
                _id: { modelId: '$modelId', userId: '$userId', username: '$username' },
                count: { $sum: 1 },
                tokens: { $sum: '$tokens' }
            }},
            { $sort: { count: -1 } },
            { $group: {
                _id: '$_id.modelId',
                topUsers: { $push: { 
                    userId: '$_id.userId',
                    username: '$_id.username',
                    count: '$count',
                    tokens: '$tokens'
                }}
            }},
            { $project: {
                modelId: '$_id',
                topUsers: { $slice: ['$topUsers', 10] }
            }}
        ]);
        
        // Ranking geral de usuários
        const topUsersGeneral = await ModelUsage.aggregate([
            { $match: { provider: 'groq', timestamp: { $gte: startDate } } },
            { $group: { 
                _id: { userId: '$userId', username: '$username' },
                count: { $sum: 1 },
                tokens: { $sum: '$tokens' },
                models: { $addToSet: '$modelId' }
            }},
            { $project: {
                userId: '$_id.userId',
                username: '$_id.username',
                count: 1,
                tokens: 1,
                modelsUsed: { $size: '$models' }
            }},
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]);
        
        // Total de uso
        const totalUsage = await ModelUsage.aggregate([
            { $match: { provider: 'groq', timestamp: { $gte: startDate } } },
            { $group: { 
                _id: null,
                totalRequests: { $sum: 1 },
                totalTokens: { $sum: '$tokens' },
                uniqueUsers: { $addToSet: '$userId' },
                uniqueModels: { $addToSet: '$modelId' }
            }},
            { $project: {
                totalRequests: 1,
                totalTokens: 1,
                uniqueUsers: { $size: '$uniqueUsers' },
                uniqueModels: { $size: '$uniqueModels' }
            }}
        ]);
        
        // Uso por dia (para gráfico)
        const dailyUsage = await ModelUsage.aggregate([
            { $match: { provider: 'groq', timestamp: { $gte: startDate } } },
            { $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                count: { $sum: 1 },
                tokens: { $sum: '$tokens' }
            }},
            { $sort: { _id: 1 } }
        ]);
        
        res.json({
            period,
            total: totalUsage[0] || { totalRequests: 0, totalTokens: 0, uniqueUsers: 0, uniqueModels: 0 },
            modelUsage,
            usersByModel,
            topUsersGeneral,
            dailyUsage
        });
        
    } catch (e) {
        console.error('Erro ao buscar stats Groq:', e);
        res.status(500).json({ error: e.message });
    }
});

// Ocultar/mostrar modelos Groq
app.post('/api/admin/groq/toggle-visibility', auth, adminOnly, async (req, res) => {
    try {
        const { modelId, hidden } = req.body;
        
        if (!modelId) {
            return res.status(400).json({ error: 'modelId é obrigatório' });
        }
        
        await connectDB();
        
        let hiddenConfig = await GlobalConfig.findOne({ key: 'GROQ_HIDDEN_MODELS' });
        let hiddenModels = hiddenConfig?.value || [];
        
        if (hidden) {
            if (!hiddenModels.includes(modelId)) {
                hiddenModels.push(modelId);
            }
        } else {
            hiddenModels = hiddenModels.filter(id => id !== modelId);
        }
        
        await GlobalConfig.findOneAndUpdate(
            { key: 'GROQ_HIDDEN_MODELS' },
            { key: 'GROQ_HIDDEN_MODELS', value: hiddenModels, updatedAt: new Date() },
            { upsert: true }
        );
        
        // Limpar cache
        groqModelsCache = { data: null, lastFetch: 0 };
        
        res.json({ success: true, hiddenModels });
        
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Buscar modelos ocultos
app.get('/api/admin/groq/hidden', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const config = await GlobalConfig.findOne({ key: 'GROQ_HIDDEN_MODELS' });
        res.json(config?.value || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
