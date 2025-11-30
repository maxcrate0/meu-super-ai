import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Cpu, Settings, LogOut, Plus, MessageSquare, Trash2, Edit2, X, Check, 
  Sun, Moon, Menu, User, Key, Palette, Send, Loader2, RefreshCw
} from 'lucide-react';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

axios.defaults.timeout = 120000;

export default function ChatInterface({ user, setUser }) {
  // Estados principais
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('chat');
  
  // Modelos
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.0-flash-exp:free");
  const [userSystemPrompt, setUserSystemPrompt] = useState("");
  
  // UI States
  const [showChatConfig, setShowChatConfig] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  
  // Tema e configurações do usuário
  const [theme, setTheme] = useState(user?.theme || 'dark');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [personalApiKey, setPersonalApiKey] = useState('');
  const [hasPersonalKey, setHasPersonalKey] = useState(user?.hasPersonalKey || false);

  const token = localStorage.getItem('token');
  const messagesEndRef = useRef(null);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Carregar dados iniciais
  useEffect(() => {
    loadChats();
    loadModels();
    loadProfile();
  }, []);

  // Aplicar tema
  useEffect(() => {
    document.documentElement.classList.toggle('light-theme', theme === 'light');
  }, [theme]);

  const loadProfile = async () => {
    try {
      const res = await axios.get(API_URL + '/user/profile', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setDisplayName(res.data.displayName || '');
      setBio(res.data.bio || '');
      setTheme(res.data.theme || 'dark');
      setHasPersonalKey(res.data.hasPersonalKey || false);
    } catch(e) {
      console.log('Erro ao carregar perfil');
    }
  };

  const loadModels = async () => {
    setModelsLoading(true);
    try {
      const res = await axios.get(API_URL + '/models');
      if (res.data && res.data.length > 0) {
        setModels(res.data);
        if (!res.data.find(m => m.id === selectedModel)) {
          setSelectedModel(res.data[0].id);
        }
      }
    } catch(e) {
      // Fallback
      setModels([
        {id:"google/gemini-2.0-flash-exp:free", name:"Gemini 2.0 Flash"},
        {id:"meta-llama/llama-3.3-70b-instruct:free", name:"Llama 3.3 70B"},
        {id:"deepseek/deepseek-chat:free", name:"DeepSeek V3"}
      ]);
    }
    setModelsLoading(false);
  };

  const loadChats = async () => {
    try {
      const res = await axios.get(API_URL + '/chats', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setChats(res.data || []);
    } catch(e) {
      console.error('Erro ao carregar chats');
    }
  };

  const selectChat = async (id) => {
    setLoading(true);
    setActiveChatId(id);
    setMode('chat');
    setShowSidebar(false);
    try {
      const res = await axios.get(API_URL + '/chats/' + id, { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setMessages(res.data.messages || []);
      if (res.data.model) setSelectedModel(res.data.model);
      setUserSystemPrompt(res.data.userSystemPrompt || "");
    } catch(e) {
      alert('Erro ao carregar chat');
    }
    setLoading(false);
  };

  const createNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setMode('chat');
    setShowSidebar(false);
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Apagar este chat?")) return;
    await axios.delete(API_URL + '/chats/' + id, { 
      headers: { Authorization: 'Bearer ' + token } 
    });
    loadChats();
    if (activeChatId === id) createNewChat();
  };

  const saveRename = async () => {
    await axios.patch(API_URL + '/chats/' + editingChatId, { title: editTitle }, { 
      headers: { Authorization: 'Bearer ' + token } 
    });
    setEditingChatId(null);
    loadChats();
  };

  const saveSettings = async () => {
    try {
      const updates = { displayName, bio, theme };
      if (personalApiKey) updates.personal_api_key = personalApiKey;
      
      await axios.patch(API_URL + '/user/profile', updates, {
        headers: { Authorization: 'Bearer ' + token }
      });
      
      // Atualiza o user no localStorage
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.theme = theme;
      storedUser.displayName = displayName;
      localStorage.setItem('user', JSON.stringify(storedUser));
      
      if (personalApiKey) {
        setHasPersonalKey(true);
        setPersonalApiKey('');
      }
      
      alert('Configurações salvas!');
      setShowSettings(false);
    } catch(e) {
      alert('Erro ao salvar: ' + (e.response?.data?.error || e.message));
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    let currentChatId = activeChatId;

    if (!currentChatId && mode === 'chat') {
      try {
        const res = await axios.post(API_URL + '/chats', { 
          model: selectedModel, 
          systemPrompt: userSystemPrompt 
        }, { 
          headers: { Authorization: 'Bearer ' + token } 
        });
        if (!res.data?._id) throw new Error('Resposta inválida');
        currentChatId = res.data._id;
        setActiveChatId(currentChatId);
        loadChats();
      } catch(e) {
        return alert("Erro ao criar chat: " + (e.response?.data?.error || e.message));
      }
    }

    const newMsgs = [...messages, { role: 'user', content: input }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const endpoint = mode === 'swarm' ? '/swarm' : '/chat';
      const payload = mode === 'swarm' 
        ? { task: input, model: selectedModel }
        : { chatId: currentChatId, messages: newMsgs, model: selectedModel, userSystemPrompt };

      const res = await axios.post(API_URL + endpoint, payload, {
        headers: { Authorization: 'Bearer ' + token },
        timeout: 120000
      });

      const reply = mode === 'swarm' 
        ? { role: 'assistant', content: '🐝 [SWARM]\n\n' + res.data.content }
        : res.data;

      setMessages([...newMsgs, reply]);
      if (mode === 'chat') loadChats();
    } catch(err) {
      let errorMsg = err.code === 'ECONNABORTED' 
        ? "Timeout - A IA demorou muito para responder."
        : err.response?.data?.error || err.message;
      setMessages([...newMsgs, { role: 'assistant', content: `❌ ERRO: ${errorMsg}` }]);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };

  // Classes baseadas no tema
  const isDark = theme === 'dark';
  const bgMain = isDark ? 'bg-gray-900' : 'bg-gray-100';
  const bgSidebar = isDark ? 'bg-gray-800' : 'bg-white';
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const bgInput = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className={`flex h-screen ${bgMain} ${textMain} font-sans`}>
      {/* Overlay para mobile */}
      {showSidebar && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setShowSidebar(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative z-50 w-72 h-full ${bgSidebar} flex flex-col ${borderColor} border-r
        transform transition-transform duration-300 ease-in-out
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className={`p-4 ${borderColor} border-b`}>
          <button onClick={createNewChat} className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded-lg flex items-center justify-center gap-2 transition font-medium">
            <Plus size={18}/> Novo Chat
          </button>
          <button 
            onClick={() => { setMode(mode === 'swarm' ? 'chat' : 'swarm'); setShowSidebar(false); }}
            className={`mt-2 w-full p-3 rounded-lg flex items-center justify-center gap-2 transition font-medium ${
              mode === 'swarm' ? 'bg-purple-600 hover:bg-purple-500' : (isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300')
            }`}
          >
            <Cpu size={18}/> Modo Swarm
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className={`text-xs ${textMuted} mb-2 px-2 uppercase tracking-wide`}>Histórico</div>
          {chats.length === 0 && <div className={`text-sm ${textMuted} px-2`}>Nenhum chat ainda</div>}
          {chats.map(chat => (
            <div 
              key={chat._id} 
              onClick={() => selectChat(chat._id)} 
              className={`group p-3 rounded-lg mb-1 cursor-pointer flex justify-between items-center transition ${
                activeChatId === chat._id 
                  ? (isDark ? 'bg-gray-700' : 'bg-blue-50') 
                  : (isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-100')
              }`}
            >
              {editingChatId === chat._id ? (
                <div className="flex gap-2 w-full" onClick={e => e.stopPropagation()}>
                  <input 
                    className={`${bgInput} text-sm w-full p-2 rounded ${borderColor} border`}
                    autoFocus 
                    value={editTitle} 
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveRename()}
                  />
                  <button onClick={saveRename} className="text-green-500 hover:text-green-400">
                    <Check size={18}/>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <MessageSquare size={16} className={textMuted + ' shrink-0'}/>
                    <span className="text-sm truncate">{chat.title}</span>
                  </div>
                  <div className="hidden group-hover:flex gap-1">
                    <button onClick={e => { e.stopPropagation(); setEditingChatId(chat._id); setEditTitle(chat.title); }} className={`${textMuted} hover:text-blue-400`}>
                      <Edit2 size={14}/>
                    </button>
                    <button onClick={e => deleteChat(e, chat._id)} className={`${textMuted} hover:text-red-400`}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className={`p-4 ${borderColor} border-t space-y-2`}>
          {user?.role === 'admin' && (
            <a href="/admin" className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 transition">
              <Settings size={18}/> Painel Admin
            </a>
          )}
          <button onClick={() => setShowSettings(true)} className={`flex items-center gap-2 ${textMuted} hover:${textMain} transition w-full`}>
            <User size={18}/> Configurações
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition w-full">
            <LogOut size={18}/> Sair
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header Mobile */}
        <div className={`md:hidden ${bgCard} p-3 flex justify-between items-center ${borderColor} border-b`}>
          <button onClick={() => setShowSidebar(true)} className="p-2">
            <Menu size={24}/>
          </button>
          <span className="font-bold">Meu Super AI</span>
          <button onClick={() => setShowChatConfig(true)} className="p-2">
            <Settings size={24}/>
          </button>
        </div>

        {/* Header Desktop */}
        <div className={`hidden md:flex ${bgCard} ${borderColor} border-b p-3 justify-between items-center`}>
          <div className="flex items-center gap-4">
            <span className={textMuted}>
              Modelo: <span className={textMain}>{models.find(m => m.id === selectedModel)?.name || selectedModel}</span>
            </span>
            {mode === 'swarm' && <span className="text-purple-400 font-bold flex items-center gap-1"><Cpu size={14}/> SWARM</span>}
          </div>
          <button onClick={() => setShowChatConfig(true)} className={`flex items-center gap-2 ${textMuted} hover:text-blue-400 transition`}>
            <Settings size={16}/> Config Chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className={`text-center ${textMuted} mt-20`}>
              <h2 className="text-3xl font-bold mb-2">{mode === 'swarm' ? '🐝 Modo Swarm' : '💬 Novo Chat'}</h2>
              <p className="text-sm">Envie uma mensagem para começar</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div 
              key={i} 
              className={`p-4 rounded-xl max-w-3xl shadow-lg ${
                m.role === 'user' 
                  ? 'bg-blue-600 text-white ml-auto' 
                  : (isDark ? 'bg-gray-800' : 'bg-white border')
              }`}
            >
              <div className="text-xs opacity-60 uppercase font-bold mb-2">
                {m.role === 'user' ? (displayName || user?.username || 'Você') : 'Assistente'}
              </div>
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{m.content}</pre>
            </div>
          ))}
          {loading && (
            <div className="flex items-center justify-center gap-2 text-blue-400">
              <Loader2 className="animate-spin" size={20}/>
              <span>Processando...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`p-4 ${bgCard} ${borderColor} border-t`}>
          <div className="flex gap-2 max-w-4xl mx-auto">
            <input
              className={`flex-1 ${bgInput} p-4 rounded-xl ${borderColor} border outline-none focus:border-blue-500 transition`}
              placeholder={mode === 'swarm' ? "Descreva sua tarefa..." : "Digite sua mensagem..."}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button 
              onClick={sendMessage} 
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 rounded-xl font-medium transition flex items-center gap-2"
            >
              <Send size={18}/>
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Config Chat */}
      {showChatConfig && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowChatConfig(false)}>
          <div className={`${bgCard} rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className={`p-4 ${borderColor} border-b flex justify-between items-center`}>
              <h2 className="font-bold text-lg">Configurações do Chat</h2>
              <button onClick={() => setShowChatConfig(false)} className={textMuted}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className={`text-sm ${textMuted} block mb-2`}>Modelo de IA</label>
                <div className="flex gap-2">
                  <select 
                    className={`flex-1 ${bgInput} p-3 rounded-lg ${borderColor} border`}
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <button onClick={loadModels} className={`p-3 ${bgInput} rounded-lg ${borderColor} border`} title="Atualizar modelos">
                    <RefreshCw size={18} className={modelsLoading ? 'animate-spin' : ''}/>
                  </button>
                </div>
                <p className={`text-xs ${textMuted} mt-1`}>{models.length} modelos gratuitos disponíveis</p>
              </div>
              <div>
                <label className={`text-sm ${textMuted} block mb-2`}>System Prompt</label>
                <textarea
                  className={`w-full ${bgInput} p-3 rounded-lg ${borderColor} border min-h-[100px]`}
                  placeholder="Instruções personalizadas para a IA..."
                  value={userSystemPrompt}
                  onChange={e => setUserSystemPrompt(e.target.value)}
                />
              </div>
            </div>
            <div className={`p-4 ${borderColor} border-t`}>
              <button onClick={() => setShowChatConfig(false)} className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded-lg font-medium transition">
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configurações Gerais */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowSettings(false)}>
          <div className={`${bgCard} rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className={`p-4 ${borderColor} border-b flex justify-between items-center`}>
              <h2 className="font-bold text-lg">Configurações da Conta</h2>
              <button onClick={() => setShowSettings(false)} className={textMuted}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Tema */}
              <div>
                <label className={`text-sm ${textMuted} flex items-center gap-2 mb-2`}>
                  <Palette size={16}/> Tema
                </label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setTheme('dark')}
                    className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 transition ${
                      theme === 'dark' ? 'bg-blue-600 text-white' : (isDark ? 'bg-gray-700' : 'bg-gray-200')
                    }`}
                  >
                    <Moon size={18}/> Escuro
                  </button>
                  <button 
                    onClick={() => setTheme('light')}
                    className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 transition ${
                      theme === 'light' ? 'bg-blue-600 text-white' : (isDark ? 'bg-gray-700' : 'bg-gray-200')
                    }`}
                  >
                    <Sun size={18}/> Claro
                  </button>
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className={`text-sm ${textMuted} flex items-center gap-2 mb-2`}>
                  <User size={16}/> Nome de Exibição
                </label>
                <input
                  className={`w-full ${bgInput} p-3 rounded-lg ${borderColor} border`}
                  placeholder="Como você quer ser chamado"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>

              {/* Bio */}
              <div>
                <label className={`text-sm ${textMuted} block mb-2`}>Descrição para a IA</label>
                <textarea
                  className={`w-full ${bgInput} p-3 rounded-lg ${borderColor} border min-h-[80px]`}
                  placeholder="Informações sobre você que a IA deve saber..."
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                />
                <p className={`text-xs ${textMuted} mt-1`}>A IA usará isso para personalizar respostas</p>
              </div>

              {/* API Key */}
              <div>
                <label className={`text-sm ${textMuted} flex items-center gap-2 mb-2`}>
                  <Key size={16}/> Chave API Pessoal (OpenRouter)
                </label>
                <input
                  type="password"
                  className={`w-full ${bgInput} p-3 rounded-lg ${borderColor} border`}
                  placeholder={hasPersonalKey ? "••••••••••••" : "sk-or-v1-..."}
                  value={personalApiKey}
                  onChange={e => setPersonalApiKey(e.target.value)}
                />
                {hasPersonalKey && (
                  <p className={`text-xs text-green-500 mt-1`}>✓ Você tem uma chave pessoal configurada</p>
                )}
              </div>
            </div>
            <div className={`p-4 ${borderColor} border-t`}>
              <button onClick={saveSettings} className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded-lg font-medium transition">
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
