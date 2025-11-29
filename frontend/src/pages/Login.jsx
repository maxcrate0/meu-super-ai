import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function Login({ setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Pronto.');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus('Enviando...');
    
    try {
      const res = await axios.post(API_URL + '/login', { username, password });
      
      if (!res.data.token) {
        alert('ERRO: Servidor não mandou token.');
        return;
      }
      
      // Salva os dados
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data));
      setUser(res.data);
      
      setStatus('Sucesso!');
      
      // ALERTA DE PROVA (Para você ver que funcionou)
      // alert("Login Aprovado! Clique OK para entrar."); 
      
      navigate('/');
      
    } catch (err) {
      console.error(err);
      const msg = err.response?.data || err.message;
      alert('ERRO: ' + JSON.stringify(msg));
      setStatus('Falha: ' + JSON.stringify(msg));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <form onSubmit={handleLogin} className="bg-gray-800 p-6 rounded shadow-lg w-full max-w-sm border-2 border-blue-500">
        <h1 className="text-2xl mb-4 font-bold text-center text-blue-400">LOGIN FINAL</h1>
        
        <div className="mb-4 bg-black p-2 rounded text-xs font-mono text-green-400 break-all">
          STATUS: {status}
        </div>

        <input className="w-full mb-3 p-3 rounded bg-gray-700" placeholder="admin" value={username} onChange={e=>setUsername(e.target.value)} />
        <input className="w-full mb-6 p-3 rounded bg-gray-700" type="password" placeholder="@admin2306#" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-blue-600 p-3 rounded font-bold hover:bg-blue-500">ENTRAR</button>
      </form>
    </div>
  );
}
