const OpenAI = require('openai');
const axios = require('axios');
const { verifyToken, getApiKey, getGlobalSystemPrompt, User, Chat, connectDB, GlobalConfig } = require('../shared/db');

// ============ CUSTOM TOOL SCHEMA ============
const mongoose = require('mongoose');

const customToolSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    code: { type: String, required: true },
    parameters: { type: Object, default: {} },
    isActive: { type: Boolean, default: true },
    executionCount: { type: Number, default: 0 },
    lastExecuted: Date
}, { timestamps: true });

customToolSchema.index({ userId: 1, name: 1 }, { unique: true });
const CustomTool = mongoose.models.CustomTool || mongoose.model('CustomTool', customToolSchema);

// ============ TOOLS DEFINITION ============
const getAvailableTools = (userId) => [
    {
        type: "function",
        function: {
            name: "swarm_delegate",
            description: `Executa múltiplas tarefas em PARALELO usando agentes IA secundários.`,
            parameters: {
                type: "object",
                properties: {
                    task1: { type: "string", description: "Primeira tarefa" },
                    task2: { type: "string", description: "Segunda tarefa (opcional)" },
                    task3: { type: "string", description: "Terceira tarefa (opcional)" },
                    task4: { type: "string", description: "Quarta tarefa (opcional)" },
                    task5: { type: "string", description: "Quinta tarefa (opcional)" }
                },
                required: ["task1"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_image",
            description: "Gera uma imagem com base em uma descrição textual.",
            parameters: {
                type: "object",
                properties: {
                    prompt: { type: "string", description: "Descrição detalhada da imagem" }
                },
                required: ["prompt"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Pesquisa na web e retorna resultados.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Termo de busca" },
                    num_results: { type: "number", description: "Número de resultados (max 10)" }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "web_scrape",
            description: "Extrai conteúdo de uma página web.",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL da página" },
                    selector: { type: "string", description: "Seletor CSS (opcional)" }
                },
                required: ["url"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "http_request",
            description: "Faz requisição HTTP customizada.",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL" },
                    method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
                    headers: { type: "object" },
                    body: { type: "object" }
                },
                required: ["url"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_custom_tool",
            description: "Cria uma ferramenta personalizada reutilizável.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Nome da ferramenta" },
                    description: { type: "string", description: "Descrição" },
                    code: { type: "string", description: "Código JavaScript" },
                    parameters: { type: "object" }
                },
                required: ["name", "description", "code"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "execute_custom_tool",
            description: "Executa uma ferramenta personalizada.",
            parameters: {
                type: "object",
                properties: {
                    tool_name: { type: "string", description: "Nome da ferramenta" },
                    params: { type: "object", description: "Parâmetros" }
                },
                required: ["tool_name"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "list_custom_tools",
            description: "Lista ferramentas personalizadas do usuário.",
            parameters: { type: "object", properties: {} }
        }
    }
];

// ============ SWARM AGENT ============
const executeSwarmAgent = async (apiKey, task, model) => {
    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
            "HTTP-Referer": "https://meu-super-ai.vercel.app",
            "X-Title": "jgspAI - Swarm"
        }
    });

    try {
        const resp = await openai.chat.completions.create({
            model: model || "google/gemini-2.0-flash-exp:free",
            messages: [
                { role: "system", content: "Você é um agente Swarm. Execute a tarefa de forma direta e eficiente." },
                { role: "user", content: task.instruction }
            ],
            max_tokens: 4000
        });
        
        return { id: task.id, success: true, result: resp.choices[0].message.content };
    } catch (e) {
        return { id: task.id, success: false, error: e.message };
    }
};

// ============ PROCESS TOOL CALLS ============
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
                content: JSON.stringify({ error: "Erro ao parsear argumentos" })
            });
            continue;
        }

        try {
            let result;
            
            switch (funcName) {
                case 'swarm_delegate': {
                    let taskArray = [];
                    for (let i = 1; i <= 5; i++) {
                        if (args[`task${i}`]) {
                            taskArray.push({ id: `task${i}`, instruction: args[`task${i}`] });
                        }
                    }
                    
                    if (taskArray.length === 0) {
                        result = { error: "Nenhuma tarefa fornecida" };
                        break;
                    }
                    
                    const taskPromises = taskArray.map(task => executeSwarmAgent(apiKey, task, model));
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
                        // Usa Pollinations AI (gratuito)
                        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(args.prompt)}?width=1024&height=1024&nologo=true`;
                        result = { 
                            success: true, 
                            image_url: imageUrl,
                            prompt: args.prompt
                        };
                    } catch (err) {
                        result = { error: `Erro ao gerar imagem: ${err.message}` };
                    }
                    break;
                }
                
                case 'web_search': {
                    try {
                        const query = encodeURIComponent(args.query);
                        const numResults = Math.min(args.num_results || 5, 10);
                        
                        // DuckDuckGo Instant Answer API
                        const response = await axios.get(`https://api.duckduckgo.com/?q=${query}&format=json&no_html=1`, {
                            timeout: 10000
                        });
                        
                        const searchResults = [];
                        
                        if (response.data.AbstractText) {
                            searchResults.push({
                                title: response.data.Heading || 'Resultado',
                                snippet: response.data.AbstractText,
                                link: response.data.AbstractURL
                            });
                        }
                        
                        if (response.data.RelatedTopics) {
                            response.data.RelatedTopics.slice(0, numResults - 1).forEach(topic => {
                                if (topic.Text) {
                                    searchResults.push({
                                        title: topic.Text.split(' - ')[0] || 'Relacionado',
                                        snippet: topic.Text,
                                        link: topic.FirstURL
                                    });
                                }
                            });
                        }
                        
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
                            headers: { 'User-Agent': 'Mozilla/5.0' },
                            timeout: 15000,
                            maxContentLength: 2 * 1024 * 1024
                        });
                        
                        // Extrai texto simples (sem cheerio nas Functions)
                        let content = response.data;
                        if (typeof content === 'string') {
                            // Remove tags HTML
                            content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
                            content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
                            content = content.replace(/<[^>]+>/g, ' ');
                            content = content.replace(/\s+/g, ' ').trim().substring(0, 30000);
                        }
                        
                        result = { 
                            success: true,
                            url: args.url,
                            content
                        };
                    } catch (scrapeErr) {
                        result = { error: `Erro ao acessar página: ${scrapeErr.message}` };
                    }
                    break;
                }
                
                case 'http_request': {
                    try {
                        const config = {
                            url: args.url,
                            method: args.method || 'GET',
                            headers: args.headers || {},
                            timeout: 30000
                        };
                        
                        if (['POST', 'PUT', 'PATCH'].includes(config.method) && args.body) {
                            config.data = args.body;
                        }
                        
                        const response = await axios(config);
                        
                        result = {
                            success: true,
                            status: response.status,
                            data: typeof response.data === 'string' ? 
                                response.data.substring(0, 30000) : 
                                JSON.stringify(response.data).substring(0, 30000)
                        };
                    } catch (httpErr) {
                        result = { 
                            error: httpErr.message,
                            status: httpErr.response?.status
                        };
                    }
                    break;
                }
                
                case 'create_custom_tool': {
                    await connectDB();
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
                        message: `Ferramenta "${toolName}" criada!`,
                        tool: { name: newTool.name, description: newTool.description }
                    };
                    break;
                }
                
                case 'execute_custom_tool': {
                    await connectDB();
                    const tool = await CustomTool.findOne({ userId, name: args.tool_name });
                    if (!tool) {
                        result = { error: `Ferramenta "${args.tool_name}" não encontrada` };
                        break;
                    }
                    
                    try {
                        const fn = new Function('params', tool.code);
                        const execResult = fn(args.params || {});
                        
                        await CustomTool.findByIdAndUpdate(tool._id, { 
                            $inc: { executionCount: 1 },
                            lastExecuted: new Date()
                        });
                        
                        result = { success: true, result: execResult };
                    } catch (execErr) {
                        result = { error: `Erro ao executar: ${execErr.message}` };
                    }
                    break;
                }
                
                case 'list_custom_tools': {
                    await connectDB();
                    const tools = await CustomTool.find({ userId, isActive: true })
                        .select('name description executionCount');
                    result = { 
                        tools: tools.map(t => ({
                            name: t.name,
                            description: t.description,
                            uses: t.executionCount
                        })),
                        count: tools.length
                    };
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
                content: JSON.stringify({ error: `Erro: ${err.message}` })
            });
        }
    }
    
    return results;
};

