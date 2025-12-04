import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Send,
  RotateCcw,
  Sun,
  Moon,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Settings,
  Wrench,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { http, chooseBase } from '../lib/api';

const DEFAULT_MODELS = [
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'openrouter' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'openrouter' },
  { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek V3', provider: 'openrouter' },
  { id: 'gpt-4', name: 'GPT-4', provider: 'g4f' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'g4f' },
];

const MessageBubble = ({ message, bubbleStyles }) => {
  const isUser = message.role === 'user';
  const bubbleClass = isUser ? bubbleStyles.user : bubbleStyles.assistant;
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl w-full rounded-2xl px-4 py-3 shadow-sm border ${bubbleClass}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          className="prose max-w-none text-sm leading-relaxed prose-p:my-2 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2"
        >
          {message.content || ''}
        </ReactMarkdown>
      </div>
    </div>
  );
};

const Sidebar = ({ chats, activeChatId, onSelect, onCreate, onDelete, onRename, loading, collapsed, children, surface, border, textMuted }) => {
  const [editingId, setEditingId] = useState(null);
  const [titleDraft, setTitleDraft] = useState('');

  const startEdit = (chat) => {
    setEditingId(chat._id);
    setTitleDraft(chat.title || 'Nova conversa');
  };

  const save = () => {
    if (!editingId) return;
    onRename(editingId, titleDraft.trim() || 'Nova conversa');
    setEditingId(null);
  };

  return (
    <aside
      className={`${
        collapsed ? 'hidden lg:flex lg:w-72' : 'w-full lg:w-72'
      } flex-shrink-0 h-full border-r ${border} ${surface} backdrop-blur-xl`}
    >
      <div className="flex flex-col h-full">
        <div className={`p-4 flex items-center justify-between border-b ${border}`}>
          <span className={`text-sm ${textMuted}`}>Conversas</span>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
            disabled={loading}
          >
            <Plus size={16} /> Nova
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 && (
            <div className={`p-4 text-sm ${textMuted}`}>Nenhuma conversa ainda.</div>
          )}
          {chats.map((chat) => {
            const isActive = chat._id === activeChatId;
            const isEditing = editingId === chat._id;
            return (
              <div
                key={chat._id}
                className={`px-4 py-3 flex items-center gap-2 border-b ${border} cursor-pointer ${
                  isActive ? 'bg-indigo-50 dark:bg-gray-900/60' : 'hover:bg-gray-100/70 dark:hover:bg-gray-900/60'
                }`}
                onClick={() => onSelect(chat._id)}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className={`flex-1 ${surface} border ${border} rounded-md px-2 py-1 text-sm focus:outline-none focus:border-indigo-500`}
                    />
                    <button onClick={save} className="text-emerald-500 hover:text-emerald-400">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} className={`${textMuted} hover:text-gray-600 dark:hover:text-gray-200`}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 text-sm truncate text-gray-900 dark:text-gray-200">{chat.title || 'Sem título'}</div>
                    <button onClick={(e) => { e.stopPropagation(); startEdit(chat); }} className={`${textMuted} hover:text-gray-700 dark:hover:text-gray-200`}>
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(chat._id); }}
                      className={`${textMuted} hover:text-red-500`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {children}
      </div>
    </aside>
  );
};

const ModelSelector = ({ models, g4fModels, selected, onChange, loading }) => {
  const list = useMemo(() => {
    const merged = [...models, ...g4fModels];
    if (merged.length === 0) return DEFAULT_MODELS;
    return merged;
  }, [models, g4fModels]);

  return (
    <div className="relative w-full lg:w-72">
      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Modelo</label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-indigo-500"
        disabled={loading}
      >
        {list.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.id}
          </option>
        ))}
      </select>
    </div>
  );
};

