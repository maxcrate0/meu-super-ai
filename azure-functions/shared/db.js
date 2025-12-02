// Módulo compartilhado entre as Functions
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// ============ CACHE EM MEMÓRIA ============
class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
    }
    
    set(key, value, ttlSeconds = 300) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }
        
        this.cache.set(key, {
            value,
            createdAt: Date.now(),
            ttl: ttlSeconds * 1000
        });
        
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
}

const cache = new MemoryCache();

// ============ MONGODB CONNECTION ============
let isConnected = false;

const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState >= 1) {
        return;
    }
    
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 1,
            retryWrites: false
        });
        isConnected = true;
        console.log('MongoDB conectado (Functions)');
    } catch (err) {
        console.error('Erro MongoDB:', err.message);
        throw err;
    }
};

// ============ USER SCHEMA ============
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    personal_api_key: String,
    displayName: String,
    bio: String,
    theme: { type: String, default: 'dark' },
    usage: {
        requests: { type: Number, default: 0 },
        tokens: { type: Number, default: 0 }
    }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

// ============ GLOBAL CONFIG SCHEMA ============
const globalConfigSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
    description: String
}, { timestamps: true });

const GlobalConfig = mongoose.models.GlobalConfig || mongoose.model('GlobalConfig', globalConfigSchema);

// ============ CHAT SCHEMA ============
const chatSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'Novo Chat' },
    model: { type: String, default: 'google/gemini-2.0-flash-exp:free' },
    messages: { type: Array, default: [] },
    userSystemPrompt: String
}, { timestamps: true });

const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);

// ============ AUTH HELPER ============
const verifyToken = async (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Token não fornecido');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    await connectDB();
    
    const cacheKey = `user:${decoded.id}`;
    let user = cache.get(cacheKey);
    
    if (!user) {
        user = await User.findById(decoded.id).lean();
        if (user) {
            cache.set(cacheKey, user, 300);
        }
    }
    
    if (!user) {
        throw new Error('Usuário não encontrado');
    }
    
    user._id = decoded.id;
    return user;
};

// ============ API KEY HELPER ============
const getApiKey = async (user) => {
    if (user.personal_api_key) return user.personal_api_key;
    
    const cacheKey = 'config:OPENROUTER_API_KEY';
    let apiKey = cache.get(cacheKey);
    
    if (apiKey === null) {
        await connectDB();
        const globalKey = await GlobalConfig.findOne({ key: 'OPENROUTER_API_KEY' }).lean();
        apiKey = globalKey?.value || process.env.GLOBAL_API_KEY || '';
        cache.set(cacheKey, apiKey, 600);
    }
    
    return apiKey;
};

// ============ SYSTEM PROMPT HELPER ============
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

// ============ GROQ KEY HELPER ============
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

module.exports = {
    cache,
    connectDB,
    User,
    GlobalConfig,
    Chat,
    verifyToken,
    getApiKey,
    getGlobalSystemPrompt,
    getGroqApiKey
};
