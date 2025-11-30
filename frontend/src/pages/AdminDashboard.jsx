import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { User, MessageSquare, Wrench, X } from 'lucide-react';

const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [viewingChat, setViewingChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => { 
    setLoading(true);
    setError(null);
    axios.get(API_URL + '/admin/users', { headers: { Authorization: 'Bearer ' + token } })
      .then(res => {
        console.log('Usuários recebidos:', res.data);
        setUsers(res.data || []);
      })
      .catch(err => {
        console.error('Erro ao carregar usuários:', err);
        setError('Erro ao carregar usuários: ' + (err.response?.data?.error || err.message));
      })
      .finally(() => setLoading(false));
  }, []);

  const selectUser = async (id) => {
    setSelectedUser(id); setViewingChat(null);
    try {
      const res = await axios.get(API_URL + '/admin/user/' + id, { headers: { Authorization: 'Bearer ' + token } });
      console.log('Detalhes do usuário:', res.data);
      setUserDetails(res.data);
    } catch(err) {
      console.error('Erro ao carregar detalhes:', err);
      alert('Erro ao carregar detalhes do usuário');
    }
  };

  const openChat = async (chatId) => {
    try {
      const res = await axios.get(API_URL + '/admin/chat/' + chatId, { headers: { Authorization: 'Bearer ' + token } });
      setViewingChat(res.data);
    } catch(err) {
      console.error('Erro ao carregar chat:', err);
      alert('Erro ao carregar chat');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-black flex font-sans">
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto hidden md:block">
        <div className="p-4 border-b font-bold text-lg">Usuários ({users.length})</div>
        {loading && <div className="p-4 text-gray-500">Carregando...</div>}
        {error && <div className="p-4 text-red-500 text-sm">{error}</div>}
        {!loading && users.length === 0 && <div className="p-4 text-gray-500">Nenhum usuário encontrado</div>}
        {users.map(u => (
            <div key={u._id} onClick={() => selectUser(u._id)} className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedUser === u._id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}>
                <div className="font-bold flex items-center gap-2"><User size={16}/> {u.username}</div>
                <div className="text-xs text-gray-500">{u.role} | Reqs: {u.usage?.requests || 0}</div>
            </div>
        ))}
        <div className="p-4"><a href="/" className="text-blue-600 underline">Voltar ao Chat</a></div>
      </div>
      <div className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        {!userDetails ? <div className="text-gray-400 text-center mt-20">Selecione um usuário.</div> : (
            <div>
                <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><User className="text-blue-600"/> {userDetails.user.username}</h1>
                <div className="mb-8"><h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Wrench size={20}/> Ferramentas</h2>{userDetails.tools.length===0?<p className="text-gray-500 italic">Nenhuma.</p>:<div className="grid grid-cols-1 gap-4">{userDetails.tools.map(t=><div key={t._id} className="bg-white p-3 rounded shadow border"><div className="font-bold text-blue-600">{t.name}</div><pre className="bg-gray-900 text-green-400 text-[10px] p-2 mt-2 rounded overflow-auto max-h-20">{t.code}</pre></div>)}</div>}</div>
                <div><h2 className="font-bold text-lg mb-4 flex items-center gap-2"><MessageSquare size={20}/> Chats</h2>{userDetails.chats.length===0?<p className="text-gray-500 italic">Nenhum.</p>:<div className="space-y-2">{userDetails.chats.map(c=><div key={c._id} onClick={()=>openChat(c._id)} className="bg-white p-3 rounded border hover:bg-blue-50 cursor-pointer flex justify-between items-center"><div><div className="font-bold">{c.title}</div><div className="text-xs text-gray-500">{c.model}</div></div><div className="text-xs text-gray-400">{new Date(c.updatedAt).toLocaleDateString()}</div></div>)}</div>}</div>
            </div>
        )}
      </div>
      {viewingChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg"><div><h3 className="font-bold text-lg">{viewingChat.title}</h3><div className="text-xs text-gray-500">Model: {viewingChat.model}</div></div><button onClick={() => setViewingChat(null)}><X/></button></div>
                <div className="p-4 bg-yellow-50 text-xs border-b"><span className="font-bold">System Prompt:</span> {viewingChat.userSystemPrompt || "Nenhum"}</div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">{viewingChat.messages.map((m, i) => (<div key={i} className={`p-3 rounded max-w-[80%] text-sm ${m.role === 'user' ? 'bg-blue-600 text-white ml-auto' : 'bg-white border text-black'}`}><div className="text-[10px] opacity-70 uppercase mb-1 font-bold">{m.role}</div><pre className="whitespace-pre-wrap font-sans">{m.content}</pre></div>))}</div>
            </div>
        </div>
      )}
    </div>
  );
}
