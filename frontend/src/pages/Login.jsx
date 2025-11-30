import React, { useState } from 'react';
import axios from 'axios';
const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function Login({ setUser }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Processando...');
    try {
      const res = await axios.post(API_URL + (isRegister ? '/register' : '/login'), { username, password });
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data));
        setUser(res.data);
        window.location.href = '/';
      } else { setStatus(res.data.message || 'Conta criada! Faça login.'); setIsRegister(false); }
    } catch (err) { setStatus('Erro: ' + (err.response?.data?.error || err.message)); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded w-full max-w-sm border border-blue-500">
        <h1 className="text-3xl mb-6 font-bold text-center text-blue-400">{isRegister ? 'Nova Conta' : 'Login V2'}</h1>
        {status && <div className="mb-4 bg-black p-2 text-xs text-yellow-400">{status}</div>}
        <input className="w-full mb-4 p-3 rounded bg-gray-700" placeholder="User" value={username} onChange={e=>setUsername(e.target.value)} />
        <input className="w-full mb-6 p-3 rounded bg-gray-700" type="password" placeholder="Pass" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-blue-600 p-3 rounded font-bold">{isRegister ? 'CADASTRAR' : 'ENTRAR'}</button>
        <p className="text-center text-sm text-gray-400 mt-4 cursor-pointer underline" onClick={() => { setIsRegister(!isRegister); setStatus(''); }}>
            {isRegister ? 'Já tem conta? Entrar' : 'Criar conta nova'}
        </p>
      </form>
    </div>
  );
}
