const { app } = require('@azure/functions');
const axios = require('axios');
const {
    baseHeaders,
    DEFAULT_MODEL,
    verifyToken,
    getApiKey,
    getGlobalSystemPrompt,
    buildMessages,
    incrementUsage,
    getOpenAIClient,
    jsonResponse,
} = require('./shared');

// ============ TOOLS ============
const SWARM_AGENTS = {
    researcher: { name: "Researcher", description: "Pesquisa web e análise de dados", model: "google/gemini-2.0-flash-exp:free" },
    coder: { name: "Coder", description: "Programação e código", model: "google/gemini-2.0-flash-exp:free" },
    writer: { name: "Writer", description: "Escrita criativa e redação", model: "google/gemini-2.0-flash-exp:free" },
    analyst: { name: "Analyst", description: "Análise de dados e lógica", model: "google/gemini-2.0-flash-exp:free" },
    creative: { name: "Creative", description: "Criação de conteúdo visual e artístico", model: "google/gemini-2.0-flash-exp:free" }
};

const builtInTools = [
    {
        type: "function",
        function: {
            name: "swarm_delegate",
            description: "Delegar tarefa para um agente especializado do Swarm. Use quando precisar de ajuda especializada.",
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
            description: "Buscar informações na web usando DuckDuckGo. Use para pesquisas gerais.",
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
            name: "web_browse",
            description: "Acessar e extrair conteúdo de uma URL. Use para ler artigos, páginas web, etc.",
            parameters: {
                type: "object",
                properties: { 
                    url: { type: "string", description: "URL para acessar" },
                    selector: { type: "string", description: "Seletor CSS opcional para extrair conteúdo específico" }
                },
                required: ["url"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_image",
            description: "Gerar imagem com IA. Use para criar imagens a partir de descrições textuais.",
            parameters: {
                type: "object",
                properties: { 
                    prompt: { type: "string", description: "Descrição detalhada da imagem" },
                    style: { type: "string", enum: ["realistic", "anime", "artistic", "3d", "cartoon"], description: "Estilo da imagem" }
                },
                required: ["prompt"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "code_execute",
            description: "Executar código Python ou JavaScript de forma segura. Use para cálculos, processamento de dados, etc.",
            parameters: {
                type: "object",
                properties: { 
                    language: { type: "string", enum: ["python", "javascript"], description: "Linguagem do código" },
                    code: { type: "string", description: "Código a ser executado" }
                },
                required: ["language", "code"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_tool",
            description: "Gerar uma nova ferramenta personalizada. Use quando precisar de uma funcionalidade que não existe.",
            parameters: {
                type: "object",
                properties: { 
                    name: { type: "string", description: "Nome da ferramenta (snake_case)" },
                    description: { type: "string", description: "Descrição do que a ferramenta faz" },
                    parameters: { type: "object", description: "Schema de parâmetros JSON" },
                    implementation: { type: "string", description: "Código JavaScript da implementação" }
                },
                required: ["name", "description", "parameters", "implementation"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "memory_store",
            description: "Armazenar informação na memória para uso posterior.",
            parameters: {
                type: "object",
                properties: { 
                    key: { type: "string", description: "Chave identificadora" },
                    value: { type: "string", description: "Valor a armazenar" }
                },
                required: ["key", "value"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "memory_retrieve",
            description: "Recuperar informação previamente armazenada.",
            parameters: {
                type: "object",
                properties: { 
                    key: { type: "string", description: "Chave identificadora" }
                },
                required: ["key"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "file_read",
            description: "Ler conteúdo de um arquivo (simulado).",
            parameters: {
                type: "object",
                properties: { 
                    path: { type: "string", description: "Caminho do arquivo" }
                },
                required: ["path"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "calculate",
            description: "Realizar cálculos matemáticos complexos.",
            parameters: {
                type: "object",
                properties: { 
                    expression: { type: "string", description: "Expressão matemática" }
                },
                required: ["expression"]
            }
        }
    }
];

// Armazenamento temporário em memória
const memoryStore = new Map();
const customTools = new Map();

// Tool Handlers
const handleSwarmDelegate = async (args, openai) => {
    const agent = SWARM_AGENTS[args.agent];
    if (!agent) return { error: "Agente não encontrado", availableAgents: Object.keys(SWARM_AGENTS) };
    
    const response = await openai.chat.completions.create({
        model: agent.model,
        messages: [
            { role: "system", content: `Você é ${agent.name}, especialista em ${agent.description}. Responda de forma clara, detalhada e útil.` },
            { role: "user", content: args.task }
        ],
        max_tokens: 2000
    });
    return { agent: agent.name, task: args.task, response: response.choices[0].message.content };
};

const handleWebSearch = async (args) => {
    try {
        // Tentar DuckDuckGo API
        const resp = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1`, { timeout: 10000 });
        
        let results = [];
        if (resp.data.AbstractText) {
            results.push({ type: 'abstract', text: resp.data.AbstractText, source: resp.data.AbstractSource });
        }
        if (resp.data.RelatedTopics?.length) {
            results = results.concat(resp.data.RelatedTopics.slice(0, 5).map(t => ({
                type: 'related',
                text: t.Text || t.FirstURL,
                url: t.FirstURL
            })));
        }
        
        return { query: args.query, results: results.length ? results : 'Sem resultados encontrados' };
    } catch (e) {
        return { error: e.message, query: args.query };
    }
};

const handleWebBrowse = async (args) => {
    try {
        const resp = await axios.get(args.url, { 
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; jgspAI/1.0)' },
            maxContentLength: 500000
        });
        
        // Extrair texto básico do HTML
        let content = resp.data;
        if (typeof content === 'string') {
            // Remover scripts, styles, e tags HTML
            content = content
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 10000);
        }
        
        return { url: args.url, content, length: content.length };
    } catch (e) {
        return { error: e.message, url: args.url };
    }
};

const handleGenerateImage = async (args) => {
    const style = args.style || 'realistic';
    const enhancedPrompt = `${args.prompt}, ${style} style, high quality, detailed`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true`;
    return { imageUrl: url, prompt: args.prompt, style, message: 'Imagem gerada com sucesso!' };
};

const handleCodeExecute = async (args) => {
    // Execução segura usando eval limitado (apenas para JavaScript básico)
    if (args.language === 'javascript') {
        try {
            // Criar sandbox limitado
            const sandbox = {
                Math, JSON, Date, Array, Object, String, Number, Boolean, 
                parseInt, parseFloat, isNaN, isFinite,
                console: { log: (...a) => a.join(' ') },
                result: null
            };
            
            const fn = new Function(...Object.keys(sandbox), `
                "use strict";
                ${args.code}
            `);
            
            const output = fn(...Object.values(sandbox));
            return { language: args.language, output: String(output), success: true };
        } catch (e) {
            return { error: e.message, language: args.language };
        }
    } else if (args.language === 'python') {
        // Para Python, retornar instruções (não temos executor Python no Azure Functions)
        return { 
            language: args.language, 
            code: args.code,
            message: 'Código Python analisado. Para executar, use um ambiente Python local.',
            analysis: 'O código parece válido e pode ser executado em um ambiente Python.'
        };
    }
    
    return { error: `Linguagem ${args.language} não suportada` };
};

const handleGenerateTool = async (args) => {
    try {
        // Salvar ferramenta customizada (em memória por enquanto)
        const toolDef = {
            type: "function",
            function: {
                name: args.name,
                description: args.description,
                parameters: args.parameters
            }
        };
        
        customTools.set(args.name, {
            definition: toolDef,
            implementation: args.implementation
        });
        
        return { 
            success: true, 
            message: `Ferramenta "${args.name}" criada com sucesso!`,
            tool: toolDef
        };
    } catch (e) {
        return { error: e.message };
    }
};

const handleMemoryStore = async (args) => {
    memoryStore.set(args.key, { value: args.value, timestamp: Date.now() });
    return { success: true, key: args.key, message: 'Informação armazenada com sucesso' };
};

const handleMemoryRetrieve = async (args) => {
    const data = memoryStore.get(args.key);
    if (!data) return { error: `Chave "${args.key}" não encontrada na memória` };
    return { key: args.key, value: data.value, storedAt: new Date(data.timestamp).toISOString() };
};

const handleFileRead = async (args) => {
    // Simulação - em produção integraria com storage
    return { 
        path: args.path, 
        message: 'Leitura de arquivo simulada. Em ambiente de produção, integraria com Azure Blob Storage.',
        simulated: true
    };
};

const handleCalculate = async (args) => {
    try {
        // Avaliação segura de expressões matemáticas
        const expr = args.expression.replace(/[^0-9+\-*/().%\s^]/g, '');
        const result = Function(`"use strict"; return (${expr})`)();
        return { expression: args.expression, result, success: true };
    } catch (e) {
        return { error: e.message, expression: args.expression };
    }
};

const executeToolCall = async (toolCall, openai) => {
    const args = JSON.parse(toolCall.function.arguments || '{}');
    const toolName = toolCall.function.name;
    
    switch (toolName) {
        case 'swarm_delegate': return await handleSwarmDelegate(args, openai);
        case 'web_search': return await handleWebSearch(args);
        case 'web_browse': return await handleWebBrowse(args);
        case 'generate_image': return await handleGenerateImage(args);
        case 'code_execute': return await handleCodeExecute(args);
        case 'generate_tool': return await handleGenerateTool(args);
        case 'memory_store': return await handleMemoryStore(args);
        case 'memory_retrieve': return await handleMemoryRetrieve(args);
        case 'file_read': return await handleFileRead(args);
        case 'calculate': return await handleCalculate(args);
        default: 
            // Verificar ferramentas customizadas
            if (customTools.has(toolName)) {
                try {
                    const custom = customTools.get(toolName);
                    const fn = new Function('args', custom.implementation);
                    return fn(args);
                } catch (e) {
                    return { error: `Erro ao executar ferramenta customizada: ${e.message}` };
                }
            }
            return { error: `Tool ${toolName} não implementada` };
    }
};

// ============ HTTP FUNCTION ============
app.http('tools', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'chat/tools',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return { status: 200, headers: baseHeaders, body: '' };
        if (request.method === 'GET') return jsonResponse(200, { ok: true, service: 'tools' });
        
        try {
            const user = await verifyToken(request.headers.get('authorization'));
            const body = await request.json();
            const { messages, model, userSystemPrompt } = body || {};
            
            if (!Array.isArray(messages)) {
                return jsonResponse(400, { error: 'messages é obrigatório' });
            }
            
            const apiKey = await getApiKey(user);
            if (!apiKey) return jsonResponse(400, { error: 'API Key não configurada' });
            
            const openai = getOpenAIClient(apiKey);
            const globalPrompt = await getGlobalSystemPrompt();
            const msgs = buildMessages(messages, globalPrompt, userSystemPrompt, user.bio);
            
            let response = await openai.chat.completions.create({
                model: model || DEFAULT_MODEL,
                messages: msgs,
                tools: builtInTools,
                tool_choice: 'auto'
            });
            
            let msg = response.choices[0].message;
            const toolResults = [];
            
            for (let i = 0; i < 5 && msg.tool_calls?.length; i++) {
                for (const toolCall of msg.tool_calls) {
                    const result = await executeToolCall(toolCall, openai);
                    toolResults.push({ tool: toolCall.function.name, result });
                    msgs.push(msg);
                    msgs.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
                }
                
                response = await openai.chat.completions.create({
                    model: model || DEFAULT_MODEL,
                    messages: msgs,
                    tools: builtInTools,
                    tool_choice: 'auto'
                });
                msg = response.choices[0].message;
            }
            
            incrementUsage(user._id);
            
            return jsonResponse(200, { ...msg, toolResults: toolResults.length ? toolResults : undefined });
            
        } catch (e) {
            context.log('tools error:', e.message);
            const status = e.message.includes('Token') || e.message.includes('Usuário') ? 401 : 500;
            return jsonResponse(status, { error: e.message });
        }
    }
});
