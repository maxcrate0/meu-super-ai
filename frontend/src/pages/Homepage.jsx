import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  Cpu, MessageSquare, LogIn, UserPlus, Menu, X, 
  Sparkles, Zap, Shield, GraduationCap, Brain, 
  Languages, ExternalLink, Mail, CheckCircle, ArrowRight,
  Users, Star, Globe, Play, Rocket, ChevronRight
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

// Componente de contador animado
const AnimatedCounter = ({ end, duration = 2000, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (countRef.current) {
      observer.observe(countRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    let startTime;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [isVisible, end, duration]);

  return <span ref={countRef}>{count}{suffix}</span>;
};

// Componente de texto que digita
const TypeWriter = ({ texts, speed = 100, pause = 2000 }) => {
  const [displayText, setDisplayText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = texts[textIndex];
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (charIndex < currentText.length) {
          setDisplayText(currentText.substring(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        } else {
          setTimeout(() => setIsDeleting(true), pause);
        }
      } else {
        if (charIndex > 0) {
          setDisplayText(currentText.substring(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        } else {
          setIsDeleting(false);
          setTextIndex((textIndex + 1) % texts.length);
        }
      }
    }, isDeleting ? speed / 2 : speed);

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, textIndex, texts, speed, pause]);

  return (
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
};

export default function Homepage({ user, setUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { lang, setLang, texts } = useLanguage();
  const t = texts.landing;

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    navigate('/');
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMenuOpen(false);
    }
  };

  const typewriterTexts = lang === 'pt' 
    ? ['Inteligência Artificial', 'Métodos de Estudo', 'Produtividade', 'Inovação']
    : ['Artificial Intelligence', 'Study Methods', 'Productivity', 'Innovation'];

  const stats = [
    { value: 50, suffix: '+', label: lang === 'pt' ? 'Modelos de IA' : 'AI Models' },
    { value: 1000, suffix: '+', label: lang === 'pt' ? 'Usuários Ativos' : 'Active Users' },
    { value: 99, suffix: '%', label: lang === 'pt' ? 'Satisfação' : 'Satisfaction' },
    { value: 24, suffix: '/7', label: lang === 'pt' ? 'Disponibilidade' : 'Availability' },
  ];

  return (
    <>
      <Helmet>
        <title>{t.seo.title}</title>
        <meta name="description" content={t.seo.description} />
        <meta name="keywords" content={t.seo.keywords} />
        <meta property="og:title" content={t.seo.title} />
        <meta property="og:description" content={t.seo.description} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://jgsp.me" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-indigo-950/50 to-gray-950"></div>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>

        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center space-x-2 group">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-transform">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                  JGSP
                </span>
              </Link>

              <div className="hidden md:flex items-center space-x-8">
                <button onClick={() => scrollToSection('projetos')} className="text-gray-300 hover:text-white transition-colors relative group">
                  {t.navbar.projects}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-indigo-500 to-cyan-500 group-hover:w-full transition-all"></span>
                </button>
                <button onClick={() => scrollToSection('beneficios')} className="text-gray-300 hover:text-white transition-colors relative group">
                  {lang === 'pt' ? 'Benefícios' : 'Benefits'}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-indigo-500 to-cyan-500 group-hover:w-full transition-all"></span>
                </button>
                <button onClick={() => scrollToSection('sobre')} className="text-gray-300 hover:text-white transition-colors relative group">
                  {t.navbar.about}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-indigo-500 to-cyan-500 group-hover:w-full transition-all"></span>
                </button>
                <button onClick={() => scrollToSection('contato')} className="text-gray-300 hover:text-white transition-colors relative group">
                  {t.navbar.contact}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-indigo-500 to-cyan-500 group-hover:w-full transition-all"></span>
                </button>
              </div>

              <div className="hidden md:flex items-center space-x-4">
                <button
                  onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
                  className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-indigo-500 rounded-lg transition-all"
                >
                  <Languages className="h-4 w-4" />
                  <span>{lang.toUpperCase()}</span>
                </button>
                
                {user ? (
                  <>
                    <span className="text-gray-300">{t.navbar.hello}, {user.displayName || user.username}</span>
                    {user.role === 'admin' && (
                      <Link to="/admin" className="px-3 py-1.5 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors">
                        Admin
                      </Link>
                    )}
                    <button onClick={handleLogout} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">
                      {t.navbar.logout}
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="flex items-center space-x-2 px-4 py-2 text-gray-300 hover:text-white transition-colors">
                      <LogIn className="h-4 w-4" />
                      <span>{t.navbar.login}</span>
                    </Link>
                    <Link
                      to="/login?register=true"
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-lg transition-all transform hover:scale-105"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>{t.navbar.register}</span>
                    </Link>
                  </>
                )}
              </div>

              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-gray-300 hover:text-white">
                {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {menuOpen && (
            <div className="md:hidden bg-gray-900/95 backdrop-blur-md border-t border-indigo-500/20 animate-slideDown">
              <div className="px-4 py-4 space-y-3">
                <button onClick={() => scrollToSection('projetos')} className="block w-full text-left px-3 py-2 hover:bg-indigo-500/20 rounded-lg">
                  {t.navbar.projects}
                </button>
                <button onClick={() => scrollToSection('beneficios')} className="block w-full text-left px-3 py-2 hover:bg-indigo-500/20 rounded-lg">
                  {lang === 'pt' ? 'Benefícios' : 'Benefits'}
                </button>
                <button onClick={() => scrollToSection('sobre')} className="block w-full text-left px-3 py-2 hover:bg-indigo-500/20 rounded-lg">
                  {t.navbar.about}
                </button>
                <button onClick={() => scrollToSection('contato')} className="block w-full text-left px-3 py-2 hover:bg-indigo-500/20 rounded-lg">
                  {t.navbar.contact}
                </button>
                <button
                  onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
                  className="w-full flex items-center justify-between px-3 py-2 text-gray-400 hover:text-white border border-gray-700 hover:border-indigo-500 rounded-lg"
                >
                  <span className="flex items-center space-x-2">
                    <Languages className="h-4 w-4" />
                    <span>{lang === 'pt' ? 'Idioma' : 'Language'}</span>
                  </span>
                  <span className="text-indigo-400 font-medium">{lang.toUpperCase()}</span>
                </button>
                {!user && (
                  <div className="border-t border-gray-700 pt-3 space-y-2">
                    <Link to="/login" onClick={() => setMenuOpen(false)} className="block px-3 py-2 hover:bg-indigo-500/20 rounded-lg">
                      {t.navbar.login}
                    </Link>
                    <Link to="/login?register=true" onClick={() => setMenuOpen(false)} className="block px-3 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-lg text-center">
                      {t.navbar.register}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Hero Section */}
        <section className="relative z-10 pt-32 pb-20 px-4 min-h-screen flex items-center">
          <div className="max-w-7xl mx-auto w-full">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left - Text Content */}
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-sm text-indigo-300 mb-6 animate-fadeIn">
                  <Rocket className="h-4 w-4" />
                  <span>{lang === 'pt' ? '🚀 Novidade: Integração GPT4Free' : '🚀 New: GPT4Free Integration'}</span>
                </div>
                
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                  <span className="text-white">{lang === 'pt' ? 'O Futuro da' : 'The Future of'}</span>
                  <br />
                  <TypeWriter texts={typewriterTexts} speed={80} pause={2500} />
                </h1>
                
                <p className="text-xl text-gray-400 mb-8 max-w-xl mx-auto lg:mx-0">
                  {t.hero.subtitle}
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-8">
                  <button
                    onClick={() => scrollToSection('projetos')}
                    className="group flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-indigo-500/25"
                  >
                    <span>{t.hero.cta}</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  
                  <button
                    onClick={() => scrollToSection('demo')}
                    className="group flex items-center space-x-2 px-8 py-4 border border-gray-600 hover:border-indigo-500 rounded-xl text-lg font-semibold transition-all hover:bg-indigo-500/10"
                  >
                    <Play className="h-5 w-5" />
                    <span>{lang === 'pt' ? 'Ver Demo' : 'Watch Demo'}</span>
                  </button>
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-center lg:justify-start gap-6 text-gray-500 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-500" />
                    <span>{lang === 'pt' ? 'Seguro' : 'Secure'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span>{lang === 'pt' ? 'Rápido' : 'Fast'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-indigo-500" />
                    <span>{lang === 'pt' ? 'Gratuito' : 'Free'}</span>
                  </div>
                </div>
              </div>

              {/* Right - Visual Demo */}
              <div className="relative hidden lg:block">
                <div className="relative w-full h-[500px]">
                  {/* Main Chat Preview */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 bg-gray-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-4 shadow-2xl shadow-indigo-500/10 animate-float">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg flex items-center justify-center">
                        <Cpu className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">jgspAI</p>
                        <p className="text-xs text-green-400">● Online</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-indigo-500/20 rounded-lg p-3 text-sm text-gray-300">
                        {lang === 'pt' ? '🤖 Como posso ajudar você hoje?' : '🤖 How can I help you today?'}
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3 text-sm text-white ml-8">
                        {lang === 'pt' ? 'Crie um código Python para...' : 'Create a Python code for...'}
                      </div>
                      <div className="flex gap-2">
                        <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                        <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                        <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                      </div>
                    </div>
                  </div>

                  {/* Floating Model Cards */}
                  <div className="absolute top-8 right-8 bg-gray-800/80 backdrop-blur-md border border-gray-700 rounded-xl p-3 animate-floatSlow">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">G</div>
                      <span className="text-sm text-gray-300">GPT-4</span>
                    </div>
                  </div>

                  <div className="absolute top-24 left-4 bg-gray-800/80 backdrop-blur-md border border-gray-700 rounded-xl p-3 animate-floatSlow" style={{animationDelay: '0.5s'}}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">C</div>
                      <span className="text-sm text-gray-300">Claude</span>
                    </div>
                  </div>

                  <div className="absolute bottom-24 right-12 bg-gray-800/80 backdrop-blur-md border border-gray-700 rounded-xl p-3 animate-floatSlow" style={{animationDelay: '1s'}}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">G</div>
                      <span className="text-sm text-gray-300">Gemini</span>
                    </div>
                  </div>

                  <div className="absolute bottom-8 left-16 bg-gray-800/80 backdrop-blur-md border border-gray-700 rounded-xl p-3 animate-floatSlow" style={{animationDelay: '1.5s'}}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">L</div>
                      <span className="text-sm text-gray-300">Llama</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="relative z-10 py-16 px-4 border-y border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Projetos Section */}
        <section id="projetos" className="relative z-10 py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-sm text-indigo-300 mb-4">
                {lang === 'pt' ? '🎯 Nossos Produtos' : '🎯 Our Products'}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                {t.projects.title}
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                {t.projects.subtitle}
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* jgspAI Card */}
              <div className="group relative bg-gradient-to-br from-gray-900 to-gray-950 border border-indigo-500/30 hover:border-indigo-500/60 rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-2">
                <div className="relative h-48 bg-gradient-to-br from-indigo-600 to-cyan-600 overflow-hidden">
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-4 p-4">
                      {[...Array(48)].map((_, i) => (
                        <div key={i} className="w-2 h-2 bg-white rounded-full opacity-30"></div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500">
                      <Cpu className="h-12 w-12 text-white" />
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold text-white">
                    🔥 Popular
                  </div>
                </div>
                
                <div className="p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-2xl font-bold text-white">jgspAI</h3>
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs rounded-full">{t.projects.jgspai.badge}</span>
                  </div>
                  
                  <p className="text-gray-400 mb-6 leading-relaxed">
                    {t.projects.jgspai.description}
                  </p>
                  
                  <ul className="space-y-3 mb-8">
                    {t.projects.jgspai.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle className="h-3 w-3 text-indigo-400" />
                        </div>
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link
                    to="/jgspai"
                    className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-xl font-semibold transition-all transform hover:scale-[1.02] shadow-lg shadow-indigo-500/20"
                  >
                    <MessageSquare className="h-5 w-5" />
                    {t.projects.jgspai.cta}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Smart-Co Card */}
              <div className="group relative bg-gradient-to-br from-gray-900 to-gray-950 border border-emerald-500/30 hover:border-emerald-500/60 rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-2">
                <div className="relative h-48 bg-gradient-to-br from-emerald-600 to-teal-600 overflow-hidden">
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-4 p-4">
                      {[...Array(48)].map((_, i) => (
                        <div key={i} className="w-2 h-2 bg-white rounded-full opacity-30"></div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500">
                      <GraduationCap className="h-12 w-12 text-white" />
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold text-white">
                    📚 {lang === 'pt' ? 'Educação' : 'Education'}
                  </div>
                </div>
                
                <div className="p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-2xl font-bold text-white">Smart-Co</h3>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs rounded-full">{t.projects.smartco.badge}</span>
                  </div>
                  
                  <p className="text-gray-400 mb-6 leading-relaxed">
                    {t.projects.smartco.description}
                  </p>
                  
                  <ul className="space-y-3 mb-8">
                    {t.projects.smartco.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle className="h-3 w-3 text-emerald-400" />
                        </div>
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <a
                    href="https://smart-co.tech/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl font-semibold transition-all transform hover:scale-[1.02] shadow-lg shadow-emerald-500/20"
                  >
                    <ExternalLink className="h-5 w-5" />
                    {t.projects.smartco.cta}
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefícios Section */}
        <section id="beneficios" className="relative z-10 py-24 px-4 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-sm text-cyan-300 mb-4">
                {lang === 'pt' ? '✨ Por que nos escolher' : '✨ Why choose us'}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                {t.whyChoose.title}
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Shield, gradient: 'from-indigo-500 to-purple-500' },
                { icon: Zap, gradient: 'from-emerald-500 to-teal-500' },
                { icon: Users, gradient: 'from-cyan-500 to-blue-500' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={i}
                    className="group relative p-8 bg-gray-900/50 hover:bg-gray-900/80 border border-gray-800 hover:border-gray-700 rounded-2xl transition-all duration-300 hover:-translate-y-2"
                  >
                    <div className={`w-14 h-14 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform`}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-white">{t.whyChoose.items[i].title}</h3>
                    <p className="text-gray-400 leading-relaxed">{t.whyChoose.items[i].description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section id="demo" className="relative z-10 py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm text-purple-300 mb-4">
                {lang === 'pt' ? '🎬 Veja em Ação' : '🎬 See it in Action'}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                {lang === 'pt' ? 'Experimente o Poder da IA' : 'Experience the Power of AI'}
              </h2>
            </div>

            <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border-b border-gray-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-sm text-gray-400 ml-2">jgspAI Chat</span>
              </div>
              
              <div className="p-6 space-y-4 min-h-[300px]">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                    <Cpu className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-800 rounded-2xl rounded-tl-none p-4 max-w-[80%]">
                    <p className="text-gray-300">
                      {lang === 'pt' 
                        ? '👋 Olá! Sou o jgspAI. Posso ajudar com código, pesquisas, criar ferramentas e muito mais. O que você gostaria de fazer hoje?'
                        : '👋 Hello! I\'m jgspAI. I can help with code, research, create tools and much more. What would you like to do today?'}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <div className="bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-2xl rounded-tr-none p-4 max-w-[80%]">
                    <p className="text-white">
                      {lang === 'pt' 
                        ? 'Crie uma função Python que ordena uma lista usando quicksort'
                        : 'Create a Python function that sorts a list using quicksort'}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                    <Cpu className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-800 rounded-2xl rounded-tl-none p-4 max-w-[80%]">
                    <p className="text-gray-300 mb-3">
                      {lang === 'pt' ? 'Claro! Aqui está a implementação:' : 'Sure! Here\'s the implementation:'}
                    </p>
                    <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-green-400">
                      <pre>{`def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)`}</pre>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-800">
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder={lang === 'pt' ? 'Digite sua mensagem...' : 'Type your message...'}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    disabled
                  />
                  <button className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-xl">
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sobre Section */}
        <section id="sobre" className="relative z-10 py-24 px-4 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-sm text-amber-300 mb-4">
              {lang === 'pt' ? '🌟 Nossa História' : '🌟 Our Story'}
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              {t.about.title}
            </h2>
            <p className="text-xl text-gray-400 mb-10 leading-relaxed">
              {t.about.description}
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-3 px-6 py-3 bg-gray-900/50 rounded-xl border border-gray-800">
                <Globe className="h-6 w-6 text-indigo-400" />
                <span className="text-gray-300">{t.about.global}</span>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 bg-gray-900/50 rounded-xl border border-gray-800">
                <Brain className="h-6 w-6 text-emerald-400" />
                <span className="text-gray-300">{t.about.innovation}</span>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 bg-gray-900/50 rounded-xl border border-gray-800">
                <Star className="h-6 w-6 text-amber-400" />
                <span className="text-gray-300">{t.about.quality}</span>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="relative z-10 py-24 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-3xl p-12 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 grid grid-cols-12 grid-rows-8 gap-4 p-4">
                  {[...Array(96)].map((_, i) => (
                    <div key={i} className="w-1 h-1 bg-white rounded-full"></div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  {lang === 'pt' ? 'Pronto para começar?' : 'Ready to get started?'}
                </h2>
                <p className="text-xl text-white/80 mb-8 max-w-xl mx-auto">
                  {lang === 'pt' 
                    ? 'Junte-se a milhares de usuários que já estão aproveitando o poder da IA e métodos de estudo avançados.'
                    : 'Join thousands of users who are already harnessing the power of AI and advanced study methods.'}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    to="/login?register=true"
                    className="flex items-center gap-2 px-8 py-4 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-gray-100 transition-all transform hover:scale-105"
                  >
                    <Rocket className="h-5 w-5" />
                    {lang === 'pt' ? 'Começar Grátis' : 'Start Free'}
                  </Link>
                  <a
                    href="mailto:contato@jgsp.me"
                    className="flex items-center gap-2 px-8 py-4 bg-white/10 border border-white/30 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
                  >
                    <Mail className="h-5 w-5" />
                    {lang === 'pt' ? 'Falar Conosco' : 'Contact Us'}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contato Section */}
        <section id="contato" className="relative z-10 py-24 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Mail className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-4">{t.contact.title}</h2>
            <p className="text-gray-400 mb-8 text-lg">
              {t.contact.description}
            </p>
            <a 
              href="mailto:contato@jgsp.me"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-xl text-lg font-semibold transition-all transform hover:scale-105"
            >
              <Mail className="h-5 w-5" />
              contato@jgsp.me
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 py-12 px-4 border-t border-white/5 bg-gray-950/80">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div className="md:col-span-2">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xl font-bold">JGSP</span>
                </div>
                <p className="text-gray-400 text-sm max-w-md">
                  {t.footer.description}
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold mb-4">{t.footer.quickLinks}</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/jgspai" className="text-gray-400 hover:text-white transition-colors">jgspAI</Link></li>
                  <li><a href="https://smart-co.tech/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">Smart-Co</a></li>
                  <li><Link to="/docs" className="text-gray-400 hover:text-white transition-colors">{t.footer.docs}</Link></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-4">{t.footer.contactTitle}</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="mailto:contato@jgsp.me" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      contato@jgsp.me
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-gray-400">
              <p>© {new Date().getFullYear()} JGSP. {t.footer.rights}</p>
              <div className="flex items-center gap-6 mt-4 md:mt-0">
                <Link to="/privacy" className="hover:text-white transition-colors">{t.footer.privacy}</Link>
                <Link to="/terms" className="hover:text-white transition-colors">{t.footer.terms}</Link>
              </div>
            </div>
          </div>
        </footer>

        {/* CSS Animations */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes float {
            0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
            50% { transform: translate(-50%, -50%) translateY(-20px); }
          }
          @keyframes floatSlow {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.5s ease-out;
          }
          .animate-slideDown {
            animation: slideDown 0.3s ease-out;
          }
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
          .animate-floatSlow {
            animation: floatSlow 4s ease-in-out infinite;
          }
        `}</style>
      </div>
    </>
  );
}
