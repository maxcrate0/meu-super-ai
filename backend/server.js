require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai');
const axios = require('axios');
const compression = require('compression');
const { exec } = require('child_process');
const util = require('util');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');

// GPT4Free - módulo será carregado dinamicamente (é ESM)
let g4fModule = null;
let g4fProviders = null;
let createG4FClient = null;

async function loadG4F() {
    if (!g4fModule) {
        g4fModule = await import('@gpt4free/g4f.dev');
        const providersModule = await import('@gpt4free/g4f.dev/providers');
        g4fProviders = providersModule.default || providersModule;
        createG4FClient = providersModule.createClient;
    }
    return { g4fModule, g4fProviders, createG4FClient };
}

const User = require('./models/User');
const Chat = require('./models/Chat');
const CustomTool = require('./models/CustomTool');
const GlobalConfig = require('./models/GlobalConfig');
const PageContent = require('./models/PageContent');

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
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] }));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meu-super-ai';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

// Cache para modelos (atualiza a cada 5 minutos)
let modelsCache = { data: [], lastFetch: 0 };
let g4fModelsCache = { data: [], lastFetch: 0 };
const MODELS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Conexão MongoDB
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('MongoDB Conectado');
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

// Middleware de autenticação
const auth = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
        req.user = user;
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

// Helper para obter API Key (prioridade: usuário > global do banco > env)
const getApiKey = async (user) => {
    if (user.personal_api_key) return user.personal_api_key;
    await connectDB();
    const globalKey = await GlobalConfig.findOne({ key: 'OPENROUTER_API_KEY' });
    if (globalKey) return globalKey.value;
    return process.env.GLOBAL_API_KEY || '';
};

// ============ ROTAS PÚBLICAS ============

app.get('/api/ping', (req, res) => res.send('pong'));

// Modelos OpenRouter (com cache)
app.get('/api/models', async (req, res) => {
    const now = Date.now();
    if (modelsCache.data.length > 0 && (now - modelsCache.lastFetch) < MODELS_CACHE_TTL) {
        return res.json(modelsCache.data);
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
        
        modelsCache = { data: freeModels, lastFetch: now };
        res.json(freeModels);
    } catch (e) {
        console.error('Erro ao buscar modelos:', e.message);
        // Retorna cache antigo se existir, senão lista vazia
        res.json(modelsCache.data.length > 0 ? modelsCache.data : []);
    }
});

