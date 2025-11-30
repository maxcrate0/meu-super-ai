import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ChatInterface from './pages/ChatInterface';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // NOVO ESTADO

  useEffect(() => {
    // Tenta ler o usuário salvo
    const stored = localStorage.getItem('user');
    if (stored) {
      try { 
        setUser(JSON.parse(stored)); 
      } catch(e) { 
        localStorage.clear(); 
      }
    }
    setLoading(false); // Só libera o site depois de ler a memória
  }, []);

  // Se estiver carregando, mostra tela preta em vez de chutar para o login
  if (loading) {
    return <div className="h-screen bg-gray-900 flex items-center justify-center text-white">Carregando sistema...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
        {/* Agora ele só redireciona se loading for false e user for null */}
        <Route path="/" element={user ? <ChatInterface user={user} setUser={setUser} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
