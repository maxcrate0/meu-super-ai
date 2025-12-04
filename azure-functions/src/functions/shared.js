const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const axios = require('axios');

const baseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'google/gemini-2.0-flash-exp:free';
const REFERER = process.env.OPENROUTER_REFERER || 'https://meu-super-ai.vercel.app';
const TITLE = process.env.OPENROUTER_TITLE || 'jgspAI';

let isConnected = false;
const models = {};

const ensureModels = () => {
    models.User = models.User || mongoose.model('User', new mongoose.Schema({
        username: String,
        password: String,
        role: { type: String, default: 'user' },
        personal_api_key: String,
        displayName: String,
        bio: String,
        usage: { requests: { type: Number, default: 0 } }
    }));

    models.Chat = models.Chat || mongoose.model('Chat', new mongoose.Schema({
        userId: mongoose.Schema.Types.ObjectId,
        title: String,
        model: String,
        messages: Array,
        userSystemPrompt: String
    }, { timestamps: true }));

    models.GlobalConfig = models.GlobalConfig || mongoose.model('GlobalConfig', new mongoose.Schema({
        key: String,
        value: mongoose.Schema.Types.Mixed
    }));

    models.CustomTool = models.CustomTool || mongoose.model('CustomTool', new mongoose.Schema({
        name: String,
        description: String,
        endpoint: String,
        method: String,
        headers: Object,
        bodyTemplate: String,
        responseMapping: String,
        parameters: Array,
        isActive: Boolean,
        createdBy: mongoose.Schema.Types.ObjectId
    }));

    return models;
};

const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState >= 1) return ensureModels();

    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });
    isConnected = true;
    return ensureModels();
};

const verifyToken = async (authHeader) => {
    if (!authHeader?.startsWith('Bearer ')) throw new Error('Token não fornecido');
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET);
    const { User } = await connectDB();
    const user = await User.findById(decoded.id).lean();
    if (!user) throw new Error('Usuário não encontrado');
    user._id = decoded.id;
    return user;
};

const getApiKey = async (user) => {
    if (user.personal_api_key) return user.personal_api_key;
    const { GlobalConfig } = await connectDB();
    const cfg = await GlobalConfig.findOne({ key: 'OPENROUTER_API_KEY' }).lean();
    return cfg?.value || process.env.GLOBAL_API_KEY || '';
};

const getGlobalSystemPrompt = async () => {
    const { GlobalConfig } = await connectDB();
    const cfg = await GlobalConfig.findOne({ key: 'GLOBAL_SYSTEM_PROMPT' }).lean();
    return cfg?.value || '';
};

const buildMessages = (messages, globalPrompt, userSystemPrompt, bio) => {
    const systemContent = [globalPrompt, userSystemPrompt, bio ? `Info: ${bio}` : ''].filter(Boolean);
    if (systemContent.length === 0) return messages;
    return [{ role: 'system', content: systemContent.join('\n\n') }, ...messages];
};

const incrementUsage = (userId) => {
    const { User } = models;
    if (!User || !userId) return;
    User.findByIdAndUpdate(userId, { $inc: { 'usage.requests': 1 } }).catch(() => {});
};

const getOpenAIClient = (apiKey) => new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: { 'HTTP-Referer': REFERER, 'X-Title': TITLE }
});

const jsonResponse = (status, body) => ({ status, headers: baseHeaders, body: JSON.stringify(body) });

const callG4F = async (model, messages) => {
    const response = await axios.post('https://text.pollinations.ai/openai',
        { model: model || 'openai', messages },
        { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
    );
    if (response.data?.choices?.[0]?.message) return response.data.choices[0].message;
    throw new Error('G4F falhou');
};

module.exports = {
    baseHeaders,
    DEFAULT_MODEL,
    connectDB,
    verifyToken,
    getApiKey,
    getGlobalSystemPrompt,
    buildMessages,
    incrementUsage,
    getOpenAIClient,
    jsonResponse,
    callG4F,
    models
};