// Modelos GPT4Free - busca dos provedores reais via @gpt4free/g4f.dev
app.get('/api/models/g4f', async (req, res) => {
    const now = Date.now();
    
    // Retorna cache se ainda válido (cache de 30 minutos para g4f)
    const G4F_CACHE_TTL = 30 * 60 * 1000;
    if (g4fModelsCache.data.length > 0 && (now - g4fModelsCache.lastFetch) < G4F_CACHE_TTL) {
        return res.json(g4fModelsCache.data);
    }
    
    try {
        const { createG4FClient: createClient } = await loadG4F();
        const allModels = [];
        
        // Provedores gratuitos do g4f.dev
        const freeProviders = ['pollinations-ai', 'default', 'puter'];
        
        for (const providerName of freeProviders) {
            try {
                const client = createClient(providerName);
                const models = await client.models.list();
                
                if (models && models.length > 0) {
                    models.forEach(m => {
                        allModels.push({
                            id: m.id,
                            name: m.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                            provider: providerName,
                            type: m.type || 'chat'
                        });
                    });
                }
            } catch (e) {
                console.log(`Erro ao buscar modelos do provider ${providerName}:`, e.message);
            }
        }
        
        // Se conseguiu buscar modelos, salva no cache
        if (allModels.length > 0) {
            // Remove duplicatas por ID
            const uniqueModels = [...new Map(allModels.map(m => [m.id, m])).values()];
            g4fModelsCache = { data: uniqueModels, lastFetch: now };
            
            // Salva no MongoDB para persistência
            await connectDB();
            await mongoose.connection.db.collection('g4f_cache').updateOne(
                { _id: 'g4f_data' },
                { $set: { models: uniqueModels, updated_at: new Date() } },
                { upsert: true }
            );
            
            return res.json(uniqueModels);
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
    
    // Fallback final: Lista de modelos conhecidos do pollinations-ai
    const g4fModels = [
        { id: 'deepseek-v3', name: 'DeepSeek V3.1', provider: 'pollinations-ai', type: 'chat' },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'pollinations-ai', type: 'chat' },
        { id: 'searchgpt', name: 'Gemini Search', provider: 'pollinations-ai', type: 'chat' },
        { id: 'mistral-small-3.1-24b-instruct', name: 'Mistral Small 3.2 24B', provider: 'pollinations-ai', type: 'chat' },
        { id: 'gpt-5-mini', name: 'OpenAI GPT-5 Nano', provider: 'pollinations-ai', type: 'chat' },
        { id: 'llama-4-maverick', name: 'Llama 4 Maverick', provider: 'pollinations-ai', type: 'chat' },
        { id: 'qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'pollinations-ai', type: 'chat' },
        { id: 'claude-hybridspace', name: 'Claude Hybridspace', provider: 'pollinations-ai', type: 'chat' },
        { id: 'gemma-3-27b-it', name: 'Gemma 3 27B', provider: 'pollinations-ai', type: 'chat' },
    ];
    
    g4fModelsCache = { data: g4fModels, lastFetch: now };
    res.json(g4fModels);
});

// ============ AUTH ============

app.post('/api/register', async (req, res) => {
    await connectDB();
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username e password são obrigatórios' });
    if (await User.findOne({ username })) return res.status(400).json({ error: 'Usuário já existe' });
    
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash });
    res.json({ 
        token: jwt.sign({ id: user._id }, JWT_SECRET), 
        role: user.role, 
        username: user.username,
        theme: user.theme,
        displayName: user.displayName,
        bio: user.bio
    });
});

