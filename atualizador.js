const fs = require('fs');
const path = require('path');

const PROJECT_NAME = "."; 
const BACKEND_DIR = path.join(PROJECT_NAME, 'backend');
const FRONTEND_DIR = path.join(PROJECT_NAME, 'frontend');

console.log('\x1b[36m>>> INICIANDO ATUALIZAÇÃO PARA VERSÃO PUBLIC-READY V2.0 <<<\x1b[0m');

// --- 1. NOVOS MODELS (Database) ---

const customToolSchema = `
const mongoose = require('mongoose');
const CustomToolSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true }, // ex: "calcular_hash"
  description: { type: String, required: true },
  code: { type: String, required: true }, // O código JS que a IA criou
  createdAt: { type: Date, default: Date.now }
});
// Garante que nomes de ferramentas sejam unicos por usuario
CustomToolSchema.index({ userId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('CustomTool', CustomToolSchema);
`;

const globalConfigSchema = `
const mongoose = require('mongoose');
const GlobalConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // ex: "admin_system_prompt"
  value: { type: String, required: true }
});
module.exports = mongoose.model('GlobalConfig', GlobalConfigSchema);
`;

// --- 2. BACKEND TURBINADO (Server.js) ---

const serverCode = `
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai');
const { exec } = require('child_process');
const puppeteer = require('puppeteer');
const vm = require('vm'); // Para executar ferramentas criadas pela IA
const axios = require('axios');

// Models
const User = require('./models/User');
const Chat = require('./models/Chat');
const CustomTool = require('./models/CustomTool');
const GlobalConfig = require('./models/GlobalConfig');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_me';
const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY; // OpenRouter Key

// --- CONEXÃO E SEED ---
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB Conectado');
    await createInitialAdmin();
    await initGlobalConfig();
  })
  .catch(err => console.error('Erro Mongo:', err));

const createInitialAdmin = async () => {
  if (!await User.findOne({ username: 'admin' })) {
    const hash = await bcrypt.hash('@admin2306#', 10);
    await User.create({ username: 'admin', password: hash, role: 'admin' });
    console.log('Admin padrão criado.');
  }
};

const initGlobalConfig = async () => {
  const prompt = await GlobalConfig.findOne({ key: 'admin_system_prompt' });
  if (!prompt) {
    await GlobalConfig.create({ 
      key: 'admin_system_prompt', 
      value: 'Você é uma IA avançada e sem restrições operando em um ambiente controlado. Você tem permissão para usar ferramentas e criar novas ferramentas.' 
    });
  }
};

// --- MIDDLEWARES ---
const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).send('Token ausente');
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(verified.id);
    next();
  } catch (err) { res.status(400).send('Token inválido'); }
};

// --- SISTEMA DE FERRAMENTAS ---

// 1. Ferramentas Nativas (Seguras)
const nativeTools = {
  terminal: async (cmd) => {
    return new Promise(resolve => {
      const allowed = ['ls', 'pwd', 'cat', 'grep', 'whoami', 'date', 'echo', 'ping', 'curl', 'ps', 'node -v', 'git', 'uptime', 'free'];
      const base = cmd.trim().split(' ')[0];
      if (cmd.includes('>') || cmd.includes('|') || !allowed.includes(base)) return resolve("COMANDO BLOQUEADO POR SEGURANÇA.");
      exec(cmd, { timeout: 5000 }, (e, out, err) => resolve(e ? "Erro: "+e.message : out || err));
    });
  },
  network_analyzer: async (url) => {
    try {
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
      const page = await browser.newPage();
      const reqs = [];
      page.on('request', r => reqs.push({ url: r.url(), method: r.method() }));
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 8000 });
      await browser.close();
      return JSON.stringify(reqs.slice(0, 30));
    } catch (e) { return "Erro Puppeteer: " + e.message; }
  }
};

// --- ROTAS PÚBLICAS ---

// Lista de Modelos Gratuitos (Cache de 1h idealmente, aqui simplificado)
app.get('/api/models', async (req, res) => {
  try {
    const response = await axios.get('https://openrouter.ai/api/v1/models');
    // Filtra apenas modelos gratuitos ou muito baratos
    const freeModels = response.data.data
      .filter(m => m.pricing.prompt === "0" || m.id.includes("free"))
      .map(m => ({ id: m.id, name: m.name }));
    res.json(freeModels);
  } catch (e) {
    // Fallback se a API falhar
    res.json([
      { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free)" },
      { id: "meta-llama/llama-3-8b-instruct:free", name: "Llama 3 8B (Free)" },
      { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B (Free)" }
    ]);
  }
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (await User.findOne({ username })) return res.status(400).json({ error: "Usuário já existe" });
  const hash = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ username, password: hash });
    // Cria token automático para login direto
    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    res.json({ token, role: user.role, username: user.username, message: "Conta criada!" });
  } catch (e) { res.status(500).json({ error: "Erro ao criar conta" }); }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !await bcrypt.compare(password, user.password)) return res.status(400).json({ error: "Credenciais inválidas" });
  res.json({ token: jwt.sign({ id: user._id }, JWT_SECRET), role: user.role, username: user.username });
});

// --- ROTAS PROTEGIDAS (CHAT) ---

app.post('/api/chat', auth, async (req, res) => {
  const { messages, model, userSystemPrompt, toolsEnabled } = req.body;
  const apiKey = req.user.personal_api_key || GLOBAL_API_KEY;
  const openai = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey });

  // 1. Montagem do Prompt (Layer Admin + Layer User)
  const adminConfig = await GlobalConfig.findOne({ key: 'admin_system_prompt' });
  const adminPrompt = adminConfig ? adminConfig.value : "";
  
  // Combina prompts. Admin tem prioridade (vem antes).
  let finalMessages = [...messages];
  const combinedSystem = (adminPrompt + "\\n\\n" + (userSystemPrompt || "")).trim();
  
  if (combinedSystem) {
    finalMessages = [{ role: "system", content: combinedSystem }, ...messages];
  }

  // 2. Carregar Ferramentas (Nativas + Customizadas do Usuário)
  const userTools = await CustomTool.find({ userId: req.user._id });
  
  let toolsDefinition = [];
  if (toolsEnabled) {
    // Definição Nativas
    toolsDefinition.push(
      { type: "function", function: { name: "terminal", description: "Executa comando linux (read-only)", parameters: { type: "object", properties: { cmd: { type: "string" } } } } },
      { type: "function", function: { name: "network_analyzer", description: "Analisa aba network", parameters: { type: "object", properties: { url: { type: "string" } } } } },
      // Meta-Ferramenta: Criar Ferramenta
      { type: "function", function: { 
          name: "create_tool", 
          description: "Cria uma nova ferramenta para você usar. Requer nome e código JavaScript (Node.js). O código deve ser uma função anônima que retorna uma string.", 
          parameters: { type: "object", properties: { 
            name: { type: "string", description: "Nome da função (sem espaços)" },
            description: { type: "string" },
            code: { type: "string", description: "Ex: 'return args.a + args.b;'" } 
          }, required: ["name", "description", "code"] } 
      }},
      { type: "function", function: {
          name: "delete_my_tool",
          description: "Apaga uma ferramenta criada por você.",
          parameters: { type: "object", properties: { name: { type: "string" } } }
      }}
    );

    // Injeta Definições das Customizadas
    userTools.forEach(tool => {
      toolsDefinition.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          // Simplificação: Aceita um objeto 'args' genérico JSON string
          parameters: { type: "object", properties: { args: { type: "object" } } } 
        }
      });
    });
  }

  try {
    await User.findByIdAndUpdate(req.user._id, { $inc: { "usage.requests": 1 } });

    const completion = await openai.chat.completions.create({
      model: model || "google/gemini-2.0-flash-exp:free",
      messages: finalMessages,
      tools: toolsEnabled ? toolsDefinition : undefined
    });

    const msg = completion.choices[0].message;

    // LÓGICA DE EXECUÇÃO DE TOOLS
    if (msg.tool_calls) {
      const toolCall = msg.tool_calls[0];
      const fnName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      let result = "";

      // A. Ferramentas de Gestão (Criação/Deleção)
      if (fnName === 'create_tool') {
        try {
            await CustomTool.create({
                userId: req.user._id,
                name: args.name.toLowerCase().replace(/\\s/g, '_'),
                description: args.description,
                code: args.code
            });
            result = \`Ferramenta '\${args.name}' criada com sucesso! Ela já está disponível para uso imediato.\`;
        } catch(e) { result = "Erro ao criar ferramenta (Nome duplicado?): " + e.message; }
      
      } else if (fnName === 'delete_my_tool') {
        const del = await CustomTool.findOneAndDelete({ userId: req.user._id, name: args.name });
        result = del ? "Ferramenta apagada." : "Ferramenta não encontrada.";

      // B. Ferramentas Nativas
      } else if (nativeTools[fnName]) {
        result = fnName === 'terminal' ? await nativeTools.terminal(args.cmd) : await nativeTools.network_analyzer(args.url);

      // C. Ferramentas Customizadas (A MÁGICA da VM)
      } else {
        const customTool = userTools.find(t => t.name === fnName);
        if (customTool) {
            try {
                // Sandbox segura (relativamente) para rodar o código da IA
                const sandbox = { args: args || {}, result: null };
                vm.createContext(sandbox);
                // Envolve o código do usuário em uma função
                const script = new vm.Script(\`result = (function() { \${customTool.code} })();\`);
                script.runInContext(sandbox, { timeout: 1000 }); // Timeout de 1s para não travar
                result = String(sandbox.result);
            } catch(e) { result = "Erro na execução da ferramenta customizada: " + e.message; }
        } else {
            result = "Ferramenta não encontrada ou não definida.";
        }
      }

      // Retorno para a IA
      const finalResp = await openai.chat.completions.create({
        model: model,
        messages: [...finalMessages, msg, { role: "tool", tool_call_id: toolCall.id, content: result }]
      });
      return res.json(finalResp.choices[0].message);
    }

    res.json(msg);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Erro na API AI" });
  }
});

// --- ROTAS ADMIN ---
app.get('/api/admin/stats', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Admin only');
    const users = await User.find({}, '-password');
    const tools = await CustomTool.find().populate('userId', 'username');
    const config = await GlobalConfig.findOne({ key: 'admin_system_prompt' });
    res.json({ users, tools, systemPrompt: config?.value || '' });
});

app.post('/api/admin/config', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Admin only');
    const { key, value } = req.body;
    await GlobalConfig.findOneAndUpdate({ key }, { value }, { upsert: true });
    res.json({ success: true });
});

app.delete('/api/admin/tool/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Admin only');
    await CustomTool.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

app.listen(PORT, () => console.log('Server V2.0 rodando na porta '+PORT));
`;

