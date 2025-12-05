import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Activity, Database, Eye, EyeOff, Key, MessageSquare, RefreshCw, Shield, Users as UsersIcon } from 'lucide-react';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

const client = axios.create({ baseURL: API_URL, timeout: 30000 });
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const StatCard = ({ icon: Icon, label, value, hint }) => (
  <div className="flex items-center gap-3 p-4 rounded-xl border border-indigo-500/20 bg-gray-900/50 text-white">
    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-200">
      <Icon size={18} />
    </div>
    <div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-semibold">{value ?? '–'}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  </div>
);

const ModelRow = ({ model, onToggle, disabled }) => {
  const hidden = model.hidden;
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-800 bg-gray-900/60">
      <div>
        <p className="text-sm font-medium text-white">{model.name || model.id}</p>
        <p className="text-xs text-gray-400">{model.provider}</p>
      </div>
      <button
        onClick={() => onToggle(model)}
        disabled={disabled}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition ${
          hidden
            ? 'border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
            : 'border-gray-700 text-gray-200 hover:border-indigo-500'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        {hidden ? 'Reativar' : 'Ocultar'}
      </button>
    </div>
  );
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [modelStats, setModelStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userChats, setUserChats] = useState([]);
  const [models, setModels] = useState([]);
  const [hiddenModels, setHiddenModels] = useState([]);
  const [apiKeys, setApiKeys] = useState({});
  const [savingKeys, setSavingKeys] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [newKey, setNewKey] = useState({ key: '', value: '' });

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
        const fetchG4F = async () => {
          try {
            return await client.get('/models/g4f');
          } catch (e) {
            try {
              const res = await fetch('http://meu-super-ai-g4f.centralus.azurecontainer.io:8080/v1/models');
              const json = await res.json().catch(() => null);
              const arr = Array.isArray(json) ? json : (json?.data || []);
              return { data: arr };
            } catch (e2) {
              return { data: [] };
            }
          }
        };

        const [statsRes, modelStatsRes, usersRes, hiddenRes, openRes, g4fRes, keysRes] = await Promise.all([
          client.get('/admin/stats'),
          client.get('/admin/models/stats').catch(() => ({ data: null })),
          client.get('/admin/users'),
          client.get('/admin/models/hidden'),
          client.get('/models'),
          fetchG4F(),
          client.get('/admin/api-keys').catch(() => ({ data: {} })),
        ]);

      setStats(statsRes.data || {});
      setModelStats(modelStatsRes.data || null);
      setUsers(usersRes.data || []);
      setHiddenModels(hiddenRes.data || []);
      const openModels = (openRes.data || []).map((m) => ({ ...m, provider: m.provider || 'openrouter' }));
      const g4fModels = (g4fRes.data || []).map((m) => ({ ...m, provider: 'g4f' }));
      setModels([...openModels, ...g4fModels]);
      setApiKeys(keysRes.data || {});
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao carregar dados');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const combinedModels = useMemo(() => {
    return models.map((m) => {
      const key = `${m.provider}:${m.id}`;
      return { ...m, hidden: hiddenModels.includes(key) };
    });
  }, [models, hiddenModels]);

  const selectUser = async (id) => {
    setSelectedUserId(id);
    setSelectedUser(null);
    setUserChats([]);
    if (!id) return;
    try {
      const [userRes, chatsRes] = await Promise.all([
        client.get(`/admin/users/${id}`),
        client.get(`/admin/users/${id}/chats`),
      ]);
      setSelectedUser(userRes.data);
      setUserChats(chatsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao carregar usuário');
    }
  };

  const toggleModel = async (model) => {
    const key = `${model.provider}:${model.id}`;
    const currentlyHidden = hiddenModels.includes(key);
    setModelsLoading(true);
    try {
      await client.post('/admin/models/toggle-visibility', {
        modelId: model.id,
        provider: model.provider,
        hidden: !currentlyHidden,
      });
      setHiddenModels((prev) =>
        currentlyHidden ? prev.filter((k) => k !== key) : [...prev, key]
      );
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao atualizar modelo');
    }
    setModelsLoading(false);
  };

  const unhideModel = async (key) => {
    setModelsLoading(true);
    try {
      await client.post('/admin/models/unhide', { modelKey: key });
      setHiddenModels((prev) => prev.filter((k) => k !== key));
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao reativar modelo');
    }
    setModelsLoading(false);
  };

  const saveKeys = async () => {
    setSavingKeys(true);
    try {
      await client.post('/admin/api-keys', apiKeys || {});
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar chaves');
    }
    setSavingKeys(false);
  };

  const addKey = () => {
    if (!newKey.key.trim()) return;
    setApiKeys((prev) => ({ ...prev, [newKey.key.trim()]: newKey.value }));
    setNewKey({ key: '', value: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-300">
          <RefreshCw className="animate-spin" size={18} />
          <span>Carregando painel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-indigo-400" />
          <div>
            <p className="text-xs text-gray-400">Painel Administrativo</p>
            <h1 className="text-xl font-semibold">jgspAI</h1>
          </div>
        </div>
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-700 hover:border-indigo-500 text-sm"
        >
          <RefreshCw size={16} /> Atualizar
        </button>
      </header>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-lg border border-red-700/60 bg-red-900/20 text-red-200 text-sm">
          {error}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={UsersIcon} label="Usuários" value={stats?.users} />
          <StatCard icon={MessageSquare} label="Chats" value={stats?.chats} />
          <StatCard icon={Activity} label="Requisições" value={stats?.usages} />
          <StatCard icon={Database} label="Erros de modelo" value={modelStats?.errors} hint="últimos registros" />
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-800 rounded-xl bg-gray-900/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><UsersIcon size={18} /> Usuários</h2>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {users.map((u) => (
                <button
                  key={u._id}
                  onClick={() => selectUser(u._id)}
                  className={`w-full text-left p-3 rounded-lg border ${
                    selectedUserId === u._id ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-gray-800 bg-gray-900'
                  } hover:border-indigo-500/50 transition`}
                >
                  <p className="text-sm font-medium">{u.username}</p>
                  <p className="text-xs text-gray-400">{u.role} • {formatDate(u.createdAt)}</p>
                </button>
              ))}
              {users.length === 0 && <p className="text-sm text-gray-400">Nenhum usuário cadastrado.</p>}
            </div>
          </div>

          <div className="p-4 border border-gray-800 rounded-xl bg-gray-900/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Shield size={18} /> Detalhes</h2>
            </div>
            {selectedUser ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{selectedUser.username}</p>
                    <p className="text-xs text-gray-400">{selectedUser.role}</p>
                  </div>
                  <span className="text-xs text-gray-400">desde {formatDate(selectedUser.createdAt)}</span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Chats recentes</p>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {userChats.map((c) => (
                      <div key={c._id} className="p-3 rounded-lg border border-gray-800 bg-gray-950/60">
                        <p className="text-sm font-medium">{c.title || 'Sem título'}</p>
                        <p className="text-xs text-gray-500">{formatDate(c.updatedAt)}</p>
                      </div>
                    ))}
                    {userChats.length === 0 && (
                      <p className="text-sm text-gray-400">Nenhum chat para este usuário.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Selecione um usuário para ver detalhes.</p>
            )}
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-800 rounded-xl bg-gray-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Activity size={18} /> Modelos</h2>
              <span className="text-xs text-gray-400">Clique para alternar</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {combinedModels.map((m) => (
                <ModelRow key={`${m.provider}:${m.id}`} model={m} onToggle={toggleModel} disabled={modelsLoading} />
              ))}
              {combinedModels.length === 0 && <p className="text-sm text-gray-400">Nenhum modelo cadastrado.</p>}
            </div>
            {hiddenModels.length > 0 && (
              <div className="text-xs text-gray-400">
                <p className="mb-1">Modelos ocultos:</p>
                <div className="flex flex-wrap gap-2">
                  {hiddenModels.map((key) => (
                    <button
                      key={key}
                      onClick={() => unhideModel(key)}
                      className="px-2 py-1 rounded-md border border-gray-700 hover:border-emerald-400 text-gray-200"
                      disabled={modelsLoading}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border border-gray-800 rounded-xl bg-gray-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Key size={18} /> Chaves e Config</h2>
              <button
                onClick={saveKeys}
                disabled={savingKeys}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-700 hover:border-indigo-500 text-sm"
              >
                {savingKeys && <RefreshCw size={14} className="animate-spin" />} Salvar
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(apiKeys || {}).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <input
                    value={k}
                    disabled
                    className="w-40 bg-gray-950 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-300"
                  />
                  <input
                    value={v}
                    onChange={(e) => setApiKeys((prev) => ({ ...prev, [k]: e.target.value }))}
                    className="flex-1 bg-gray-950 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-200"
                    placeholder="Valor"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  value={newKey.key}
                  onChange={(e) => setNewKey((prev) => ({ ...prev, key: e.target.value }))}
                  className="w-40 bg-gray-950 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-200"
                  placeholder="NOME_VARIAVEL"
                />
                <input
                  value={newKey.value}
                  onChange={(e) => setNewKey((prev) => ({ ...prev, value: e.target.value }))}
                  className="flex-1 bg-gray-950 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-200"
                  placeholder="Valor"
                />
                <button
                  onClick={addKey}
                  className="px-3 py-2 rounded-md border border-gray-700 hover:border-indigo-500 text-sm"
                >
                  Adicionar
                </button>
              </div>
              <p className="text-xs text-gray-500">Use para armazenar OPENROUTER_API_KEY, G4F_API_URL e outras chaves do backend.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );

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

  const toggleAdmin = async (userId) => {
    const user = users.find(u => u._id === userId);
    const action = user?.role === 'admin' ? 'rebaixar de admin' : 'promover a admin';
    if (!confirm(`Tem certeza que deseja ${action} o usuário "${user?.username}"?`)) return;
    try {
      const res = await axios.patch(API_URL + '/admin/user/' + userId + '/toggle-admin', {}, { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      loadUsers();
      // Recarrega detalhes do usuário se estiver visualizando
      if (selectedUser === userId) {
        selectUser(userId);
      }
      alert(res.data.message || 'Papel do usuário alterado com sucesso!');
    } catch(err) {
      alert('Erro ao alterar papel do usuário: ' + (err.response?.data?.error || err.message));
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
    <div className="min-h-screen bg-[#0f0f0f] text-white flex font-sans">
      {/* Overlay Mobile */}
      {showMobileMenu && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setShowMobileMenu(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative z-50 w-64 h-full bg-[#171717] flex flex-col border-r border-[#2a2a2a]
        transform transition-transform duration-300 ease-in-out
        ${showMobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-[#2a2a2a] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
            <Shield size={20}/>
          </div>
          <div>
            <h1 className="font-semibold">{t.title}</h1>
            <p className="text-xs text-gray-500">Painel de controle</p>
          </div>
        </div>

        {/* Stats Compactas */}
        {stats && (
          <div className="p-3 border-b border-[#2a2a2a] flex gap-2 text-center">
            <div className="flex-1 bg-[#1f1f1f] p-2 rounded-lg">
              <div className="text-sm font-bold text-blue-400">{stats.totalUsers}</div>
              <div className="text-[10px] text-gray-500">{t.users}</div>
            </div>
            <div className="flex-1 bg-[#1f1f1f] p-2 rounded-lg">
              <div className="text-sm font-bold text-green-400">{stats.totalChats}</div>
              <div className="text-[10px] text-gray-500">{t.chats}</div>
            </div>
            <div className="flex-1 bg-[#1f1f1f] p-2 rounded-lg">
              <div className="text-sm font-bold text-purple-400">{stats.totalRequests}</div>
              <div className="text-[10px] text-gray-500">{t.requests}</div>
            </div>
          </div>
        )}

        {/* Quick Actions - Compactas */}
        <div className="p-2 border-b border-[#2a2a2a]">
          <div className="grid grid-cols-2 gap-1.5">
            <button 
              onClick={() => setShowApiKeyModal(true)}
              className="bg-[#1f1f1f] hover:bg-[#2a2a2a] p-2.5 rounded-lg flex flex-col items-center gap-1 transition text-xs"
            >
              <Key size={16} className="text-yellow-500"/>
              <span className="text-gray-400">API Keys</span>
            </button>
            <button 
              onClick={() => setShowModelModal(true)}
              className="bg-[#1f1f1f] hover:bg-[#2a2a2a] p-2.5 rounded-lg flex flex-col items-center gap-1 transition text-xs"
            >
              <Cpu size={16} className="text-purple-500"/>
              <span className="text-gray-400">Modelos</span>
            </button>
            <button 
              onClick={() => setShowSystemPromptModal(true)}
              className="bg-[#1f1f1f] hover:bg-[#2a2a2a] p-2.5 rounded-lg flex flex-col items-center gap-1 transition text-xs"
            >
              <FileText size={16} className="text-green-500"/>
              <span className="text-gray-400">Prompt</span>
            </button>
            <Link 
              to="/admin/content"
              className="bg-[#1f1f1f] hover:bg-[#2a2a2a] p-2.5 rounded-lg flex flex-col items-center gap-1 transition text-xs"
            >
              <Layout size={16} className="text-pink-500"/>
              <span className="text-gray-400">Conteúdo</span>
            </Link>
          </div>
          
          {/* Analytics Buttons */}
          <div className="flex gap-1.5 mt-1.5">
            <button 
              onClick={() => { setShowGroqPanel(true); loadGroqData(); }}
              className="flex-1 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 p-2 rounded-lg flex items-center justify-center gap-1.5 transition text-xs"
            >
              <Zap size={14}/> Groq
            </button>
            <button 
              onClick={() => { setShowModelsPanel(true); loadModelsData(); }}
              className="flex-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 p-2 rounded-lg flex items-center justify-center gap-1.5 transition text-xs"
            >
              <Activity size={14}/> Analytics
            </button>
          </div>
          
          {/* Status das APIs */}
          <div className="mt-2 flex gap-1.5 text-[10px]">
            {apiKeyConfig?.hasGlobalApiKey && (
              <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">OR ✓</span>
            )}
            {apiKeyConfig?.hasGroqApiKey && (
              <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">Groq ✓</span>
            )}
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 text-xs text-gray-500 uppercase tracking-wide flex items-center justify-between px-3">
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
              className={`p-3 mx-2 mb-1 rounded-lg cursor-pointer transition ${
                selectedUser === u._id ? 'bg-blue-600/20 ring-1 ring-blue-500' : 'hover:bg-[#1f1f1f]'
              }`}
            >
              <div className="font-medium flex items-center gap-2 text-sm">
                <User size={14} className={u.role === 'admin' ? 'text-yellow-500' : 'text-gray-500'}/>
                {u.username}
                {u.role === 'admin' && <span className="text-[10px] bg-yellow-600/30 text-yellow-400 px-1.5 py-0.5 rounded">ADMIN</span>}
              </div>
              <div className="text-xs text-gray-500 mt-1 ml-5">
                {u.displayName && <span className="text-gray-400">{u.displayName} • </span>}
                {u.usage?.requests || 0} reqs
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[#2a2a2a]">
          <Link to="/chat" className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm p-2 rounded-lg hover:bg-[#1f1f1f]">
            <ChevronLeft size={16}/> Voltar ao Chat
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-[#0f0f0f] overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-[#171717] p-4 flex items-center gap-4 border-b border-[#2a2a2a]">
          <button onClick={() => setShowMobileMenu(true)} className="p-2">
            <Menu size={24}/>
          </button>
          <span className="font-semibold">{t.title}</span>
        </div>

        {!userDetails ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#1f1f1f] flex items-center justify-center mx-auto mb-4">
                <Users size={32} className="text-gray-600"/>
              </div>
              <p className="text-gray-400">{texts.admin.selectUser || 'Selecione um usuário'}</p>
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-4xl mx-auto">
            {/* User Header */}
            <div className="bg-[#171717] rounded-2xl p-6 mb-6 border border-[#2a2a2a]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold">
                    {(userDetails.user.displayName || userDetails.user.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                      {userDetails.user.displayName || userDetails.user.username}
                      {userDetails.user.role === 'admin' && (
                        <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded">ADMIN</span>
                      )}
                    </h1>
                    <p className="text-gray-500 text-sm">@{userDetails.user.username}</p>
                    {userDetails.user.bio && (
                      <p className="text-gray-400 text-xs mt-1 italic max-w-md">"{userDetails.user.bio}"</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowMessageModal(true)}
                    className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-2 rounded-lg flex items-center gap-2 transition text-sm"
                  >
                    <Send size={14}/> Mensagem
                  </button>
                  <button 
                    onClick={() => toggleAdmin(userDetails.user._id)}
                    className={`${
                      userDetails.user.role === 'admin' 
                        ? 'bg-gray-600/20 hover:bg-gray-600/30 text-gray-400' 
                        : 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400'
                    } px-3 py-2 rounded-lg flex items-center gap-2 transition text-sm`}
                  >
                    <Shield size={14}/> 
                    {userDetails.user.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                  </button>
                  {userDetails.user.role !== 'admin' && (
                    <button 
                      onClick={() => deleteUser(userDetails.user._id)}
                      className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-2 rounded-lg flex items-center gap-2 transition text-sm"
                    >
                      <Trash2 size={14}/> Apagar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-[#171717] p-4 rounded-xl border border-[#2a2a2a]">
                <div className="text-2xl font-bold text-blue-400">{userDetails.chats.length}</div>
                <div className="text-xs text-gray-500">{t.chats}</div>
              </div>
              <div className="bg-[#171717] p-4 rounded-xl border border-[#2a2a2a]">
                <div className="text-2xl font-bold text-green-400">{userDetails.tools.length}</div>
                <div className="text-xs text-gray-500">{t.tools}</div>
              </div>
              <div className="bg-[#171717] p-4 rounded-xl border border-[#2a2a2a]">
                <div className="text-2xl font-bold text-purple-400">{userDetails.user.usage?.requests || 0}</div>
                <div className="text-xs text-gray-500">{t.requests}</div>
              </div>
              <div className="bg-[#171717] p-4 rounded-xl border border-[#2a2a2a]">
                <div className="text-2xl font-bold text-yellow-400">{userDetails.user.hasPersonalKey ? '✓' : '✗'}</div>
                <div className="text-xs text-gray-500">API Key</div>
              </div>
            </div>

            {/* Chats */}
            <div className="mb-6">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2 text-gray-400">
                <MessageSquare size={16}/> {t.chats} ({userDetails.chats.length})
              </h2>
              {userDetails.chats.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Nenhum chat encontrado</p>
              ) : (
                <div className="space-y-2">
                  {userDetails.chats.slice(0, 10).map(c => (
                    <div 
                      key={c._id} 
                      className="bg-[#171717] p-3 rounded-xl flex items-center justify-between gap-3 hover:bg-[#1f1f1f] transition cursor-pointer border border-[#2a2a2a]"
                      onClick={() => openChat(c._id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{c.title}</div>
                        <div className="text-xs text-gray-500">{c.model?.split('/').pop() || 'N/A'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {new Date(c.updatedAt).toLocaleDateString('pt-BR')}
                        </span>
                        <button 
                          onClick={e => { e.stopPropagation(); deleteChat(c._id); }}
                          className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                  ))}
                  {userDetails.chats.length > 10 && (
                    <p className="text-xs text-gray-500 text-center py-2">
                      + {userDetails.chats.length - 10} mais chats
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Tools */}
            <div>
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2 text-gray-400">
                <Wrench size={16}/> {t.tools} ({userDetails.tools.length})
              </h2>
              {userDetails.tools.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Nenhuma ferramenta encontrada</p>
              ) : (
                <div className="space-y-2">
                  {userDetails.tools.map(t => (
                    <div key={t._id} className="bg-[#171717] p-3 rounded-xl border border-[#2a2a2a]">
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

      {/* Modal Gerenciamento Global de Modelos */}
      {showModelsPanel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Cpu className="text-purple-500"/> Gerenciamento de Modelos
              </h2>
              <button onClick={() => setShowModelsPanel(false)}>
                <X size={24}/>
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-gray-700 overflow-x-auto">
              {[
                { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
                { id: 'providers', label: 'Por Provedor', icon: Database },
                { id: 'userRanking', label: 'Ranking', icon: Trophy },
                { id: 'hidden', label: 'Ocultos', icon: EyeOff },
                { id: 'errors', label: 'Erros', icon: AlertTriangle },
                { id: 'test', label: 'Testar Modelos', icon: Zap }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setModelsActiveTab(tab.id)}
                  className={`flex-1 p-3 flex items-center justify-center gap-2 transition text-sm whitespace-nowrap ${
                    modelsActiveTab === tab.id 
                      ? 'bg-purple-600 text-white' 
                      : 'hover:bg-gray-700 text-gray-400'
                  }`}
                >
                  <tab.icon size={16}/> {tab.label}
                </button>
              ))}
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {loadingModels ? (
                <div className="text-center py-8">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={32}/>
                  <p>Carregando...</p>
                </div>
              ) : (
                <>
                  {/* Tab: Estatísticas Gerais */}
                  {modelsActiveTab === 'stats' && allModelsStats && (
                    <div className="space-y-6">
                      {/* Cards de resumo */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-600">
                          <p className="text-xs text-gray-500 uppercase">Total Requisições</p>
                          <p className="text-2xl font-bold text-purple-400">
                            {allModelsStats.total?.totalRequests?.toLocaleString() || 0}
                          </p>
                        </div>
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-600">
                          <p className="text-xs text-gray-500 uppercase">Taxa de Sucesso</p>
                          <p className="text-2xl font-bold text-green-400">
                            {allModelsStats.total?.successRate?.toFixed(1) || 100}%
                          </p>
                        </div>
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-600">
                          <p className="text-xs text-gray-500 uppercase">Modelos Únicos</p>
                          <p className="text-2xl font-bold text-blue-400">
                            {allModelsStats.total?.uniqueModels || 0}
                          </p>
                        </div>
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-600">
                          <p className="text-xs text-gray-500 uppercase">Usuários Ativos</p>
                          <p className="text-2xl font-bold text-orange-400">
                            {allModelsStats.total?.uniqueUsers || 0}
                          </p>
                        </div>
                      </div>
                      
                      {/* Top Modelos */}
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold">Top Modelos (7 dias)</h3>
                          <button 
                            onClick={loadModelsData}
                            className="text-sm bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded flex items-center gap-1"
                          >
                            <RefreshCw size={14}/> Atualizar
                          </button>
                        </div>
                        
                        <div className="grid gap-3">
                          {(allModelsStats.modelUsage || []).slice(0, 10).map((item, index) => {
                            const maxCount = allModelsStats.modelUsage?.[0]?.count || 1;
                            const percentage = (item.count / maxCount) * 100;
                            const modelKey = `${item.provider}:${item.modelId}`;
                            const isHidden = hiddenModels.includes(modelKey);
                            
                            return (
                              <div 
                                key={modelKey}
                                className={`p-4 rounded-lg border ${
                                  isHidden 
                                    ? 'bg-gray-900/50 border-gray-700 opacity-60' 
                                    : 'bg-gray-900 border-gray-600'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    {index === 0 && <span className="text-yellow-400">🥇</span>}
                                    {index === 1 && <span className="text-gray-300">🥈</span>}
                                    {index === 2 && <span className="text-orange-400">🥉</span>}
                                    <span className="font-semibold">{item.modelId}</span>
                                    <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded">
                                      {item.provider}
                                    </span>
                                    {isHidden && (
                                      <span className="text-xs bg-red-600/50 px-2 py-0.5 rounded">Oculto</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-purple-400 font-bold">
                                      {item.count.toLocaleString()} usos
                                    </span>
                                    <button
                                      onClick={() => toggleModelVisibility(item.modelId, item.provider, isHidden)}
                                      className={`p-2 rounded transition ${
                                        isHidden 
                                          ? 'bg-green-600 hover:bg-green-500' 
                                          : 'bg-red-600 hover:bg-red-500'
                                      }`}
                                      title={isHidden ? 'Mostrar' : 'Ocultar'}
                                    >
                                      {isHidden ? <Eye size={14}/> : <EyeOff size={14}/>}
                                    </button>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-purple-500 h-2 rounded-full transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <div className="flex justify-between mt-1 text-xs text-gray-500">
                                  <span>{item.uniqueUsers || 0} usuários</span>
                                  <span className={item.successRate >= 90 ? 'text-green-400' : item.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                                    {item.successRate?.toFixed(1) || 100}% sucesso
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Tab: Por Provedor */}
                  {modelsActiveTab === 'providers' && allModelsStats && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold mb-4">Uso por Provedor</h3>
                      
                      <div className="grid gap-4">
                        {(allModelsStats.providerUsage || []).map((provider, index) => {
                          const maxCount = allModelsStats.providerUsage?.[0]?.count || 1;
                          const percentage = (provider.count / maxCount) * 100;
                          
                          const providerColors = {
                            'groq': 'bg-orange-600',
                            'pollinations-ai': 'bg-green-600',
                            'deepinfra': 'bg-blue-600',
                            'cloudflare': 'bg-yellow-600',
                            'cerebras': 'bg-pink-600'
                          };
                          
                          return (
                            <div 
                              key={provider.provider}
                              className="p-4 bg-gray-900 rounded-lg border border-gray-600"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Database className="text-purple-400"/>
                                  <span className="font-semibold text-lg capitalize">{provider.provider}</span>
                                </div>
                                <span className="text-2xl font-bold text-purple-400">
                                  {provider.count.toLocaleString()}
                                </span>
                              </div>
                              
                              <div className="w-full bg-gray-700 rounded-full h-3 mb-3">
                                <div 
                                  className={`${providerColors[provider.provider] || 'bg-purple-500'} h-3 rounded-full transition-all`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                <div className="text-center">
                                  <p className="text-gray-500">Modelos</p>
                                  <p className="font-semibold text-blue-400">{provider.uniqueModels}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-gray-500">Usuários</p>
                                  <p className="font-semibold text-orange-400">{provider.uniqueUsers}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-gray-500">Sucesso</p>
                                  <p className={`font-semibold ${
                                    provider.successRate >= 90 ? 'text-green-400' : 
                                    provider.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>{provider.successRate?.toFixed(1)}%</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-gray-500">Erros</p>
                                  <p className="font-semibold text-red-400">{provider.errorCount}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Tab: Ranking de Usuários */}
                  {modelsActiveTab === 'userRanking' && allModelsStats && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold mb-4">Ranking Geral de Usuários</h3>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left border-b border-gray-700">
                              <th className="p-3 text-gray-400">#</th>
                              <th className="p-3 text-gray-400">Usuário</th>
                              <th className="p-3 text-gray-400">Requisições</th>
                              <th className="p-3 text-gray-400">Modelos</th>
                              <th className="p-3 text-gray-400">Provedores</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(allModelsStats.topUsersGeneral || []).map((user, index) => (
                              <tr 
                                key={user.userId || index}
                                className={`border-b border-gray-800 ${
                                  index < 3 ? 'bg-purple-900/20' : ''
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
                                    <span className="font-medium">{user.username || 'Usuário'}</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <span className="text-purple-400 font-bold">
                                    {user.count.toLocaleString()}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-400">{user.modelsUsed}</td>
                                <td className="p-3 text-gray-400">{user.providersUsed}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Tab: Modelos Ocultos */}
                  {modelsActiveTab === 'hidden' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold mb-4">
                        Modelos Ocultos ({hiddenModels.length})
                      </h3>
                      
                      {hiddenModels.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <EyeOff size={48} className="mx-auto mb-4 opacity-50"/>
                          <p>Nenhum modelo oculto</p>
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {hiddenModels.map(modelKey => {
                            const [provider, ...modelIdParts] = modelKey.split(':');
                            const modelId = modelIdParts.join(':');
                            
                            return (
                              <div 
                                key={modelKey}
                                className="p-4 bg-gray-900 rounded-lg border border-red-600/30 flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-semibold">{modelId}</span>
                                  <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded ml-2">
                                    {provider}
                                  </span>
                                </div>
                                <button
                                  onClick={() => unhideModel(modelKey)}
                                  className="bg-green-600 hover:bg-green-500 p-2 rounded flex items-center gap-2 transition"
                                >
                                  <Eye size={16}/> Reativar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Modelos auto-ocultados */}
                      {allModelsStats?.autoHiddenModels?.length > 0 && (
                        <div className="mt-8">
                          <h4 className="text-md font-semibold mb-3 flex items-center gap-2 text-yellow-400">
                            <AlertTriangle size={18}/> Modelos Auto-Ocultados (muitos erros)
                          </h4>
                          <div className="grid gap-3">
                            {allModelsStats.autoHiddenModels.map((item, index) => (
                              <div 
                                key={index}
                                className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-600/30"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="font-semibold">{item._id.modelId}</span>
                                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded ml-2">
                                      {item._id.provider}
                                    </span>
                                  </div>
                                  <span className="text-red-400 font-bold">
                                    {item.errorCount} erros
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                  Último erro: {item.lastError?.substring(0, 100)}...
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Tab: Erros Recentes */}
                  {modelsActiveTab === 'errors' && allModelsStats && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold mb-4">Erros Recentes</h3>
                      
                      {(allModelsStats.recentErrors || []).length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <AlertTriangle size={48} className="mx-auto mb-4 opacity-50"/>
                          <p>Nenhum erro registrado</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(allModelsStats.recentErrors || []).map((err, index) => (
                            <div 
                              key={index}
                              className="p-4 bg-gray-900 rounded-lg border border-red-600/30"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold">{err.modelId}</span>
                                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                                      {err.provider}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      err.errorType === 'rate_limit' ? 'bg-yellow-600/50 text-yellow-300' :
                                      err.errorType === 'model_error' ? 'bg-red-600/50 text-red-300' :
                                      err.errorType === 'auth' ? 'bg-orange-600/50 text-orange-300' :
                                      'bg-gray-600/50 text-gray-300'
                                    }`}>
                                      {err.errorType || 'other'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-red-400 mt-1">
                                    {err.error?.substring(0, 150)}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-2">
                                    Usuário: {err.username || 'Desconhecido'} • 
                                    {new Date(err.timestamp).toLocaleString('pt-BR')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Tab: Teste de Modelos */}
                  {modelsActiveTab === 'test' && (
                    <div className="space-y-6">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">Teste de Modelos</h3>
                          <p className="text-sm text-gray-500">
                            Testa todos os modelos e oculta automaticamente os que não funcionam
                          </p>
                        </div>
                        <button 
                          onClick={startModelTest}
                          disabled={testingModels}
                          className={`px-6 py-3 rounded-lg flex items-center gap-2 transition font-medium ${
                            testingModels 
                              ? 'bg-gray-600 cursor-not-allowed' 
                              : 'bg-green-600 hover:bg-green-500'
                          }`}
                        >
                          {testingModels ? (
                            <>
                              <RefreshCw className="animate-spin" size={18}/>
                              Testando...
                            </>
                          ) : (
                            <>
                              <Zap size={18}/>
                              Iniciar Teste Geral
                            </>
                          )}
                        </button>
                      </div>
                      
                      {testingModels && (
                        <div className="bg-yellow-900/20 border border-yellow-600/30 p-4 rounded-lg">
                          <div className="flex items-center gap-3">
                            <RefreshCw className="animate-spin text-yellow-400" size={24}/>
                            <div>
                              <p className="font-medium text-yellow-300">Teste em andamento...</p>
                              <p className="text-sm text-yellow-400/70">
                                Isso pode levar alguns minutos. Os resultados aparecerão automaticamente.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {testResults && (
                        <div className="space-y-4">
                          {/* Resumo do teste */}
                          <div className="bg-gray-900 p-4 rounded-lg border border-gray-600">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-semibold">Último Teste</h4>
                              <span className="text-xs text-gray-500">
                                {new Date(testResults.timestamp).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center">
                                <p className="text-2xl font-bold text-blue-400">{testResults.totalTested}</p>
                                <p className="text-xs text-gray-500">Testados</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-green-400">{testResults.successful}</p>
                                <p className="text-xs text-gray-500">Funcionando</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-red-400">{testResults.failed}</p>
                                <p className="text-xs text-gray-500">Falharam</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-orange-400">{testResults.autoHidden}</p>
                                <p className="text-xs text-gray-500">Auto-Ocultados</p>
                              </div>
                            </div>
                            
                            {/* Barra de progresso */}
                            <div className="mt-4">
                              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden flex">
                                <div 
                                  className="bg-green-500 h-3"
                                  style={{ width: `${(testResults.successful / testResults.totalTested) * 100}%` }}
                                />
                                <div 
                                  className="bg-red-500 h-3"
                                  style={{ width: `${(testResults.failed / testResults.totalTested) * 100}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>{((testResults.successful / testResults.totalTested) * 100).toFixed(1)}% OK</span>
                                <span>{((testResults.failed / testResults.totalTested) * 100).toFixed(1)}% Falhas</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Lista de resultados */}
                          <div>
                            <h4 className="font-semibold mb-3">Resultados Detalhados</h4>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {(testResults.results || []).map((result, index) => (
                                <div 
                                  key={index}
                                  className={`p-3 rounded-lg border flex items-center justify-between ${
                                    result.success 
                                      ? 'bg-green-900/20 border-green-600/30' 
                                      : result.hidden 
                                        ? 'bg-red-900/30 border-red-600/50' 
                                        : 'bg-yellow-900/20 border-yellow-600/30'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    {result.success ? (
                                      <span className="text-green-400 text-xl">✓</span>
                                    ) : result.hidden ? (
                                      <span className="text-red-400 text-xl">✗</span>
                                    ) : (
                                      <span className="text-yellow-400 text-xl">⚠</span>
                                    )}
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{result.modelId}</span>
                                        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                                          {result.provider}
                                        </span>
                                        {result.hidden && (
                                          <span className="text-xs bg-red-600 px-2 py-0.5 rounded">
                                            Ocultado
                                          </span>
                                        )}
                                      </div>
                                      {result.error && (
                                        <p className="text-xs text-red-400 mt-1">
                                          {result.error.substring(0, 80)}...
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className={`text-sm font-medium ${
                                      result.success ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                      {result.duration}ms
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {!testResults && !testingModels && (
                        <div className="text-center py-12 text-gray-500">
                          <Zap size={48} className="mx-auto mb-4 opacity-50"/>
                          <p className="text-lg mb-2">Nenhum teste realizado ainda</p>
                          <p className="text-sm">
                            Clique em "Iniciar Teste Geral" para testar todos os modelos
                          </p>
                        </div>
                      )}
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
