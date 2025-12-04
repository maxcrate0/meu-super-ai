import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
  Zap,
  Paperclip,
  Image,
  Globe,
  Terminal,
  Code,
  Play,
  Bot,
  Cpu,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Shield,
  Sparkles,
  Volume2,
  Video,
  FileText,
  Network,
  Eye,
  MousePointer,
  Search,
  RefreshCw,
  Copy,
  Download,
  Upload,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { http } from '../lib/api';

// ============ CONSTANTS ============
const MODEL_CATEGORIES = {
  chat: { label: 'Texto', icon: MessageSquare, color: 'blue' },
  image: { label: 'Imagem', icon: Image, color: 'pink' },
  audio: { label: 'Áudio', icon: Volume2, color: 'green' },
  video: { label: 'Vídeo', icon: Video, color: 'purple' },
  code: { label: 'Código', icon: Code, color: 'yellow' },
  moderation: { label: 'Moderação', icon: Shield, color: 'red' },
  tts: { label: 'TTS', icon: Volume2, color: 'cyan' },
};

const PROVIDER_CONFIG = {
  openrouter: {
    label: 'OpenRouter',
    color: 'from-purple-500 to-indigo-600',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  groq: {
    label: 'Groq',
    color: 'from-orange-500 to-red-600',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  },
  g4f: {
    label: 'G4F',
    color: 'from-green-500 to-teal-600',
    badge: 'bg-green-500/20 text-green-300 border-green-500/30',
  },
  'g4f-python': {
    label: 'G4F Python',
    color: 'from-blue-500 to-cyan-600',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  cloudflare: {
    label: 'Cloudflare',
    color: 'from-amber-500 to-yellow-600',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
};

// ============ COMPONENTS ============
const CodeBlock = ({ inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const code = String(children).replace(/\n$/, '');
  
  if (!inline && match) {
    return (
      <div className="relative group">
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="absolute right-2 top-2 p-1.5 rounded-md bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Copy size={14} className="text-gray-400" />
        </button>
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          className="rounded-xl !bg-gray-900/80 !border !border-gray-800"
          {...props}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }
  return <code className={className} {...props}>{children}</code>;
};

const MessageBubble = ({ message, isLight }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';
  
  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className={`max-w-2xl w-full rounded-xl px-4 py-2 text-xs ${
          isLight ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-indigo-900/30 text-indigo-300 border border-indigo-800'
        }`}>
          <span className="font-semibold">Sistema:</span> {message.content}
        </div>
      </div>
    );
  }
  
  if (isTool) {
    return (
      <div className="flex justify-start">
        <div className={`max-w-3xl w-full rounded-xl px-4 py-3 ${
          isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-900/20 border border-amber-800'
        }`}>
          <div className="flex items-center gap-2 mb-2 text-xs font-medium text-amber-500">
            <Wrench size={14} /> Ferramenta: {message.name || 'Tool'}
          </div>
          <pre className="text-xs overflow-auto">{message.content}</pre>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl w-full rounded-2xl px-5 py-4 shadow-lg transition-all ${
        isUser
          ? isLight
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white ml-12'
            : 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white ml-12'
          : isLight
            ? 'bg-white text-gray-900 border border-gray-200 mr-12'
            : 'bg-gray-900/80 text-gray-100 border border-gray-800 mr-12'
      }`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-2 text-xs font-medium opacity-70">
            <Bot size={14} /> Assistente
          </div>
        )}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{ code: CodeBlock }}
          className="prose max-w-none text-sm leading-relaxed prose-p:my-2 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2"
        >
          {message.content || ''}
        </ReactMarkdown>
        {message.toolResults && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <div className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
              <Zap size={12} /> Ferramentas executadas:
            </div>
            {message.toolResults.map((tr, idx) => (
              <div key={idx} className="text-xs bg-gray-800/50 rounded-lg p-2 mb-1">
                <span className="text-cyan-400">{tr.tool}:</span> {JSON.stringify(tr.result).slice(0, 100)}...
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Sidebar = ({ 
  chats, activeChatId, onSelect, onCreate, onDelete, onRename, 
  loading, collapsed, isLight, onNavigateAdmin, user 
}) => {
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

  const surface = isLight ? 'bg-white/95' : 'bg-[#0f0f0f]/95';
  const border = isLight ? 'border-gray-200' : 'border-[#2a2a2a]';
  const muted = isLight ? 'text-gray-500' : 'text-gray-400';

  return (
    <aside className={`${collapsed ? 'hidden lg:flex lg:w-72' : 'w-full lg:w-72'} flex-shrink-0 h-full border-r ${border} ${surface} backdrop-blur-xl`}>
      <div className="flex flex-col h-full w-full">
        {/* Header */}
        <div className={`p-4 flex items-center justify-between border-b ${border}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">jgspAI</h1>
              <p className={`text-xs ${muted}`}>Chat Inteligente</p>
            </div>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={onCreate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} /> Nova Conversa
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-2">
          {chats.length === 0 && (
            <div className={`p-4 text-sm ${muted} text-center`}>
              Nenhuma conversa ainda.
            </div>
          )}
          {chats.map((chat) => {
            const isActive = chat._id === activeChatId;
            const isEditing = editingId === chat._id;
            return (
              <div
                key={chat._id}
                className={`mb-1 px-3 py-3 flex items-center gap-2 rounded-xl cursor-pointer transition-all ${
                  isActive 
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30' 
                    : isLight 
                      ? 'hover:bg-gray-100' 
                      : 'hover:bg-gray-900/60'
                }`}
                onClick={() => !isEditing && onSelect(chat._id)}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className={`flex-1 bg-transparent border ${border} rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-indigo-500`}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && save()}
                    />
                    <button onClick={save} className="text-emerald-500 hover:text-emerald-400">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} className={muted}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <MessageSquare size={16} className={isActive ? 'text-indigo-400' : muted} />
                    <div className="flex-1 text-sm truncate">{chat.title || 'Sem título'}</div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); startEdit(chat); }} 
                      className={`${muted} hover:text-indigo-400 opacity-0 group-hover:opacity-100`}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(chat._id); }}
                      className={`${muted} hover:text-red-500`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={`p-3 border-t ${border} space-y-2`}>
          {user?.role === 'admin' && (
            <button
              onClick={onNavigateAdmin}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border ${border} text-sm transition-all ${
                isLight ? 'hover:bg-gray-100 text-gray-700' : 'hover:bg-gray-900 text-gray-300'
              }`}
            >
              <Shield size={16} className="text-yellow-500" /> Painel Admin
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

const ModelSelector = ({ models, selected, onChange, loading, isLight }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchProvider = activeProvider === 'all' || m.provider === activeProvider;
      const matchCategory = activeCategory === 'all' || m.type === activeCategory;
      const matchSearch = !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.id?.toLowerCase().includes(search.toLowerCase());
      return matchProvider && matchCategory && matchSearch;
    });
  }, [models, activeProvider, activeCategory, search]);

  const groupedByProvider = useMemo(() => {
    const groups = {};
    filteredModels.forEach((m) => {
      const provider = m.provider || 'other';
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(m);
    });
    return groups;
  }, [filteredModels]);

  const selectedModel = models.find((m) => m.id === selected);
  const providerConfig = selectedModel ? PROVIDER_CONFIG[selectedModel.provider] : null;

  const border = isLight ? 'border-gray-200' : 'border-gray-800';
  const surface = isLight ? 'bg-white' : 'bg-[#171717]';
  const muted = isLight ? 'text-gray-500' : 'text-gray-400';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${border} ${surface} transition-all hover:border-indigo-500 min-w-[240px]`}
      >
        <Cpu size={16} className="text-indigo-400" />
        <div className="flex-1 text-left">
          <div className="text-sm font-medium truncate max-w-[180px]">
            {selectedModel?.name || selected || 'Selecionar modelo'}
          </div>
          {providerConfig && (
            <div className={`text-xs px-1.5 py-0.5 rounded-md inline-block mt-0.5 border ${providerConfig.badge}`}>
              {providerConfig.label}
            </div>
          )}
        </div>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 mt-2 w-[400px] max-h-[500px] overflow-hidden rounded-2xl border ${border} ${surface} shadow-2xl z-50`}>
          {/* Search */}
          <div className={`p-3 border-b ${border}`}>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${border} ${isLight ? 'bg-gray-50' : 'bg-gray-900'}`}>
              <Search size={16} className={muted} />
              <input
                type="text"
                placeholder="Buscar modelos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Provider Tabs */}
          <div className={`flex gap-1 p-2 border-b ${border} overflow-x-auto`}>
            <button
              onClick={() => setActiveProvider('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                activeProvider === 'all' ? 'bg-indigo-600 text-white' : `${isLight ? 'bg-gray-100' : 'bg-gray-800'} ${muted}`
              }`}
            >
              Todos
            </button>
            {Object.entries(PROVIDER_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setActiveProvider(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  activeProvider === key ? `bg-gradient-to-r ${config.color} text-white` : `${isLight ? 'bg-gray-100' : 'bg-gray-800'} ${muted}`
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>

          {/* Category Tabs */}
          <div className={`flex gap-1 p-2 border-b ${border} overflow-x-auto`}>
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-2 py-1 rounded-lg text-xs transition ${
                activeCategory === 'all' ? 'bg-indigo-500/20 text-indigo-300' : muted
              }`}
            >
              Todos
            </button>
            {Object.entries(MODEL_CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition ${
                  activeCategory === key ? 'bg-indigo-500/20 text-indigo-300' : muted
                }`}
              >
                <cat.icon size={12} /> {cat.label}
              </button>
            ))}
          </div>

          {/* Models List */}
          <div className="max-h-[300px] overflow-y-auto p-2">
            {Object.entries(groupedByProvider).map(([provider, items]) => (
              <div key={provider} className="mb-3">
                <div className={`text-xs font-semibold ${muted} uppercase tracking-wide px-2 py-1`}>
                  {PROVIDER_CONFIG[provider]?.label || provider} ({items.length})
                </div>
                {items.slice(0, 50).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onChange(m.id); setIsOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                      selected === m.id 
                        ? 'bg-indigo-500/20 border border-indigo-500/50' 
                        : isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium truncate">{m.name || m.id}</div>
                      <div className={`text-xs ${muted} truncate`}>{m.id}</div>
                    </div>
                    {m.type && MODEL_CATEGORIES[m.type] && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300">
                        {MODEL_CATEGORIES[m.type].label}
                      </span>
                    )}
                    {m.speed && (
                      <span className={`text-xs ${muted}`}>{m.speed}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
            {filteredModels.length === 0 && (
              <div className={`text-center py-8 ${muted}`}>
                Nenhum modelo encontrado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SettingsPanel = ({ isOpen, onClose, isLight, settings, onUpdateSettings }) => {
  if (!isOpen) return null;

  const border = isLight ? 'border-gray-200' : 'border-[#2a2a2a]';
  const surface = isLight ? 'bg-white' : 'bg-[#171717]';
  const muted = isLight ? 'text-gray-500' : 'text-gray-400';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4" onClick={onClose}>
      <div className={`rounded-2xl w-full max-w-lg shadow-2xl border ${border} ${surface}`} onClick={(e) => e.stopPropagation()}>
        <div className={`px-5 py-4 border-b ${border} flex items-center justify-between`}>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings size={20} className="text-indigo-400" /> Configurações
          </h2>
          <button onClick={onClose} className={`p-2 rounded-lg ${isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'}`}>
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 space-y-6">
          {/* Theme */}
          <div>
            <label className={`text-sm font-medium ${muted} block mb-3`}>Tema</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition ${
                  settings.theme === 'dark' 
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' 
                    : `${border} ${isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'}`
                }`}
              >
                <Moon size={18} /> Escuro
              </button>
              <button
                onClick={() => onUpdateSettings({ theme: 'light' })}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition ${
                  settings.theme === 'light' 
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' 
                    : `${border} ${isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'}`
                }`}
              >
                <Sun size={18} /> Claro
              </button>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className={`text-sm font-medium ${muted} block mb-2`}>
              System Prompt Pessoal
              <span className="text-xs ml-2 opacity-60">(prioridade abaixo do admin)</span>
            </label>
            <textarea
              value={settings.userSystemPrompt || ''}
              onChange={(e) => onUpdateSettings({ userSystemPrompt: e.target.value })}
              placeholder="Instruções personalizadas para a IA..."
              className={`w-full rounded-xl px-4 py-3 text-sm border ${border} ${
                isLight ? 'bg-gray-50' : 'bg-gray-900'
              } resize-none focus:outline-none focus:border-indigo-500 transition`}
              rows={4}
            />
          </div>

          {/* Temperature */}
          <div>
            <label className={`text-sm font-medium ${muted} block mb-2`}>
              Temperatura: {settings.temperature || 0.7}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature || 0.7}
              onChange={(e) => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className={`flex justify-between text-xs ${muted} mt-1`}>
              <span>Preciso</span>
              <span>Criativo</span>
            </div>
          </div>
        </div>

        <div className={`px-5 py-4 border-t ${border} flex justify-end`}>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium text-sm"
          >
            Salvar e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const ToolsPanel = ({ isOpen, onClose, isLight, tools, onToggleTool, swarmEnabled, onToggleSwarm }) => {
  if (!isOpen) return null;

  const border = isLight ? 'border-gray-200' : 'border-[#2a2a2a]';
  const surface = isLight ? 'bg-white' : 'bg-[#171717]';
  const muted = isLight ? 'text-gray-500' : 'text-gray-400';

  const builtInTools = [
    { id: 'web_search', name: 'Busca Web', icon: Globe, description: 'Pesquisar na internet' },
    { id: 'web_browse', name: 'Navegar Web', icon: Eye, description: 'Ver e interagir com sites' },
    { id: 'web_click', name: 'Clicar Elementos', icon: MousePointer, description: 'Clicar em botões e links' },
    { id: 'web_network', name: 'Network Tab', icon: Network, description: 'Ver requisições de rede' },
    { id: 'web_console', name: 'Console', icon: Terminal, description: 'Executar no console do site' },
    { id: 'code_execute', name: 'Executar Código', icon: Code, description: 'Rodar código Python/JS' },
    { id: 'terminal', name: 'Terminal', icon: Terminal, description: 'Executar comandos shell' },
    { id: 'file_read', name: 'Ler Arquivos', icon: FileText, description: 'Ler conteúdo de arquivos' },
    { id: 'file_write', name: 'Escrever Arquivos', icon: FileText, description: 'Criar/editar arquivos' },
    { id: 'generate_image', name: 'Gerar Imagem', icon: Image, description: 'Criar imagens com IA' },
    { id: 'generate_tool', name: 'Gerar Ferramenta', icon: Wrench, description: 'Criar novas ferramentas' },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className={`absolute right-0 top-0 h-full w-full max-w-md ${surface} border-l ${border} shadow-2xl overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className={`sticky top-0 px-5 py-4 border-b ${border} ${surface} flex items-center justify-between`}>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wrench size={20} className="text-amber-400" /> Ferramentas
          </h2>
          <button onClick={onClose} className={`p-2 rounded-lg ${isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'}`}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Swarm Toggle */}
          <div className={`p-4 rounded-xl border ${border} ${isLight ? 'bg-gray-50' : 'bg-gray-900'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <Zap size={20} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold">Swarm Mode</div>
                  <div className={`text-xs ${muted}`}>Execução paralela de agentes</div>
                </div>
              </div>
              <button
                onClick={onToggleSwarm}
                className={`w-12 h-6 rounded-full transition-colors ${
                  swarmEnabled ? 'bg-orange-500' : isLight ? 'bg-gray-300' : 'bg-gray-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                  swarmEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            {swarmEnabled && (
              <div className={`text-xs ${muted} mt-2`}>
                O Swarm delegará tarefas para agentes especializados (Pesquisador, Coder, Escritor, Analista)
              </div>
            )}
          </div>

          {/* Built-in Tools */}
          <div>
            <h3 className={`text-sm font-semibold ${muted} uppercase tracking-wide mb-3`}>Ferramentas Integradas</h3>
            
            {/* Tool Presets */}
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const allToolIds = builtInTools.map(t => t.id);
                  onToggleTool(allToolIds);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${border} transition ${
                  isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
                }`}
              >
                ✨ Todas
              </button>
              <button
                onClick={() => {
                  onToggleTool(['web_search', 'web_browse', 'code_execute', 'file_read']);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${border} transition ${
                  isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
                }`}
              >
                🎯 Padrão
              </button>
              <button
                onClick={() => {
                  onToggleTool([]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${border} transition ${
                  isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
                }`}
              >
                🚫 Nenhuma
              </button>
              <button
                onClick={() => {
                  onToggleTool(['web_search', 'web_browse', 'wikipedia']);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${border} transition ${
                  isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
                }`}
              >
                🌐 Web
              </button>
              <button
                onClick={() => {
                  onToggleTool(['code_execute', 'terminal', 'file_read', 'file_write']);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${border} transition ${
                  isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
                }`}
              >
                💻 Code
              </button>
              <button
                onClick={() => {
                  onToggleTool(['generate_image', 'generate_tool']);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${border} transition ${
                  isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
                }`}
              >
                🎨 Criar
              </button>
            </div>

            <div className="space-y-2">
              {builtInTools.map((tool) => (
                <div
                  key={tool.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${border} ${
                    tools.includes(tool.id) ? 'bg-indigo-500/10 border-indigo-500/50' : ''
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    tools.includes(tool.id) ? 'bg-indigo-500' : isLight ? 'bg-gray-100' : 'bg-gray-800'
                  }`}>
                    <tool.icon size={16} className={tools.includes(tool.id) ? 'text-white' : muted} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{tool.name}</div>
                    <div className={`text-xs ${muted}`}>{tool.description}</div>
                  </div>
                  <button
                    onClick={() => onToggleTool(tool.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      tools.includes(tool.id) 
                        ? 'bg-indigo-500 text-white' 
                        : `border ${border} ${isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'}`
                    }`}
                  >
                    {tools.includes(tool.id) ? 'Ativo' : 'Ativar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FloatingInput = ({ 
  value, onChange, onSend, onAttach, loading, isLight, 
  swarmEnabled, onToggleSwarm, placeholder 
}) => {
  const textareaRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const border = isLight ? 'border-gray-200' : 'border-[#2a2a2a]';
  const surface = isLight ? 'bg-white' : 'bg-[#171717]';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onAttach(files);
    }
  };

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 lg:left-72 p-4 transition-all ${
        isDragging ? 'bg-indigo-500/10' : ''
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className={`max-w-4xl mx-auto ${surface} rounded-2xl border ${border} shadow-2xl p-3`}>
        <div className="flex items-end gap-3">
          {/* Attach Button */}
          <button
            onClick={() => document.getElementById('file-upload').click()}
            className={`p-2.5 rounded-xl transition ${
              isLight ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-gray-800 text-gray-400'
            }`}
            title="Anexar arquivo"
          >
            <Paperclip size={20} />
          </button>
          <input
            id="file-upload"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onAttach(Array.from(e.target.files))}
          />

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={loading}
              rows={1}
              className={`w-full resize-none rounded-xl px-4 py-3 text-sm focus:outline-none transition ${
                isLight 
                  ? 'bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400' 
                  : 'bg-gray-900 focus:bg-gray-800 text-gray-100 placeholder-gray-500'
              }`}
              style={{ maxHeight: '150px', minHeight: '44px' }}
            />
          </div>

          {/* Swarm Toggle */}
          <button
            onClick={onToggleSwarm}
            className={`p-2.5 rounded-xl transition ${
              swarmEnabled 
                ? 'bg-orange-500 text-white' 
                : isLight ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-gray-800 text-gray-400'
            }`}
            title={swarmEnabled ? 'Swarm ativo' : 'Ativar Swarm'}
          >
            <Zap size={20} />
          </button>

          {/* Send Button */}
          <button
            onClick={onSend}
            disabled={loading || !value.trim()}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center gap-2 ${
              loading || !value.trim()
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20'
            }`}
          >
            {loading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <>
                <Send size={18} /> Enviar
              </>
            )}
          </button>
        </div>

        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/20 rounded-2xl border-2 border-dashed border-indigo-500">
            <div className="text-indigo-300 font-medium flex items-center gap-2">
              <Upload size={24} /> Solte os arquivos aqui
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============ MAIN COMPONENT ============
export default function ChatInterface({ user, setUser }) {
  const { texts } = useLanguage();
  const t = texts.chat || {};

  // State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.0-flash-exp:free');
  const [theme, setTheme] = useState(user?.theme || 'dark');
  const [showSettings, setShowSettings] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [swarmEnabled, setSwarmEnabled] = useState(false);
  const [enabledTools, setEnabledTools] = useState(['web_search', 'generate_image']);
  const [userSystemPrompt, setUserSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);

  const endRef = useRef(null);
  const isLight = theme === 'light';

  // Effects
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    document.documentElement.classList.toggle('light-theme', isLight);
  }, [theme, isLight]);

  useEffect(() => {
    const load = async () => {
      try {
        const [chatsRes, modelsRes, g4fRes] = await Promise.all([
          http.get('/chats'),
          http.get('/models'),
          http.get('/models/g4f').catch(() => ({ data: [] })),
        ]);
        
        // Merge all models with proper provider tagging
        const openRouterModels = (modelsRes.data || []).map(m => ({
          ...m,
          provider: m.provider || 'openrouter',
          type: m.type || 'chat'
        }));
        
        const g4fModels = (g4fRes.data || []).map(m => ({
          ...m,
          provider: m.provider || 'g4f',
          type: m.type || 'chat'
        }));
        
        setModels([...openRouterModels, ...g4fModels]);
        setChats(chatsRes.data || []);

        if (chatsRes.data?.length) {
          const first = chatsRes.data[0];
          setActiveChatId(first._id);
          setMessages(first.messages || []);
          if (first.model) setSelectedModel(first.model);
          if (first.userSystemPrompt) setUserSystemPrompt(first.userSystemPrompt);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      }
    };
    load();
  }, []);

  // Handlers
  const navigateToAdmin = () => {
    window.location.href = '/admin';
  };

  const selectChat = async (id) => {
    setActiveChatId(id);
    setLoading(true);
    try {
      const res = await http.get(`/chats/${id}`);
      setMessages(res.data?.messages || []);
      if (res.data?.model) setSelectedModel(res.data.model);
      if (res.data?.userSystemPrompt) setUserSystemPrompt(res.data.userSystemPrompt);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const createChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setAttachments([]);
  };

  const deleteChat = async (id) => {
    if (!confirm('Excluir esta conversa?')) return;
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

  const handleAttach = (files) => {
    setAttachments((prev) => [...prev, ...files]);
  };

  const sendMessage = async (contentOverride, historyOverride) => {
    const content = (contentOverride ?? input).trim();
    const history = historyOverride ?? messages;
    if (!content && attachments.length === 0) return;

    const newMessages = [...history, { role: 'user', content }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const endpoint = swarmEnabled ? '/chat/tools' : '/chat';
      const payload = {
        chatId: activeChatId,
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        model: selectedModel,
        userSystemPrompt,
        temperature,
        tools: enabledTools,
        swarm: swarmEnabled,
      };

      const res = await http.post(endpoint, payload, { timeout: 300000 });
      const reply = {
        role: 'assistant',
        content: res.data?.content || '',
        toolResults: res.data?.toolResults,
      };

      setMessages((prev) => [...prev, reply]);
      
      if (!activeChatId && res.data?.chatId) {
        const derivedTitle = newMessages[0]?.content?.slice(0, 40) || 'Nova conversa';
        const newChat = {
          _id: res.data.chatId,
          title: derivedTitle,
          model: selectedModel,
          messages: [...newMessages, reply],
          updatedAt: new Date().toISOString(),
        };
        setActiveChatId(res.data.chatId);
        setChats((prev) => [newChat, ...prev]);
      } else if (activeChatId) {
        setChats((prev) =>
          prev.map((c) =>
            c._id === activeChatId
              ? { ...c, model: selectedModel, updatedAt: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Erro ao processar mensagem. Tente novamente.' }]);
    }
    setLoading(false);
    setAttachments([]);
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

  const updateSettings = (updates) => {
    if (updates.theme !== undefined) setTheme(updates.theme);
    if (updates.userSystemPrompt !== undefined) setUserSystemPrompt(updates.userSystemPrompt);
    if (updates.temperature !== undefined) setTemperature(updates.temperature);
  };

  const toggleTool = (toolId) => {
    // Aceita array (preset) ou string (toggle individual)
    if (Array.isArray(toolId)) {
      setEnabledTools(toolId);
    } else {
      setEnabledTools((prev) =>
        prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
      );
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    window.location.href = '/';
  };

  // Styles
  const pageBg = isLight ? 'bg-[#f8f9fa]' : 'bg-[#0a0a0a]';
  const headerBg = isLight ? 'bg-white/80' : 'bg-[#0f0f0f]/80';
  const border = isLight ? 'border-gray-200' : 'border-[#2a2a2a]';

  return (
    <div className={`min-h-screen flex ${pageBg} text-${isLight ? 'gray-900' : 'gray-100'}`}>
      {/* Sidebar */}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelect={selectChat}
        onCreate={createChat}
        onDelete={deleteChat}
        onRename={renameChat}
        loading={loading}
        collapsed={!sidebarOpen}
        isLight={isLight}
        onNavigateAdmin={navigateToAdmin}
        user={user}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-screen flex flex-col relative">
        {/* Header */}
        <header className={`sticky top-0 z-40 h-16 flex items-center justify-between px-4 border-b ${border} ${headerBg} backdrop-blur-xl`}>
          <div className="flex items-center gap-3">
            <button
              className={`lg:hidden p-2 rounded-xl ${isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-900'}`}
              onClick={() => setSidebarOpen((v) => !v)}
            >
              {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
            </button>
            <h1 className="text-lg font-semibold hidden sm:block">Chat</h1>
          </div>

          <div className="flex items-center gap-2">
            <ModelSelector
              models={models}
              selected={selectedModel}
              onChange={setSelectedModel}
              loading={loading}
              isLight={isLight}
            />

            <button
              onClick={() => setShowTools(true)}
              className={`p-2.5 rounded-xl border ${border} transition ${
                isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
              } ${enabledTools.length > 0 ? 'border-amber-500/50 text-amber-400' : ''}`}
              title="Ferramentas"
            >
              <Wrench size={18} />
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className={`p-2.5 rounded-xl border ${border} transition ${
                isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
              }`}
              title="Configurações"
            >
              <Settings size={18} />
            </button>

            <button
              onClick={() => setTheme(isLight ? 'dark' : 'light')}
              className={`p-2.5 rounded-xl border ${border} transition ${
                isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
              }`}
              title="Alternar tema"
            >
              {isLight ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <button
              onClick={handleLogout}
              className={`p-2.5 rounded-xl border ${border} transition ${
                isLight ? 'hover:bg-gray-100 text-red-500' : 'hover:bg-gray-800 text-red-400'
              }`}
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Messages */}
        <section className="flex-1 overflow-y-auto px-4 py-6 pb-32">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
                  <Sparkles size={36} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Olá! Como posso ajudar?</h2>
                <p className={`text-sm max-w-md ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                  Sou seu assistente de IA. Posso ajudar com código, pesquisa, criação de conteúdo e muito mais.
                </p>
                {swarmEnabled && (
                  <div className="mt-4 flex items-center gap-2 text-orange-400 text-sm">
                    <Zap size={16} /> Modo Swarm ativo - Agentes especializados disponíveis
                  </div>
                )}
              </div>
            )}
            {messages.map((m, idx) => (
              <MessageBubble key={idx} message={m} isLight={isLight} />
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className={`rounded-2xl px-5 py-4 ${
                  isLight ? 'bg-white border border-gray-200' : 'bg-gray-900/80 border border-gray-800'
                }`}>
                  <div className="flex items-center gap-2 text-indigo-400">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Pensando...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </section>

        {/* Regenerate Button */}
        {messages.length > 0 && !loading && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
            <button
              onClick={regenerate}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${border} ${
                isLight ? 'bg-white hover:bg-gray-50' : 'bg-gray-900 hover:bg-gray-800'
              } text-sm shadow-lg transition`}
            >
              <RotateCcw size={16} /> Regenerar
            </button>
          </div>
        )}

        {/* Floating Input */}
        <FloatingInput
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          onAttach={handleAttach}
          loading={loading}
          isLight={isLight}
          swarmEnabled={swarmEnabled}
          onToggleSwarm={() => setSwarmEnabled(!swarmEnabled)}
          placeholder={t.placeholder || 'Digite sua mensagem...'}
        />
      </main>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isLight={isLight}
        settings={{ theme, userSystemPrompt, temperature }}
        onUpdateSettings={updateSettings}
      />

      {/* Tools Panel */}
      <ToolsPanel
        isOpen={showTools}
        onClose={() => setShowTools(false)}
        isLight={isLight}
        tools={enabledTools}
        onToggleTool={toggleTool}
        swarmEnabled={swarmEnabled}
        onToggleSwarm={() => setSwarmEnabled(!swarmEnabled)}
      />
    </div>
  );
}
