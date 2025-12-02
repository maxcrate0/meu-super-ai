const OpenAI = require('openai');
const { verifyToken, getApiKey, User, connectDB } = require('../shared/db');

// ============ SWARM AGENT ============
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
- Retorne APENAS o resultado, sem explicações desnecessárias`;

    try {
        const resp = await openai.chat.completions.create({
            model: model || "google/gemini-2.0-flash-exp:free",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: task }
            ],
            max_tokens: 4000
        });
        
        return {
            success: true,
            result: resp.choices[0].message.content
        };
    } catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
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
    
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        context.res.body = '';
        return;
    }
    
    try {
        const user = await verifyToken(req.headers.authorization);
        
        const { task, model } = req.body;
        
        if (!task) {
            context.res.status = 400;
            context.res.body = { error: 'Task é obrigatório' };
            return;
        }
        
        const apiKey = await getApiKey(user);
        
        if (!apiKey) {
            context.res.status = 400;
            context.res.body = { error: 'Nenhuma API Key configurada.' };
            return;
        }

        const result = await executeSwarmAgent(apiKey, task, model);
        
        // Incrementa uso
        User.findByIdAndUpdate(user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
        
        if (result.success) {
            context.res.status = 200;
            context.res.body = { role: 'assistant', content: result.result };
        } else {
            context.res.status = 500;
            context.res.body = { error: result.error };
        }
        
    } catch (e) {
        console.error('Erro na Function swarm:', e);
        context.res.status = e.message.includes('Token') || e.message.includes('Usuário') ? 401 : 500;
        context.res.body = { error: e.message };
    }
};
