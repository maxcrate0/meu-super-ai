import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// IMPORTAÇÃO IMPORTANTE: Aqui garantimos que ele pega o arquivo que acabamos de criar
import Login from './pages/Login';
import ChatInterface from './pages/ChatInterface';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Tenta recuperar o usuário salvo
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch(e) { localStorage.clear(); }
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota de Login explícita */}
        <Route path="/login" element={<Login setUser={setUser} />} />
        
        {/* Rotas Protegidas */}
        <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
        <Route path="/" element={user ? <ChatInterface user={user} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
