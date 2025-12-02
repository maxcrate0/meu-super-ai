import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  User, MessageSquare, Wrench, X, Trash2, Key, Users, 
  BarChart3, RefreshCw, ChevronLeft, Settings, AlertTriangle, Cpu,
  Send, Mail, FileText, Layout, Database, Zap, Eye, EyeOff, TrendingUp, Trophy
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function AdminDashboard() {
  // i18n
  const { texts } = useLanguage();
  const t = texts.admin;
  
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [viewingChat, setViewingChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [globalApiKey, setGlobalApiKey] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [apiKeyConfig, setApiKeyConfig] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [models, setModels] = useState([]);
  const [defaultModels, setDefaultModels] = useState({
    text: '',
    image: '',
    audio: '',
    video: ''
  });
  const [activeModelTab, setActiveModelTab] = useState('text');
  const [selectedModelProvider, setSelectedModelProvider] = useState('openrouter');
  const [showModelModal, setShowModelModal] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showSystemPromptModal, setShowSystemPromptModal] = useState(false);
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState('');
  const [savingSystemPrompt, setSavingSystemPrompt] = useState(false);
  const [activeApiTab, setActiveApiTab] = useState('openrouter');
  
  // Estados do painel Groq
  const [showGroqPanel, setShowGroqPanel] = useState(false);
  const [groqModels, setGroqModels] = useState([]);
  const [groqUsage, setGroqUsage] = useState([]);
  const [groqUserRankings, setGroqUserRankings] = useState([]);
  const [groqModelRankings, setGroqModelRankings] = useState([]);
  const [loadingGroq, setLoadingGroq] = useState(false);
  const [groqActiveTab, setGroqActiveTab] = useState('models');
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    loadUsers();
    loadStats();
    loadApiKeyConfig();
    loadModels();
  }, []);

  // Carregar dados do Groq quando o painel for aberto
  const loadGroqData = async () => {
    setLoadingGroq(true);
    try {
      const [modelsRes, statsRes, limitsRes] = await Promise.all([
        axios.get(API_URL + '/admin/groq/models', { headers: { Authorization: 'Bearer ' + token } }),
        axios.get(API_URL + '/admin/groq/stats', { headers: { Authorization: 'Bearer ' + token } }),
        axios.get(API_URL + '/admin/groq/limits', { headers: { Authorization: 'Bearer ' + token } })
      ]);
      
      // Combinar modelos com limites
      const limits = limitsRes.data?.models || {};
      const modelsWithLimits = (modelsRes.data || []).map(m => ({
        ...m,
        limits: limits[m.id] ? {
          requestsPerMinute: limits[m.id].rpm,
          requestsPerDay: limits[m.id].rpd,
          tokensPerMinute: limits[m.id].tpm,
          tokensPerDay: limits[m.id].tpd
        } : m.limits
      }));
      
      setGroqModels(modelsWithLimits);
      
      // Estatísticas
      const stats = statsRes.data || {};
      setGroqUsage(stats.modelUsage || []);
      setGroqUserRankings(stats.topUsersGeneral || []);
      setGroqModelRankings(stats.modelUsage || []);
    } catch (err) {
      console.error('Erro ao carregar dados Groq:', err);
    }
    setLoadingGroq(false);
  };

  const toggleGroqModelVisibility = async (modelId, hidden) => {
    try {
      await axios.post(
        API_URL + '/admin/groq/toggle-visibility',
        { modelId, hidden: !hidden },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      // Atualiza localmente
      setGroqModels(prev => prev.map(m => 
        m.id === modelId ? { ...m, hidden: !hidden } : m
      ));
    } catch (err) {
      alert('Erro ao alterar visibilidade: ' + (err.response?.data?.error || err.message));
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(API_URL + '/admin/users', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setUsers(res.data || []);
    } catch(err) {
      setError('Erro ao carregar usuários: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const res = await axios.get(API_URL + '/admin/stats', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setStats(res.data);
    } catch(e) {
      console.error('Erro ao carregar estatísticas');
    }
  };

  const loadApiKeyConfig = async () => {
    try {
      const res = await axios.get(API_URL + '/admin/config', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setApiKeyConfig(res.data);
      if (res.data.defaultModels) {
        setDefaultModels(res.data.defaultModels);
      } else if (res.data.defaultModel) {
        // Fallback para migração
        setDefaultModels(prev => ({ ...prev, text: res.data.defaultModel }));
      }
      if (res.data.globalSystemPrompt) {
        setGlobalSystemPrompt(res.data.globalSystemPrompt);
      }
    } catch(e) {
      console.error('Erro ao carregar config');
    }
  };

  const loadModels = async () => {
    try {
      const [openRouterRes, g4fRes] = await Promise.all([
        axios.get(API_URL + '/models').catch(() => ({ data: [] })),
        axios.get(API_URL + '/models/g4f').catch(() => ({ data: [] }))
      ]);

      const openRouterModels = (openRouterRes.data || []).map(m => ({ ...m, source: 'OpenRouter', type: 'chat' }));
      const g4fModels = (g4fRes.data || []).map(m => ({ ...m, source: 'GPT4Free' }));
      
      setModels([...openRouterModels, ...g4fModels]);
    } catch(e) {
      console.error('Erro ao carregar modelos', e);
      // Fallback
      setModels([
        {id:"google/gemini-2.0-flash-exp:free", name:"Gemini 2.0 Flash", source: 'OpenRouter', type: 'chat'},
        {id:"deepseek-v3", name:"DeepSeek V3", source: 'GPT4Free', type: 'chat'}
      ]);
    }
  };

  const saveDefaultModels = async () => {
    setSavingModel(true);
    try {
      await axios.post(API_URL + '/admin/config/default-models', 
        { 
          textModel: defaultModels.text,
          imageModel: defaultModels.image,
          audioModel: defaultModels.audio,
          videoModel: defaultModels.video
        },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      alert('Modelos padrão salvos com sucesso!');
      setShowModelModal(false);
    } catch(err) {
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    }
    setSavingModel(false);
  };

  const saveGlobalSystemPrompt = async () => {
    setSavingSystemPrompt(true);
    try {
      await axios.post(API_URL + '/admin/config/system-prompt', 
        { systemPrompt: globalSystemPrompt },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      alert('System Prompt global salvo com sucesso!');
      setShowSystemPromptModal(false);
    } catch(err) {
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    }
    setSavingSystemPrompt(false);
  };

  const selectUser = async (id) => {
    setSelectedUser(id);
    setViewingChat(null);
    setShowMobileMenu(false);
    try {
      const res = await axios.get(API_URL + '/admin/user/' + id, { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setUserDetails(res.data);
    } catch(err) {
      alert('Erro ao carregar detalhes do usuário');
    }
  };

  const openChat = async (chatId) => {
    try {
      const res = await axios.get(API_URL + '/admin/chat/' + chatId, { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setViewingChat(res.data);
    } catch(err) {
      alert('Erro ao carregar chat');
    }
  };

  const deleteChat = async (chatId) => {
    if (!confirm('Tem certeza que deseja apagar este chat? Esta ação não pode ser desfeita.')) return;
    try {
      await axios.delete(API_URL + '/admin/chat/' + chatId, { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setViewingChat(null);
      // Recarrega detalhes do usuário
      if (selectedUser) selectUser(selectedUser);
      alert('Chat apagado com sucesso!');
    } catch(err) {
      alert('Erro ao apagar chat: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteTool = async (toolId, toolName) => {
    if (!confirm(`Tem certeza que deseja apagar a ferramenta "${toolName}"?`)) return;
    try {
      await axios.delete(API_URL + '/admin/tool/' + toolId, { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      // Recarrega detalhes do usuário
      if (selectedUser) selectUser(selectedUser);
      alert('Ferramenta apagada com sucesso!');
    } catch(err) {
      alert('Erro ao apagar ferramenta: ' + (err.response?.data?.error || err.message));
    }
  };

  const sendAdminMessage = async () => {
    if (!adminMessage.trim() || !selectedUser) return;
    setSendingMessage(true);
    try {
      await axios.post(API_URL + '/admin/user/' + selectedUser + '/message', 
        { message: adminMessage },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      alert('Mensagem enviada com sucesso! O usuário verá quando abrir o site.');
      setAdminMessage('');
      setShowMessageModal(false);
    } catch(err) {
      alert('Erro ao enviar: ' + (err.response?.data?.error || err.message));
    }
    setSendingMessage(false);
  };

  const clearAdminMessage = async (userId) => {
    try {
      await axios.delete(API_URL + '/admin/user/' + userId + '/message', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      alert('Mensagem limpa!');
    } catch(err) {
      alert('Erro: ' + err.message);
    }
  };

  const deleteUser = async (userId) => {
    const user = users.find(u => u._id === userId);
    if (!confirm(`Tem certeza que deseja apagar o usuário "${user?.username}"? Todos os chats e ferramentas serão excluídos.`)) return;
    try {
      await axios.delete(API_URL + '/admin/user/' + userId, { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      setSelectedUser(null);
      setUserDetails(null);
      loadUsers();
      loadStats();
      alert('Usuário apagado com sucesso!');
    } catch(err) {
      alert('Erro ao apagar usuário: ' + (err.response?.data?.error || err.message));
    }
  };

  const saveGlobalApiKey = async () => {
    try {
      const payload = {};
      if (activeApiTab === 'openrouter') {
        payload.apiKey = globalApiKey;
      } else {
        payload.groqApiKey = groqApiKey;
      }
      
      const res = await axios.post(API_URL + '/admin/config/apikey', 
        payload,
        { headers: { Authorization: 'Bearer ' + token } }
      );
      setApiKeyConfig(res.data);
      setGlobalApiKey('');
      setGroqApiKey('');
      setShowApiKeyModal(false);
      alert('Chave API salva com sucesso!');
    } catch(err) {
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    }
  };

  const removeApiKey = async (type) => {
    try {
      const payload = type === 'openrouter' ? { apiKey: '' } : { groqApiKey: '' };
      const res = await axios.post(API_URL + '/admin/config/apikey', 
        payload,
        { headers: { Authorization: 'Bearer ' + token } }
      );
      setApiKeyConfig(res.data);
      alert('Chave removida!');
    } catch(err) {
      alert('Erro: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex font-sans">
      {/* Overlay Mobile */}
      {showMobileMenu && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setShowMobileMenu(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative z-50 w-72 h-full bg-gray-800 flex flex-col border-r border-gray-700
        transform transition-transform duration-300 ease-in-out
        ${showMobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Settings className="text-yellow-500"/> {t.title}
          </h1>
        </div>

        {/* Stats */}
        {stats && (
          <div className="p-4 border-b border-gray-700 grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-700 p-2 rounded">
              <div className="text-lg font-bold text-blue-400">{stats.totalUsers}</div>
              <div className="text-xs text-gray-400">{t.users}</div>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <div className="text-lg font-bold text-green-400">{stats.totalChats}</div>
              <div className="text-xs text-gray-400">{t.chats}</div>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <div className="text-lg font-bold text-purple-400">{stats.totalRequests}</div>
              <div className="text-xs text-gray-400">{t.requests}</div>
            </div>
          </div>
        )}

        {/* API Key Config */}
        <div className="p-4 border-b border-gray-700 space-y-2">
          <button 
            onClick={() => setShowApiKeyModal(true)}
            className="w-full bg-yellow-600 hover:bg-yellow-500 p-3 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Key size={18}/> {t.apiKeys}
          </button>
          <div className="flex flex-col gap-1">
            {apiKeyConfig?.hasGlobalApiKey && (
              <p className="text-xs text-green-400 text-center">
                ✓ OpenRouter: {apiKeyConfig.globalApiKeyPreview}
              </p>
            )}
            {apiKeyConfig?.hasGroqApiKey && (
              <p className="text-xs text-emerald-400 text-center">
                ⚡ Groq: {apiKeyConfig.groqApiKeyPreview}
              </p>
            )}
          </div>
          
          <button 
            onClick={() => setShowModelModal(true)}
            className="w-full bg-purple-600 hover:bg-purple-500 p-3 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Cpu size={18}/> {t.defaultModels}
          </button>
          <div className="text-xs text-purple-400 text-center mt-1 flex justify-center gap-2">
            {defaultModels.text && <span title={t.modelsModal.text}>Txt: ✓</span>}
            {defaultModels.image && <span title={t.modelsModal.image}>Img: ✓</span>}
            {defaultModels.audio && <span title={t.modelsModal.audio}>Aud: ✓</span>}
            {defaultModels.video && <span title={t.modelsModal.video}>Vid: ✓</span>}
          </div>
          
          <button 
            onClick={() => setShowSystemPromptModal(true)}
            className="w-full bg-green-600 hover:bg-green-500 p-3 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <FileText size={18}/> {t.systemPrompt}
          </button>
          {globalSystemPrompt && (
            <p className="text-xs text-green-400 text-center truncate">
              ✓ ({globalSystemPrompt.length} chars)
            </p>
          )}
          
          <Link 
            to="/admin/content"
            className="w-full bg-pink-600 hover:bg-pink-500 p-3 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Layout size={18}/> {t.contentEditor}
          </Link>
          
          <button 
            onClick={() => { setShowGroqPanel(true); loadGroqData(); }}
            className="w-full bg-orange-600 hover:bg-orange-500 p-3 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Zap size={18}/> Groq Analytics
          </button>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 text-xs text-gray-500 uppercase tracking-wide flex items-center justify-between">
            <span>{t.users} ({users.length})</span>
            <button onClick={loadUsers} className="hover:text-white">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            </button>
          </div>
          
          {loading && <div className="p-4 text-gray-500 text-center">{texts.loading}</div>}
          {error && <div className="p-4 text-red-400 text-sm">{error}</div>}
          
          {users.map(u => (
            <div 
              key={u._id} 
              onClick={() => selectUser(u._id)} 
              className={`p-4 border-b border-gray-700 cursor-pointer transition ${
                selectedUser === u._id ? 'bg-blue-900/30 border-l-4 border-l-blue-500' : 'hover:bg-gray-750'
              }`}
            >
              <div className="font-medium flex items-center gap-2">
                <User size={16} className={u.role === 'admin' ? 'text-yellow-500' : 'text-gray-400'}/>
                {u.username}
                {u.role === 'admin' && <span className="text-xs bg-yellow-600 px-2 py-0.5 rounded">ADMIN</span>}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {u.displayName && <span className="text-gray-400">{u.displayName} • </span>}
                Requests: {u.usage?.requests || 0}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-700">
          <Link to="/" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition">
            <ChevronLeft size={18}/> {texts.docs.backToHome}
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-850 overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-gray-800 p-4 flex items-center gap-4 border-b border-gray-700">
          <button onClick={() => setShowMobileMenu(true)} className="p-2">
            <Users size={24}/>
          </button>
          <span className="font-bold">{t.title}</span>
        </div>

        {!userDetails ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Users size={48} className="mx-auto mb-4 opacity-50"/>
              <p>{texts.admin.selectUser || 'Selecione um usuário para ver detalhes'}</p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* User Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                  <User className="text-blue-500"/>
                  {userDetails.user.displayName || userDetails.user.username}
                  {userDetails.user.role === 'admin' && (
                    <span className="text-sm bg-yellow-600 px-2 py-1 rounded">ADMIN</span>
                  )}
                </h1>
                <p className="text-gray-400 text-sm mt-1">@{userDetails.user.username}</p>
                {userDetails.user.bio && (
                  <p className="text-gray-500 text-sm mt-2 italic">"{userDetails.user.bio}"</p>
                )}
              </div>
              {userDetails.user.role !== 'admin' && (
                <button 
                  onClick={() => deleteUser(userDetails.user._id)}
                  className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg flex items-center gap-2 transition"
                >
                  <Trash2 size={18}/> {t.deleteUser}
                </button>
              )}
              <button 
                onClick={() => setShowMessageModal(true)}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Mail size={18}/> {t.sendMessage}
              </button>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-400">{userDetails.chats.length}</div>
                <div className="text-sm text-gray-400">{t.chats}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-400">{userDetails.tools.length}</div>
                <div className="text-sm text-gray-400">{t.tools}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">{userDetails.user.usage?.requests || 0}</div>
                <div className="text-sm text-gray-400">{t.requests}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-400">{userDetails.user.hasPersonalKey ? '✓' : '✗'}</div>
                <div className="text-sm text-gray-400">API Key</div>
              </div>
            </div>

            {/* Chats */}
            <div className="mb-8">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <MessageSquare size={20}/> {t.chats} ({userDetails.chats.length})
              </h2>
              {userDetails.chats.length === 0 ? (
                <p className="text-gray-500 italic">Nenhum chat encontrado</p>
              ) : (
                <div className="grid gap-2">
                  {userDetails.chats.map(c => (
                    <div 
                      key={c._id} 
                      className="bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-750 transition cursor-pointer"
                      onClick={() => openChat(c._id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.title}</div>
                        <div className="text-xs text-gray-500">{c.model}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">
                          {new Date(c.updatedAt).toLocaleDateString('pt-BR')}
                        </span>
                        <button 
                          onClick={e => { e.stopPropagation(); deleteChat(c._id); }}
                          className="text-red-400 hover:text-red-300 p-2"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tools */}
            <div>
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Wrench size={20}/> {t.tools} ({userDetails.tools.length})
              </h2>
              {userDetails.tools.length === 0 ? (
                <p className="text-gray-500 italic">Nenhuma ferramenta encontrada</p>
              ) : (
                <div className="grid gap-4">
                  {userDetails.tools.map(t => (
                    <div key={t._id} className="bg-gray-800 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-blue-400">{t.name}</div>
                        <button 
                          onClick={() => deleteTool(t._id, t.name)}
                          className="text-red-400 hover:text-red-300 p-2"
                          title="Apagar ferramenta"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{t.description}</p>
                      <pre className="bg-gray-900 text-green-400 text-xs p-3 mt-3 rounded overflow-auto max-h-32">
                        {t.code}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal View Chat */}
      {viewingChat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{viewingChat.title}</h3>
                <div className="text-xs text-gray-500">Modelo: {viewingChat.model}</div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => deleteChat(viewingChat._id)}
                  className="text-red-400 hover:text-red-300 p-2"
                  title="Apagar chat"
                >
                  <Trash2 size={20}/>
                </button>
                <button onClick={() => setViewingChat(null)} className="p-2">
                  <X size={24}/>
                </button>
              </div>
            </div>
            
            {viewingChat.userSystemPrompt && (
              <div className="p-3 bg-yellow-900/30 text-xs border-b border-gray-700">
                <span className="font-bold text-yellow-500">System Prompt:</span> {viewingChat.userSystemPrompt}
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {viewingChat.messages?.length === 0 && (
                <p className="text-gray-500 text-center">Nenhuma mensagem neste chat</p>
              )}
              {viewingChat.messages?.map((m, i) => (
                <div 
                  key={i} 
                  className={`p-4 rounded-lg max-w-[85%] ${
                    m.role === 'user' ? 'bg-blue-600 ml-auto' : 'bg-gray-700'
                  }`}
                >
                  <div className="text-xs opacity-60 uppercase mb-2 font-bold">{m.role}</div>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{m.content}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal API Key */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Key className="text-yellow-500"/> {t.apiKeyModal.title}
              </h2>
              <button onClick={() => setShowApiKeyModal(false)}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Tabs para alternar entre APIs */}
              <div className="flex border-b border-gray-700">
                <button
                  onClick={() => setActiveApiTab('openrouter')}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${
                    activeApiTab === 'openrouter' 
                      ? 'border-indigo-500 text-indigo-400' 
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  {t.apiKeyModal.openrouter}
                </button>
                <button
                  onClick={() => setActiveApiTab('groq')}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${
                    activeApiTab === 'groq' 
                      ? 'border-emerald-500 text-emerald-400' 
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  {t.apiKeyModal.groq}
                </button>
              </div>

              <div className="bg-yellow-900/30 border border-yellow-600/50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={20}/>
                  <div className="text-sm">
                    <p className="font-medium text-yellow-500">
                      {activeApiTab === 'openrouter' ? 'OpenRouter' : 'Groq'}
                    </p>
                    <p className="text-yellow-200/70 mt-1">
                      {activeApiTab === 'openrouter' 
                        ? t.apiKeyModal.openrouterDesc
                        : t.apiKeyModal.groqDesc}
                    </p>
                  </div>
                </div>
              </div>

              {/* OpenRouter */}
              {activeApiTab === 'openrouter' && (
                <>
                  {apiKeyConfig?.hasGlobalApiKey && (
                    <div className="text-sm text-green-400 flex items-center justify-between">
                      <span>✓ {t.apiKeyModal.currentKey}: {apiKeyConfig.globalApiKeyPreview}</span>
                      <button 
                        onClick={() => removeApiKey('openrouter')}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        {texts.remove}
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">{t.apiKeyModal.newKey} (OpenRouter)</label>
                    <input
                      type="password"
                      className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600"
                      placeholder="sk-or-v1-..."
                      value={globalApiKey}
                      onChange={e => setGlobalApiKey(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={saveGlobalApiKey}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 p-3 rounded-lg transition"
                    disabled={!globalApiKey}
                  >
                    {t.apiKeyModal.saveOpenRouter}
                  </button>
                </>
              )}

              {/* Groq */}
              {activeApiTab === 'groq' && (
                <>
                  {apiKeyConfig?.hasGroqApiKey && (
                    <div className="text-sm text-green-400 flex items-center justify-between">
                      <span>✓ {t.apiKeyModal.currentKey}: {apiKeyConfig.groqApiKeyPreview}</span>
                      <button 
                        onClick={() => removeApiKey('groq')}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        {texts.remove}
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">{t.apiKeyModal.newKey} (Groq)</label>
                    <input
                      type="password"
                      className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600"
                      placeholder="gsk_..."
                      value={groqApiKey}
                      onChange={e => setGroqApiKey(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={saveGlobalApiKey}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 p-3 rounded-lg transition"
                    disabled={!groqApiKey}
                  >
                    {t.apiKeyModal.saveGroq}
                  </button>
                  <p className="text-xs text-gray-500 text-center">
                    {t.apiKeyModal.groqTip}{' '}
                    <a href="https://console.groq.com/keys" target="_blank" className="text-emerald-400 hover:underline">
                      console.groq.com
                    </a>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Modelos Padrão */}
      {showModelModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Cpu className="text-purple-500"/> {t.modelsModal.title}
              </h2>
              <button onClick={() => setShowModelModal(false)}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-purple-900/30 border border-purple-600/50 p-4 rounded-lg">
                <div className="text-sm">
                  <p className="font-medium text-purple-400">{t.modelsModal.title}</p>
                  <p className="text-purple-200/70 mt-1">
                    {t.modelsModal.desc}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-700">
                {['text', 'image', 'audio', 'video'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveModelTab(tab)}
                    className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${
                      activeModelTab === tab 
                        ? 'border-purple-500 text-purple-400' 
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab === 'text' && t.modelsModal.text}
                    {tab === 'image' && t.modelsModal.image}
                    {tab === 'audio' && t.modelsModal.audio}
                    {tab === 'video' && t.modelsModal.video}
                  </button>
                ))}
              </div>

              {/* Seletor de Provider */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">Provider</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedModelProvider('openrouter')}
                    className={`flex-1 p-2 rounded-lg flex items-center justify-center gap-1 transition text-sm ${
                      selectedModelProvider === 'openrouter' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    <Database size={14}/> OpenRouter
                  </button>
                  <button 
                    onClick={() => setSelectedModelProvider('g4f')}
                    className={`flex-1 p-2 rounded-lg flex items-center justify-center gap-1 transition text-sm ${
                      selectedModelProvider === 'g4f' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    <Zap size={14}/> GPT4Free
                  </button>
                  <button 
                    onClick={() => setSelectedModelProvider('groq')}
                    className={`flex-1 p-2 rounded-lg flex items-center justify-center gap-1 transition text-sm ${
                      selectedModelProvider === 'groq' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    ⚡ Groq
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  {t.model} - {activeModelTab === 'text' ? t.modelsModal.text : 
                               activeModelTab === 'image' ? t.modelsModal.image : 
                               activeModelTab === 'audio' ? t.modelsModal.audio : t.modelsModal.video}
                </label>
                <select
                  className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600"
                  value={defaultModels[activeModelTab]}
                  onChange={e => setDefaultModels(prev => ({ ...prev, [activeModelTab]: e.target.value }))}
                >
                  <option value="">{t.modelsModal.selectModel}...</option>
                  
                  {models
                    .filter(m => {
                      // Filtrar por provider
                      if (selectedModelProvider === 'openrouter') return m.source === 'OpenRouter';
                      if (selectedModelProvider === 'groq') return m.source === 'GPT4Free' && m.provider === 'groq';
                      return m.source === 'GPT4Free' && m.provider !== 'groq';
                    })
                    .filter(m => {
                      if (activeModelTab === 'text') return !m.type || m.type === 'chat';
                      return m.type === activeModelTab;
                    })
                    .sort((a,b) => a.name.localeCompare(b.name))
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.name}{m.speed ? ` (${m.speed})` : ''}</option>
                    ))
                  }
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  {models
                    .filter(m => {
                      if (selectedModelProvider === 'openrouter') return m.source === 'OpenRouter';
                      if (selectedModelProvider === 'groq') return m.source === 'GPT4Free' && m.provider === 'groq';
                      return m.source === 'GPT4Free' && m.provider !== 'groq';
                    })
                    .filter(m => {
                      if (activeModelTab === 'text') return !m.type || m.type === 'chat';
                      return m.type === activeModelTab;
                    }).length} {texts.chat.modelsAvailable}
                </p>
              </div>

              <button 
                onClick={saveDefaultModels}
                disabled={savingModel}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 p-3 rounded-lg transition font-medium"
              >
                {savingModel ? texts.loading : t.modelsModal.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enviar Mensagem */}
      {showMessageModal && userDetails && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Mail className="text-blue-500"/> {t.sendMessage}
              </h2>
              <button onClick={() => setShowMessageModal(false)}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-900/30 border border-blue-600/50 p-4 rounded-lg">
                <div className="text-sm">
                  <p className="font-medium text-blue-400">{t.sendMessage}: {userDetails.user.displayName || userDetails.user.username}</p>
                </div>
              </div>

              <div>
                <textarea
                  className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600 min-h-[120px] resize-none"
                  placeholder={t.systemPromptModal.placeholder}
                  value={adminMessage}
                  onChange={e => setAdminMessage(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => clearAdminMessage(userDetails.user._id)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 p-3 rounded-lg transition"
                >
                  {texts.remove}
                </button>
                <button 
                  onClick={sendAdminMessage}
                  disabled={sendingMessage || !adminMessage.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 p-3 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {sendingMessage ? texts.loading : <><Send size={18}/> {texts.send || 'Send'}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal System Prompt Global */}
      {showSystemPromptModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <FileText className="text-green-500"/> {t.systemPromptModal.title}
              </h2>
              <button onClick={() => setShowSystemPromptModal(false)}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-green-900/30 border border-green-600/50 p-4 rounded-lg">
                <div className="text-sm">
                  <p className="font-medium text-green-400">{t.systemPromptModal.title}</p>
                  <p className="text-green-200/70 mt-1">
                    {t.systemPromptModal.desc}
                  </p>
                </div>
              </div>

              <div>
                <textarea
                  className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600 min-h-[200px] resize-none font-mono text-sm"
                  placeholder={t.systemPromptModal.placeholder}
                  value={globalSystemPrompt}
                  onChange={e => setGlobalSystemPrompt(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-2">
                  {globalSystemPrompt.length} chars
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => { setGlobalSystemPrompt(''); saveGlobalSystemPrompt(); }}
                  className="flex-1 bg-red-600 hover:bg-red-500 p-3 rounded-lg transition"
                >
                  {texts.remove}
                </button>
                <button 
                  onClick={saveGlobalSystemPrompt}
                  disabled={savingSystemPrompt}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 p-3 rounded-lg transition font-medium"
                >
                  {savingSystemPrompt ? texts.loading : t.systemPromptModal.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Groq Analytics */}
      {showGroqPanel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Zap className="text-orange-500"/> Groq Analytics
              </h2>
              <button onClick={() => setShowGroqPanel(false)}>
                <X size={24}/>
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-gray-700">
              {[
                { id: 'models', label: 'Modelos', icon: Cpu },
                { id: 'usage', label: 'Uso por Modelo', icon: BarChart3 },
                { id: 'userRanking', label: 'Ranking Usuários', icon: Trophy },
                { id: 'modelRanking', label: 'Ranking Modelos', icon: TrendingUp }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setGroqActiveTab(tab.id)}
                  className={`flex-1 p-3 flex items-center justify-center gap-2 transition ${
                    groqActiveTab === tab.id 
                      ? 'bg-orange-600 text-white' 
                      : 'hover:bg-gray-700 text-gray-400'
                  }`}
                >
                  <tab.icon size={16}/> {tab.label}
                </button>
              ))}
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {loadingGroq ? (
                <div className="text-center py-8">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={32}/>
                  <p>Carregando...</p>
                </div>
              ) : (
                <>
                  {/* Tab: Modelos */}
                  {groqActiveTab === 'models' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Modelos Groq Disponíveis</h3>
                        <button 
                          onClick={loadGroqData}
                          className="text-sm bg-orange-600 hover:bg-orange-500 px-3 py-1 rounded flex items-center gap-1"
                        >
                          <RefreshCw size={14}/> Atualizar
                        </button>
                      </div>
                      
                      <div className="grid gap-3">
                        {groqModels.map(model => (
                          <div 
                            key={model.id}
                            className={`p-4 rounded-lg border ${
                              model.hidden 
                                ? 'bg-gray-900/50 border-gray-700 opacity-60' 
                                : 'bg-gray-900 border-gray-600'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{model.name || model.id}</span>
                                  {model.hidden && (
                                    <span className="text-xs bg-red-600/50 px-2 py-0.5 rounded">Oculto</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1 font-mono">{model.id}</p>
                                
                                {model.limits && (
                                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div className="bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500">RPM:</span>{' '}
                                      <span className="text-orange-400 font-semibold">
                                        {model.limits.requestsPerMinute?.toLocaleString() || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500">RPD:</span>{' '}
                                      <span className="text-orange-400 font-semibold">
                                        {model.limits.requestsPerDay?.toLocaleString() || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500">TPM:</span>{' '}
                                      <span className="text-blue-400 font-semibold">
                                        {model.limits.tokensPerMinute?.toLocaleString() || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="bg-gray-800 p-2 rounded">
                                      <span className="text-gray-500">TPD:</span>{' '}
                                      <span className="text-blue-400 font-semibold">
                                        {model.limits.tokensPerDay?.toLocaleString() || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                
                                {model.usageCount > 0 && (
                                  <p className="text-xs text-green-400 mt-2">
                                    ✓ Usado {model.usageCount} vezes
                                  </p>
                                )}
                              </div>
                              
                              <button
                                onClick={() => toggleGroqModelVisibility(model.id, model.hidden)}
                                className={`p-2 rounded transition ${
                                  model.hidden 
                                    ? 'bg-green-600 hover:bg-green-500' 
                                    : 'bg-red-600 hover:bg-red-500'
                                }`}
                                title={model.hidden ? 'Mostrar para usuários' : 'Ocultar para usuários'}
                              >
                                {model.hidden ? <Eye size={18}/> : <EyeOff size={18}/>}
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        {groqModels.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            Nenhum modelo Groq encontrado. Verifique se a API Key do Groq está configurada.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Tab: Uso por Modelo */}
                  {groqActiveTab === 'usage' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold mb-4">Estatísticas de Uso por Modelo</h3>
                      
                      <div className="grid gap-3">
                        {groqUsage.map((item, index) => (
                          <div 
                            key={item._id || item.modelId || index}
                            className="p-4 bg-gray-900 rounded-lg border border-gray-600"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-semibold">{item._id || item.modelId}</span>
                                <p className="text-xs text-gray-500 mt-1">
                                  {item.uniqueUsers || 0} usuários únicos
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-2xl font-bold text-orange-400">
                                  {(item.count || 0).toLocaleString()}
                                </span>
                                <p className="text-xs text-gray-500">requisições</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {groqUsage.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            Nenhum uso registrado ainda.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Tab: Ranking de Usuários */}
                  {groqActiveTab === 'userRanking' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold mb-4">Ranking de Usuários por Uso do Groq</h3>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left border-b border-gray-700">
                              <th className="p-3 text-gray-400">#</th>
                              <th className="p-3 text-gray-400">Usuário</th>
                              <th className="p-3 text-gray-400">Total de Requisições</th>
                              <th className="p-3 text-gray-400">Modelos Usados</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groqUserRankings.map((user, index) => (
                              <tr 
                                key={user.userId || user._id?.userId || index}
                                className={`border-b border-gray-800 ${
                                  index < 3 ? 'bg-orange-900/20' : ''
                                }`}
                              >
                                <td className="p-3">
                                  {index === 0 && <span className="text-yellow-400 text-xl">🥇</span>}
                                  {index === 1 && <span className="text-gray-300 text-xl">🥈</span>}
                                  {index === 2 && <span className="text-orange-400 text-xl">🥉</span>}
                                  {index > 2 && <span className="text-gray-500">{index + 1}</span>}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <User size={16} className="text-gray-400"/>
                                    <span className="font-medium">{user.username || 'Usuário ' + (user.userId?.slice(-4) || '?')}</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <span className="text-orange-400 font-bold">
                                    {(user.count || 0).toLocaleString()}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-400">
                                  {user.modelsUsed || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {groqUserRankings.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            Nenhum ranking disponível ainda.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Tab: Ranking de Modelos */}
                  {groqActiveTab === 'modelRanking' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold mb-4">Modelos Mais Usados</h3>
                      
                      <div className="grid gap-3">
                        {groqModelRankings.map((model, index) => {
                          const maxCount = groqModelRankings[0]?.count || 1;
                          const percentage = ((model.count || 0) / maxCount) * 100;
                          
                          return (
                            <div 
                              key={model._id || model.modelId || index}
                              className="p-4 bg-gray-900 rounded-lg border border-gray-600"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {index === 0 && <span className="text-yellow-400">🥇</span>}
                                  {index === 1 && <span className="text-gray-300">🥈</span>}
                                  {index === 2 && <span className="text-orange-400">🥉</span>}
                                  <span className="font-semibold">{model._id || model.modelId}</span>
                                </div>
                                <span className="text-orange-400 font-bold">
                                  {(model.count || 0).toLocaleString()} usos
                                </span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-orange-500 h-2 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {model.uniqueUsers || 0} usuários únicos
                              </p>
                            </div>
                          );
                        })}
                        
                        {groqModelRankings.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            Nenhum ranking disponível ainda.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