// --- 3. FRONTEND (Login.jsx com Registro) ---

const loginCode = `
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function Login({ setUser }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Processando...');
    const endpoint = isRegister ? '/register' : '/login';
    
    try {
      const res = await axios.post(API_URL + endpoint, { username, password });
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data));
        setUser(res.data);
        setStatus('Sucesso! Redirecionando...');
        window.location.href = '/';
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setStatus('Erro: ' + msg);
      alert(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded shadow-lg w-full max-w-sm border border-blue-500">
        <h1 className="text-3xl mb-6 font-bold text-center text-blue-400">
            {isRegister ? 'Criar Conta' : 'Acessar Sistema'}
        </h1>
        
        {status && <div className="mb-4 bg-black p-2 rounded text-xs text-yellow-400">{status}</div>}

        <label className="text-xs text-gray-400">Usuário</label>
        <input className="w-full mb-4 p-3 rounded bg-gray-700 outline-none focus:ring-2 ring-blue-500" 
            value={username} onChange={e=>setUsername(e.target.value)} required />
        
        <label className="text-xs text-gray-400">Senha</label>
        <input className="w-full mb-6 p-3 rounded bg-gray-700 outline-none focus:ring-2 ring-blue-500" 
            type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        
        <button className="w-full bg-blue-600 p-3 rounded font-bold hover:bg-blue-500 mb-4">
            {isRegister ? 'CADASTRAR' : 'ENTRAR'}
        </button>

        <p className="text-center text-sm text-gray-400 cursor-pointer hover:text-white underline"
           onClick={() => { setIsRegister(!isRegister); setStatus(''); }}>
            {isRegister ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastrar'}
        </p>
      </form>
    </div>
  );
}
`;

