import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cpu, Settings, LogOut, Terminal, Wrench, Plus, MessageSquare, Trash2, Edit2, X, Check } from 'lucide-react';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

// Configuração Global do Axios para não desistir fácil
axios.defaults.timeout = 120000; // 2 minutos de tolerância

export default function ChatInterface({ user }) {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('chat');
  
  // SEUS MODELOS - Inicializa com fallback para evitar lista vazia
  const [models, setModels] = useState([
    {id:"google/gemini-2.0-flash-exp:free", name:"Gemini 2.0 Flash"},
    {id:"meta-llama/llama-3.3-70b-instruct:free", name:"Llama 3.3 70B"},
    {id:"deepseek/deepseek-chat:free", name:"DeepSeek V3 (Free)"}
  ]);
  
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.0-flash-exp:free");
  const [userSystemPrompt, setUserSystemPrompt] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const token = localStorage.getItem('token');

  useEffect(() => { 
    loadChats(); 
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const res = await axios.get(API_URL + '/models');
      if (res.data && res.data.length > 0) {
        setModels(res.data);
        if (!res.data.find(m => m.id === selectedModel)) {
          setSelectedModel(res.data[0].id);
        }
      }
      // Se res.data estiver vazio, mantém os modelos de fallback
    } catch(e) {
      console.log('Usando modelos de fallback');
      // Mantém os modelos de fallback que já estão no state
    }
  };

  const loadChats = async () => {
    try {
        const res = await axios.get(API_URL + '/chats', { headers: { Authorization: 'Bearer ' + token } });
        setChats(res.data);
    } catch(e) {}
  };

  const selectChat = async (id) => {
    setLoading(true); setActiveChatId(id); setMode('chat');
    try {
        const res = await axios.get(API_URL + '/chats/' + id, { headers: { Authorization: 'Bearer ' + token } });
        setMessages(res.data.messages || []);
        if (res.data.model) setSelectedModel(res.data.model);
        setUserSystemPrompt(res.data.userSystemPrompt || "");
    } catch(e) { alert('Erro ao carregar chat'); }
    setLoading(false);
  };

  const createNewChat = () => { setActiveChatId(null); setMessages([]); setMode('chat'); };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    if(!confirm("Apagar chat?")) return;
    await axios.delete(API_URL + '/chats/' + id, { headers: { Authorization: 'Bearer ' + token } });
    loadChats(); if(activeChatId === id) createNewChat();
  };

  const saveRename = async () => {
    await axios.patch(API_URL + '/chats/' + editingChatId, { title: editTitle }, { headers: { Authorization: 'Bearer ' + token } });
    setEditingChatId(null); loadChats();
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    let currentChatId = activeChatId;
    if (!currentChatId && mode === 'chat') {
        try {
            console.log('Criando novo chat com modelo:', selectedModel);
            const res = await axios.post(API_URL + '/chats', { model: selectedModel, systemPrompt: userSystemPrompt }, { headers: { Authorization: 'Bearer ' + token } });
            console.log('Chat criado:', res.data);
            if (!res.data || !res.data._id) {
                throw new Error('Resposta inválida do servidor');
            }
            currentChatId = res.data._id; 
            setActiveChatId(currentChatId); 
            loadChats();
        } catch(e) { 
            console.error('Erro ao criar chat:', e);
            const errorMsg = e.response?.data?.error || e.message;
            return alert("Erro ao criar chat: " + errorMsg); 
        }
    }

    const newMsgs = [...messages, { role: 'user', content: input }];
    setMessages(newMsgs); setInput(''); setLoading(true);

    try {
      const endpoint = mode === 'swarm' ? '/swarm' : '/chat';
      const payload = mode === 'swarm' ? { task: input, model: selectedModel } : { chatId: currentChatId, messages: newMsgs, model: selectedModel, userSystemPrompt, toolsEnabled: true };
      
      const res = await axios.post(API_URL + endpoint, payload, { 
          headers: { Authorization: 'Bearer ' + token },
          timeout: 120000 // Timeout explícito de 2 minutos na requisição
      });
      const reply = mode === 'swarm' ? { role: 'assistant', content: '[SWARM]:\\n' + res.data.content } : res.data;
      
      setMessages([...newMsgs, reply]);
      if(mode === 'chat') loadChats();
    } catch (err) {
      console.error(err);
      // Tratamento de erro detalhado
      let errorMsg = "Erro desconhecido";
      if (err.code === 'ECONNABORTED') {
          errorMsg = "Tempo limite excedido (Timeout). A IA demorou muito para responder.";
      } else if (err.response) {
          errorMsg = err.response.data?.error || JSON.stringify(err.response.data);
      } else {
          errorMsg = err.message;
      }
      
      setMessages([...newMsgs, { role: 'assistant', content: `❌ ERRO: ${errorMsg}\n\n(Tente novamente)` }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans">
      <div className="w-72 bg-gray-800 flex flex-col border-r border-gray-700 hidden md:flex">
        <div className="p-4 border-b border-gray-700">
            <button onClick={createNewChat} className="w-full bg-blue-600 p-2 rounded flex items-center justify-center gap-2 hover:bg-blue-500 transition"><Plus size={16}/> Novo Chat</button>
            <button onClick={() => setMode('swarm')} className={`mt-2 w-full p-2 rounded flex items-center justify-center gap-2 transition ${mode==='swarm'?'bg-purple-600':'bg-gray-700 hover:bg-gray-600'}`}><Cpu size={16}/> Modo Swarm</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
            <div className="text-xs text-gray-500 mb-2 px-2">HISTÓRICO</div>
            {chats.map(chat => (
                <div key={chat._id} onClick={() => selectChat(chat._id)} className={`group p-3 rounded mb-1 cursor-pointer flex justify-between items-center ${activeChatId === chat._id ? 'bg-gray-700' : 'hover:bg-gray-750'}`}>
                    {editingChatId === chat._id ? (
                        <div className="flex gap-1 w-full" onClick={e=>e.stopPropagation()}><input className="bg-black text-xs w-full p-1 rounded" autoFocus value={editTitle} onChange={e=>setEditTitle(e.target.value)} /><button onClick={saveRename} className="text-green-400"><Check size={14}/></button></div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 overflow-hidden"><MessageSquare size={14} className="text-gray-400 shrink-0"/><span className="text-sm truncate">{chat.title}</span></div>
                            <div className="hidden group-hover:flex gap-1"><button onClick={(e)=>{e.stopPropagation();setEditingChatId(chat._id);setEditTitle(chat.title)}} className="text-gray-400 hover:text-white"><Edit2 size={12}/></button><button onClick={(e)=>deleteChat(e, chat._id)} className="text-gray-400 hover:text-red-400"><Trash2 size={12}/></button></div>
                        </>
                    )}
                </div>
            ))}
        </div>
        <div className="p-4 border-t border-gray-700">
            {user.role === 'admin' && <a href="/admin" className="flex items-center gap-2 text-yellow-500 mb-3"><Settings size={16}/> Admin</a>}
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="flex items-center gap-2 text-red-400"><LogOut size={16}/> Sair</button>
        </div>
      </div>
      <div className="flex-1 flex flex-col relative h-full">
        <div className="md:hidden bg-gray-800 p-3 flex justify-between items-center border-b border-gray-700"><button onClick={createNewChat}><Plus/></button><span className="font-bold">Gemini V3</span><button onClick={() => setMode('swarm')}><Cpu/></button></div>
        <div className="bg-gray-800 border-b border-gray-700 p-2 flex justify-between items-center text-xs">
            <div className="flex gap-4"><span className="text-gray-400">Modelo: {models.find(m=>m.id===selectedModel)?.name || selectedModel}</span>{mode === 'swarm' && <span className="text-purple-400 font-bold">SWARM</span>}</div>
            <button onClick={() => setShowConfig(!showConfig)} className="flex items-center gap-1 hover:text-blue-400"><Wrench size={14}/> Config</button>
        </div>
        {showConfig && (
            <div className="bg-gray-800 p-4 border-b border-gray-700 grid grid-cols-1 gap-4 absolute w-full z-10 shadow-xl">
                <div><label className="text-xs text-gray-400">MODELO</label><select className="w-full bg-gray-900 p-2 rounded border border-gray-600" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                <div><label className="text-xs text-gray-400">SYSTEM PROMPT</label><input className="w-full bg-gray-900 p-2 rounded border border-gray-600" value={userSystemPrompt} onChange={e => setUserSystemPrompt(e.target.value)} /></div>
            </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && <div className="text-center text-gray-500 mt-20"><h2 className="text-2xl font-bold">{mode==='swarm'?'Swarm':'Novo Chat'}</h2></div>}
          {messages.map((m, i) => (<div key={i} className={`p-3 rounded-lg max-w-4xl shadow ${m.role === 'user' ? 'bg-blue-700 ml-auto' : 'bg-gray-700'}`}><div className="text-[10px] opacity-50 uppercase font-bold mb-1">{m.role}</div><pre className="whitespace-pre-wrap text-sm font-sans">{m.content}</pre></div>))}
          {loading && <div className="text-blue-400 animate-pulse text-center text-sm">IA Processando...</div>}
        </div>
        <div className="p-4 bg-gray-800"><div className="flex gap-2 max-w-5xl mx-auto"><input className="flex-1 bg-gray-900 p-3 rounded-lg border border-gray-600 outline-none" placeholder="Mensagem..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()}/><button onClick={sendMessage} disabled={loading} className="bg-blue-600 px-6 rounded-lg font-bold">Enviar</button></div></div>
      </div>
    </div>
  );
}
