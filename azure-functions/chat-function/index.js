const OpenAI = require('openai');
const axios = require('axios');
const { verifyToken, getApiKey, getGlobalSystemPrompt, getGroqApiKey, User, Chat, connectDB } = require('../shared/db');

// ============ G4F PROVIDERS ============
const callG4F = async (model, messages) => {
    let provider = null;
    
    // Detecta provider pelo modelo
    if (model.startsWith('@cf/') || model.startsWith('@hf/')) {
        provider = 'cloudflare';
    } else if (model.includes('meta-llama') || model.includes('Qwen') || model.includes('deepseek-ai')) {
        provider = 'deepinfra';
    }
    
    const providersToTry = [];
    
    // Cloudflare Worker
    if (provider === 'cloudflare') {
        providersToTry.push({
            name: 'cloudflare',
            url: 'https://workers.cloudflare.com/ai/run',
            transform: (m, msgs) => ({
                model: m,
                messages: msgs
            })
        });
    }
    
    // DeepInfra
    if (provider === 'deepinfra' || !provider) {
        providersToTry.push({
            name: 'deepinfra',
            url: 'https://api.deepinfra.com/v1/openai/chat/completions',
            transform: (m, msgs) => ({
                model: m,
                messages: msgs
            })
        });
    }
    
    // Pollinations (sempre como fallback)
    providersToTry.push({
        name: 'pollinations',
        url: 'https://text.pollinations.ai/openai',
        transform: (m, msgs) => ({
            model: m || 'openai',
            messages: msgs
        })
    });
    
    for (const p of providersToTry) {
        try {
            console.log(`Tentando G4F com ${p.name}...`);
            const response = await axios.post(p.url, p.transform(model, messages), {
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000
            });
            
            if (response.data?.choices?.[0]?.message) {
                return response.data.choices[0].message;
            }
            if (response.data?.response) {
                return { role: 'assistant', content: response.data.response };
            }
        } catch (e) {
            console.log(`${p.name} falhou:`, e.message);
            continue;
        }
    }
    
    throw new Error('Todos os provedores G4F falharam');
};

module.exports = async function (context, req) {
    // CORS headers
    context.res = {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    };
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        context.res.body = '';
        return;
    }
    
    try {
        // Autenticação
        const user = await verifyToken(req.headers.authorization);
        
        const { chatId, messages, model, userSystemPrompt, provider } = req.body;
        
        // GPT4Free
        if (provider === 'g4f') {
            const globalSystemPrompt = await getGlobalSystemPrompt();
            
            const systemContent = [];
            if (globalSystemPrompt) systemContent.push(globalSystemPrompt);
            if (userSystemPrompt) systemContent.push(userSystemPrompt);
            if (user.bio) systemContent.push(`Informações sobre o usuário: ${user.bio}`);
            
            const msgs = systemContent.length > 0 
                ? [{ role: "system", content: systemContent.join('\n\n') }, ...messages]
                : [...messages];
            
            const msg = await callG4F(model, msgs);
            
            // Atualiza uso em background
            User.findByIdAndUpdate(user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
            
            // Salva histórico
            if (chatId) {
                Chat.findOne({ _id: chatId, userId: user._id }).then(async (chat) => {
                    if (chat) {
                        chat.messages.push(messages[messages.length - 1]);
                        chat.messages.push(msg);
                        chat.model = model;
                        chat.updatedAt = Date.now();
                        await chat.save();
                    }
                }).catch(err => console.error('Erro ao salvar histórico:', err));
            }
            
            context.res.status = 200;
            context.res.body = msg;
            return;
        }
        
        // OpenRouter (padrão)
        const apiKey = await getApiKey(user);
        
        if (!apiKey) {
            context.res.status = 400;
            context.res.body = { error: 'Nenhuma API Key configurada.' };
            return;
        }
        
        const openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey,
            defaultHeaders: {
                "HTTP-Referer": "https://meu-super-ai.vercel.app",
                "X-Title": "jgspAI"
            }
        });
        
        const globalSystemPrompt = await getGlobalSystemPrompt();
        
        const systemContent = [];
        if (globalSystemPrompt) systemContent.push(globalSystemPrompt);
        if (userSystemPrompt) systemContent.push(userSystemPrompt);
        if (user.bio) systemContent.push(`Informações sobre o usuário: ${user.bio}`);
        
        const msgs = systemContent.length > 0 
            ? [{ role: "system", content: systemContent.join('\n\n') }, ...messages]
            : [...messages];
        
        const resp = await openai.chat.completions.create({
            model: model || "google/gemini-2.0-flash-exp:free",
            messages: msgs
        });
        
        const msg = resp.choices[0].message;
        
        // Atualiza uso
        User.findByIdAndUpdate(user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
        
        // Salva histórico
        if (chatId) {
            Chat.findOne({ _id: chatId, userId: user._id }).then(async (chat) => {
                if (chat) {
                    chat.messages.push(messages[messages.length - 1]);
                    chat.messages.push(msg);
                    chat.model = model;
                    chat.updatedAt = Date.now();
                    await chat.save();
                }
            }).catch(err => console.error('Erro ao salvar histórico:', err));
        }
        
        context.res.status = 200;
        context.res.body = msg;
        
    } catch (e) {
        console.error('Erro na Function chat:', e);
        context.res.status = e.message.includes('Token') || e.message.includes('Usuário') ? 401 : 500;
        context.res.body = { error: e.message };
    }
};
