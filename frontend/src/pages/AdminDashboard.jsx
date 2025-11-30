import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  User, MessageSquare, Wrench, X, Trash2, Key, Users, 
  BarChart3, RefreshCw, ChevronLeft, Settings, AlertTriangle, Cpu
} from 'lucide-react';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [viewingChat, setViewingChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [globalApiKey, setGlobalApiKey] = useState('');
  const [apiKeyConfig, setApiKeyConfig] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [models, setModels] = useState([]);
  const [defaultModel, setDefaultModel] = useState('');
  const [showModelModal, setShowModelModal] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    loadUsers();
    loadStats();
    loadApiKeyConfig();
    loadModels();
  }, []);

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
      if (res.data.defaultModel) {
        setDefaultModel(res.data.defaultModel);
      }
    } catch(e) {
      console.error('Erro ao carregar config');
    }
  };

  const loadModels = async () => {
    try {
      const res = await axios.get(API_URL + '/models');
      if (res.data && res.data.length > 0) {
        setModels(res.data);
      }
    } catch(e) {
      // Fallback
      setModels([
        {id:"google/gemini-2.0-flash-exp:free", name:"Gemini 2.0 Flash"},
        {id:"meta-llama/llama-3.3-70b-instruct:free", name:"Llama 3.3 70B"},
        {id:"deepseek/deepseek-chat:free", name:"DeepSeek V3"}
      ]);
    }
  };

  const saveDefaultModel = async () => {
    if (!defaultModel) return;
    setSavingModel(true);
    try {
      await axios.post(API_URL + '/admin/config/default-model', 
        { model: defaultModel },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      alert('Modelo padrão salvo com sucesso!');
      setShowModelModal(false);
    } catch(err) {
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    }
    setSavingModel(false);
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
      const res = await axios.post(API_URL + '/admin/config/apikey', 
        { apiKey: globalApiKey },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      setApiKeyConfig(res.data);
      setGlobalApiKey('');
      setShowApiKeyModal(false);
      alert('Chave API global salva com sucesso!');
    } catch(err) {
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
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
            <Settings className="text-yellow-500"/> Admin Panel
          </h1>
        </div>

        {/* Stats */}
        {stats && (
          <div className="p-4 border-b border-gray-700 grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-700 p-2 rounded">
              <div className="text-lg font-bold text-blue-400">{stats.totalUsers}</div>
              <div className="text-xs text-gray-400">Usuários</div>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <div className="text-lg font-bold text-green-400">{stats.totalChats}</div>
              <div className="text-xs text-gray-400">Chats</div>
            </div>
            <div className="bg-gray-700 p-2 rounded">
              <div className="text-lg font-bold text-purple-400">{stats.totalRequests}</div>
              <div className="text-xs text-gray-400">Requests</div>
            </div>
          </div>
        )}

        {/* API Key Config */}
        <div className="p-4 border-b border-gray-700 space-y-2">
          <button 
            onClick={() => setShowApiKeyModal(true)}
            className="w-full bg-yellow-600 hover:bg-yellow-500 p-3 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Key size={18}/> Gerenciar API Key
          </button>
          {apiKeyConfig?.hasGlobalApiKey && (
            <p className="text-xs text-green-400 text-center">
              ✓ Chave: {apiKeyConfig.globalApiKeyPreview}
            </p>
          )}
          
          <button 
            onClick={() => setShowModelModal(true)}
            className="w-full bg-purple-600 hover:bg-purple-500 p-3 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Cpu size={18}/> Modelo Padrão
          </button>
          {defaultModel && (
            <p className="text-xs text-purple-400 text-center truncate" title={defaultModel}>
              ✓ {models.find(m => m.id === defaultModel)?.name || defaultModel.split('/').pop()}
            </p>
          )}
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 text-xs text-gray-500 uppercase tracking-wide flex items-center justify-between">
            <span>Usuários ({users.length})</span>
            <button onClick={loadUsers} className="hover:text-white">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            </button>
          </div>
          
          {loading && <div className="p-4 text-gray-500 text-center">Carregando...</div>}
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
          <a href="/" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition">
            <ChevronLeft size={18}/> Voltar ao Chat
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-850 overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-gray-800 p-4 flex items-center gap-4 border-b border-gray-700">
          <button onClick={() => setShowMobileMenu(true)} className="p-2">
            <Users size={24}/>
          </button>
          <span className="font-bold">Admin Dashboard</span>
        </div>

        {!userDetails ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Users size={48} className="mx-auto mb-4 opacity-50"/>
              <p>Selecione um usuário para ver detalhes</p>
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
                  <Trash2 size={18}/> Excluir Usuário
                </button>
              )}
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-400">{userDetails.chats.length}</div>
                <div className="text-sm text-gray-400">Chats</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-400">{userDetails.tools.length}</div>
                <div className="text-sm text-gray-400">Ferramentas</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">{userDetails.user.usage?.requests || 0}</div>
                <div className="text-sm text-gray-400">Requests</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-400">{userDetails.user.hasPersonalKey ? '✓' : '✗'}</div>
                <div className="text-sm text-gray-400">API Key</div>
              </div>
            </div>

            {/* Chats */}
            <div className="mb-8">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <MessageSquare size={20}/> Chats ({userDetails.chats.length})
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
                <Wrench size={20}/> Ferramentas ({userDetails.tools.length})
              </h2>
              {userDetails.tools.length === 0 ? (
                <p className="text-gray-500 italic">Nenhuma ferramenta encontrada</p>
              ) : (
                <div className="grid gap-4">
                  {userDetails.tools.map(t => (
                    <div key={t._id} className="bg-gray-800 p-4 rounded-lg">
                      <div className="font-bold text-blue-400">{t.name}</div>
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
                <Key className="text-yellow-500"/> Chave API Global
              </h2>
              <button onClick={() => setShowApiKeyModal(false)}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-yellow-900/30 border border-yellow-600/50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={20}/>
                  <div className="text-sm">
                    <p className="font-medium text-yellow-500">Importante</p>
                    <p className="text-yellow-200/70 mt-1">
                      Esta chave será usada por todos os usuários que não têm chave pessoal configurada.
                    </p>
                  </div>
                </div>
              </div>

              {apiKeyConfig?.hasGlobalApiKey && (
                <div className="text-sm text-green-400">
                  ✓ Chave atual: {apiKeyConfig.globalApiKeyPreview}
                </div>
              )}

              <div>
                <label className="text-sm text-gray-400 block mb-2">Nova Chave API (OpenRouter)</label>
                <input
                  type="password"
                  className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600"
                  placeholder="sk-or-v1-..."
                  value={globalApiKey}
                  onChange={e => setGlobalApiKey(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => { setGlobalApiKey(''); saveGlobalApiKey(); }}
                  className="flex-1 bg-red-600 hover:bg-red-500 p-3 rounded-lg transition"
                >
                  Remover Chave
                </button>
                <button 
                  onClick={saveGlobalApiKey}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 p-3 rounded-lg transition"
                  disabled={!globalApiKey}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modelo Padrão */}
      {showModelModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Cpu className="text-purple-500"/> Modelo Padrão
              </h2>
              <button onClick={() => setShowModelModal(false)}>
                <X size={24}/>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-purple-900/30 border border-purple-600/50 p-4 rounded-lg">
                <div className="text-sm">
                  <p className="font-medium text-purple-400">Modelo padrão do sistema</p>
                  <p className="text-purple-200/70 mt-1">
                    Este modelo será selecionado automaticamente quando um usuário criar um novo chat.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Selecione o modelo</label>
                <select
                  className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600"
                  value={defaultModel}
                  onChange={e => setDefaultModel(e.target.value)}
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">{models.length} modelos gratuitos disponíveis</p>
              </div>

              <button 
                onClick={saveDefaultModel}
                disabled={savingModel || !defaultModel}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 p-3 rounded-lg transition font-medium"
              >
                {savingModel ? 'Salvando...' : 'Salvar Modelo Padrão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
