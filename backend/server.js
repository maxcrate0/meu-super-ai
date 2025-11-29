require('dotenv').config();
                                        const express = require('express');
                                        const mongoose = require('mongoose');
                                        const cors = require('cors');
                                        const jwt = require('jsonwebtoken');
                                        const bcrypt = require('bcryptjs');
                                        const OpenAI = require('openai');
                                        const { exec } = require('child_process');
                                        const puppeteer = require('puppeteer');
                                        const User = require('./models/User');
                                        const Chat = require('./models/Chat');

                                        const app = express();
                                        app.use(cors());
                                        app.use(express.json());

                                        const PORT = process.env.PORT || 3000;
                                        const JWT_SECRET = process.env.JWT_SECRET || 'secret';
                                        const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY;
                                        const DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free";

                                        // Seed Admin
                                        const createInitialAdmin = async () => {
                                          try {
                                              if (!await User.findOne({ username: 'admin' })) {
                                                    const hash = await bcrypt.hash('@admin2306#', 10);
                                                          await User.create({ username: 'admin', password: hash, role: 'admin' });
                                                                console.log('>>> ADMIN CRIADO: admin / @admin2306# <<<');
                                                                    }
                                                                      } catch (e) { console.error(e); }
                                                                      };

                                                                      mongoose.connect(process.env.MONGODB_URI)
                                                                        .then(() => { console.log('DB Conectado'); createInitialAdmin(); })
                                                                          .catch(err => console.error(err));

                                                                          const auth = async (req, res, next) => {
                                                                            const token = req.header('Authorization')?.replace('Bearer ', '');
                                                                              if (!token) return res.status(401).send('Negado');
                                                                                try {
                                                                                    const verified = jwt.verify(token, JWT_SECRET);
                                                                                        req.user = await User.findById(verified.id);
                                                                                            next();
                                                                                              } catch (err) { res.status(400).send('Token invalido'); }
                                                                                              };

                                                                                              // Tools
                                                                                              const runSafeTerminal = (cmd) => new Promise(res => {
                                                                                                const allowed = ['ls', 'pwd', 'cat', 'grep', 'whoami', 'date', 'echo', 'ping', 'curl', 'ps', 'node -v', 'git status'];
                                                                                                  if (cmd.includes('>') || cmd.includes('|') || !allowed.includes(cmd.split(' ')[0])) return res("COMANDO PROIBIDO");
                                                                                                    exec(cmd, { timeout: 5000 }, (e, out, err) => res(e ? "Erro: "+e.message : out || err));
                                                                                                    });

                                                                                                    const analyzeNetwork = async (url) => {
                                                                                                      try {
                                                                                                          const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
                                                                                                              const page = await browser.newPage();
                                                                                                                  const reqs = [];
                                                                                                                      page.on('request', r => reqs.push({ url: r.url(), method: r.method() }));
                                                                                                                          await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
                                                                                                                              await browser.close();
                                                                                                                                  return JSON.stringify(reqs.slice(0, 30));
                                                                                                                                    } catch (e) { return "Erro: " + e.message; }
                                                                                                                                    };

                                                                                                                                    // Routes
                                                                                                                                    app.post('/api/chat', auth, async (req, res) => {
                                                                                                                                      const { messages, model, systemPrompt, toolsEnabled } = req.body;
                                                                                                                                        const apiKey = req.user.personal_api_key || GLOBAL_API_KEY;
                                                                                                                                          const openai = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey });
                                                                                                                                            
                                                                                                                                              await User.findByIdAndUpdate(req.user._id, { $inc: { "usage.requests": 1 } });
                                                                                                                                                
                                                                                                                                                  // Salvar Chat (Opcional - Logica basica)
                                                                                                                                                    let chat = await Chat.findOne({ userId: req.user._id }).sort({_id:-1});
                                                                                                                                                      if(!chat) chat = await Chat.create({ userId: req.user._id, messages: [] });
                                                                                                                                                        // Aqui voce pode expandir para salvar historico real no banco

                                                                                                                                                          const tools = [
                                                                                                                                                              { type: "function", function: { name: "terminal", description: "Read-only terminal", parameters: { type: "object", properties: { cmd: { type: "string" } } } } },
                                                                                                                                                                  { type: "function", function: { name: "network_analyzer", description: "Analyze network", parameters: { type: "object", properties: { url: { type: "string" } } } } }
                                                                                                                                                                    ];

                                                                                                                                                                      try {
                                                                                                                                                                          const allMsgs = systemPrompt ? [{role:"system", content:systemPrompt}, ...messages] : messages;
                                                                                                                                                                              const resp = await openai.chat.completions.create({ model: model || DEFAULT_MODEL, messages: allMsgs, tools: toolsEnabled ? tools : undefined });
                                                                                                                                                                                  const msg = resp.choices[0].message;

                                                                                                                                                                                      if (msg.tool_calls) {
                                                                                                                                                                                            const tool = msg.tool_calls[0];
                                                                                                                                                                                                  const args = JSON.parse(tool.function.arguments);
                                                                                                                                                                                                        const result = tool.function.name === 'terminal' ? await runSafeTerminal(args.cmd) : await analyzeNetwork(args.url);
                                                                                                                                                                                                              const final = await openai.chat.completions.create({ model: model || DEFAULT_MODEL, messages: [...allMsgs, msg, { role: "tool", tool_call_id: tool.id, content: result }] });
                                                                                                                                                                                                                    return res.json(final.choices[0].message);
                                                                                                                                                                                                                        }
                                                                                                                                                                                                                            res.json(msg);
                                                                                                                                                                                                                              } catch (e) { res.status(500).json({ error: e.message }); }
                                                                                                                                                                                                                              });

                                                                                                                                                                                                                              app.post('/api/swarm', auth, async (req, res) => {
                                                                                                                                                                                                                                const { task, model } = req.body;
                                                                                                                                                                                                                                  const apiKey = req.user.personal_api_key || GLOBAL_API_KEY;
                                                                                                                                                                                                                                    const targetModel = model || DEFAULT_MODEL;
                                                                                                                                                                                                                                      const openai = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey });

                                                                                                                                                                                                                                        try {
                                                                                                                                                                                                                                            const plan = await openai.chat.completions.create({ model: targetModel, messages: [{ role: "system", content: "Return JSON array of subtasks." }, { role: "user", content: task }] });
                                                                                                                                                                                                                                                let subtasks = [task];
                                                                                                                                                                                                                                                    try { subtasks = JSON.parse(plan.choices[0].message.content.replace(/\`\`\`json|\`\`\`/g, '')); } catch(e){}
                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                            const results = await Promise.all(subtasks.slice(0, 30).map(t => 
                                                                                                                                                                                                                                                                  openai.chat.completions.create({ model: targetModel, messages: [{ role: "user", content: JSON.stringify(t) }] })
                                                                                                                                                                                                                                                                        .then(r => r.choices[0].message.content).catch(e => "Error")
                                                                                                                                                                                                                                                                            ));

                                                                                                                                                                                                                                                                                const summary = await openai.chat.completions.create({ model: targetModel, messages: [{ role: "system", content: "Summarize." }, { role: "user", content: JSON.stringify(results) }] });
                                                                                                                                                                                                                                                                                    res.json(summary.choices[0].message);
                                                                                                                                                                                                                                                                                      } catch (e) { res.status(500).json({ error: e.message }); }
                                                                                                                                                                                                                                                                                      });

                                                                                                                                                                                                                                                                                      app.post('/api/login', async (req, res) => {
                                                                                                                                                                                                                                                                                        const { username, password } = req.body;
                                                                                                                                                                                                                                                                                          const user = await User.findOne({ username });
                                                                                                                                                                                                                                                                                            if (!user || !await bcrypt.compare(password, user.password)) return res.status(400).send('Invalid');
                                                                                                                                                                                                                                                                                              res.json({ token: jwt.sign({ id: user._id }, JWT_SECRET), role: user.role, username: user.username });
                                                                                                                                                                                                                                                                                              });

                                                                                                                                                                                                                                                                                              app.get('/api/admin/data', auth, async (req, res) => {
                                                                                                                                                                                                                                                                                                const users = await User.find({}, '-password');
                                                                                                                                                                                                                                                                                                  res.json({ users, chats: [] }); // Simplificado para demo
                                                                                                                                                                                                                                                                                                  });

                                                                                                                                                                                                                                                                                                  app.listen(PORT, () => console.log('Server running'));