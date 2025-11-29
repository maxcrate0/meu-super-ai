import React, { useState } from 'react';
import axios from 'axios';
import { Cpu, Settings, LogOut } from 'lucide-react';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function ChatInterface({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('chat');
  const [model, setModel] = useState("google/gemini-2.0-flash-exp:free");

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
        ? { task: input, model } 
        : { messages: newMsgs, model, toolsEnabled: true };

      const res = await axios.post(API_URL + endpoint, payload, {
        headers: { Authorization: 'Bearer ' + token }
      });

      const reply = mode === 'swarm' 
        ? { role: 'assistant', content: '[SWARM]:\n' + res.data.content }
        : res.data;

      setMessages([...newMsgs, reply]);
    } catch (err) {
      setMessages([...newMsgs, { role: 'assistant', content: 'Erro: ' + err.message }]);
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans">
      <div className="w-64 bg-gray-800 p-4 flex flex-col border-r border-gray-700">
        <h1 className="text-xl font-bold mb-6 text-blue-400">Gemini Clone</h1>
        <div className="space-y-4 flex-1">
          <button onClick={() => setMode('chat')} className="w-full text-left p-2 hover:bg-gray-700 rounded">Chat Padrão</button>
          <button onClick={() => setMode('swarm')} className="w-full text-left p-2 hover:bg-gray-700 rounded flex gap-2"><Cpu size={18}/> Swarm (30x)</button>
          
          <select className="w-full bg-gray-900 p-2 rounded border border-gray-600 text-xs" value={model} onChange={e => setModel(e.target.value)}>
             <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Free</option>
             <option value="meta-llama/llama-3-8b-instruct:free">Llama 3 8B</option>
          </select>
        </div>
        
        {user.role === 'admin' && (
            <a href="/admin" className="mt-4 text-yellow-400 flex gap-2 items-center p-2"><Settings size={16}/> Admin</a>
        )}
        <button onClick={logout} className="mt-4 text-red-400 flex gap-2 items-center p-2"><LogOut size={16}/> Sair</button>
      </div>

      <div className="flex-1 flex flex-col p-6">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((m, i) => (
            <div key={i} className={`p-4 rounded-xl max-w-4xl ${m.role === 'user' ? 'bg-blue-700 ml-auto' : 'bg-gray-800'}`}>
              <div className="text-xs opacity-50 mb-1 uppercase">{m.role}</div>
              <pre className="whitespace-pre-wrap text-sm">{m.content}</pre>
            </div>
          ))}
          {loading && <div className="text-blue-400 animate-pulse">Processando...</div>}
        </div>

        <div className="flex gap-2">
            <input 
                className="flex-1 bg-gray-800 p-3 rounded-lg border border-gray-600 outline-none"
                placeholder={mode === 'swarm' ? "Tarefa complexa..." : "Mensagem..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage} className="bg-blue-600 px-6 rounded-lg font-bold">Enviar</button>
        </div>
      </div>
    </div>
  );
}
