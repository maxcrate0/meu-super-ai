const { app } = require('@azure/functions');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const axios = require('axios');

// ============ MONGODB ============
let isConnected = false;
let User, Chat, GlobalConfig;

const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState >= 1) return;
    
    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });
    isConnected = true;
    
    if (!mongoose.models.User) {
        User = mongoose.model('User', new mongoose.Schema({
            username: String, password: String, role: { type: String, default: 'user' },
            personal_api_key: String, displayName: String, bio: String,
            usage: { requests: { type: Number, default: 0 } }
        }));
    } else User = mongoose.models.User;
    
    if (!mongoose.models.Chat) {
        Chat = mongoose.model('Chat', new mongoose.Schema({
            userId: mongoose.Schema.Types.ObjectId, title: String, model: String,
            messages: Array, userSystemPrompt: String
        }, { timestamps: true }));
    } else Chat = mongoose.models.Chat;
    
    if (!mongoose.models.GlobalConfig) {
        GlobalConfig = mongoose.model('GlobalConfig', new mongoose.Schema({
            key: String, value: mongoose.Schema.Types.Mixed
        }));
    } else GlobalConfig = mongoose.models.GlobalConfig;
};

// ============ AUTH ============
const verifyToken = async (authHeader) => {
    if (!authHeader?.startsWith('Bearer ')) throw new Error('Token não fornecido');
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET);
    await connectDB();
    const user = await User.findById(decoded.id).lean();
    if (!user) throw new Error('Usuário não encontrado');
    user._id = decoded.id;
    return user;
};

const getApiKey = async (user) => {
    if (user.personal_api_key) return user.personal_api_key;
    const cfg = await GlobalConfig.findOne({ key: 'OPENROUTER_API_KEY' }).lean();
    return cfg?.value || process.env.GLOBAL_API_KEY || '';
};

const getGlobalSystemPrompt = async () => {
    const cfg = await GlobalConfig.findOne({ key: 'GLOBAL_SYSTEM_PROMPT' }).lean();
    return cfg?.value || '';
};

// ============ G4F ============
const callG4F = async (model, messages) => {
    const response = await axios.post('https://text.pollinations.ai/openai', 
        { model: model || 'openai', messages },
        { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
    );
    if (response.data?.choices?.[0]?.message) return response.data.choices[0].message;
    throw new Error('G4F falhou');
};

// ============ HTTP FUNCTION ============
app.http('chat', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'chat',
    handler: async (request, context) => {
        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        };
        
        // CORS preflight
        if (request.method === 'OPTIONS') {
            return { status: 200, headers, body: '' };
        }
        
        // Health check
        if (request.method === 'GET') {
            return { status: 200, headers, body: JSON.stringify({ ok: true, service: 'chat' }) };
        }
        
        try {
            const authHeader = request.headers.get('authorization');
            const user = await verifyToken(authHeader);
            
            const body = await request.json();
            const { messages, model, userSystemPrompt, provider } = body;
            
            if (!messages || !Array.isArray(messages)) {
                return { status: 400, headers, body: JSON.stringify({ error: 'messages é obrigatório' }) };
            }
            
            // Build messages
            const globalPrompt = await getGlobalSystemPrompt();
            const systemContent = [globalPrompt, userSystemPrompt, user.bio ? `Info: ${user.bio}` : ''].filter(Boolean);
            const msgs = systemContent.length > 0 
                ? [{ role: "system", content: systemContent.join('\n\n') }, ...messages]
                : messages;
            
            let msg;
            if (provider === 'g4f') {
                msg = await callG4F(model, msgs);
            } else {
                const apiKey = await getApiKey(user);
                if (!apiKey) {
                    return { status: 400, headers, body: JSON.stringify({ error: 'API Key não configurada' }) };
                }
                
                const openai = new OpenAI({
                    baseURL: "https://openrouter.ai/api/v1",
                    apiKey,
                    defaultHeaders: { "HTTP-Referer": "https://meu-super-ai.vercel.app", "X-Title": "jgspAI" }
                });
                
                const resp = await openai.chat.completions.create({
                    model: model || "google/gemini-2.0-flash-exp:free",
                    messages: msgs
                });
                msg = resp.choices[0].message;
            }
            
            // Update usage
            User.findByIdAndUpdate(user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
            
            return { status: 200, headers, body: JSON.stringify(msg) };
            
        } catch (e) {
            context.log('Error:', e.message);
            const status = e.message.includes('Token') || e.message.includes('Usuário') ? 401 : 500;
            return { status, headers, body: JSON.stringify({ error: e.message }) };
        }
    }
});
