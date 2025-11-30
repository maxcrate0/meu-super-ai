import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cpu, Settings, LogOut, Terminal, Wrench } from 'lucide-react';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function ChatInterface({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('chat');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.0-flash-exp:free");
  const [userSystemPrompt, setUserSystemPrompt] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    axios.get(API_URL + '/models').then(res => { if(res.data.length) { setModels(res.data); setSelectedModel(res.data[0].id); } }).catch(()=>{});
  }, []);

  const send = async () => {
    if (!input) return;
    const newMsgs = [...messages, { role: 'user', content: input }];
    setMessages(newMsgs); setInput(''); setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = mode === 'swarm' ? { task: input, model: selectedModel } : { messages: newMsgs, model: selectedModel, userSystemPrompt, toolsEnabled: true };
      const res = await axios.post(API_URL + (mode === 'swarm' ? '/swarm' : '/chat'), payload, { headers: { Authorization: 'Bearer ' + token } });
      const reply = mode === 'swarm' ? { role: 'assistant', content: '[SWARM]:\n' + res.data.content } : res.data;
      setMessages([...newMsgs, reply]);
    } catch (err) { setMessages([...newMsgs, { role: 'assistant', content: 'Erro: ' + (err.response?.data?.error || err.message) }]); }
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans">
      <div className="w-16 md:w-64 bg-gray-800 flex flex-col border-r border-gray-700">
        <div className="hidden md:block p-4 font-bold text-blue-400">Gemini V2</div>
        <div className="flex-1 p-2 space-y-2">
            <button onClick={() => setMode('chat')} className={`p-3 w-full rounded flex gap-2 ${mode==='chat'?'bg-blue-600':''}`}><Terminal size={20}/><span className="hidden md:block">Chat</span></button>
            <button onClick={() => setMode('swarm')} className={`p-3 w-full rounded flex gap-2 ${mode==='swarm'?'bg-purple-600':''}`}><Cpu size={20}/><span className="hidden md:block">Swarm</span></button>
            <button onClick={() => setShowConfig(!showConfig)} className="p-3 w-full rounded flex gap-2 hover:bg-gray-700"><Wrench size={20}/><span className="hidden md:block">Config</span></button>
        </div>
        {user.role === 'admin' && <a href="/admin" className="p-3 text-yellow-400 flex gap-2"><Settings size={20}/><span className="hidden md:block">Admin</span></a>}
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="p-3 text-red-400 flex gap-2"><LogOut size={20}/><span className="hidden md:block">Sair</span></button>
      </div>
      <div className="flex-1 flex flex-col relative">
        {showConfig && (
            <div className="bg-gray-800 p-4 border-b border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-400">MODELO</label><select className="w-full bg-gray-900 p-2 rounded" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                <div><label className="text-xs text-gray-400">SEU SYSTEM PROMPT</label><input className="w-full bg-gray-900 p-2 rounded" placeholder="Ex: Seja sarcástico" value={userSystemPrompt} onChange={e => setUserSystemPrompt(e.target.value)} /></div>
            </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (<div key={i} className={`p-3 rounded-lg max-w-4xl ${m.role === 'user' ? 'bg-blue-700 ml-auto' : 'bg-gray-700'}`}><pre className="whitespace-pre-wrap text-sm font-sans">{m.content}</pre></div>))}
          {loading && <div className="text-blue-400 animate-pulse text-center">Processando...</div>}
        </div>
        <div className="p-4 bg-gray-800 flex gap-2">
            <input className="flex-1 bg-gray-900 p-3 rounded" placeholder="Mensagem..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
            <button onClick={send} disabled={loading} className="bg-blue-600 px-6 rounded font-bold">Enviar</button>
        </div>
      </div>
    </div>
  );
}
