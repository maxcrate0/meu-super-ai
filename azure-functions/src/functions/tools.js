const { app } = require('@azure/functions');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const axios = require('axios');

// ============ MONGODB (reused) ============
let isConnected = false;
let User, Chat, GlobalConfig, CustomTool;

const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState >= 1) return;
    
    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });
    isConnected = true;
    
    User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
        username: String, password: String, role: { type: String, default: 'user' },
        personal_api_key: String, displayName: String, bio: String,
        usage: { requests: { type: Number, default: 0 } }
    }));
    
    Chat = mongoose.models.Chat || mongoose.model('Chat', new mongoose.Schema({
        userId: mongoose.Schema.Types.ObjectId, title: String, model: String,
        messages: Array, userSystemPrompt: String
    }, { timestamps: true }));
    
    GlobalConfig = mongoose.models.GlobalConfig || mongoose.model('GlobalConfig', new mongoose.Schema({
        key: String, value: mongoose.Schema.Types.Mixed
    }));
    
    CustomTool = mongoose.models.CustomTool || mongoose.model('CustomTool', new mongoose.Schema({
        name: String, description: String, endpoint: String, method: String,
        headers: Object, bodyTemplate: String, responseMapping: String,
        parameters: Array, isActive: Boolean, createdBy: mongoose.Schema.Types.ObjectId
    }));
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

// ============ TOOLS ============
const SWARM_AGENTS = {
    researcher: { name: "Researcher", description: "Pesquisa web e análise de dados", model: "google/gemini-2.0-flash-exp:free" },
    coder: { name: "Coder", description: "Programação e código", model: "google/gemini-2.0-flash-exp:free" },
    writer: { name: "Writer", description: "Escrita criativa e redação", model: "google/gemini-2.0-flash-exp:free" },
    analyst: { name: "Analyst", description: "Análise de dados e lógica", model: "google/gemini-2.0-flash-exp:free" }
};

const builtInTools = [
    {
        type: "function",
        function: {
            name: "swarm_delegate",
            description: "Delegar tarefa para um agente especializado do Swarm",
            parameters: {
                type: "object",
                properties: {
                    agent: { type: "string", enum: Object.keys(SWARM_AGENTS), description: "Agente especializado" },
                    task: { type: "string", description: "Tarefa a ser executada" }
                },
                required: ["agent", "task"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Buscar informações na web",
            parameters: {
                type: "object",
                properties: { query: { type: "string", description: "Termo de busca" } },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_image",
            description: "Gerar imagem com IA",
            parameters: {
                type: "object",
                properties: { prompt: { type: "string", description: "Descrição da imagem" } },
                required: ["prompt"]
            }
        }
    }
];

// Tool Handlers
const handleSwarmDelegate = async (args, openai) => {
    const agent = SWARM_AGENTS[args.agent];
    if (!agent) return { error: "Agente não encontrado" };
    
    const response = await openai.chat.completions.create({
        model: agent.model,
        messages: [
            { role: "system", content: `Você é ${agent.name}, especialista em ${agent.description}. Responda de forma concisa.` },
            { role: "user", content: args.task }
        ]
    });
    return { agent: agent.name, response: response.choices[0].message.content };
};

const handleWebSearch = async (args) => {
    try {
        const resp = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1`, { timeout: 10000 });
        return { results: resp.data.AbstractText || resp.data.RelatedTopics?.slice(0, 3).map(t => t.Text).join('\n') || 'Sem resultados' };
    } catch (e) {
        return { error: e.message };
    }
};

const handleGenerateImage = async (args) => {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(args.prompt)}?width=1024&height=1024&nologo=true`;
    return { imageUrl: url, prompt: args.prompt };
};

const executeToolCall = async (toolCall, openai) => {
    const args = JSON.parse(toolCall.function.arguments);
    switch (toolCall.function.name) {
        case 'swarm_delegate': return await handleSwarmDelegate(args, openai);
        case 'web_search': return await handleWebSearch(args);
        case 'generate_image': return await handleGenerateImage(args);
        default: return { error: `Tool ${toolCall.function.name} não implementada` };
    }
};

// ============ HTTP FUNCTION ============
app.http('tools', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'chat/tools',
    handler: async (request, context) => {
        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        };
        
        if (request.method === 'OPTIONS') return { status: 200, headers, body: '' };
        if (request.method === 'GET') return { status: 200, headers, body: JSON.stringify({ ok: true, service: 'tools' }) };
        
        try {
            const user = await verifyToken(request.headers.get('authorization'));
            const body = await request.json();
            const { messages, model, userSystemPrompt } = body;
            
            if (!messages || !Array.isArray(messages)) {
                return { status: 400, headers, body: JSON.stringify({ error: 'messages é obrigatório' }) };
            }
            
            const apiKey = await getApiKey(user);
            if (!apiKey) return { status: 400, headers, body: JSON.stringify({ error: 'API Key não configurada' }) };
            
            const openai = new OpenAI({
                baseURL: "https://openrouter.ai/api/v1",
                apiKey,
                defaultHeaders: { "HTTP-Referer": "https://meu-super-ai.vercel.app", "X-Title": "jgspAI" }
            });
            
            // Build messages
            const globalPrompt = await getGlobalSystemPrompt();
            const systemContent = [globalPrompt, userSystemPrompt, user.bio ? `Info: ${user.bio}` : ''].filter(Boolean);
            const msgs = systemContent.length > 0 
                ? [{ role: "system", content: systemContent.join('\n\n') }, ...messages]
                : [...messages];
            
            // First call with tools
            let response = await openai.chat.completions.create({
                model: model || "google/gemini-2.0-flash-exp:free",
                messages: msgs,
                tools: builtInTools,
                tool_choice: "auto"
            });
            
            let msg = response.choices[0].message;
            const toolResults = [];
            
            // Process tool calls (max 5 iterations)
            for (let i = 0; i < 5 && msg.tool_calls?.length; i++) {
                for (const toolCall of msg.tool_calls) {
                    const result = await executeToolCall(toolCall, openai);
                    toolResults.push({ tool: toolCall.function.name, result });
                    msgs.push(msg);
                    msgs.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
                }
                
                response = await openai.chat.completions.create({
                    model: model || "google/gemini-2.0-flash-exp:free",
                    messages: msgs,
                    tools: builtInTools,
                    tool_choice: "auto"
                });
                msg = response.choices[0].message;
            }
            
            User.findByIdAndUpdate(user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
            
            return { 
                status: 200, 
                headers, 
                body: JSON.stringify({ ...msg, toolResults: toolResults.length ? toolResults : undefined }) 
            };
            
        } catch (e) {
            context.log('Error:', e.message);
            const status = e.message.includes('Token') || e.message.includes('Usuário') ? 401 : 500;
            return { status, headers, body: JSON.stringify({ error: e.message }) };
        }
    }
});
