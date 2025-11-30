require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai');
const { exec } = require('child_process');
const puppeteer = require('puppeteer');
const vm = require('vm');
const axios = require('axios');
const compression = require('compression');
const User = require('./models/User');
const Chat = require('./models/Chat');
const CustomTool = require('./models/CustomTool');
const GlobalConfig = require('./models/GlobalConfig');

const app = express();

// OTIMIZAÇÃO 1: Compressão e CORS Rápido
app.use(compression());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] }));
app.use(express.json({ limit: '1mb' })); // Limita tamanho para ser mais leve

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meu-super-ai';

// OTIMIZAÇÃO 2: Conexão MongoDB Persistente e Resiliente
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000, // Não espera eternamente
            socketTimeoutMS: 45000, // Mantém conexão viva
        });
        console.log('MongoDB Conectado');
        // Cria admin se não existir (em background)
        User.findOne({ username: 'admin' }).then(async (u) => {
            if (!u) await User.create({ username: 'admin', password: await bcrypt.hash('@admin2306#', 10), role: 'admin' });
        });
    } catch (err) {
        console.error('Erro Mongo:', err);
    }
};
// Conecta logo no início
connectDB();

const auth = async (req, res, next) => {
  const t = req.header('Authorization')?.replace('Bearer ', '');
  if (!t) return res.status(401).send('No token');
  try { req.user = await User.findById(jwt.verify(t, JWT_SECRET).id); next(); } catch (e) { res.status(400).send('Invalid'); }
};

// ROTA WAKE-UP (Para o frontend acordar o servidor)
app.get('/api/ping', (req, res) => res.send('pong'));

// Rotas CRUD Otimizadas
app.get('/api/chats', auth, async (req, res) => {
    await connectDB();
    // Seleciona apenas campos necessários para a lista carregar rápido
    res.json(await Chat.find({ userId: req.user._id }).sort({ updatedAt: -1 }).select('title model updatedAt').limit(20));
});

app.post('/api/chats', auth, async (req, res) => {
    await connectDB();
    try {
        console.log('Criando chat para user:', req.user._id);
        const chat = await Chat.create({ 
            userId: req.user._id, 
            title: 'Novo Chat', 
            model: req.body.model || 'google/gemini-2.0-flash-exp:free', 
            userSystemPrompt: req.body.systemPrompt || '' 
        });
        console.log('Chat criado:', chat._id);
        res.json(chat);
    } catch(e) {
        console.error("Erro Criar Chat:", e);
        res.status(500).json({ error: "Erro ao gravar no banco: " + e.message });
    }
});

app.get('/api/chats/:id', auth, async (req, res) => { await connectDB(); res.json(await Chat.findOne({ _id: req.params.id, userId: req.user._id })); });
app.patch('/api/chats/:id', auth, async (req, res) => { await connectDB(); res.json(await Chat.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { updatedAt: Date.now(), ...req.body }, { new: true })); });
app.delete('/api/chats/:id', auth, async (req, res) => { await connectDB(); await Chat.findOneAndDelete({ _id: req.params.id, userId: req.user._id }); res.json({success:true}); });
app.get('/api/models', async (req,res) => { try{const r=await axios.get('https://openrouter.ai/api/v1/models');res.json(r.data.data.filter(m=>m.pricing.prompt==="0"||m.id.includes("free")).map(m=>({id:m.id,name:m.name})));}catch(e){res.json([])} });
app.post('/api/register', async(req,res)=>{await connectDB(); const{username,password}=req.body;if(await User.findOne({username}))return res.status(400).json({error:"User exists"});const hash=await bcrypt.hash(password,10);const u=await User.create({username,password:hash});res.json({token:jwt.sign({id:u._id},JWT_SECRET),role:u.role,username})});
app.post('/api/login', async(req,res)=>{await connectDB(); const{username,password}=req.body;const u=await User.findOne({username});if(!u||!await bcrypt.compare(password,u.password))return res.status(400).json({error:"Invalid"});res.json({token:jwt.sign({id:u._id},JWT_SECRET),role:u.role,username})});
app.get('/api/admin/users', auth, async (req, res) => { 
    await connectDB(); 
    const users = await User.find({}, '-password');
    console.log('Usuários encontrados:', users.map(u => ({ id: u._id, username: u.username })));
    res.json(users); 
});
app.get('/api/admin/user/:id', auth, async (req, res) => { await connectDB(); res.json({ user: await User.findById(req.params.id,'-password'), tools: await CustomTool.find({userId:req.params.id}), chats: await Chat.find({userId:req.params.id}) }); });

// --- ROTA DE CHAT ULTRA-RÁPIDA ---
app.post('/api/chat', auth, async (req, res) => {
  const { chatId, messages, model, userSystemPrompt, toolsEnabled } = req.body;
  const apiKey = req.user.personal_api_key || GLOBAL_API_KEY;
  const openai = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey, defaultHeaders: { "HTTP-Referer": "https://gemini-clone.vercel.app", "X-Title": "Gemini Clone" } });

  // OTIMIZAÇÃO 3: Recuperação de contexto em background
  // Não travamos a thread principal esperando o banco confirmar o update do model
  let chatPromise = chatId ? Chat.findOne({_id: chatId, userId: req.user._id}) : Promise.resolve(null);

  const sys = userSystemPrompt ? `System: ${userSystemPrompt}` : "";
  const msgs = sys ? [{role:"system", content:sys}, ...messages] : [...messages];

  try {
    // Chama a IA imediatamente
    const resp = await openai.chat.completions.create({
        model: model || "google/gemini-2.0-flash-exp:free",
        messages: msgs
    });
    
    const msg = resp.choices[0].message;
    
    // OTIMIZAÇÃO 4: Salva no banco DEPOIS de responder ao usuário (Fire and Forget)
    // Isso faz a resposta parecer instantânea, pois não espera o MongoDB
    res.json(msg);

    chatPromise.then(async (currentChat) => {
        if(currentChat) {
            currentChat.messages.push(messages[messages.length-1]); 
            currentChat.messages.push(msg); 
            if(model) currentChat.model = model;
            currentChat.updatedAt = Date.now();
            await currentChat.save();
        }
    }).catch(err => console.error("Erro ao salvar histórico em background:", err));

  } catch(e) { 
      res.status(500).json({ error: e.message, details: e.response?.data }); 
  }
});

// Swarm (Mantido)
app.post('/api/swarm', auth, async (req, res) => {
    const { task, model } = req.body; const apiKey = req.user.personal_api_key || GLOBAL_API_KEY; const openai = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey, defaultHeaders: { "HTTP-Referer": "https://gemini-clone.vercel.app", "X-Title": "Swarm" } });
    try { const lResp = await openai.chat.completions.create({model, messages:[{role:"system",content:"LIDER"},{role:"user",content:task}]}); res.json(lResp.choices[0].message); } catch(e) { res.status(500).json({error:e.message}); }
});

app.listen(PORT, () => console.log('Server V3.5-Turbo running'));
