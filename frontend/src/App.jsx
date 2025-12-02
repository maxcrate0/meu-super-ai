import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import Login from './pages/Login';
import ChatInterface from './pages/ChatInterface';
import AdminDashboard from './pages/AdminDashboard';
import Homepage from './pages/Homepage';
import Docs from './pages/Docs';
import ContentEditor from './pages/ContentEditor';

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { 
        setUser(JSON.parse(stored)); 
      } catch(e) { 
        localStorage.clear(); 
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="h-screen bg-gray-900 flex items-center justify-center text-white">{t('loading')}</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Páginas públicas */}
        <Route path="/" element={<Homepage user={user} setUser={setUser} />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        
        {/* Páginas protegidas */}
        <Route path="/chat" element={user ? <ChatInterface user={user} setUser={setUser} /> : <Navigate to="/login" />} />
        <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard user={user} /> : <Navigate to="/" />} />
        <Route path="/admin/content" element={user?.role === 'admin' ? <ContentEditor /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