// ============ MAIN FUNCTION ============
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
        
        const { chatId, messages, model, models, userSystemPrompt, enableSwarm = true } = req.body;
        
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
        
        const toolsInstructions = enableSwarm ? `
Você tem acesso a ferramentas poderosas:
- swarm_delegate: Executa múltiplas tarefas em paralelo (use task1, task2, task3...)
- generate_image: Gera imagens
- web_search: Pesquisa na web
- web_scrape: Extrai conteúdo de sites
- http_request: Faz requisições HTTP
- create_custom_tool: Cria ferramentas personalizadas
- execute_custom_tool: Executa ferramentas criadas
- list_custom_tools: Lista suas ferramentas
` : '';
        
        const systemContent = [];
        if (globalSystemPrompt) systemContent.push(globalSystemPrompt);
        systemContent.push(`Você é um assistente de IA avançado.${toolsInstructions}`);
        if (userSystemPrompt) systemContent.push(userSystemPrompt);
        if (user.bio) systemContent.push(`Sobre o usuário: ${user.bio}`);
        
        const msgs = [{ role: "system", content: systemContent.join('\n\n') }, ...messages];
        const tools = enableSwarm ? getAvailableTools(user._id) : undefined;

        let resp = await openai.chat.completions.create({
            model: model || "google/gemini-2.0-flash-exp:free",
            messages: msgs,
            tools,
            tool_choice: enableSwarm ? "auto" : undefined
        });

        let assistantMessage = resp.choices[0].message;
        
        // Processa tool calls
        let iterations = 0;
        const maxIterations = 8;
        
        while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
            iterations++;
            
            msgs.push(assistantMessage);
            const toolResults = await processToolCalls(assistantMessage.tool_calls, apiKey, model, user._id, models);
            msgs.push(...toolResults);
            
            User.findByIdAndUpdate(user._id, { 
                $inc: { 'usage.requests': toolResults.length } 
            }).catch(() => {});
            
            resp = await openai.chat.completions.create({
                model: model || "google/gemini-2.0-flash-exp:free",
                messages: msgs,
                tools,
                tool_choice: "auto"
            });
            
            assistantMessage = resp.choices[0].message;
        }

        const finalResponse = {
            role: 'assistant',
            content: assistantMessage.content || '',
            swarm_used: iterations > 0,
            swarm_iterations: iterations
        };

        context.res.status = 200;
        context.res.body = finalResponse;

        // Background tasks
        User.findByIdAndUpdate(user._id, { $inc: { 'usage.requests': 1 } }).catch(() => {});
        
        if (chatId) {
            Chat.findOne({ _id: chatId, userId: user._id }).then(async (chat) => {
                if (chat) {
                    chat.messages.push(messages[messages.length - 1]);
                    chat.messages.push({ role: 'assistant', content: finalResponse.content });
                    chat.model = model;
                    chat.updatedAt = Date.now();
                    await chat.save();
                }
            }).catch(() => {});
        }
        
    } catch (e) {
        console.error('Erro na Function tools:', e);
        context.res.status = e.message.includes('Token') || e.message.includes('Usuário') ? 401 : 500;
        context.res.body = { error: e.message };
    }
};
