import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Settings, LogOut, Plus, MessageSquare, Trash2, Edit2, X, Check, 
  Sun, Moon, Menu, User, Key, Palette, Send, Loader2, RefreshCw, Zap,
  Paperclip, Image, File, Wrench, ChevronDown, ChevronUp,
  Search, Database, Layers, Sparkles, Copy, RotateCcw, PanelLeftClose, PanelLeft
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

const RAW_FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL || '';
const FUNCTIONS_URL = RAW_FUNCTIONS_URL.endsWith('/') ? RAW_FUNCTIONS_URL.slice(0, -1) : RAW_FUNCTIONS_URL;

axios.defaults.timeout = 120000;

export default function ChatInterface({ user, setUser }) {
  const { texts } = useLanguage();
  const t = texts.chat;
  const tUser = texts.userSettings;
  
  // Estados principais
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [swarmEnabled, setSwarmEnabled] = useState(true);
  
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
  const [selectedProvider, setSelectedProvider] = useState("openrouter");
  const [modelSearch, setModelSearch] = useState("");
  const [userSystemPrompt, setUserSystemPrompt] = useState("");
  
  // UI States
  const [showChatConfig, setShowChatConfig] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  
  // Tema e configurações do usuário
  const [theme, setTheme] = useState(user?.theme || 'dark');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [personalApiKey, setPersonalApiKey] = useState('');
  const [hasPersonalKey, setHasPersonalKey] = useState(user?.hasPersonalKey || false);
  
  // Mensagem do admin
  const [adminNotification, setAdminNotification] = useState(null);
  
  // Textarea auto-resize
  const textareaRef = useRef(null);

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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Copiar mensagem para clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Regenerar última resposta
  const regenerateResponse = async () => {
    if (messages.length < 2 || loading) return;
    const lastUserMsgIndex = messages.map((m, i) => ({ ...m, i })).filter(m => m.role === 'user').pop()?.i;
    if (lastUserMsgIndex === undefined) return;
    
    const newMessages = messages.slice(0, lastUserMsgIndex + 1);
    setMessages(newMessages);
    
    // Re-enviar última mensagem do usuário
    const lastUserMsg = newMessages[lastUserMsgIndex];
    setLoading(true);
    
    try {
      const endpoint = swarmEnabled ? '/chat/tools' : '/chat';
      const payload = { 
        chatId: activeChatId, 
        messages: newMessages.map(m => ({ role: m.role, content: m.content })), 
        model: selectedModels.text,
        models: selectedModels,
        provider: selectedProvider,
        userSystemPrompt,
        enableSwarm: swarmEnabled
      };

      const baseUrl = FUNCTIONS_URL || API_URL;
      const res = await axios.post(baseUrl + endpoint, payload, {
        headers: { Authorization: 'Bearer ' + token },
        timeout: 300000
      });

      const reply = {
        role: 'assistant',
        content: res.data.content,
        provider: selectedProvider,
        ...(res.data.swarm_used && { swarm_used: true, swarm_iterations: res.data.swarm_iterations })
      };

      setMessages([...newMessages, reply]);
    } catch(err) {
      let errorMsg = err.code === 'ECONNABORTED' 
        ? t.timeout
        : err.response?.data?.error || err.message;
      setMessages([...newMessages, { role: 'assistant', content: `❌ ${t.error}: ${errorMsg}` }]);
    }
    setLoading(false);
  };

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
  const bgMain = isDark ? 'bg-[#212121]' : 'bg-white';
  const bgSidebar = isDark ? 'bg-[#171717]' : 'bg-gray-50';
  const bgCard = isDark ? 'bg-[#2f2f2f]' : 'bg-gray-100';
  const bgInput = isDark ? 'bg-[#2f2f2f]' : 'bg-gray-100';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-700';
  const borderColor = isDark ? 'border-[#3f3f3f]' : 'border-gray-200';
  const hoverBg = isDark ? 'hover:bg-[#2f2f2f]' : 'hover:bg-gray-200';

  // Nome do modelo atual
  const getCurrentModelName = () => {
    if (selectedProvider === 'openrouter') {
      return models.find(m => m.id === selectedModels.text)?.name || selectedModels.text.split('/').pop();
    } else if (selectedProvider === 'groq') {
      return g4fModels.find(m => m.id === selectedModels.text && m.provider === 'groq')?.name || selectedModels.text;
    } else {
      return g4fModels.find(m => m.id === selectedModels.text)?.name || selectedModels.text;
    }
  };

  return (
    <div className={`flex h-screen ${bgMain} ${textMain} font-sans overflow-hidden`}>
      {/* Notificação do Admin */}
      {adminNotification && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[100]">
          <div className={`${bgCard} rounded-2xl shadow-2xl w-full max-w-md animate-fade-in`}>
            <div className={`p-4 border-b ${borderColor} flex items-center gap-3`}>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <User size={20} className="text-white"/>
              </div>
              <div>
                <h2 className="font-semibold">{t.adminMessage}</h2>
                <p className={`text-xs ${textMuted}`}>
                  {adminNotification.sentAt && new Date(adminNotification.sentAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="p-6">
              <p className="whitespace-pre-wrap">{adminNotification.message}</p>
            </div>
            <div className={`p-4 border-t ${borderColor}`}>
              <button 
                onClick={dismissAdminMessage}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 p-3 rounded-xl transition font-medium"
              >
                {t.understood}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setShowMobileSidebar(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        ${sidebarOpen ? 'w-64' : 'w-0 md:w-0'} 
        ${showMobileSidebar ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
        fixed md:relative z-50 h-full ${bgSidebar} flex flex-col 
        transition-all duration-300 ease-in-out overflow-hidden
      `}>
        {/* Sidebar Header */}
        <div className="p-3 flex flex-col gap-2">
          <button 
            onClick={createNewChat}
            className={`w-full ${hoverBg} p-3 rounded-xl flex items-center gap-3 transition border ${borderColor}`}
          >
            <Plus size={18} className={textMuted}/>
            <span className="text-sm font-medium">{t.newChat}</span>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-2">
          <div className={`text-xs ${textMuted} mb-2 px-2 font-medium`}>{t.history}</div>
          {chats.length === 0 && <div className={`text-xs ${textMuted} px-2`}>{t.noChats}</div>}
          {chats.map(chat => (
            <div 
              key={chat._id} 
              onClick={() => selectChat(chat._id)} 
              className={`group p-3 rounded-xl mb-1 cursor-pointer flex justify-between items-center transition ${
                activeChatId === chat._id 
                  ? bgCard
                  : hoverBg
              }`}
            >
              {editingChatId === chat._id ? (
                <div className="flex gap-2 w-full" onClick={e => e.stopPropagation()}>
                  <input 
                    className={`${bgInput} text-sm w-full p-2 rounded-lg ${borderColor} border focus:outline-none focus:ring-1 focus:ring-blue-500`}
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
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <MessageSquare size={16} className={textMuted + ' shrink-0'}/>
                    <span className="text-sm truncate">{chat.title}</span>
                  </div>
                  <div className="hidden group-hover:flex gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); setEditingChatId(chat._id); setEditTitle(chat.title); }} className={`${textMuted} hover:text-blue-400 p-1`}>
                      <Edit2 size={14}/>
                    </button>
                    <button onClick={e => deleteChat(e, chat._id)} className={`${textMuted} hover:text-red-400 p-1`}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className={`p-3 ${borderColor} border-t space-y-1`}>
          {/* Swarm Toggle */}
          <button 
            onClick={() => setSwarmEnabled(!swarmEnabled)}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition ${
              swarmEnabled ? 'bg-purple-600/20 text-purple-400' : hoverBg + ' ' + textMuted
            }`}
          >
            <Zap size={18}/>
            <span className="text-sm">{swarmEnabled ? t.swarmOn : t.swarmOff}</span>
          </button>
          
          {/* Tools Button */}
          <button 
            onClick={() => setShowToolsPanel(true)}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition ${hoverBg} ${textMuted} hover:${textMain}`}
          >
            <Wrench size={18}/>
            <span className="text-sm flex-1 text-left">{t.myTools}</span>
            {userTools.length > 0 && (
              <span className="bg-purple-600 text-white text-xs rounded-full px-2 py-0.5">
                {userTools.length}
              </span>
            )}
          </button>

          {user?.role === 'admin' && (
            <a href="/admin" className={`flex items-center gap-3 p-3 rounded-xl transition ${hoverBg} text-yellow-500`}>
              <Settings size={18}/> 
              <span className="text-sm">{t.adminPanel}</span>
            </a>
          )}
          
          <button onClick={() => setShowSettings(true)} className={`w-full p-3 rounded-xl flex items-center gap-3 transition ${hoverBg} ${textMuted}`}>
            <User size={18}/>
            <span className="text-sm">{displayName || user?.username}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className={`h-14 flex items-center justify-between px-4 ${borderColor} border-b shrink-0`}>
          <div className="flex items-center gap-2">
            {/* Sidebar Toggle */}
            <button 
              onClick={() => {
                if (window.innerWidth < 768) {
                  setShowMobileSidebar(!showMobileSidebar);
                } else {
                  setSidebarOpen(!sidebarOpen);
                }
              }}
              className={`p-2 rounded-lg transition ${hoverBg} ${textMuted}`}
            >
              {sidebarOpen ? <PanelLeftClose size={20}/> : <PanelLeft size={20}/>}
            </button>

            {/* Model Selector Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition ${hoverBg}`}
              >
                <Sparkles size={16} className="text-purple-400"/>
                <span className="text-sm font-medium max-w-[150px] truncate">{getCurrentModelName()}</span>
                <ChevronDown size={16} className={textMuted}/>
              </button>
              
              {showModelDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowModelDropdown(false)}/>
                  <div className={`absolute left-0 top-full mt-2 w-72 ${bgCard} rounded-2xl shadow-xl border ${borderColor} z-50 overflow-hidden`}>
                    {/* Provider Tabs */}
                    <div className={`flex ${borderColor} border-b p-1`}>
                      {[
                        { id: 'openrouter', label: 'OpenRouter', color: 'indigo' },
                        { id: 'g4f', label: 'GPT4Free', color: 'emerald' },
                        { id: 'groq', label: 'Groq', color: 'orange' }
                      ].map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProvider(p.id)}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition ${
                            selectedProvider === p.id 
                              ? `bg-${p.color}-600 text-white` 
                              : `${textMuted} ${hoverBg}`
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    
                    {/* Search */}
                    <div className="p-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500"/>
                        <input
                          type="text"
                          placeholder={t.searchModels}
                          value={modelSearch}
                          onChange={e => setModelSearch(e.target.value)}
                          className={`w-full pl-9 pr-4 py-2 ${bgInput} rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        />
                      </div>
                    </div>
                    
                    {/* Models List */}
                    <div className="max-h-64 overflow-y-auto p-2">
                      {selectedProvider === 'openrouter' && models
                        .filter(m => !m.type || m.type === 'chat')
                        .filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase()))
                        .map(m => (
                          <button
                            key={m.id}
                            onClick={() => { setSelectedModels(prev => ({ ...prev, text: m.id })); setShowModelDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg transition flex items-center gap-2 ${
                              selectedModels.text === m.id ? 'bg-indigo-600 text-white' : hoverBg
                            }`}
                          >
                            <span className="truncate flex-1">{m.name}</span>
                            {selectedModels.text === m.id && <Check size={14}/>}
                          </button>
                        ))
                      }
                      {selectedProvider === 'g4f' && g4fModels
                        .filter(m => m.provider !== 'groq')
                        .filter(m => !m.type || m.type === 'chat')
                        .filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase()))
                        .map(m => (
                          <button
                            key={m.id}
                            onClick={() => { setSelectedModels(prev => ({ ...prev, text: m.id })); setShowModelDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg transition flex items-center gap-2 ${
                              selectedModels.text === m.id ? 'bg-emerald-600 text-white' : hoverBg
                            }`}
                          >
                            <span className="truncate flex-1">{m.name}</span>
                            {m.provider && <span className={`text-xs ${selectedModels.text === m.id ? 'text-emerald-200' : textMuted}`}>({m.provider})</span>}
                          </button>
                        ))
                      }
                      {selectedProvider === 'groq' && g4fModels
                        .filter(m => m.provider === 'groq')
                        .filter(m => !m.type || m.type === 'chat')
                        .filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase()))
                        .map(m => (
                          <button
                            key={m.id}
                            onClick={() => { setSelectedModels(prev => ({ ...prev, text: m.id })); setShowModelDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg transition flex items-center gap-2 ${
                              selectedModels.text === m.id ? 'bg-orange-600 text-white' : hoverBg
                            }`}
                          >
                            <span className="truncate flex-1">{m.name}</span>
                            {m.speed && <span className={`text-xs ${selectedModels.text === m.id ? 'text-orange-200' : textMuted}`}>({m.speed})</span>}
                          </button>
                        ))
                      }
                    </div>
                    
                    {/* Footer */}
                    <div className={`p-2 ${borderColor} border-t flex justify-between items-center`}>
                      <button 
                        onClick={() => { setShowModelDropdown(false); setShowChatConfig(true); }}
                        className={`text-xs ${textMuted} hover:${textMain} flex items-center gap-1`}
                      >
                        <Settings size={12}/> {t.configChat}
                      </button>
                      <button onClick={loadModels} className={`p-1 ${textMuted} hover:text-blue-400`}>
                        <RefreshCw size={14} className={modelsLoading ? 'animate-spin' : ''}/>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {swarmEnabled && (
              <span className="text-xs text-purple-400 flex items-center gap-1 px-2 py-1 bg-purple-500/10 rounded-lg">
                <Zap size={12}/> AI Tools
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleLogout}
              className={`p-2 rounded-lg transition ${hoverBg} text-red-400`}
            >
              <LogOut size={18}/>
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {messages.length === 0 ? (
              /* Welcome Screen */
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center mb-6">
                  <Sparkles size={32} className="text-white"/>
                </div>
                <h1 className="text-3xl font-semibold mb-2">{t.newChatWelcome}</h1>
                <p className={`${textMuted} mb-8 max-w-md`}>{t.newChatHint}</p>
                
                {swarmEnabled && (
                  <div className={`${bgCard} p-4 rounded-2xl max-w-md text-left border ${borderColor}`}>
                    <div className="flex items-center gap-2 mb-2 text-purple-400">
                      <Zap size={18}/> 
                      <span className="font-medium">{t.modeSwarmActive}</span>
                    </div>
                    <p className={`text-sm ${textMuted}`}>
                      {selectedProvider === 'g4f' ? t.swarmDescG4f : t.swarmDesc}
                    </p>
                  </div>
                )}
                
                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-md">
                  <button 
                    onClick={() => setInput("Explique como funciona a inteligência artificial")}
                    className={`${bgCard} p-4 rounded-xl text-left ${hoverBg} transition border ${borderColor}`}
                  >
                    <span className="text-sm">💡 Explique conceitos</span>
                  </button>
                  <button 
                    onClick={() => setInput("Escreva um código em Python para")}
                    className={`${bgCard} p-4 rounded-xl text-left ${hoverBg} transition border ${borderColor}`}
                  >
                    <span className="text-sm">💻 Escreva código</span>
                  </button>
                  <button 
                    onClick={() => setInput("Crie uma história sobre")}
                    className={`${bgCard} p-4 rounded-xl text-left ${hoverBg} transition border ${borderColor}`}
                  >
                    <span className="text-sm">📝 Crie histórias</span>
                  </button>
                  <button 
                    onClick={() => setInput("Traduza o seguinte texto:")}
                    className={`${bgCard} p-4 rounded-xl text-left ${hoverBg} transition border ${borderColor}`}
                  >
                    <span className="text-sm">🌍 Traduza textos</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Messages */
              <div className="space-y-6">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : ''}`}>
                    {m.role === 'assistant' && (
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0`}>
                        <Sparkles size={16} className="text-white"/>
                      </div>
                    )}
                    
                    <div className={`flex-1 max-w-[85%] ${m.role === 'user' ? 'ml-auto' : ''}`}>
                      {/* Message Header */}
                      <div className={`flex items-center gap-2 mb-1 ${m.role === 'user' ? 'justify-end' : ''}`}>
                        <span className={`text-xs font-medium ${textMuted}`}>
                          {m.role === 'user' ? (displayName || user?.username || t.you) : 'jgspAI'}
                        </span>
                        {m.swarm_used && (
                          <span className="text-xs text-purple-400 flex items-center gap-1">
                            <Zap size={10}/> {m.swarm_iterations}x
                          </span>
                        )}
                      </div>
                      
                      {/* Message Content */}
                      <div className={`rounded-2xl px-4 py-3 ${
                        m.role === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : `${bgCard} ${borderColor} border`
                      }`}>
                        <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''} 
                          prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 
                          prose-code:bg-black/20 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                          prose-pre:bg-black/30 prose-pre:border-0 prose-pre:rounded-xl
                          prose-a:text-blue-400 prose-strong:font-semibold`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                      
                      {/* Message Actions */}
                      {m.role === 'assistant' && (
                        <div className="flex gap-1 mt-2">
                          <button 
                            onClick={() => copyToClipboard(m.content)}
                            className={`p-1.5 rounded-lg ${textMuted} ${hoverBg} transition`}
                            title="Copiar"
                          >
                            <Copy size={14}/>
                          </button>
                          {i === messages.length - 1 && (
                            <button 
                              onClick={regenerateResponse}
                              className={`p-1.5 rounded-lg ${textMuted} ${hoverBg} transition`}
                              title="Regenerar"
                            >
                              <RotateCcw size={14}/>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {m.role === 'user' && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
                        <User size={16} className="text-white"/>
                      </div>
                    )}
                  </div>
                ))}
                
                {loading && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Sparkles size={16} className="text-white"/>
                    </div>
                    <div className={`${bgCard} rounded-2xl px-4 py-3 ${borderColor} border`}>
                      <div className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={16}/>
                        <span className={textMuted}>{swarmEnabled ? t.thinkingSwarm : t.thinking}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4">
          <div className="max-w-3xl mx-auto">
            {/* Attached Files */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachedFiles.map((file, i) => (
                  <div key={i} className={`${bgCard} ${borderColor} border rounded-xl px-3 py-2 flex items-center gap-2 text-sm`}>
                    {file.type === 'image' ? <Image size={14} className="text-green-400"/> : <File size={14} className="text-blue-400"/>}
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-red-400 hover:text-red-300 p-0.5">
                      <X size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Input Box */}
            <div className={`${bgCard} rounded-2xl border ${borderColor} shadow-lg overflow-hidden`}>
              <div className="flex items-end gap-2 p-3">
                {/* Attach Button */}
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
                  className={`p-2 rounded-lg ${textMuted} ${hoverBg} transition disabled:opacity-50`}
                >
                  {uploading ? <Loader2 className="animate-spin" size={20}/> : <Paperclip size={20}/>}
                </button>
                
                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  className={`flex-1 bg-transparent resize-none outline-none text-sm py-2 max-h-[200px] ${textMain}`}
                  placeholder={t.placeholder}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={loading}
                  rows={1}
                />
                
                {/* Send Button */}
                <button 
                  onClick={sendMessage} 
                  disabled={loading || (!input.trim() && attachedFiles.length === 0)}
                  className={`p-2 rounded-lg transition ${
                    input.trim() || attachedFiles.length > 0
                      ? 'bg-white text-black hover:bg-gray-200' 
                      : `${textMuted} cursor-not-allowed`
                  }`}
                >
                  <Send size={20}/>
                </button>
              </div>
            </div>
            
            <p className={`text-xs ${textMuted} text-center mt-3`}>
              jgspAI pode cometer erros. Verifique informações importantes.
            </p>
          </div>
        </div>
      </main>

      {/* Modal Ferramentas do Usuário */}
      {showToolsPanel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowToolsPanel(false)}>
          <div className={`${bgCard} rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
            <div className={`p-4 ${borderColor} border-b flex justify-between items-center shrink-0`}>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Wrench className="text-purple-400"/> {t.myTools}
                <span className={`text-sm ${textMuted}`}>({userTools.length})</span>
              </h2>
              <button onClick={() => setShowToolsPanel(false)} className={`${textMuted} hover:${textMain} p-1`}>
                <X size={20}/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {userTools.length === 0 ? (
                <div className={`text-center ${textMuted} py-12`}>
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                    <Wrench size={32} className="text-purple-400"/>
                  </div>
                  <p className="font-medium mb-2">{t.noTools}</p>
                  <p className="text-sm">{t.noToolsHint}</p>
                  <p className="text-xs mt-4 opacity-70 max-w-sm mx-auto">{t.noToolsExample}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userTools.map(tool => (
                    <div key={tool._id} className={`${bgInput} rounded-xl p-4 border ${borderColor}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-purple-400">{tool.name}</h3>
                          <p className={`text-sm ${textMuted}`}>{tool.description}</p>
                        </div>
                        <button 
                          onClick={() => deleteTool(tool._id)}
                          className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition"
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
                        <pre className={`mt-2 ${isDark ? 'bg-black/30' : 'bg-gray-200'} p-3 rounded-lg text-xs overflow-auto max-h-32 text-green-400`}>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowChatConfig(false)}>
          <div className={`${bgCard} rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
            <div className={`p-4 ${borderColor} border-b flex justify-between items-center shrink-0`}>
              <h2 className="font-semibold text-lg">{t.settings}</h2>
              <button onClick={() => setShowChatConfig(false)} className={`${textMuted} hover:${textMain} p-1`}>
                <X size={20}/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Model Type Tabs */}
              <div className={`flex rounded-xl ${bgInput} p-1`}>
                {['text', 'image', 'audio', 'video'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveModelTab(tab)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                      activeModelTab === tab 
                        ? 'bg-blue-600 text-white' 
                        : textMuted + ' hover:' + textMain
                    }`}
                  >
                    {tab === 'text' && texts.admin.modelsModal.text}
                    {tab === 'image' && texts.admin.modelsModal.image}
                    {tab === 'audio' && texts.admin.modelsModal.audio}
                    {tab === 'video' && texts.admin.modelsModal.video}
                  </button>
                ))}
              </div>

              {/* Provider Selector */}
              <div>
                <label className={`text-sm ${textMuted} flex items-center gap-2 mb-2`}>
                  <Layers size={16}/> {t.providerAI}
                </label>
                <div className={`flex rounded-xl ${bgInput} p-1`}>
                  <button 
                    onClick={() => setSelectedProvider('openrouter')}
                    className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1 transition text-sm font-medium ${
                      selectedProvider === 'openrouter' ? 'bg-indigo-600 text-white' : textMuted
                    }`}
                  >
                    <Database size={14}/> OpenRouter
                  </button>
                  <button 
                    onClick={() => setSelectedProvider('g4f')}
                    className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1 transition text-sm font-medium ${
                      selectedProvider === 'g4f' ? 'bg-emerald-600 text-white' : textMuted
                    }`}
                  >
                    <Zap size={14}/> GPT4Free
                  </button>
                  <button 
                    onClick={() => setSelectedProvider('groq')}
                    className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1 transition text-sm font-medium ${
                      selectedProvider === 'groq' ? 'bg-orange-600 text-white' : textMuted
                    }`}
                  >
                    ⚡ Groq
                  </button>
                </div>
              </div>

              {/* Model Selector */}
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
                    className={`w-full pl-10 pr-4 py-2.5 ${bgInput} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                  />
                </div>
                <div className={`${bgInput} rounded-xl max-h-48 overflow-y-auto`}>
                  {selectedProvider === 'openrouter' && (
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
                          className={`w-full text-left px-3 py-2.5 text-sm transition flex items-center gap-2 rounded-lg m-1 ${
                            selectedModels[activeModelTab] === m.id 
                              ? 'bg-indigo-600 text-white' 
                              : hoverBg
                          }`}
                        >
                          <span className="truncate flex-1">{m.name}</span>
                          {selectedModels[activeModelTab] === m.id && <Check size={14}/>}
                        </button>
                      ))
                  )}
                  {selectedProvider === 'g4f' && (
                    g4fModels
                      .filter(m => m.provider !== 'groq')
                      .filter(m => {
                        if (activeModelTab === 'text') return !m.type || m.type === 'chat';
                        return m.type === activeModelTab;
                      })
                      .filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase()))
                      .map(m => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModels(prev => ({ ...prev, [activeModelTab]: m.id }))}
                          className={`w-full text-left px-3 py-2.5 text-sm transition flex items-center gap-2 rounded-lg m-1 ${
                            selectedModels[activeModelTab] === m.id 
                              ? 'bg-emerald-600 text-white' 
                              : hoverBg
                          }`}
                        >
                          <span className="truncate flex-1">{m.name}</span>
                          {m.provider && <span className={`text-xs ${selectedModels[activeModelTab] === m.id ? 'text-emerald-200' : textMuted}`}>({m.provider})</span>}
                        </button>
                      ))
                  )}
                  {selectedProvider === 'groq' && (
                    g4fModels
                      .filter(m => m.provider === 'groq')
                      .filter(m => {
                        if (activeModelTab === 'text') return !m.type || m.type === 'chat';
                        return m.type === activeModelTab;
                      })
                      .filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase()))
                      .map(m => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModels(prev => ({ ...prev, [activeModelTab]: m.id }))}
                          className={`w-full text-left px-3 py-2.5 text-sm transition flex items-center gap-2 rounded-lg m-1 ${
                            selectedModels[activeModelTab] === m.id 
                              ? 'bg-orange-600 text-white' 
                              : hoverBg
                          }`}
                        >
                          <span className="truncate flex-1">{m.name}</span>
                          {m.speed && <span className={`text-xs ${selectedModels[activeModelTab] === m.id ? 'text-orange-200' : textMuted}`}>({m.speed})</span>}
                        </button>
                      ))
                  )}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className={`text-xs ${textMuted}`}>
                    {(() => {
                      const typeFilter = m => {
                        if (activeModelTab === 'text') return !m.type || m.type === 'chat';
                        return m.type === activeModelTab;
                      };
                      if (selectedProvider === 'openrouter') return models.filter(typeFilter).length;
                      if (selectedProvider === 'groq') return g4fModels.filter(m => m.provider === 'groq').filter(typeFilter).length;
                      return g4fModels.filter(m => m.provider !== 'groq').filter(typeFilter).length;
                    })()} {t.modelsAvailable}
                  </p>
                  <button onClick={loadModels} className={`p-1 ${textMuted} hover:text-blue-400`} title={t.refreshModels}>
                    <RefreshCw size={14} className={modelsLoading ? 'animate-spin' : ''}/>
                  </button>
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className={`text-sm ${textMuted} block mb-2`}>{t.systemPrompt}</label>
                <textarea
                  className={`w-full ${bgInput} p-3 rounded-xl min-h-[100px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                  placeholder={t.systemPromptPlaceholder}
                  value={userSystemPrompt}
                  onChange={e => setUserSystemPrompt(e.target.value)}
                />
              </div>
            </div>
            <div className={`p-4 ${borderColor} border-t shrink-0`}>
              <button onClick={() => setShowChatConfig(false)} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 p-3 rounded-xl font-medium transition">
                {t.apply}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configurações do Usuário */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowSettings(false)}>
          <div className={`${bgCard} rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
            <div className={`p-4 ${borderColor} border-b flex justify-between items-center shrink-0`}>
              <h2 className="font-semibold text-lg">{tUser.title}</h2>
              <button onClick={() => setShowSettings(false)} className={`${textMuted} hover:${textMain} p-1`}>
                <X size={20}/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Tema */}
              <div>
                <label className={`text-sm ${textMuted} flex items-center gap-2 mb-2`}>
                  <Palette size={16}/> {tUser.theme}
                </label>
                <div className={`flex rounded-xl ${bgInput} p-1`}>
                  <button 
                    onClick={() => setTheme('dark')}
                    className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition font-medium ${
                      theme === 'dark' ? 'bg-blue-600 text-white' : textMuted
                    }`}
                  >
                    <Moon size={16}/> {tUser.themeDark}
                  </button>
                  <button 
                    onClick={() => setTheme('light')}
                    className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition font-medium ${
                      theme === 'light' ? 'bg-blue-600 text-white' : textMuted
                    }`}
                  >
                    <Sun size={16}/> {tUser.themeLight}
                  </button>
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className={`text-sm ${textMuted} flex items-center gap-2 mb-2`}>
                  <User size={16}/> {tUser.displayName}
                </label>
                <input
                  className={`w-full ${bgInput} p-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                  placeholder={tUser.displayName}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>

              {/* Bio */}
              <div>
                <label className={`text-sm ${textMuted} block mb-2`}>{tUser.bio}</label>
                <textarea
                  className={`w-full ${bgInput} p-3 rounded-xl min-h-[80px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                  placeholder={tUser.bioPlaceholder}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                />
              </div>

              {/* API Key */}
              <div>
                <label className={`text-sm ${textMuted} flex items-center gap-2 mb-2`}>
                  <Key size={16}/> {tUser.personalApiKey}
                </label>
                <input
                  type="password"
                  className={`w-full ${bgInput} p-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                  placeholder={hasPersonalKey ? "••••••••••••" : tUser.apiKeyPlaceholder}
                  value={personalApiKey}
                  onChange={e => setPersonalApiKey(e.target.value)}
                />
                {hasPersonalKey && (
                  <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <Check size={12}/> {tUser.apiKeyInfo}
                  </p>
                )}
              </div>
              
              {/* Logout */}
              <button 
                onClick={handleLogout}
                className="w-full p-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition flex items-center justify-center gap-2"
              >
                <LogOut size={16}/> {texts.logout}
              </button>
            </div>
            <div className={`p-4 ${borderColor} border-t shrink-0`}>
              <button onClick={saveSettings} className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded-xl font-medium transition">
                {tUser.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
