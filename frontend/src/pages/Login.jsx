import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const RAW_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function Login({ setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Aguardando...');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus('Conectando ao servidor...');
    try {
      console.log("Enviando para:", API_URL + '/login');
      const res = await axios.post(API_URL + '/login', { username, password });
      setStatus('Resposta recebida! Processando...');
      if (!res.data.token) {
        alert('ERRO: Servidor não mandou o Token!');
        return;
      }
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data));
      setUser(res.data);
      setStatus('Redirecionando...');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data || err.message;
      alert('FALHA: ' + JSON.stringify(msg));
      setStatus('Erro: ' + JSON.stringify(msg));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded shadow-lg w-full max-w-sm">
        <h1 className="text-2xl mb-4 font-bold text-center text-blue-400">Gemini Debug</h1>
        <div className="mb-4 text-xs font-mono bg-black p-2 rounded text-yellow-500 break-all">
          Status: {status}<br/>API: {API_URL}
        </div>
        <input className="w-full mb-3 p-3 rounded bg-gray-700" placeholder="User" value={username} onChange={e=>setUsername(e.target.value)} />
        <input className="w-full mb-6 p-3 rounded bg-gray-700" type="password" placeholder="Pass" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-blue-600 p-3 rounded font-bold">ENTRAR</button>
      </form>
    </div>
  );
}