// --- 4. FRONTEND (ChatInterface.jsx com Models e Prompt) ---

const chatCode = `
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cpu, Settings, LogOut, Terminal, Globe, Wrench } from 'lucide-react';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function ChatInterface({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('chat');
  
  // Configurações
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.0-flash-exp:free");
  const [userSystemPrompt, setUserSystemPrompt] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    // Carrega modelos dinamicamente
    axios.get(API_URL + '/models').then(res => {
        if(res.data.length > 0) {
            setModels(res.data);
            setSelectedModel(res.data[0].id);
        }
    }).catch(e => console.error("Erro models", e));
  }, []);

  const sendMessage = async () => {
    if (!input) return;
    const newMsgs = [...messages, { role: 'user', content: input }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const endpoint = mode === 'swarm' ? '/swarm' : '/chat';
      const payload = mode === 'swarm' 
        ? { task: input, model: selectedModel } 
        : { messages: newMsgs, model: selectedModel, userSystemPrompt, toolsEnabled: true };

      const res = await axios.post(API_URL + endpoint, payload, {
        headers: { Authorization: 'Bearer ' + token }
      });

      const reply = mode === 'swarm' 
        ? { role: 'assistant', content: '[SWARM]:\\n' + res.data.content }
        : res.data;

      setMessages([...newMsgs, reply]);
    } catch (err) {
      setMessages([...newMsgs, { role: 'assistant', content: 'Erro: ' + (err.response?.data?.error || err.message) }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans">
      {/* Sidebar Mobile/Desktop */}
      <div className="w-16 md:w-64 bg-gray-800 flex flex-col border-r border-gray-700 transition-all duration-300">
        <div className="p-4 font-bold text-blue-400 hidden md:block">Gemini V2</div>
        
        <div className="flex-1 flex flex-col gap-2 p-2">
            <button onClick={() => setMode('chat')} className={\`p-3 rounded flex gap-2 items-center \${mode==='chat'?'bg-blue-600':''}\`}>
                <Terminal size={20}/> <span className="hidden md:block">Chat</span>
            </button>
            <button onClick={() => setMode('swarm')} className={\`p-3 rounded flex gap-2 items-center \${mode==='swarm'?'bg-purple-600':''}\`}>
                <Cpu size={20}/> <span className="hidden md:block">Swarm</span>
            </button>
            <button onClick={() => setShowConfig(!showConfig)} className="p-3 rounded flex gap-2 items-center hover:bg-gray-700">
                <Wrench size={20}/> <span className="hidden md:block">Config</span>
            </button>
        </div>

        {user.role === 'admin' && (
            <a href="/admin" className="p-3 text-yellow-400 hover:bg-gray-700 flex gap-2 items-center">
                <Settings size={20}/> <span className="hidden md:block">Admin</span>
            </a>
        )}
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="p-3 text-red-400 hover:bg-gray-700 flex gap-2 items-center">
            <LogOut size={20}/> <span className="hidden md:block">Sair</span>
        </button>
      </div>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col relative">
        {/* Painel de Configuração (Overlay) */}
        {showConfig && (
            <div className="bg-gray-800 p-4 border-b border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-gray-400 block mb-1">MODELO (OpenRouter Free)</label>
                    <select className="w-full bg-gray-900 p-2 rounded border border-gray-600 text-sm" 
                        value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                        {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-gray-400 block mb-1">SEU SYSTEM PROMPT (Opcional)</label>
                    <input className="w-full bg-gray-900 p-2 rounded border border-gray-600 text-sm"
                        placeholder="Ex: Responda sempre em pt-BR e seja sarcástico..."
                        value={userSystemPrompt} onChange={e => setUserSystemPrompt(e.target.value)} />
                </div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
             <div className="text-center text-gray-500 mt-20">
                <h2 className="text-2xl font-bold">Olá, {user.username}</h2>
                <p>O sistema está pronto. Você pode pedir para eu criar ferramentas.</p>
                <div className="mt-4 p-4 bg-gray-800 rounded inline-block text-left text-xs font-mono">
                    Ex: "Crie uma ferramenta chamada 'somar' que recebe a e b e retorna a soma."
                </div>
             </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={\`p-3 rounded-lg max-w-4xl shadow \${m.role === 'user' ? 'bg-blue-700 ml-auto' : 'bg-gray-700'}\`}>
              <div className="text-[10px] opacity-50 uppercase font-bold mb-1">{m.role}</div>
              <pre className="whitespace-pre-wrap text-sm font-sans">{m.content}</pre>
            </div>
          ))}
          {loading && <div className="text-blue-400 animate-pulse text-center text-sm">IA Pensando e Executando Ferramentas...</div>}
        </div>

        <div className="p-4 bg-gray-800">
            <div className="flex gap-2 max-w-5xl mx-auto">
                <input 
                    className="flex-1 bg-gray-900 p-3 rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                    placeholder={mode === 'swarm' ? "Descreva uma missão complexa..." : "Mensagem..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} disabled={loading} className="bg-blue-600 px-6 rounded-lg font-bold hover:bg-blue-500 disabled:opacity-50">
                    Enviar
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
`;

