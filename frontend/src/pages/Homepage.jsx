import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Cpu, MessageSquare, Terminal, Globe, Wrench, ChevronDown,
  LogIn, UserPlus, Menu, X, Sparkles, Zap, Shield, Code,
  Layers, Database, Bot, Infinity
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net';

export default function Homepage({ user, setUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [content, setContent] = useState(null);
  const navigate = useNavigate();
  const toolsTimeoutRef = useRef(null);

  // Carregar conteúdo da página
  useEffect(() => {
    fetch(`${API}/api/content/homepage`)
      .then(r => r.json())
      .then(data => {
        if (data.sections) setContent(data);
      })
      .catch(() => {});
  }, []);

  // Funções para controlar o dropdown com delay
  const handleToolsEnter = () => {
    if (toolsTimeoutRef.current) {
      clearTimeout(toolsTimeoutRef.current);
      toolsTimeoutRef.current = null;
    }
    setToolsOpen(true);
  };

  const handleToolsLeave = () => {
    toolsTimeoutRef.current = setTimeout(() => {
      setToolsOpen(false);
    }, 150);
  };

  const handleToolClick = (toolPath) => {
    setToolsOpen(false);
    if (user) {
      navigate(toolPath);
    } else {
      // Salva destino e redireciona para login
      localStorage.setItem('redirectAfterLogin', toolPath);
      navigate('/login');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    navigate('/');
  };

  const tools = [
    { name: 'Chat AI', path: '/chat', icon: MessageSquare, description: 'Converse com IAs avançadas' },
    // Mais ferramentas serão adicionadas aqui
  ];

  // Conteúdo padrão se não houver customização
  const defaultHero = {
    title: 'jgspAI',
    subtitle: 'Plataforma de Inteligência Artificial avançada com múltiplas ferramentas para potencializar sua produtividade.',
  };

  const defaultFeatures = [
    { icon: MessageSquare, title: 'Chat AI Avançado', desc: 'Converse com modelos de IA de última geração, crie ferramentas customizadas e automatize tarefas.' },
    { icon: Terminal, title: 'Execução de Código', desc: 'Execute comandos bash, scripts Python e muito mais diretamente pela IA.' },
    { icon: Globe, title: 'Pesquisa Web', desc: 'A IA pode pesquisar na web, extrair conteúdo de sites e monitorar requisições.' },
    { icon: Wrench, title: 'Ferramentas Customizáveis', desc: 'Crie suas próprias ferramentas e automações que a IA pode usar.' },
  ];

  const getSection = (id) => content?.sections?.find(s => s.id === id);
  const heroSection = getSection('hero');
  const featuresSection = getSection('features');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-indigo-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo e Menu Esquerdo */}
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-2">
                <Cpu className="h-8 w-8 text-indigo-400" />
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                  jgspAI
                </span>
              </Link>

              {/* Menu Desktop */}
              <div className="hidden md:flex items-center space-x-6">
                {/* Dropdown Ferramentas */}
                <div 
                  className="relative"
                  onMouseEnter={handleToolsEnter}
                  onMouseLeave={handleToolsLeave}
                >
                  <button
                    className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors py-4"
                  >
                    <span>Ferramentas</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {toolsOpen && (
                    <div className="absolute top-full left-0 pt-1 w-72">
                      <div className="bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-indigo-500/30 py-2 animate-fadeIn">
                        {tools.map(tool => (
                          <button
                            key={tool.path}
                            onClick={() => handleToolClick(tool.path)}
                            className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-indigo-500/20 transition-colors text-left"
                          >
                            <tool.icon className="h-5 w-5 text-indigo-400" />
                            <div>
                              <p className="font-medium text-white">{tool.name}</p>
                              <p className="text-sm text-gray-400">{tool.description}</p>
                            </div>
                          </button>
                        ))}
                        <div className="border-t border-gray-700 mt-2 pt-2 px-4 py-2">
                          <p className="text-sm text-gray-500 italic">Mais ferramentas em breve...</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Link to="/docs" className="text-gray-300 hover:text-white transition-colors">
                  Docs
                </Link>
              </div>
            </div>

            {/* Menu Direito */}
            <div className="hidden md:flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-gray-300">Olá, {user.displayName || user.username}</span>
                  {user.role === 'admin' && (
                    <Link 
                      to="/admin" 
                      className="px-3 py-1.5 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="flex items-center space-x-2 px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Entrar</span>
                  </Link>
                  <Link
                    to="/login?register=true"
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-lg transition-all"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Registrar</span>
                  </Link>
                </>
              )}
            </div>

            {/* Menu Mobile Button */}
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-gray-300 hover:text-white"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Menu Mobile */}
        {menuOpen && (
          <div className="md:hidden bg-gray-900/95 backdrop-blur-md border-t border-indigo-500/20 animate-fadeIn">
            <div className="px-4 py-4 space-y-3">
              <div className="border-b border-gray-700 pb-3">
                <p className="text-sm text-gray-400 mb-2">Ferramentas</p>
                {tools.map(tool => (
                  <button
                    key={tool.path}
                    onClick={() => { handleToolClick(tool.path); setMenuOpen(false); }}
                    className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-indigo-500/20 rounded-lg"
                  >
                    <tool.icon className="h-5 w-5 text-indigo-400" />
                    <span>{tool.name}</span>
                  </button>
                ))}
              </div>
              
              <Link 
                to="/docs" 
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 hover:bg-indigo-500/20 rounded-lg"
              >
                Documentação
              </Link>
              
              {user ? (
                <>
                  <div className="border-t border-gray-700 pt-3">
                    <p className="text-sm text-gray-400">Logado como {user.username}</p>
                    {user.role === 'admin' && (
                      <Link 
                        to="/admin" 
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 mt-2 bg-amber-500/20 text-amber-400 rounded-lg"
                      >
                        Painel Admin
                      </Link>
                    )}
                    <button 
                      onClick={() => { handleLogout(); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 mt-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                    >
                      Sair
                    </button>
                  </div>
                </>
              ) : (
                <div className="border-t border-gray-700 pt-3 space-y-2">
                  <Link 
                    to="/login" 
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 hover:bg-indigo-500/20 rounded-lg"
                  >
                    Entrar
                  </Link>
                  <Link 
                    to="/login?register=true" 
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-lg text-center"
                  >
                    Registrar
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-indigo-500/30 rounded-full"></div>
              <Sparkles className="relative h-20 w-20 text-indigo-400 animate-pulse" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-indigo-200 to-cyan-200 bg-clip-text text-transparent">
            {heroSection?.title || defaultHero.title}
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto">
            {heroSection?.subtitle || defaultHero.subtitle}
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => handleToolClick('/chat')}
              className="group flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-indigo-500/25"
            >
              <MessageSquare className="h-5 w-5" />
              <span>Começar a Usar</span>
              <Zap className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            
            <Link
              to="/docs"
              className="flex items-center space-x-2 px-8 py-4 border border-indigo-500/50 hover:border-indigo-400 rounded-xl text-lg transition-colors hover:bg-indigo-500/10"
            >
              <Code className="h-5 w-5" />
              <span>Ver Documentação</span>
            </Link>
          </div>
        </div>
      </section>

      {/* All in One Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-indigo-900/20 to-cyan-900/20">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl flex items-center justify-center">
              <Layers className="h-8 w-8 text-white" />
            </div>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Tudo em um só lugar
          </h2>
          
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
            Acesse <strong className="text-white">dezenas de modelos de IA</strong> de diferentes provedores em uma única plataforma. 
            De GPT a Claude, de Gemini a Llama — todos disponíveis com suporte a <strong className="text-white">OpenRouter</strong> e <strong className="text-cyan-400">GPT4Free</strong>.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {['GPT-4', 'Claude', 'Gemini', 'Llama', 'Mistral', 'DeepSeek', 'Qwen', 'E mais...'].map((model, i) => (
              <div key={i} className="bg-gray-900/50 border border-indigo-500/20 rounded-lg p-3 text-center hover:border-indigo-500/50 transition-colors">
                <span className="text-sm font-medium text-gray-300">{model}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GPT4Free Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <Infinity className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-medium text-emerald-400 uppercase tracking-wide">Novo</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Integração com <span className="text-emerald-400">GPT4Free</span>
              </h2>
              
              <p className="text-gray-300 mb-6">
                Além dos modelos do OpenRouter, agora você também tem acesso aos provedores do <strong className="text-white">GPT4Free</strong> — 
                uma coleção de APIs gratuitas que oferecem acesso a modelos como GPT-4, Claude e outros sem necessidade de API keys.
              </p>
              
              <ul className="space-y-3">
                {[
                  'Dois provedores em uma interface',
                  'Pesquise modelos facilmente',
                  'Alterne entre OpenRouter e G4F',
                  'Sem necessidade de configuração extra'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <Zap className="h-3 w-3 text-emerald-400" />
                    </div>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-gray-900/50 border border-emerald-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bot className="h-6 w-6 text-emerald-400" />
                <span className="font-semibold">Seletor de Modelos</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium">OpenRouter</button>
                  <button className="flex-1 px-4 py-2 bg-gray-800 rounded-lg text-sm font-medium text-gray-400">GPT4Free</button>
                </div>
                
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Pesquisar modelos..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    readOnly
                  />
                </div>
                
                <div className="space-y-2 max-h-48 overflow-hidden">
                  {['google/gemini-2.0-flash', 'meta-llama/llama-3.3-70b', 'deepseek/deepseek-chat', 'mistral/mistral-large'].map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg">
                      <Database className="h-4 w-4 text-indigo-400" />
                      <span className="text-sm text-gray-300 truncate">{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gray-950/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            {featuresSection?.title || 'Recursos Poderosos'}
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {defaultFeatures.map((feature, i) => (
              <div 
                key={i}
                className="group p-6 bg-gray-900/50 hover:bg-gray-900 border border-indigo-500/20 hover:border-indigo-500/50 rounded-xl transition-all duration-300"
              >
                <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-500/30 transition-colors">
                  <feature.icon className="h-6 w-6 text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Shield className="h-16 w-16 text-emerald-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Segurança em Primeiro Lugar</h2>
          <p className="text-gray-300 text-lg">
            Seus dados são protegidos. Comandos perigosos são bloqueados automaticamente. 
            Você tem controle total sobre suas ferramentas e conversas.
          </p>
        </div>
      </section>

      {/* Coming Soon Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-indigo-900/30 to-cyan-900/30">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-2xl md:text-3xl font-light text-gray-300 italic">
            ✨ Mais conteúdo em breve ✨
          </p>
        </div>
      </section>

      {/* Donation Section */}
      <section className="py-12 px-4 bg-gray-950/50">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-xl font-semibold mb-4 text-gray-300">Apoie o Projeto</h3>
          <p className="text-gray-400 mb-6 text-sm">
            Se você gosta do jgspAI, considere fazer uma doação para ajudar a manter o projeto funcionando.
          </p>
          <div className="flex justify-center">
            <form action="https://www.paypal.com/donate" method="post" target="_blank">
              <input type="hidden" name="business" value="FPWQ5HGBR38SG" />
              <input type="hidden" name="no_recurring" value="0" />
              <input type="hidden" name="currency_code" value="USD" />
              <input 
                type="image" 
                src="https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif" 
                name="submit" 
                title="PayPal - The safer, easier way to pay online!" 
                alt="Donate with PayPal button"
                className="cursor-pointer hover:opacity-80 transition"
              />
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-indigo-500/20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Cpu className="h-6 w-6 text-indigo-400" />
            <span className="font-semibold">jgspAI</span>
          </div>
          <div className="flex items-center space-x-6 text-gray-400 text-sm">
            <Link to="/docs" className="hover:text-white transition-colors">Documentação</Link>
            <span>© 2024 Todos os direitos reservados</span>
          </div>
        </div>
      </footer>

      {/* CSS para animações */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
