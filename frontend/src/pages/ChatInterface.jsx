import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Cpu, Settings, LogOut, Plus, MessageSquare, Trash2, Edit2, X, Check, 
  Sun, Moon, Menu, User, Key, Palette, Send, Loader2, RefreshCw, Zap,
  Paperclip, Image, File, Wrench, Code, Terminal, Globe, ChevronDown,
  Search, Database, Layers
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

// URL das Azure Functions para operações pesadas (chat com IA)
// Se não configurado, usa o backend normal
const RAW_FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL || '';
const FUNCTIONS_URL = RAW_FUNCTIONS_URL.endsWith('/') ? RAW_FUNCTIONS_URL.slice(0, -1) : RAW_FUNCTIONS_URL;

axios.defaults.timeout = 120000;

export default function ChatInterface({ user, setUser }) {
  // i18n
  const { texts } = useLanguage();
  const t = texts.chat;
  const tUser = texts.userSettings;
  
  // Estados principais
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [swarmEnabled, setSwarmEnabled] = useState(true); // Habilita ferramentas Swarm no chat
  
  // Arquivos anexados
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Ferramentas do usuário
  const [userTools, setUserTools] = useState([]);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  
  // Modelos
  const [models, setModels] = useState([]);
  const [g4fModels, setG4fModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [selectedModels, setSelectedModels] = useState({
    text: "google/gemini-2.0-flash-exp:free",
    image: "",
    audio: "",
    video: ""
  });
  const [activeModelTab, setActiveModelTab] = useState('text');
  const [selectedProvider, setSelectedProvider] = useState("openrouter"); // "openrouter" ou "g4f"
  const [modelSearch, setModelSearch] = useState("");
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
  
  // Mensagem do admin
  const [adminNotification, setAdminNotification] = useState(null);

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
    loadUserTools();
    checkAdminMessage();
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

  const checkAdminMessage = async () => {
    try {
      const res = await axios.get(API_URL + '/user/admin-message', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      if (res.data.hasMessage) {
        setAdminNotification({
          message: res.data.message,
          sentAt: res.data.sentAt
        });
      }
    } catch(e) {
      console.log('Erro ao verificar mensagem do admin');
    }
  };

  const dismissAdminMessage = async () => {
    try {
      await axios.post(API_URL + '/user/admin-message/read', {}, { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setAdminNotification(null);
    } catch(e) {
      setAdminNotification(null);
    }
  };

  const loadUserTools = async () => {
    try {
      const res = await axios.get(API_URL + '/tools', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setUserTools(res.data || []);
    } catch(e) {
      console.log('Erro ao carregar ferramentas');
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      
      const res = await axios.post(API_URL + '/upload', formData, {
        headers: { 
          Authorization: 'Bearer ' + token,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setAttachedFiles(prev => [...prev, ...res.data.files]);
    } catch(err) {
      alert('Erro no upload: ' + (err.response?.data?.error || err.message));
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const deleteTool = async (toolId) => {
    if (!confirm(t.confirmDeleteTool)) return;
    try {
      await axios.delete(API_URL + '/tools/' + toolId, {
        headers: { Authorization: 'Bearer ' + token }
      });
      loadUserTools();
    } catch(err) {
      alert('Erro ao deletar: ' + (err.response?.data?.error || err.message));
    }
  };

  const loadModels = async () => {
    setModelsLoading(true);
    try {
      // Carrega modelos OpenRouter e G4F em paralelo
      const [modelsRes, g4fModelsRes, defaultModelRes] = await Promise.all([
        axios.get(API_URL + '/models'),
        axios.get(API_URL + '/models/g4f').catch(() => ({ data: [] })),
        axios.get(API_URL + '/config/default-model').catch(() => ({ data: {} }))
      ]);
      
      if (modelsRes.data && modelsRes.data.length > 0) {
        setModels(modelsRes.data);
      }
      
      // Carrega modelos G4F
      if (g4fModelsRes.data && g4fModelsRes.data.length > 0) {
        setG4fModels(g4fModelsRes.data);
      }

      // Configura modelos padrão
      const defaults = defaultModelRes.data?.defaultModels || {};
      const legacyDefault = defaultModelRes.data?.defaultModel;
      
      const newSelected = {
        text: defaults.text || legacyDefault || "google/gemini-2.0-flash-exp:free",
        image: defaults.image || "",
        audio: defaults.audio || "",
        video: defaults.video || ""
      };
      
      setSelectedModels(newSelected);

      // Define provider inicial baseado no modelo de texto
      const textModel = newSelected.text;
      if (modelsRes.data && modelsRes.data.find(m => m.id === textModel)) {
        setSelectedProvider('openrouter');
      } else if (g4fModelsRes.data && g4fModelsRes.data.find(m => m.id === textModel)) {
        setSelectedProvider('g4f');
      }

    } catch(e) {
      // Fallback
      setModels([
        {id:"google/gemini-2.0-flash-exp:free", name:"Gemini 2.0 Flash"},
        {id:"meta-llama/llama-3.3-70b-instruct:free", name:"Llama 3.3 70B"},
        {id:"deepseek/deepseek-chat:free", name:"DeepSeek V3"}
      ]);
      setG4fModels([
        {id:"gpt-4", name:"GPT-4", provider:"g4f"},
        {id:"gpt-3.5-turbo", name:"GPT-3.5 Turbo", provider:"g4f"},
        {id:"claude-3-opus", name:"Claude 3 Opus", provider:"g4f"}
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
    setShowSidebar(false);
    try {
      const res = await axios.get(API_URL + '/chats/' + id, { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setMessages(res.data.messages || []);
      if (res.data.model) {
        setSelectedModels(prev => ({ ...prev, text: res.data.model }));
      }
      setUserSystemPrompt(res.data.userSystemPrompt || "");
    } catch(e) {
      alert('Erro ao carregar chat');
    }
    setLoading(false);
  };

  const createNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setShowSidebar(false);
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    if (!confirm(t.deleteChat)) return;
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
    if (!input.trim() && attachedFiles.length === 0) return;
    let currentChatId = activeChatId;

    if (!currentChatId) {
      try {
        const res = await axios.post(API_URL + '/chats', { 
          model: selectedModels.text, 
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

    // Monta o conteúdo da mensagem incluindo arquivos
    let messageContent = input;
    if (attachedFiles.length > 0) {
      const fileDescriptions = attachedFiles.map(f => {
        if (f.type === 'image') {
          return `[Imagem anexada: ${f.name}]`;
        } else if (f.content) {
          return `[Arquivo: ${f.name}]\n\`\`\`\n${f.content.substring(0, 50000)}\n\`\`\``;
        } else {
          return `[Arquivo anexado: ${f.name} (${f.mimeType})]`;
        }
      }).join('\n\n');
      
      messageContent = attachedFiles.length > 0 && input 
        ? `${input}\n\n${fileDescriptions}`
        : fileDescriptions;
    }

    const newMsg = { 
      role: 'user', 
      content: messageContent,
      attachments: attachedFiles.length > 0 ? attachedFiles : undefined
    };
    const newMsgs = [...messages, newMsg];
    setMessages(newMsgs);
    setInput('');
    setAttachedFiles([]);
    setLoading(true);

    try {
      // Usa o endpoint com suporte a ferramentas Swarm
      const endpoint = swarmEnabled ? '/chat/tools' : '/chat';
      const payload = { 
        chatId: currentChatId, 
        messages: newMsgs.map(m => ({ role: m.role, content: m.content })), 
        model: selectedModels.text,
        models: selectedModels,
        provider: selectedProvider,
        userSystemPrompt,
        enableSwarm: swarmEnabled
      };

      // Usa Azure Functions se configurado (mais escalável)
      // Senão usa o backend normal
      const baseUrl = FUNCTIONS_URL || API_URL;
      
      const res = await axios.post(baseUrl + endpoint, payload, {
        headers: { Authorization: 'Bearer ' + token },
        timeout: 300000 // 5 minutos para ferramentas complexas
      });

      const reply = {
        role: 'assistant',
        content: res.data.content,
        provider: selectedProvider,
        ...(res.data.swarm_used && { swarm_used: true, swarm_iterations: res.data.swarm_iterations })
      };

      setMessages([...newMsgs, reply]);
      loadChats();
      loadUserTools(); // Recarrega ferramentas caso alguma tenha sido criada
    } catch(err) {
      let errorMsg = err.code === 'ECONNABORTED' 
        ? t.timeout
        : err.response?.data?.error || err.message;
      setMessages([...newMsgs, { role: 'assistant', content: `❌ ${t.error}: ${errorMsg}` }]);
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
      {/* Notificação do Admin */}
      {adminNotification && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[100]">
          <div className={`${bgSidebar} rounded-xl shadow-2xl w-full max-w-md animate-fade-in`}>
            <div className={`p-4 border-b ${borderColor} flex items-center gap-3`}>
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User size={20} className="text-white"/>
              </div>
              <div>
                <h2 className="font-bold text-lg">{t.adminMessage}</h2>
                <p className={`text-xs ${textMuted}`}>
                  {adminNotification.sentAt && new Date(adminNotification.sentAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="p-6">
              <div className={`${isDark ? 'bg-blue-900/30 border-blue-600/50' : 'bg-blue-50 border-blue-200'} border p-4 rounded-lg`}>
                <p className="whitespace-pre-wrap">{adminNotification.message}</p>
              </div>
            </div>
            <div className={`p-4 border-t ${borderColor}`}>
              <button 
                onClick={dismissAdminMessage}
                className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded-lg transition font-medium"
              >
                {t.understood}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <Plus size={18}/> {t.newChat}
          </button>
          <button 
            onClick={() => { setSwarmEnabled(!swarmEnabled); setShowSidebar(false); }}
            className={`mt-2 w-full p-3 rounded-lg flex items-center justify-center gap-2 transition font-medium ${
              swarmEnabled ? 'bg-purple-600 hover:bg-purple-500' : (isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300')
            }`}
            title={swarmEnabled ? t.swarmDesc : ""}
          >
            <Zap size={18}/> {swarmEnabled ? t.swarmOn : t.swarmOff}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className={`text-xs ${textMuted} mb-2 px-2 uppercase tracking-wide`}>{t.history}</div>
          {chats.length === 0 && <div className={`text-sm ${textMuted} px-2`}>{t.noChats}</div>}
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
              <Settings size={18}/> {t.adminPanel}
            </a>
          )}
          
          {/* Botão de Doação PayPal */}
          <div className="flex justify-center py-2">
            <form action="https://www.paypal.com/donate" method="post" target="_blank">
              <input type="hidden" name="business" value="FPWQ5HGBR38SG" />
              <input type="hidden" name="no_recurring" value="0" />
              <input type="hidden" name="currency_code" value="USD" />
              <input 
                type="image" 
                src="https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif" 
                name="submit" 
                title="PayPal - The safer, easier way to pay online!" 
                alt={t.donate}
                className="cursor-pointer hover:opacity-80 transition"
              />
            </form>
          </div>
          
          <button onClick={() => setShowSettings(true)} className={`flex items-center gap-2 ${textMuted} hover:${textMain} transition w-full`}>
            <User size={18}/> {t.accountSettings}
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition w-full">
            <LogOut size={18}/> {texts.logout}
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
          <span className="font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">jgspAI</span>
          <button onClick={() => setShowChatConfig(true)} className="p-2">
            <Settings size={24}/>
          </button>
        </div>

        {/* Header Desktop */}
        <div className={`hidden md:flex ${bgCard} ${borderColor} border-b p-3 justify-between items-center`}>
          <div className="flex items-center gap-4">
            <span className={textMuted}>
              <span className={`text-xs uppercase ${selectedProvider === 'g4f' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                {selectedProvider === 'g4f' ? 'GPT4Free' : 'OpenRouter'}
              </span>
              {' • '}
              <span className={textMain}>
                {selectedProvider === 'openrouter' 
                  ? models.find(m => m.id === selectedModels.text)?.name || selectedModels.text
                  : g4fModels.find(m => m.id === selectedModels.text)?.name || selectedModels.text
                }
              </span>
            </span>
            {swarmEnabled && (
              <span className="text-purple-400 font-bold flex items-center gap-1" title={
                selectedProvider === 'g4f' 
                  ? t.swarmDescG4f 
                  : t.swarmDesc
              }>
                <Zap size={14}/> {t.swarmActive}
              </span>
            )}
          </div>
          <button onClick={() => setShowChatConfig(true)} className={`flex items-center gap-2 ${textMuted} hover:text-indigo-400 transition`}>
            <Settings size={16}/> {t.configChat}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className={`text-center ${textMuted} mt-20`}>
              <h2 className="text-3xl font-bold mb-2">{t.newChatWelcome}</h2>
              <p className="text-sm mb-4">{t.newChatHint}</p>
              {swarmEnabled && (
                <div className={`${bgCard} p-4 rounded-xl max-w-lg mx-auto text-left ${borderColor} border`}>
                  <div className="flex items-center gap-2 mb-2 text-purple-400">
                    <Zap size={18}/> <span className="font-bold">{t.modeSwarmActive}</span>
                  </div>
                  <p className="text-xs opacity-80">
                    {selectedProvider === 'g4f' 
                      ? t.swarmDescG4f
                      : t.swarmDesc
                    }
                  </p>
                </div>
              )}
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
              <div className="flex items-center gap-2 text-xs opacity-60 uppercase font-bold mb-2">
                <span>{m.role === 'user' ? (displayName || user?.username || t.you) : t.assistant}</span>
                {m.swarm_used && (
                  <span className="text-purple-400 normal-case flex items-center gap-1">
                    <Zap size={12}/> {t.swarmIterations} ({m.swarm_iterations}x)
                  </span>
                )}
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-code:bg-gray-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-pink-400 prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700 prose-a:text-blue-400 prose-strong:text-purple-400">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center justify-center gap-2 text-blue-400">
              <Loader2 className="animate-spin" size={20}/>
              <span>{swarmEnabled ? t.thinkingSwarm : t.thinking}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`p-4 ${bgCard} ${borderColor} border-t`}>
          {/* Arquivos anexados */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 max-w-4xl mx-auto">
              {attachedFiles.map((file, i) => (
                <div key={i} className={`${bgInput} ${borderColor} border rounded-lg p-2 flex items-center gap-2 text-sm`}>
                  {file.type === 'image' ? <Image size={16} className="text-green-400"/> : <File size={16} className="text-blue-400"/>}
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button onClick={() => removeAttachment(i)} className="text-red-400 hover:text-red-300">
                    <X size={14}/>
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-2 max-w-4xl mx-auto">
            {/* Botão de anexar */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,.txt,.md,.js,.jsx,.ts,.tsx,.py,.json,.csv,.html,.css,.xml,.yaml,.yml,.pdf"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || uploading}
              className={`${bgInput} ${borderColor} border p-4 rounded-xl hover:border-blue-500 transition disabled:opacity-50`}
              title="Anexar arquivos"
            >
              {uploading ? <Loader2 className="animate-spin" size={18}/> : <Paperclip size={18}/>}
            </button>
            
            {/* Botão de ferramentas */}
            <button
              onClick={() => setShowToolsPanel(true)}
              className={`${bgInput} ${borderColor} border p-4 rounded-xl hover:border-purple-500 transition relative`}
              title="Minhas Ferramentas"
            >
              <Wrench size={18}/>
              {userTools.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {userTools.length}
                </span>
              )}
            </button>
            
            <input
              className={`flex-1 ${bgInput} p-4 rounded-xl ${borderColor} border outline-none focus:border-blue-500 transition`}
              placeholder={t.placeholder}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button 
              onClick={sendMessage} 
              disabled={loading || (!input.trim() && attachedFiles.length === 0)}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 rounded-xl font-medium transition flex items-center gap-2"
            >
              <Send size={18}/>
              <span className="hidden sm:inline">{t.send}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Ferramentas do Usuário */}
      {showToolsPanel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowToolsPanel(false)}>
          <div className={`${bgCard} rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className={`p-4 ${borderColor} border-b flex justify-between items-center`}>
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Wrench className="text-purple-400"/> {t.myTools} ({userTools.length})
              </h2>
              <button onClick={() => setShowToolsPanel(false)} className={textMuted}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6">
              {userTools.length === 0 ? (
                <div className={`text-center ${textMuted} py-8`}>
                  <Wrench size={48} className="mx-auto mb-4 opacity-50"/>
                  <p>{t.noTools}</p>
                  <p className="text-sm mt-2">{t.noToolsHint}</p>
                  <p className="text-xs mt-4 opacity-70">{t.noToolsExample}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userTools.map(tool => (
                    <div key={tool._id} className={`${bgInput} ${borderColor} border rounded-xl p-4`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-purple-400">{tool.name}</h3>
                          <p className={`text-sm ${textMuted}`}>{tool.description}</p>
                        </div>
                        <button 
                          onClick={() => deleteTool(tool._id)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                      <div className="flex items-center gap-4 text-xs mt-3">
                        <span className={textMuted}>{t.toolUsage}: {tool.executionCount || 0}</span>
                        {tool.lastExecuted && (
                          <span className={textMuted}>
                            {t.toolLastUsed}: {new Date(tool.lastExecuted).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <details className="mt-3">
                        <summary className={`text-xs ${textMuted} cursor-pointer hover:text-blue-400`}>
                          {t.viewCode}
                        </summary>
                        <pre className={`mt-2 ${bgCard} p-3 rounded-lg text-xs overflow-auto max-h-32 text-green-400`}>
                          {tool.code}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Config Chat */}
      {showChatConfig && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowChatConfig(false)}>
          <div className={`${bgCard} rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className={`p-4 ${borderColor} border-b flex justify-between items-center`}>
              <h2 className="font-bold text-lg">{t.settings}</h2>
              <button onClick={() => setShowChatConfig(false)} className={textMuted}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Tabs */}
              <div className={`flex ${borderColor} border-b`}>
                {['text', 'image', 'audio', 'video'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveModelTab(tab)}
                    className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${
                      activeModelTab === tab 
                        ? 'border-indigo-500 text-indigo-400' 
                        : 'border-transparent ' + textMuted + ' hover:' + textMain
                    }`}
                  >
                    {tab === 'text' && texts.admin.modelsModal.text}
                    {tab === 'image' && texts.admin.modelsModal.image}
                    {tab === 'audio' && texts.admin.modelsModal.audio}
                    {tab === 'video' && texts.admin.modelsModal.video}
                  </button>
                ))}
              </div>

              {/* Seletor de Provider */}
              <div>
                <label className={`text-sm ${textMuted} flex items-center gap-2 mb-2`}>
                  <Layers size={16}/> {t.providerAI}
                </label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setSelectedProvider('openrouter');
                    }}
                    className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 transition ${
                      selectedProvider === 'openrouter' ? 'bg-indigo-600 text-white' : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200')
                    }`}
                  >
                    <Database size={18}/> OpenRouter
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedProvider('g4f');
                    }}
                    className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 transition ${
                      selectedProvider === 'g4f' ? 'bg-emerald-600 text-white' : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200')
                    }`}
                  >
                    <Zap size={18}/> GPT4Free
                  </button>
                </div>
              </div>

              {/* Seletor de Modelo com Pesquisa */}
              <div>
                <label className={`text-sm ${textMuted} block mb-2`}>
                  {t.model} - {activeModelTab === 'text' ? t.textModel : 
                               activeModelTab === 'image' ? t.imageModel : 
                               activeModelTab === 'audio' ? t.audioModel : t.videoModel}
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500"/>
                  <input
                    type="text"
                    placeholder={t.searchModels}
                    value={modelSearch}
                    onChange={e => setModelSearch(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 ${bgInput} ${borderColor} border rounded-lg text-sm focus:outline-none focus:border-indigo-500`}
                  />
                </div>
                <div className={`${bgInput} ${borderColor} border rounded-lg max-h-48 overflow-y-auto`}>
                  {selectedProvider === 'openrouter' ? (
                    models
                      .filter(m => {
                        if (activeModelTab === 'text') return !m.type || m.type === 'chat';
                        return m.type === activeModelTab;
                      })
                      .filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase()))
                      .map(m => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModels(prev => ({ ...prev, [activeModelTab]: m.id }))}
                          className={`w-full text-left px-3 py-2 text-sm transition flex items-center gap-2 ${
                            selectedModels[activeModelTab] === m.id 
                              ? 'bg-indigo-600 text-white' 
                              : 'hover:bg-indigo-500/20'
                          }`}
                        >
                          <Database size={14} className={selectedModels[activeModelTab] === m.id ? 'text-white' : 'text-indigo-400'}/>
                          <span className="truncate">{m.name}</span>
                        </button>
                      ))
                  ) : (
                    g4fModels
                      .filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase()))
                      .map(m => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModels(prev => ({ ...prev, [activeModelTab]: m.id }))}
                          className={`w-full text-left px-3 py-2 text-sm transition flex items-center gap-2 ${
                            selectedModels[activeModelTab] === m.id 
                              ? 'bg-emerald-600 text-white' 
                              : 'hover:bg-emerald-500/20'
                          }`}
                        >
                          <Zap size={14} className={selectedModels[activeModelTab] === m.id ? 'text-white' : 'text-emerald-400'}/>
                          <span className="truncate">{m.name}</span>
                          {m.provider && <span className={`text-xs ${selectedModels[activeModelTab] === m.id ? 'text-emerald-200' : 'text-gray-500'}`}>({m.provider})</span>}
                        </button>
                      ))
                  )}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className={`text-xs ${textMuted}`}>
                    {selectedProvider === 'openrouter' 
                      ? models.filter(m => {
                          if (activeModelTab === 'text') return !m.type || m.type === 'chat';
                          return m.type === activeModelTab;
                        }).length 
                      : g4fModels.length} {t.modelsAvailable}
                  </p>
                  <button onClick={loadModels} className={`p-1 ${textMuted} hover:text-indigo-400`} title={t.refreshModels}>
                    <RefreshCw size={14} className={modelsLoading ? 'animate-spin' : ''}/>
                  </button>
                </div>
              </div>

              <div>
                <label className={`text-sm ${textMuted} block mb-2`}>{t.systemPrompt}</label>
                <textarea
                  className={`w-full ${bgInput} p-3 rounded-lg ${borderColor} border min-h-[100px]`}
                  placeholder={t.systemPromptPlaceholder}
                  value={userSystemPrompt}
                  onChange={e => setUserSystemPrompt(e.target.value)}
                />
              </div>
            </div>
            <div className={`p-4 ${borderColor} border-t`}>
              <button onClick={() => setShowChatConfig(false)} className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 p-3 rounded-lg font-medium transition">
                {t.apply}
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
              <h2 className="font-bold text-lg">{tUser.title}</h2>
              <button onClick={() => setShowSettings(false)} className={textMuted}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Tema */}
              <div>
                <label className={`text-sm ${textMuted} flex items-center gap-2 mb-2`}>
                  <Palette size={16}/> {tUser.theme}
                </label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setTheme('dark')}
                    className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 transition ${
                      theme === 'dark' ? 'bg-blue-600 text-white' : (isDark ? 'bg-gray-700' : 'bg-gray-200')
                    }`}
                  >
                    <Moon size={18}/> {tUser.themeDark}
                  </button>
                  <button 
                    onClick={() => setTheme('light')}
                    className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 transition ${
                      theme === 'light' ? 'bg-blue-600 text-white' : (isDark ? 'bg-gray-700' : 'bg-gray-200')
                    }`}
                  >
                    <Sun size={18}/> {tUser.themeLight}
                  </button>
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className={`text-sm ${textMuted} flex items-center gap-2 mb-2`}>
                  <User size={16}/> {tUser.displayName}
                </label>
                <input
                  className={`w-full ${bgInput} p-3 rounded-lg ${borderColor} border`}
                  placeholder={tUser.displayName}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>

              {/* Bio */}
              <div>
                <label className={`text-sm ${textMuted} block mb-2`}>{tUser.bio}</label>
                <textarea
                  className={`w-full ${bgInput} p-3 rounded-lg ${borderColor} border min-h-[80px]`}
                  placeholder={tUser.bioPlaceholder}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                />
                <p className={`text-xs ${textMuted} mt-1`}>{tUser.apiKeyInfo}</p>
              </div>

              {/* API Key */}
              <div>
                <label className={`text-sm ${textMuted} flex items-center gap-2 mb-2`}>
                  <Key size={16}/> {tUser.personalApiKey}
                </label>
                <input
                  type="password"
                  className={`w-full ${bgInput} p-3 rounded-lg ${borderColor} border`}
                  placeholder={hasPersonalKey ? "••••••••••••" : tUser.apiKeyPlaceholder}
                  value={personalApiKey}
                  onChange={e => setPersonalApiKey(e.target.value)}
                />
                {hasPersonalKey && (
                  <p className={`text-xs text-green-500 mt-1`}>✓ {tUser.apiKeyInfo}</p>
                )}
              </div>
            </div>
            <div className={`p-4 ${borderColor} border-t`}>
              <button onClick={saveSettings} className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded-lg font-medium transition">
                {tUser.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
