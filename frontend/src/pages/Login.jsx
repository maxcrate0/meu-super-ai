import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2, User, Lock, ArrowLeft } from 'lucide-react';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function Login({ setUser }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(searchParams.get('register') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Atualiza isRegister quando searchParams muda
  useEffect(() => {
    setIsRegister(searchParams.get('register') === 'true');
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setStatus('Preencha todos os campos');
      return;
    }
    setStatus('');
    setLoading(true);
    try {
      const res = await axios.post(API_URL + (isRegister ? '/register' : '/login'), { username, password });
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data));
        setUser(res.data);
        
        // Verifica se há redirecionamento pendente
        const redirectTo = localStorage.getItem('redirectAfterLogin');
        if (redirectTo) {
          localStorage.removeItem('redirectAfterLogin');
          navigate(redirectTo);
        } else {
          navigate('/');
        }
      } else {
        setStatus(res.data.message || 'Conta criada! Faça login.');
        setIsRegister(false);
      }
    } catch (err) {
      setStatus(err.response?.data?.error || 'Erro de conexão');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4">
      <div className="w-full max-w-md">
        {/* Link para voltar */}
        <Link to="/" className="inline-flex items-center space-x-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={18} />
          <span>Voltar para Home</span>
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Meu Super AI
          </h1>
          <p className="text-gray-400 mt-2">Chat com modelos de IA gratuitos</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800/50 backdrop-blur p-8 rounded-2xl border border-gray-700 shadow-xl">
          <h2 className="text-2xl font-bold text-center mb-6">
            {isRegister ? 'Criar Conta' : 'Entrar'}
          </h2>

          {status && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              status.includes('Erro') || status.includes('Preencha') 
                ? 'bg-red-900/50 text-red-300 border border-red-700' 
                : 'bg-green-900/50 text-green-300 border border-green-700'
            }`}>
              {status}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Usuário</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                <input
                  className="w-full bg-gray-900 p-3 pl-10 rounded-lg border border-gray-600 focus:border-blue-500 outline-none transition"
                  placeholder="Digite seu usuário"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-2">Senha</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                <input
                  className="w-full bg-gray-900 p-3 pl-10 rounded-lg border border-gray-600 focus:border-blue-500 outline-none transition"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-lg font-bold mt-6 transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin"/>}
            {isRegister ? 'CRIAR CONTA' : 'ENTRAR'}
          </button>

          <p 
            className="text-center text-sm text-gray-400 mt-4 cursor-pointer hover:text-white transition"
            onClick={() => { setIsRegister(!isRegister); setStatus(''); }}
          >
            {isRegister ? 'Já tem conta? Entrar' : 'Não tem conta? Criar agora'}
          </p>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          Powered by OpenRouter • Modelos gratuitos de IA
        </p>
      </div>
    </div>
  );
}
