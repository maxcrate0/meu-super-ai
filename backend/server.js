require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai');
const axios = require('axios');
const compression = require('compression');
const User = require('./models/User');
const Chat = require('./models/Chat');
const CustomTool = require('./models/CustomTool');
const GlobalConfig = require('./models/GlobalConfig');

const app = express();

// Middlewares
app.use(compression());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] }));
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meu-super-ai';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

// Cache para modelos (atualiza a cada 5 minutos)
let modelsCache = { data: [], lastFetch: 0 };
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

// ============ CHATS ============

app.get('/api/chats', auth, async (req, res) => {
    await connectDB();
    const chats = await Chat.find({ userId: req.user._id })
        .sort({ updatedAt: -1 })
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

app.post('/api/chat', auth, async (req, res) => {
    const { chatId, messages, model, userSystemPrompt } = req.body;
    const apiKey = await getApiKey(req.user);
    
    if (!apiKey) {
        return res.status(400).json({ error: 'Nenhuma API Key configurada. Configure sua chave pessoal ou peça ao admin.' });
    }

    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
            "HTTP-Referer": "https://meu-super-ai.vercel.app",
            "X-Title": "Meu Super AI"
        }
    });

    // Monta mensagens com system prompt
    const systemContent = [];
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

// ============ MODO SWARM ============

app.post('/api/swarm', auth, async (req, res) => {
    const { task, model } = req.body;
    const apiKey = await getApiKey(req.user);
    
    if (!apiKey) {
        return res.status(400).json({ error: 'Nenhuma API Key configurada.' });
    }

    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
            "HTTP-Referer": "https://meu-super-ai.vercel.app",
            "X-Title": "Meu Super AI - Swarm"
        }
    });

    const swarmPrompt = `Você é um sistema de IA avançado operando em modo SWARM. 
Sua tarefa é analisar e resolver problemas de forma estruturada e colaborativa.
Divida problemas complexos em subtarefas, analise cada uma e sintetize uma resposta completa.
Seja detalhado, organizado e forneça soluções práticas.`;

    try {
        const resp = await openai.chat.completions.create({
            model: model || "google/gemini-2.0-flash-exp:free",
            messages: [
                { role: "system", content: swarmPrompt },
                { role: "user", content: task }
            ]
        });
        
        User.findByIdAndUpdate(req.user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
        res.json(resp.choices[0].message);
    } catch (e) {
        res.status(500).json({ error: e.message });
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

// ============ ADMIN - CONFIGURAÇÕES GLOBAIS ============

app.get('/api/admin/config', auth, adminOnly, async (req, res) => {
    await connectDB();
    const apiKeyConfig = await GlobalConfig.findOne({ key: 'OPENROUTER_API_KEY' });
    res.json({
        hasGlobalApiKey: !!apiKeyConfig?.value,
        globalApiKeyPreview: apiKeyConfig?.value ? '****' + apiKeyConfig.value.slice(-4) : null
    });
});

app.post('/api/admin/config/apikey', auth, adminOnly, async (req, res) => {
    await connectDB();
    const { apiKey } = req.body;
    
    await GlobalConfig.findOneAndUpdate(
        { key: 'OPENROUTER_API_KEY' },
        { key: 'OPENROUTER_API_KEY', value: apiKey || '' },
        { upsert: true }
    );
    
    res.json({ 
        success: true, 
        hasGlobalApiKey: !!apiKey,
        globalApiKeyPreview: apiKey ? '****' + apiKey.slice(-4) : null
    });
});

// ============ ESTATÍSTICAS ADMIN ============

app.get('/api/admin/stats', auth, adminOnly, async (req, res) => {
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
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
