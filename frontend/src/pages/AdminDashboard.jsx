import React, { useEffect, useState } from 'react';
import axios from 'axios';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function AdminDashboard() {
  const [data, setData] = useState({ users: [], chats: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(API_URL + '/admin/data', {
          headers: { Authorization: 'Bearer ' + token }
        });
        setData(res.data);
      } catch (err) {
        alert('Erro ao carregar dados de admin');
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-black">
      <h1 className="text-3xl font-bold mb-8">Painel Admin</h1>
      
      {loading ? <p>Carregando...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4">Usuários ({data.users.length})</h2>
            {data.users.map(u => (
              <div key={u._id} className="border-b p-2 flex justify-between">
                <span className="font-bold">{u.username}</span>
                <span>Reqs: {u.usage?.requests || 0}</span>
              </div>
            ))}
          </div>
          
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4">Chats Recentes</h2>
            <div className="h-64 overflow-y-auto">
              {data.chats.map(c => (
                <div key={c._id} className="mb-2 p-2 border rounded bg-gray-50 text-xs">
                   <span className="font-bold">{c.userId?.username || 'User'}:</span> 
                   {c.messages && c.messages.length > 0 ? c.messages[c.messages.length-1].content.substring(0, 50) : '...'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <a href="/" className="block mt-4 text-blue-600 font-bold underline">Voltar para o Chat</a>
    </div>
  );
}