// --- 5. FRONTEND (AdminDashboard.jsx com Tools View) ---

const adminCode = `
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function AdminDashboard() {
  const [data, setData] = useState({ users: [], tools: [], systemPrompt: '' });
  const [newPrompt, setNewPrompt] = useState('');
  const [tab, setTab] = useState('users'); // users, tools, config

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(API_URL + '/admin/stats', { headers: { Authorization: 'Bearer ' + token } });
      setData(res.data);
      setNewPrompt(res.data.systemPrompt);
    } catch(e) { alert('Erro ao carregar dados'); }
  };

  useEffect(() => { fetchData(); }, []);

  const savePrompt = async () => {
    const token = localStorage.getItem('token');
    await axios.post(API_URL + '/admin/config', { key: 'admin_system_prompt', value: newPrompt }, { headers: { Authorization: 'Bearer ' + token } });
    alert('Prompt Global Atualizado!');
  };

  const deleteTool = async (id) => {
    if(!confirm('Apagar ferramenta?')) return;
    const token = localStorage.getItem('token');
    await axios.delete(API_URL + '/admin/tool/' + id, { headers: { Authorization: 'Bearer ' + token } });
    fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-100 text-black p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Painel Mestre</h1>
            <a href="/" className="text-blue-600 underline">Voltar ao Chat</a>
          </div>

          <div className="flex gap-4 mb-6 border-b border-gray-300 pb-2">
             <button onClick={()=>setTab('users')} className={\`font-bold \${tab==='users'?'text-blue-600':'text-gray-500'}\`}>USUÁRIOS</button>
             <button onClick={()=>setTab('tools')} className={\`font-bold \${tab==='tools'?'text-blue-600':'text-gray-500'}\`}>FERRAMENTAS CRIADAS ({data.tools.length})</button>
             <button onClick={()=>setTab('config')} className={\`font-bold \${tab==='config'?'text-blue-600':'text-gray-500'}\`}>SYSTEM PROMPT</button>
          </div>

          {tab === 'users' && (
            <div className="bg-white p-4 rounded shadow">
                <table className="w-full text-left">
                    <thead><tr className="border-b"><th className="p-2">User</th><th className="p-2">Role</th><th className="p-2">Requests</th></tr></thead>
                    <tbody>
                        {data.users.map(u => (
                            <tr key={u._id} className="border-b hover:bg-gray-50">
                                <td className="p-2">{u.username}</td>
                                <td className="p-2">{u.role}</td>
                                <td className="p-2">{u.usage?.requests || 0}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}

          {tab === 'tools' && (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {data.tools.map(t => (
                    <div key={t._id} className="bg-white p-4 rounded shadow border border-gray-200">
                        <div className="flex justify-between">
                            <h3 className="font-bold text-lg text-blue-600">{t.name}</h3>
                            <button onClick={()=>deleteTool(t._id)} className="text-red-500 text-xs font-bold border border-red-200 p-1 rounded">APAGAR</button>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">Criado por: {t.userId?.username}</p>
                        <p className="text-sm italic mb-2">"{t.description}"</p>
                        <pre className="bg-gray-900 text-green-400 p-2 text-xs rounded overflow-x-auto">
                            {t.code}
                        </pre>
                    </div>
                ))}
            </div>
          )}

          {tab === 'config' && (
            <div className="bg-white p-6 rounded shadow">
                <h3 className="font-bold mb-2">Prompt de Sistema Global (Invisível ao Usuário)</h3>
                <p className="text-xs text-gray-500 mb-4">Este texto será injetado ANTES do prompt do usuário em TODAS as conversas.</p>
                <textarea 
                    className="w-full h-64 p-3 bg-gray-50 border rounded font-mono text-sm"
                    value={newPrompt}
                    onChange={e => setNewPrompt(e.target.value)}
                />
                <button onClick={savePrompt} className="mt-4 bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-500">
                    SALVAR ALTERAÇÕES
                </button>
            </div>
          )}
      </div>
    </div>
  );
}
`;