app.post('/api/login', async (req, res) => {
    await connectDB();
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(400).json({ error: 'Credenciais inválidas' });
    }
    res.json({ 
        token: jwt.sign({ id: user._id }, JWT_SECRET), 
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

// ============ CHAT COM IA ============

// Helper para chamada GPT4Free usando @gpt4free/g4f.dev
const callG4F = async (model, messages, preferredProvider = null) => {
    const { createG4FClient: createClient } = await loadG4F();
    
    // Extrai o provedor do modelo se estiver no formato "provider/model"
    let provider = preferredProvider;
    let modelName = model;
    
    if (model.includes('/')) {
        const parts = model.split('/');
        provider = parts[0];
        modelName = parts.slice(1).join('/');
    }
    
    // Lista de provedores para tentar (em ordem de prioridade) - usando nomes do g4f.dev
    const providersToTry = provider 
        ? [provider]
        : ['pollinations-ai', 'default', 'puter', 'deep-infra', 'hugging-face'];
    
    const errors = [];
    
    for (const providerKey of providersToTry) {
        try {
            const client = createClient(providerKey);
            console.log(`Tentando G4F com provedor: ${providerKey}, modelo: ${modelName}`);
            
            const response = await client.chat.completions.create({
                model: modelName,
                messages: messages,
            });
            
            if (response?.choices?.[0]?.message) {
                console.log(`G4F sucesso com provedor: ${providerKey}`);
                return response.choices[0].message;
            }
        } catch (e) {
            console.log(`G4F provedor ${providerKey} falhou:`, e.message);
            errors.push(`${providerKey}: ${e.message}`);
            continue;
        }
    }
    
    throw new Error(`Todos os provedores GPT4Free falharam: ${errors.join('; ')}`);
};

app.post('/api/chat', auth, async (req, res) => {
    const { chatId, messages, model, userSystemPrompt, provider } = req.body;
    
    // Se usar GPT4Free
    if (provider === 'g4f') {
        // Obtém system prompt global
        const globalSystemPromptConfig = await GlobalConfig.findOne({ key: 'GLOBAL_SYSTEM_PROMPT' });
        const globalSystemPrompt = globalSystemPromptConfig?.value || '';
        
        const systemContent = [];
        if (globalSystemPrompt) systemContent.push(globalSystemPrompt);
        if (userSystemPrompt) systemContent.push(userSystemPrompt);
        if (req.user.bio) systemContent.push(`Informações sobre o usuário: ${req.user.bio}`);
        
        const msgs = systemContent.length > 0 
            ? [{ role: "system", content: systemContent.join('\n\n') }, ...messages]
            : [...messages];
        
        try {
            const msg = await callG4F(model, msgs);
            res.json(msg);
            
            // Incrementa uso e salva histórico
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

    // Obtém system prompt global (prioridade máxima, invisível ao usuário)
    const globalSystemPromptConfig = await GlobalConfig.findOne({ key: 'GLOBAL_SYSTEM_PROMPT' });
    const globalSystemPrompt = globalSystemPromptConfig?.value || '';
    
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
            description: `Delega uma ou mais tarefas para agentes secundários (IAs auxiliares) que executam de forma independente e retornam apenas o resultado. 
Use esta ferramenta para:
- Executar múltiplas tarefas em PARALELO para maior eficiência
- Processar dados extensos sem ocupar sua janela de contexto
- Analisar, resumir ou transformar informações
Os agentes têm MEMÓRIA VOLÁTIL, então inclua TODO o contexto necessário em cada tarefa.`,
            parameters: {
                type: "object",
                properties: {
                    tasks: {
                        type: "array",
                        description: "Lista de tarefas a serem executadas por agentes secundários em paralelo",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string", description: "Identificador único da tarefa" },
                                instruction: { type: "string", description: "Instrução clara e completa para o agente" },
                                context: { type: "string", description: "Dados ou contexto adicional (opcional)" },
                                output_format: { type: "string", description: "Formato esperado da resposta" }
                            },
                            required: ["id", "instruction"]
                        }
                    }
                },
                required: ["tasks"]
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
const processToolCalls = async (toolCalls, apiKey, model, userId) => {
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
                    const tasks = args.tasks || args.task || [];
                    const taskArray = Array.isArray(tasks) ? tasks : [tasks];
                    
                    if (taskArray.length === 0) {
                        result = { error: "Nenhuma tarefa fornecida" };
                        break;
                    }
                    
                    const normalizedTasks = taskArray.map((t, i) => ({
                        id: t.id || `task_${i + 1}`,
                        instruction: t.instruction || t.task || t.prompt || String(t),
                        context: t.context || t.data || '',
                        output_format: t.output_format || t.format || ''
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

// Endpoint de chat com suporte a ferramentas Swarm
app.post('/api/chat/tools', auth, async (req, res) => {
    const { chatId, messages, model, userSystemPrompt, enableSwarm = true, provider } = req.body;
    
    // Se usar GPT4Free (sem suporte a ferramentas, redireciona para chat simples)
    if (provider === 'g4f') {
        // G4F não suporta function calling, faz chat simples
        const globalSystemPromptConfig = await GlobalConfig.findOne({ key: 'GLOBAL_SYSTEM_PROMPT' });
        const globalSystemPrompt = globalSystemPromptConfig?.value || '';
        
        const systemContent = [];
        if (globalSystemPrompt) systemContent.push(globalSystemPrompt);
        systemContent.push('Você é um assistente de IA avançado. Nota: As ferramentas avançadas (Swarm, bash, web) não estão disponíveis no modo GPT4Free.');
        if (userSystemPrompt) systemContent.push(userSystemPrompt);
        if (req.user.bio) systemContent.push(`Informações sobre o usuário: ${req.user.bio}`);
        
        const msgs = systemContent.length > 0 
            ? [{ role: "system", content: systemContent.join('\n\n') }, ...messages]
            : [...messages];
        
        try {
            const msg = await callG4F(model, msgs);
            res.json({ content: msg.content, provider: 'g4f' });
            
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

### 🔄 DELEGAÇÃO (Swarm)
- **swarm_delegate**: Delega tarefas para agentes paralelos. Use para múltiplas tarefas independentes.

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

### QUANDO USAR CADA FERRAMENTA:
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

    // Obtém system prompt global (prioridade máxima, invisível ao usuário)
    const globalSystemPromptConfig = await GlobalConfig.findOne({ key: 'GLOBAL_SYSTEM_PROMPT' });
    const globalSystemPrompt = globalSystemPromptConfig?.value || '';
    
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
            const toolResults = await processToolCalls(assistantMessage.tool_calls, apiKey, model, req.user._id);
            
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
        const defaultModelConfig = await GlobalConfig.findOne({ key: 'DEFAULT_MODEL' });
        const globalSystemPromptConfig = await GlobalConfig.findOne({ key: 'GLOBAL_SYSTEM_PROMPT' });
        res.json({
            hasGlobalApiKey: !!apiKeyConfig?.value,
            globalApiKeyPreview: apiKeyConfig?.value ? '****' + apiKeyConfig.value.slice(-4) : null,
            defaultModel: defaultModelConfig?.value || 'google/gemini-2.0-flash-exp:free',
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
        res.json({
            defaultModel: defaultModelConfig?.value || 'google/gemini-2.0-flash-exp:free'
        });
    } catch (err) {
        console.error('Erro ao obter modelo padrão:', err);
        res.json({ defaultModel: 'google/gemini-2.0-flash-exp:free' });
    }
});

app.post('/api/admin/config/apikey', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { apiKey } = req.body;
        
        await GlobalConfig.findOneAndUpdate(
            { key: 'OPENROUTER_API_KEY' },
            { key: 'OPENROUTER_API_KEY', value: apiKey || '' },
            { upsert: true, new: true }
        );
        
        res.json({ 
            success: true, 
            hasGlobalApiKey: !!apiKey,
            globalApiKeyPreview: apiKey ? '****' + apiKey.slice(-4) : null
        });
    } catch (err) {
        console.error('Erro ao salvar API key:', err);
        res.status(500).json({ error: 'Erro ao salvar API key: ' + err.message });
    }
});

// Salvar modelo padrão
app.post('/api/admin/config/default-model', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { model } = req.body;
        
        if (!model) {
            return res.status(400).json({ error: 'Modelo é obrigatório' });
        }
        
        await GlobalConfig.findOneAndUpdate(
            { key: 'DEFAULT_MODEL' },
            { key: 'DEFAULT_MODEL', value: model },
            { upsert: true, new: true }
        );
        
        res.json({ 
            success: true, 
            defaultModel: model
        });
    } catch (err) {
        console.error('Erro ao salvar modelo padrão:', err);
        res.status(500).json({ error: 'Erro ao salvar modelo: ' + err.message });
    }
});

// Salvar system prompt global (invisível aos usuários)
app.post('/api/admin/config/system-prompt', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const { systemPrompt } = req.body;
        
        await GlobalConfig.findOneAndUpdate(
            { key: 'GLOBAL_SYSTEM_PROMPT' },
            { key: 'GLOBAL_SYSTEM_PROMPT', value: systemPrompt || '' },
            { upsert: true, new: true }
        );
        
        res.json({ 
            success: true, 
            globalSystemPrompt: systemPrompt || ''
        });
    } catch (err) {
        console.error('Erro ao salvar system prompt global:', err);
        res.status(500).json({ error: 'Erro ao salvar system prompt: ' + err.message });
    }
});

// ============ ESTATÍSTICAS ADMIN ============

app.get('/api/admin/stats', auth, adminOnly, async (req, res) => {
    try {
        await connectDB();
        const totalUsers = await User.countDocuments();
        const totalChats = await Chat.countDocuments();
        const totalRequests = await User.aggregate([
            { $group: { _id: null, total: { $sum: '$usage.requests' } } }
        ]);
        
        res.json({
            totalUsers,
            totalChats,
            totalRequests: totalRequests[0]?.total || 0
        });
    } catch (err) {
        console.error('Erro ao carregar stats:', err);
        res.status(500).json({ error: 'Erro ao carregar estatísticas: ' + err.message });
    }
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
