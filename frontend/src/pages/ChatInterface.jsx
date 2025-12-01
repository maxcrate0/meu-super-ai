import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Cpu, Settings, LogOut, Plus, MessageSquare, Trash2, Edit2, X, Check, 
  Sun, Moon, Menu, User, Key, Palette, Send, Loader2, RefreshCw, Zap,
  Paperclip, Image, File, Wrench, Code, Terminal, Globe, ChevronDown
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
    loadUserTools();
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
    if (!confirm('Tem certeza que deseja deletar esta ferramenta?')) return;
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
      // Carrega modelos e modelo padrão em paralelo
      const [modelsRes, defaultModelRes] = await Promise.all([
        axios.get(API_URL + '/models'),
        axios.get(API_URL + '/config/default-model').catch(() => ({ data: {} }))
      ]);
      
      if (modelsRes.data && modelsRes.data.length > 0) {
        setModels(modelsRes.data);
        
        // Usa o modelo padrão do admin se disponível
        const adminDefault = defaultModelRes.data?.defaultModel;
        if (adminDefault && modelsRes.data.find(m => m.id === adminDefault)) {
          setSelectedModel(adminDefault);
        } else if (!modelsRes.data.find(m => m.id === selectedModel)) {
          setSelectedModel(modelsRes.data[0].id);
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
    if (!input.trim() && attachedFiles.length === 0) return;
    let currentChatId = activeChatId;

    if (!currentChatId) {
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
        model: selectedModel, 
        userSystemPrompt,
        enableSwarm: swarmEnabled
      };

      const res = await axios.post(API_URL + endpoint, payload, {
        headers: { Authorization: 'Bearer ' + token },
        timeout: 300000 // 5 minutos para ferramentas complexas
      });

      const reply = {
        role: 'assistant',
        content: res.data.content,
        ...(res.data.swarm_used && { swarm_used: true, swarm_iterations: res.data.swarm_iterations })
      };

      setMessages([...newMsgs, reply]);
      loadChats();
      loadUserTools(); // Recarrega ferramentas caso alguma tenha sido criada
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
            onClick={() => { setSwarmEnabled(!swarmEnabled); setShowSidebar(false); }}
            className={`mt-2 w-full p-3 rounded-lg flex items-center justify-center gap-2 transition font-medium ${
              swarmEnabled ? 'bg-purple-600 hover:bg-purple-500' : (isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300')
            }`}
            title={swarmEnabled ? "Swarm ativo: A IA pode delegar tarefas para agentes paralelos" : "Swarm desativado"}
          >
            <Zap size={18}/> Swarm {swarmEnabled ? 'ON' : 'OFF'}
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
            {swarmEnabled && (
              <span className="text-purple-400 font-bold flex items-center gap-1" title="A IA pode usar agentes paralelos para tarefas complexas">
                <Zap size={14}/> SWARM
              </span>
            )}
          </div>
          <button onClick={() => setShowChatConfig(true)} className={`flex items-center gap-2 ${textMuted} hover:text-blue-400 transition`}>
            <Settings size={16}/> Config Chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className={`text-center ${textMuted} mt-20`}>
              <h2 className="text-3xl font-bold mb-2">💬 Novo Chat</h2>
              <p className="text-sm mb-4">Envie uma mensagem para começar</p>
              {swarmEnabled && (
                <div className={`${bgCard} p-4 rounded-xl max-w-lg mx-auto text-left ${borderColor} border`}>
                  <div className="flex items-center gap-2 mb-2 text-purple-400">
                    <Zap size={18}/> <span className="font-bold">Modo Swarm Ativo</span>
                  </div>
                  <p className="text-xs opacity-80">
                    A IA pode delegar tarefas para agentes secundários em paralelo, 
                    economizando contexto e aumentando eficiência. Ideal para tarefas complexas!
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
                <span>{m.role === 'user' ? (displayName || user?.username || 'Você') : 'Assistente'}</span>
                {m.swarm_used && (
                  <span className="text-purple-400 normal-case flex items-center gap-1">
                    <Zap size={12}/> Swarm ({m.swarm_iterations}x)
                  </span>
                )}
              </div>
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{m.content}</pre>
            </div>
          ))}
          {loading && (
            <div className="flex items-center justify-center gap-2 text-blue-400">
              <Loader2 className="animate-spin" size={20}/>
              <span>{swarmEnabled ? 'Processando (pode usar agentes paralelos)...' : 'Processando...'}</span>
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
              placeholder="Digite sua mensagem..."
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
              <span className="hidden sm:inline">Enviar</span>
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
                <Wrench className="text-purple-400"/> Minhas Ferramentas ({userTools.length})
              </h2>
              <button onClick={() => setShowToolsPanel(false)} className={textMuted}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6">
              {userTools.length === 0 ? (
                <div className={`text-center ${textMuted} py-8`}>
                  <Wrench size={48} className="mx-auto mb-4 opacity-50"/>
                  <p>Nenhuma ferramenta criada ainda</p>
                  <p className="text-sm mt-2">Peça para a IA criar uma ferramenta para você!</p>
                  <p className="text-xs mt-4 opacity-70">Exemplo: "Crie uma ferramenta que calcula o IMC"</p>
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
                        <span className={textMuted}>Usos: {tool.executionCount || 0}</span>
                        {tool.lastExecuted && (
                          <span className={textMuted}>
                            Último uso: {new Date(tool.lastExecuted).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      <details className="mt-3">
                        <summary className={`text-xs ${textMuted} cursor-pointer hover:text-blue-400`}>
                          Ver código
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
