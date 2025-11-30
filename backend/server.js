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
const User = require('./models/User');
const Chat = require('./models/Chat');
const CustomTool = require('./models/CustomTool');
const GlobalConfig = require('./models/GlobalConfig');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY;

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('MongoDB ON');
    if (!await User.findOne({ username: 'admin' })) {
        const hash = await bcrypt.hash('@admin2306#', 10);
        await User.create({ username: 'admin', password: hash, role: 'admin' });
    }
    if (!await GlobalConfig.findOne({ key: 'admin_system_prompt' })) {
        await GlobalConfig.create({ key: 'admin_system_prompt', value: '' });
    }
}).catch(e => console.error(e));

const auth = async (req, res, next) => {
  const t = req.header('Authorization')?.replace('Bearer ', '');
  if (!t) return res.status(401).send('No token');
  try { req.user = await User.findById(jwt.verify(t, JWT_SECRET).id); next(); } catch (e) { res.status(400).send('Invalid'); }
};

const nativeTools = {
  terminal: async (cmd) => new Promise(r => {
      const allowed = ['ls', 'pwd', 'cat', 'grep', 'whoami', 'date', 'echo', 'ping', 'curl', 'ps', 'node -v'];
      if(cmd.includes('>')||cmd.includes('|')||!allowed.includes(cmd.split(' ')[0])) return r("Blocked");
      exec(cmd, {timeout:5000}, (e,o,r_err)=>r(e?e.message:o||r_err));
  }),
  network_analyzer: async (url) => {
      try {
        const b = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
        const p = await b.newPage(); const reqs=[];
        p.on('request', r=>reqs.push({u:r.url(),m:r.method()}));
        await p.goto(url,{waitUntil:'networkidle0',timeout:8000}); await b.close();
        return JSON.stringify(reqs.slice(0,30));
      } catch(e){return e.message}
  }
};

app.get('/api/models', async (req, res) => {
  try {
    const r = await axios.get('https://openrouter.ai/api/v1/models');
    res.json(r.data.data.filter(m=>m.pricing.prompt==="0"||m.id.includes("free")).map(m=>({id:m.id,name:m.name})));
  } catch(e) { res.json([{id:"google/gemini-2.0-flash-exp:free",name:"Gemini 2.0 Free"}]); }
});

app.post('/api/register', async (req, res) => {
  const {username, password} = req.body;
  if(await User.findOne({username})) return res.status(400).json({error:"User exists"});
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({username, password: hash});
  res.json({token: jwt.sign({id: user._id}, JWT_SECRET), role: user.role, username});
});

app.post('/api/login', async (req, res) => {
  const {username, password} = req.body;
  const user = await User.findOne({username});
  if(!user || !await bcrypt.compare(password, user.password)) return res.status(400).json({error:"Invalid creds"});
  res.json({token: jwt.sign({id: user._id}, JWT_SECRET), role: user.role, username});
});

app.post('/api/chat', auth, async (req, res) => {
  const { messages, model, userSystemPrompt, toolsEnabled } = req.body;
  const apiKey = req.user.personal_api_key || GLOBAL_API_KEY;
  const openai = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey });

  const conf = await GlobalConfig.findOne({ key: 'admin_system_prompt' });
  let msgs = [...messages];
  const sys = ((conf?.value||"") + "\n" + (userSystemPrompt||"")).trim();
  if(sys) msgs = [{role:"system", content:sys}, ...messages];

  const uTools = await CustomTool.find({ userId: req.user._id });
  let tools = [];
  if(toolsEnabled) {
      tools.push(
          {type:"function",function:{name:"terminal",description:"Linux cmd",parameters:{type:"object",properties:{cmd:{type:"string"}}}}},
          {type:"function",function:{name:"network_analyzer",description:"Check network",parameters:{type:"object",properties:{url:{type:"string"}}}}},
          {type:"function",function:{name:"create_tool",description:"Create JS tool",parameters:{type:"object",properties:{name:{type:"string"},description:{type:"string"},code:{type:"string"}}}}},
          {type:"function",function:{name:"delete_my_tool",description:"Delete tool",parameters:{type:"object",properties:{name:{type:"string"}}}}}
      );
      uTools.forEach(t => tools.push({type:"function",function:{name:t.name,description:t.description,parameters:{type:"object",properties:{args:{type:"object"}}}}}));
  }

  try {
    await User.findByIdAndUpdate(req.user._id, {$inc:{"usage.requests":1}});
    const resp = await openai.chat.completions.create({model: model||"google/gemini-2.0-flash-exp:free", messages: msgs, tools: toolsEnabled?tools:undefined});
    const msg = resp.choices[0].message;

    if(msg.tool_calls) {
        const tc = msg.tool_calls[0];
        const fn = tc.function.name;
        const args = JSON.parse(tc.function.arguments);
        let resText = "";

        if(fn==='create_tool') {
            try { await CustomTool.create({userId:req.user._id, name:args.name.toLowerCase(), description:args.description, code:args.code}); resText="Tool created!"; } catch(e){resText="Error: "+e.message}
        } else if(fn==='delete_my_tool') {
            await CustomTool.findOneAndDelete({userId:req.user._id, name:args.name}); resText="Deleted.";
        } else if(nativeTools[fn]) {
            resText = fn==='terminal'?await nativeTools.terminal(args.cmd):await nativeTools.network_analyzer(args.url);
        } else {
            const ct = uTools.find(t=>t.name===fn);
            if(ct) {
                try {
                    const sandbox = {args:args||{}, result:null}; vm.createContext(sandbox);
                    new vm.Script(`result=(function(){${ct.code}})();`).runInContext(sandbox, {timeout:1000});
                    resText = String(sandbox.result);
                } catch(e){resText="Script Error: "+e.message}
            } else resText="Tool not found";
        }
        
        const final = await openai.chat.completions.create({model: model, messages: [...msgs, msg, {role:"tool", tool_call_id:tc.id, content:resText}]});
        return res.json(final.choices[0].message);
    }
    res.json(msg);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/admin/stats', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Admin only');
    const users = await User.find({}, '-password');
    const tools = await CustomTool.find().populate('userId', 'username');
    const config = await GlobalConfig.findOne({ key: 'admin_system_prompt' });
    res.json({ users, tools, systemPrompt: config?.value || '' });
});

app.post('/api/admin/config', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Admin only');
    await GlobalConfig.findOneAndUpdate({ key: req.body.key }, { value: req.body.value }, { upsert: true });
    res.json({ success: true });
});

app.delete('/api/admin/tool/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Admin only');
    await CustomTool.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

app.listen(PORT, () => console.log('Server V2 running'));