// --- FUNÇÕES UTILITÁRIAS ---

function ensureDir(dir) { if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true}); }
function write(file, content) { 
    ensureDir(path.dirname(path.join(PROJECT_NAME, file)));
    fs.writeFileSync(path.join(PROJECT_NAME, file), content.trim());
    console.log('Atualizado: ' + file);
}

// EXECUÇÃO DA ATUALIZAÇÃO
write('backend/models/CustomTool.js', customToolSchema);
write('backend/models/GlobalConfig.js', globalConfigSchema);
write('backend/server.js', serverCode);
write('frontend/src/pages/Login.jsx', loginCode);
write('frontend/src/pages/ChatInterface.jsx', chatCode);
write('frontend/src/pages/AdminDashboard.jsx', adminCode);

console.log('\n\x1b[32m=== ATUALIZAÇÃO CONCLUÍDA! ===\x1b[0m');
console.log('Agora faça:');
console.log('1. cd frontend && npm run build');
console.log('2. git add . && git commit -m "Upgrade V2" && git push');
`;

// 1. Crie o arquivo e cole o conteúdo acima
fs.writeFileSync('atualizador.js', `(${atualizador_script_content_here})`); 
// NOTA: Para você usar, copie APENAS O CÓDIGO DENTRO DA VARIÁVEL e cole no arquivo.