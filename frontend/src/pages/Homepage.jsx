import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  Cpu, MessageSquare, ChevronDown, LogIn, UserPlus, Menu, X, 
  Sparkles, Zap, Shield, Code, Book, GraduationCap, Brain, 
  Languages, ExternalLink, Mail, CheckCircle, ArrowRight,
  Users, Star, Globe, Layers
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

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

  // Navegação suave para âncoras
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMenuOpen(false);
    }
  };

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{t.seo.title}</title>
        <meta name="description" content={t.seo.description} />
        <meta name="keywords" content={t.seo.keywords} />
        <meta property="og:title" content={t.seo.title} />
        <meta property="og:description" content={t.seo.description} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={t.seo.title} />
        <meta name="twitter:description" content={t.seo.description} />
        <link rel="canonical" href="https://jgsp.me" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 text-white">
        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-indigo-500/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                  JGSP
                </span>
              </Link>

              {/* Menu Desktop */}
              <div className="hidden md:flex items-center space-x-8">
                <button 
                  onClick={() => scrollToSection('projetos')}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {t.navbar.projects}
                </button>
                <button 
                  onClick={() => scrollToSection('sobre')}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {t.navbar.about}
                </button>
                <button 
                  onClick={() => scrollToSection('contato')}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {t.navbar.contact}
                </button>
              </div>

              {/* Menu Direito */}
              <div className="hidden md:flex items-center space-x-4">
                <button
                  onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
                  className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-indigo-500 rounded-lg transition-all"
                  title={lang === 'pt' ? 'Switch to English' : 'Mudar para Português'}
                >
                  <Languages className="h-4 w-4" />
                  <span>{lang.toUpperCase()}</span>
                </button>
                
                {user ? (
                  <>
                    <span className="text-gray-300">{t.navbar.hello}, {user.displayName || user.username}</span>
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
                      {t.navbar.logout}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="flex items-center space-x-2 px-4 py-2 text-gray-300 hover:text-white transition-colors"
                    >
                      <LogIn className="h-4 w-4" />
                      <span>{t.navbar.login}</span>
                    </Link>
                    <Link
                      to="/login?register=true"
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-lg transition-all"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>{t.navbar.register}</span>
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
                <button 
                  onClick={() => scrollToSection('projetos')}
                  className="block w-full text-left px-3 py-2 hover:bg-indigo-500/20 rounded-lg"
                >
                  {t.navbar.projects}
                </button>
                <button 
                  onClick={() => scrollToSection('sobre')}
                  className="block w-full text-left px-3 py-2 hover:bg-indigo-500/20 rounded-lg"
                >
                  {t.navbar.about}
                </button>
                <button 
                  onClick={() => scrollToSection('contato')}
                  className="block w-full text-left px-3 py-2 hover:bg-indigo-500/20 rounded-lg"
                >
                  {t.navbar.contact}
                </button>
                
                <button
                  onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
                  className="w-full flex items-center justify-between px-3 py-2 text-gray-400 hover:text-white border border-gray-700 hover:border-indigo-500 rounded-lg transition-all"
                >
                  <span className="flex items-center space-x-2">
                    <Languages className="h-4 w-4" />
                    <span>{lang === 'pt' ? 'Idioma' : 'Language'}</span>
                  </span>
                  <span className="text-indigo-400 font-medium">{lang.toUpperCase()}</span>
                </button>
                
                {user ? (
                  <div className="border-t border-gray-700 pt-3">
                    <p className="text-sm text-gray-400">{t.navbar.loggedAs} {user.username}</p>
                    <button 
                      onClick={() => { handleLogout(); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 mt-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                    >
                      {t.navbar.logout}
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-gray-700 pt-3 space-y-2">
                    <Link 
                      to="/login" 
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 hover:bg-indigo-500/20 rounded-lg"
                    >
                      {t.navbar.login}
                    </Link>
                    <Link 
                      to="/login?register=true" 
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-lg text-center"
                    >
                      {t.navbar.register}
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
              {t.hero.title}
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto">
              {t.hero.subtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => scrollToSection('projetos')}
                className="group flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-indigo-500/25"
              >
                <span>{t.hero.cta}</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </section>

        {/* Projetos Section */}
        <section id="projetos" className="py-20 px-4 bg-gradient-to-r from-indigo-900/20 to-cyan-900/20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                {t.projects.title}
              </h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                {t.projects.subtitle}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* jgspAI Card */}
              <div className="group relative bg-gray-900/50 border border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10">
                <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-500/20 to-transparent w-1/2 h-full rounded-r-2xl pointer-events-none"></div>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center">
                    <Cpu className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">jgspAI</h3>
                    <span className="text-sm text-indigo-400">{t.projects.jgspai.badge}</span>
                  </div>
                </div>
                
                <p className="text-gray-300 mb-6">
                  {t.projects.jgspai.description}
                </p>
                
                <ul className="space-y-3 mb-8">
                  {t.projects.jgspai.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="flex gap-4">
                  <Link
                    to="/jgspai"
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-xl font-semibold transition-all"
                  >
                    <MessageSquare className="h-5 w-5" />
                    {t.projects.jgspai.cta}
                  </Link>
                </div>
              </div>

              {/* Smart-Co Card */}
              <div className="group relative bg-gray-900/50 border border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10">
                <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500/20 to-transparent w-1/2 h-full rounded-r-2xl pointer-events-none"></div>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                    <GraduationCap className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Smart-Co</h3>
                    <span className="text-sm text-emerald-400">{t.projects.smartco.badge}</span>
                  </div>
                </div>
                
                <p className="text-gray-300 mb-6">
                  {t.projects.smartco.description}
                </p>
                
                <ul className="space-y-3 mb-8">
                  {t.projects.smartco.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="flex gap-4">
                  <a
                    href="https://smart-co.tech/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl font-semibold transition-all"
                  >
                    <ExternalLink className="h-5 w-5" />
                    {t.projects.smartco.cta}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Por que escolher Section */}
        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              {t.whyChoose.title}
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              {t.whyChoose.items.map((item, i) => {
                const icons = [Shield, Zap, Users];
                const Icon = icons[i];
                const colors = ['indigo', 'emerald', 'cyan'];
                
                return (
                  <div 
                    key={i}
                    className="p-6 bg-gray-900/50 border border-gray-700 hover:border-indigo-500/50 rounded-xl transition-all duration-300"
                  >
                    <div className={`w-12 h-12 bg-${colors[i]}-500/20 rounded-lg flex items-center justify-center mb-4`}>
                      <Icon className={`h-6 w-6 text-${colors[i]}-400`} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-gray-400">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Sobre Section */}
        <section id="sobre" className="py-20 px-4 bg-gradient-to-r from-indigo-900/20 to-cyan-900/20">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              {t.about.title}
            </h2>
            <p className="text-lg text-gray-300 mb-8">
              {t.about.description}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 rounded-lg border border-gray-700">
                <Globe className="h-5 w-5 text-indigo-400" />
                <span className="text-gray-300">{t.about.global}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 rounded-lg border border-gray-700">
                <Brain className="h-5 w-5 text-emerald-400" />
                <span className="text-gray-300">{t.about.innovation}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 rounded-lg border border-gray-700">
                <Star className="h-5 w-5 text-amber-400" />
                <span className="text-gray-300">{t.about.quality}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Contato Section */}
        <section id="contato" className="py-20 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Mail className="h-16 w-16 text-indigo-400 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">{t.contact.title}</h2>
            <p className="text-gray-300 mb-6">
              {t.contact.description}
            </p>
            <a 
              href="mailto:contato@jgsp.me"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-xl text-lg font-semibold transition-all"
            >
              <Mail className="h-5 w-5" />
              contato@jgsp.me
            </a>
          </div>
        </section>

        {/* Footer Profissional */}
        <footer className="py-12 px-4 border-t border-indigo-500/20 bg-gray-950/50">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              {/* Logo e descrição */}
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
              
              {/* Links Rápidos */}
              <div>
                <h4 className="font-semibold mb-4">{t.footer.quickLinks}</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link to="/jgspai" className="text-gray-400 hover:text-white transition-colors">
                      jgspAI
                    </Link>
                  </li>
                  <li>
                    <a href="https://smart-co.tech/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                      Smart-Co
                    </a>
                  </li>
                  <li>
                    <Link to="/docs" className="text-gray-400 hover:text-white transition-colors">
                      {t.footer.docs}
                    </Link>
                  </li>
                </ul>
              </div>
              
              {/* Contato */}
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
            
            {/* Copyright e Links Legais */}
            <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-gray-400">
              <p>© {new Date().getFullYear()} JGSP. {t.footer.rights}</p>
              <div className="flex items-center gap-6 mt-4 md:mt-0">
                <Link to="/privacy" className="hover:text-white transition-colors">
                  {t.footer.privacy}
                </Link>
                <Link to="/terms" className="hover:text-white transition-colors">
                  {t.footer.terms}
                </Link>
              </div>
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
    </>
  );
}