export default function ChatInterface({ user, setUser }) {
  const { texts } = useLanguage();
  const t = texts.chat || {};

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [g4fModels, setG4fModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0].id);
  const [theme, setTheme] = useState(user?.theme || 'dark');
  const [showSettings, setShowSettings] = useState(false);
  const [showTools, setShowTools] = useState(false);

  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    document.documentElement.classList.toggle('light-theme', theme === 'light');
  }, [theme]);

  useEffect(() => {
    const load = async () => {
      try {
        const [chatsRes, modelsRes, g4fRes] = await Promise.all([
          http.get('/chats'),
          http.get('/models'),
          http.get('/models/g4f').catch(() => ({ data: [] })),
        ]);
        setChats(chatsRes.data || []);
        setModels(modelsRes.data || []);
        setG4fModels(g4fRes.data || []);

        if (chatsRes.data?.length) {
          const first = chatsRes.data[0];
          setActiveChatId(first._id);
          setMessages(first.messages || []);
          if (first.model) setSelectedModel(first.model);
        }
      } catch (err) {
        console.error(err);
        setModels(DEFAULT_MODELS);
      }
    };
    load();
  }, []);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const toggleSettings = () => setShowSettings((prev) => !prev);
  const toggleTools = () => setShowTools((prev) => !prev);

  const isLight = theme === 'light';
  const bubbleStyles = {
    user: isLight
      ? 'bg-white text-gray-900 border-gray-200'
      : 'bg-indigo-600 text-white border-indigo-500',
    assistant: isLight
      ? 'bg-gray-50 text-gray-900 border-gray-200'
      : 'bg-gray-900/80 text-gray-100 border-gray-800',
  };
  const pageBg = isLight ? 'bg-[#f7f7f8] text-gray-900' : 'bg-gray-950 text-gray-100';
  const surface = isLight ? 'bg-white border-gray-200' : 'bg-gray-950/80 border-gray-900';
  const sidebarSurface = isLight ? 'bg-white text-gray-900' : 'bg-gray-950/90 text-gray-100';
  const controlBorder = isLight ? 'border-gray-200' : 'border-gray-800';
  const inputBg = isLight ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-800';
  const muted = isLight ? 'text-gray-500' : 'text-gray-400';

  const selectChat = async (id) => {
    setActiveChatId(id);
    setLoading(true);
    try {
      const res = await http.get(`/chats/${id}`);
      setMessages(res.data?.messages || []);
      if (res.data?.model) setSelectedModel(res.data.model);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const createChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
  };

  const deleteChat = async (id) => {
    if (!confirm('Excluir chat?')) return;
    try {
      await http.delete(`/chats/${id}`);
      setChats((prev) => prev.filter((c) => c._id !== id));
      if (activeChatId === id) createChat();
    } catch (err) {
      console.error(err);
    }
  };

  const renameChat = async (id, title) => {
    try {
      await http.patch(`/chats/${id}`, { title });
      setChats((prev) => prev.map((c) => (c._id === id ? { ...c, title } : c)));
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessage = async (contentOverride, historyOverride) => {
    const content = (contentOverride ?? input).trim();
    const history = historyOverride ?? messages;
    if (!content) return;

    const newMessages = [...history, { role: 'user', content }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const base = chooseBase();
      const endpoint = `${base}/chat`;
      const payload = {
        chatId: activeChatId,
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        model: selectedModel,
      };

      const res = await http.post(endpoint.replace(base, ''), payload, { baseURL: base, timeout: 300000 });
      const reply = {
        role: 'assistant',
        content: res.data?.content || '',
      };

      setMessages((prev) => [...prev, reply]);
      if (!activeChatId && res.data?.chatId) {
        setActiveChatId(res.data.chatId);
        setChats((prev) => [{ _id: res.data.chatId, title: 'Nova conversa' }, ...prev]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Erro ao enviar mensagem.' }]);
    }
    setLoading(false);
  };

  const regenerate = () => {
    if (!messages.length) return;
    const lastUserIndex = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIndex === -1) return;
    const indexFromStart = messages.length - 1 - lastUserIndex;
    const history = messages.slice(0, indexFromStart);
    const lastUserMessage = messages[indexFromStart];
    sendMessage(lastUserMessage.content, history);
  };

  return (
    <div className={`min-h-screen flex ${pageBg}`}>
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelect={selectChat}
        onCreate={createChat}
        onDelete={deleteChat}
        onRename={renameChat}
        loading={loading}
        collapsed={!sidebarOpen}
        surface={sidebarSurface}
        border={controlBorder}
        textMuted={muted}
      >
        <div className={`px-4 py-3 border-t ${controlBorder} space-y-2`}> 
          <button
            onClick={toggleTools}
            className={`w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${controlBorder} ${isLight ? 'text-gray-800 bg-white hover:border-indigo-500' : 'text-gray-200 hover:border-indigo-500' } text-sm`}
          >
            <Wrench size={16} /> Ferramentas
          </button>
          <button
            onClick={toggleSettings}
            className={`w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${controlBorder} ${isLight ? 'text-gray-800 bg-white hover:border-indigo-500' : 'text-gray-200 hover:border-indigo-500' } text-sm`}
          >
            <Settings size={16} /> Configurações
          </button>
        </div>
      </Sidebar>

      <main className="flex-1 min-h-screen flex flex-col">
        <header className={`h-16 flex items-center justify-between px-4 border-b ${surface} backdrop-blur-xl`}>
          <div className="flex items-center gap-2">
            <button
              className={`lg:hidden p-2 rounded-md ${isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-900'}`}
              onClick={() => setSidebarOpen((v) => !v)}
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">jgspAI Chat</h1>
          </div>

          <div className="flex items-center gap-3">
            <ModelSelector
              models={models}
              g4fModels={g4fModels}
              selected={selectedModel}
              onChange={setSelectedModel}
              loading={loading}
            />
            <button
              onClick={toggleTools}
              className={`p-2 rounded-md border ${controlBorder} hover:border-indigo-500 ${isLight ? 'text-gray-700' : 'text-gray-100'}`}
              title="Ferramentas"
            >
              <Wrench size={18} />
            </button>
            <button
              onClick={toggleSettings}
              className={`p-2 rounded-md border ${controlBorder} hover:border-indigo-500 ${isLight ? 'text-gray-700' : 'text-gray-100'}`}
              title="Configurações"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-md border ${controlBorder} hover:border-indigo-500 ${isLight ? 'text-gray-700' : 'text-gray-100'}`}
              title="Alternar tema"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => { localStorage.clear(); setUser(null); }}
              className="p-2 rounded-md border border-gray-800 hover:border-indigo-500"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className={`text-center text-sm ${muted}`}>Envie a primeira mensagem para começar.</div>
          )}
          {messages.map((m, idx) => (
            <MessageBubble key={idx} message={m} bubbleStyles={bubbleStyles} />
          ))}
          <div ref={endRef} />
          </div>
        </section>

        <footer className={`border-t ${surface} backdrop-blur-xl px-4 py-3`}>
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.placeholder || 'Digite sua mensagem'}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm resize-none shadow-sm ${inputBg} ${isLight ? 'text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100' : 'text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900/40'}`}
              rows={3}
              disabled={loading}
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-60 shadow-sm"
              >
                {loading ? 'Enviando...' : <><Send size={16} /> Enviar</>}
              </button>
              <button
                onClick={regenerate}
                disabled={loading || messages.length === 0}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${controlBorder} ${isLight ? 'text-gray-700 hover:border-indigo-500' : 'text-gray-200 hover:border-indigo-500'} text-sm`}
              >
                <RotateCcw size={16} /> Regenerar
              </button>
            </div>
          </div>
        </footer>
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4" onClick={toggleSettings}>
          <div className={`rounded-2xl w-full max-w-md shadow-xl border ${controlBorder} ${isLight ? 'bg-white' : 'bg-gray-950'}`} onClick={(e) => e.stopPropagation()}>
            <div className={`px-4 py-3 border-b ${controlBorder} flex items-center justify-between`}>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Configurações</h2>
              <button onClick={toggleSettings} className={`text-gray-400 hover:text-gray-200 ${isLight ? 'text-gray-500 hover:text-gray-800' : ''}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className={`text-xs ${muted} mb-2`}>Tema</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`rounded-lg border px-3 py-2 text-sm ${theme === 'dark' ? 'border-indigo-500 text-white bg-gray-900' : `${controlBorder} ${isLight ? 'text-gray-700 bg-white' : 'text-gray-300'}`}`}
                  >
                    <Moon size={14} className="inline mr-2" /> Escuro
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`rounded-lg border px-3 py-2 text-sm ${theme === 'light' ? 'border-indigo-500 text-gray-900 bg-gray-50' : `${controlBorder} ${isLight ? 'text-gray-700 bg-white' : 'text-gray-300'}`}`}
                  >
                    <Sun size={14} className="inline mr-2" /> Claro
                  </button>
                </div>
              </div>
            </div>
            <div className={`px-4 py-3 border-t ${controlBorder} text-right`}>
              <button onClick={toggleSettings} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTools && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={toggleTools}>
          <div className={`absolute right-0 top-0 h-full w-full max-w-sm ${isLight ? 'bg-white' : 'bg-gray-950'} border-l ${controlBorder} shadow-2xl`} onClick={(e) => e.stopPropagation()}>
            <div className={`px-4 py-3 border-b ${controlBorder} flex items-center justify-between`}>
              <div className={`flex items-center gap-2 text-sm font-semibold ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
                <Wrench size={16} /> Ferramentas
              </div>
              <button onClick={toggleTools} className={`text-gray-400 hover:text-gray-200 ${isLight ? 'hover:text-gray-800' : ''}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm text-gray-300 dark:text-gray-300">
              <p className={isLight ? 'text-gray-600' : 'text-gray-400'}>Gerencie e acesse ferramentas personalizadas.</p>
              <p className={isLight ? 'text-gray-500' : 'text-gray-500'}>Integração completa voltará em breve. Por enquanto, use o painel Admin para ajustes avançados.</p>
              <a
                href="/admin"
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${controlBorder} hover:border-indigo-500 ${isLight ? 'text-indigo-600 bg-white' : 'text-indigo-300'}`}
              >
                <Settings size={14} /> Abrir Admin
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
