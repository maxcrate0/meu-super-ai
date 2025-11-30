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

// ============ SISTEMA SWARM AVANÇADO ============

// Definição das ferramentas disponíveis para a IA (incluindo swarm)
const getAvailableTools = () => [
    {
        type: "function",
        function: {
            name: "swarm_delegate",
            description: `Delega uma ou mais tarefas para agentes secundários (IAs auxiliares) que executam de forma independente e retornam apenas o resultado. 
Use esta ferramenta para:
- Executar múltiplas tarefas em PARALELO para maior eficiência
- Processar dados extensos sem ocupar sua janela de contexto
- Analisar, resumir ou transformar informações
- Executar cálculos ou processamentos complexos
- Pesquisar e sintetizar informações
Os agentes têm MEMÓRIA VOLÁTIL (não lembram de requisições anteriores), então inclua TODO o contexto necessário em cada tarefa.`,
            parameters: {
                type: "object",
                properties: {
                    tasks: {
                        type: "array",
                        description: "Lista de tarefas a serem executadas por agentes secundários em paralelo",
                        items: {
                            type: "object",
                            properties: {
                                id: {
                                    type: "string",
                                    description: "Identificador único da tarefa (ex: 'task_1', 'analise_dados')"
                                },
                                instruction: {
                                    type: "string",
                                    description: "Instrução clara e completa para o agente executar. Inclua TODO o contexto necessário pois o agente não tem memória de conversas anteriores."
                                },
                                context: {
                                    type: "string",
                                    description: "Dados ou contexto adicional que o agente precisa para executar a tarefa (opcional, mas recomendado)"
                                },
                                output_format: {
                                    type: "string",
                                    description: "Formato esperado da resposta (ex: 'json', 'lista', 'resumo', 'análise detalhada')"
                                }
                            },
                            required: ["id", "instruction"]
                        }
                    }
                },
                required: ["tasks"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "swarm_pipeline",
            description: `Executa uma ferramenta/ação e envia o resultado diretamente para um agente Swarm processar, retornando apenas o resultado final.
Use para economizar contexto quando você precisa:
- Obter dados de uma fonte e processá-los sem ver os dados brutos
- Encadear operações onde você só precisa do resultado final
- Fazer análises de dados extensos
O agente processador tem memória volátil e recebe apenas: sua instrução + resultado da ação.`,
            parameters: {
                type: "object",
                properties: {
                    action: {
                        type: "object",
                        description: "A ação a ser executada primeiro",
                        properties: {
                            type: {
                                type: "string",
                                enum: ["http_get", "http_post", "calculate", "generate_data"],
                                description: "Tipo da ação"
                            },
                            params: {
                                type: "object",
                                description: "Parâmetros da ação (url para http, expression para calculate, etc)"
                            }
                        },
                        required: ["type", "params"]
                    },
                    processing_instruction: {
                        type: "string",
                        description: "Instrução para o agente Swarm sobre como processar o resultado da ação"
                    },
                    output_format: {
                        type: "string",
                        description: "Formato desejado do resultado final"
                    }
                },
                required: ["action", "processing_instruction"]
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
            "X-Title": "Meu Super AI - Swarm Agent"
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
const processToolCalls = async (toolCalls, apiKey, model) => {
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

        if (funcName === 'swarm_delegate') {
            // Verifica se tasks existe e é um array
            const tasks = args.tasks || args.task || [];
            const taskArray = Array.isArray(tasks) ? tasks : [tasks];
            
            if (taskArray.length === 0) {
                results.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    content: JSON.stringify({ error: "Nenhuma tarefa fornecida para o swarm_delegate" })
                });
                continue;
            }
            
            // Normaliza as tarefas (caso venham em formato diferente)
            const normalizedTasks = taskArray.map((t, i) => ({
                id: t.id || `task_${i + 1}`,
                instruction: t.instruction || t.task || t.prompt || String(t),
                context: t.context || t.data || '',
                output_format: t.output_format || t.format || ''
            }));
            
            // Executa todas as tarefas em paralelo
            const taskPromises = normalizedTasks.map(task => executeSwarmAgent(apiKey, task, model));
            const taskResults = await Promise.all(taskPromises);
            
            results.push({
                tool_call_id: toolCall.id,
                role: "tool",
                content: JSON.stringify({
                    swarm_results: taskResults,
                    tasks_completed: taskResults.filter(r => r.success).length,
                    tasks_failed: taskResults.filter(r => !r.success).length
                })
            });
        } 
        else if (funcName === 'swarm_pipeline') {
            // Verifica se action existe
            if (!args.action) {
                results.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    content: JSON.stringify({ error: "Nenhuma ação fornecida para o swarm_pipeline" })
                });
                continue;
            }
            
            // 1. Executa a ação
            const actionResult = await executePipelineAction(args.action);
            
            if (!actionResult.success) {
                results.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    content: JSON.stringify({ error: "Falha na ação: " + actionResult.error })
                });
                continue;
            }
            
            // 2. Envia para agente Swarm processar
            const processingTask = {
                id: "pipeline_result",
                instruction: args.processing_instruction || args.instruction || "Processe os dados recebidos",
                context: actionResult.data,
                output_format: args.output_format || ''
            };
            
            const processedResult = await executeSwarmAgent(apiKey, processingTask, model);
            
            results.push({
                tool_call_id: toolCall.id,
                role: "tool",
                content: JSON.stringify({
                    pipeline_result: processedResult.result,
                    success: processedResult.success
                })
            });
        }
        else {
            results.push({
                tool_call_id: toolCall.id,
                role: "tool",
                content: JSON.stringify({ error: "Ferramenta desconhecida: " + funcName })
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
    const { chatId, messages, model, userSystemPrompt, enableSwarm = true } = req.body;
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

    // System prompt ensinando a IA a usar o Swarm
    const swarmInstructions = enableSwarm ? `

## FERRAMENTAS SWARM DISPONÍVEIS

Você tem acesso a um sistema de agentes Swarm para executar tarefas de forma eficiente:

### 1. swarm_delegate
Use para delegar tarefas a agentes secundários (IAs auxiliares):
- Execute MÚLTIPLAS tarefas em PARALELO para maior eficiência
- Os agentes têm MEMÓRIA VOLÁTIL - inclua TODO contexto necessário
- Ideal para: análises, resumos, cálculos, processamentos, pesquisas
- O resultado de cada agente volta diretamente para você

Exemplo de uso:
- Usuário pede para analisar 3 tópicos diferentes → delegue cada análise para um agente separado
- Precisa processar dados extensos → delegue para não ocupar seu contexto
- Tarefas independentes → execute em paralelo para responder mais rápido

### 2. swarm_pipeline  
Use para encadear ações onde você só precisa do resultado final:
- Busca dados (HTTP) → agente processa → você recebe só o resultado
- Economiza sua janela de contexto
- Ideal quando não precisa ver os dados brutos

### QUANDO USAR SWARM:
✅ Múltiplas tarefas independentes (paralelize!)
✅ Processamento de dados extensos
✅ Análises que não precisam de contexto anterior
✅ Quando quiser economizar tokens/contexto
✅ Tarefas bem definidas e autocontidas

### QUANDO NÃO USAR:
❌ Tarefas simples que você resolve rapidamente
❌ Quando precisa de contexto da conversa anterior
❌ Interações que requerem continuidade
` : '';

    const systemContent = [];
    systemContent.push(`Você é um assistente de IA avançado com capacidades de delegação de tarefas.${swarmInstructions}`);
    if (userSystemPrompt) systemContent.push(userSystemPrompt);
    if (req.user.bio) systemContent.push(`Informações sobre o usuário: ${req.user.bio}`);
    
    const msgs = [{ role: "system", content: systemContent.join('\n\n') }, ...messages];
    const tools = enableSwarm ? getAvailableTools() : undefined;

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
        const maxIterations = 5; // Limite de segurança
        
        while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
            iterations++;
            
            // Adiciona a mensagem do assistente com tool_calls
            msgs.push(assistantMessage);
            
            // Processa as ferramentas
            const toolResults = await processToolCalls(assistantMessage.tool_calls, apiKey, model);
            
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

// ============ ADMIN - CONFIGURAÇÕES GLOBAIS ============

app.get('/api/admin/config', auth, adminOnly, async (req, res) => {
    await connectDB();
    const apiKeyConfig = await GlobalConfig.findOne({ key: 'OPENROUTER_API_KEY' });
    const defaultModelConfig = await GlobalConfig.findOne({ key: 'DEFAULT_MODEL' });
    res.json({
        hasGlobalApiKey: !!apiKeyConfig?.value,
        globalApiKeyPreview: apiKeyConfig?.value ? '****' + apiKeyConfig.value.slice(-4) : null,
        defaultModel: defaultModelConfig?.value || 'google/gemini-2.0-flash-exp:free'
    });
});

// Endpoint público para obter modelo padrão (usado pelo frontend)
app.get('/api/config/default-model', async (req, res) => {
    await connectDB();
    const defaultModelConfig = await GlobalConfig.findOne({ key: 'DEFAULT_MODEL' });
    res.json({
        defaultModel: defaultModelConfig?.value || 'google/gemini-2.0-flash-exp:free'
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

// Salvar modelo padrão
app.post('/api/admin/config/default-model', auth, adminOnly, async (req, res) => {
    await connectDB();
    const { model } = req.body;
    
    if (!model) {
        return res.status(400).json({ error: 'Modelo é obrigatório' });
    }
    
    await GlobalConfig.findOneAndUpdate(
        { key: 'DEFAULT_MODEL' },
        { key: 'DEFAULT_MODEL', value: model },
        { upsert: true }
    );
    
    res.json({ 
        success: true, 
        defaultModel: model
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
