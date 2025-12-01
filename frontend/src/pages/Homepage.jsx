import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Cpu, MessageSquare, Terminal, Globe, Wrench, ChevronDown,
  LogIn, UserPlus, Menu, X, Sparkles, Zap, Shield, Code
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net';

export default function Homepage({ user, setUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [content, setContent] = useState(null);
  const navigate = useNavigate();

  // Carregar conteúdo da página
  useEffect(() => {
    fetch(`${API}/api/content/homepage`)
      .then(r => r.json())
      .then(data => {
        if (data.sections) setContent(data);
      })
      .catch(() => {});
  }, []);

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
    title: 'Meu Super AI',
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo e Menu Esquerdo */}
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-2">
                <Cpu className="h-8 w-8 text-purple-400" />
                <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Meu Super AI
                </span>
              </Link>

              {/* Menu Desktop */}
              <div className="hidden md:flex items-center space-x-6">
                {/* Dropdown Ferramentas */}
                <div className="relative">
                  <button
                    onMouseEnter={() => setToolsOpen(true)}
                    onMouseLeave={() => setToolsOpen(false)}
                    className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors"
                  >
                    <span>Ferramentas</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {toolsOpen && (
                    <div
                      onMouseEnter={() => setToolsOpen(true)}
                      onMouseLeave={() => setToolsOpen(false)}
                      className="absolute top-full left-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 animate-fadeIn"
                    >
                      {tools.map(tool => (
                        <button
                          key={tool.path}
                          onClick={() => handleToolClick(tool.path)}
                          className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-700 transition-colors text-left"
                        >
                          <tool.icon className="h-5 w-5 text-purple-400" />
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
                      className="px-3 py-1.5 text-sm bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
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
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
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
          <div className="md:hidden bg-gray-800 border-t border-gray-700 animate-fadeIn">
            <div className="px-4 py-4 space-y-3">
              <div className="border-b border-gray-700 pb-3">
                <p className="text-sm text-gray-400 mb-2">Ferramentas</p>
                {tools.map(tool => (
                  <button
                    key={tool.path}
                    onClick={() => { handleToolClick(tool.path); setMenuOpen(false); }}
                    className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-700 rounded-lg"
                  >
                    <tool.icon className="h-5 w-5 text-purple-400" />
                    <span>{tool.name}</span>
                  </button>
                ))}
              </div>
              
              <Link 
                to="/docs" 
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 hover:bg-gray-700 rounded-lg"
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
                        className="block px-3 py-2 mt-2 bg-yellow-500/20 text-yellow-400 rounded-lg"
                      >
                        Painel Admin
                      </Link>
                    )}
                    <button 
                      onClick={() => { handleLogout(); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 mt-2 text-red-400 hover:bg-gray-700 rounded-lg"
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
                    className="block px-3 py-2 hover:bg-gray-700 rounded-lg"
                  >
                    Entrar
                  </Link>
                  <Link 
                    to="/login?register=true" 
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-center"
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
              <div className="absolute inset-0 blur-3xl bg-purple-500/30 rounded-full"></div>
              <Sparkles className="relative h-20 w-20 text-purple-400 animate-pulse" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            {heroSection?.title || defaultHero.title}
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto">
            {heroSection?.subtitle || defaultHero.subtitle}
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => handleToolClick('/chat')}
              className="group flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-purple-500/25"
            >
              <MessageSquare className="h-5 w-5" />
              <span>Começar a Usar</span>
              <Zap className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            
            <Link
              to="/docs"
              className="flex items-center space-x-2 px-8 py-4 border border-gray-600 hover:border-gray-500 rounded-xl text-lg transition-colors"
            >
              <Code className="h-5 w-5" />
              <span>Ver Documentação</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            {featuresSection?.title || 'Recursos Poderosos'}
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {defaultFeatures.map((feature, i) => (
              <div 
                key={i}
                className="group p-6 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-purple-500/50 rounded-xl transition-all duration-300"
              >
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
                  <feature.icon className="h-6 w-6 text-purple-400" />
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
          <Shield className="h-16 w-16 text-green-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Segurança em Primeiro Lugar</h2>
          <p className="text-gray-300 text-lg">
            Seus dados são protegidos. Comandos perigosos são bloqueados automaticamente. 
            Você tem controle total sobre suas ferramentas e conversas.
          </p>
        </div>
      </section>

      {/* Coming Soon Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-2xl md:text-3xl font-light text-gray-300 italic">
            ✨ Mais conteúdo em breve ✨
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Cpu className="h-6 w-6 text-purple-400" />
            <span className="font-semibold">Meu Super AI</span>
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
