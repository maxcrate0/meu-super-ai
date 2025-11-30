import React, { useEffect, useState } from 'react';
import axios from 'axios';
const RAW_URL = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net/api';
const API_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;

export default function AdminDashboard() {
  const [data, setData] = useState({ users: [], tools: [], systemPrompt: '' });
  const [prompt, setPrompt] = useState('');
  const [tab, setTab] = useState('users');

  const fetch = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(API_URL + '/admin/stats', { headers: { Authorization: 'Bearer ' + token } });
      setData(res.data); setPrompt(res.data.systemPrompt);
    } catch(e) { alert('Erro loading admin'); }
  };
  useEffect(() => { fetch(); }, []);

  const save = async () => {
    await axios.post(API_URL + '/admin/config', { key: 'admin_system_prompt', value: prompt }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    alert('Salvo!');
  };
  const delTool = async (id) => {
    if(confirm('Apagar?')) { await axios.delete(API_URL + '/admin/tool/' + id, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }); fetch(); }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-black p-4">
      <div className="max-w-6xl mx-auto">
          <div className="flex justify-between mb-6"><h1 className="text-3xl font-bold">Admin V2</h1><a href="/" className="text-blue-600">Voltar</a></div>
          <div className="flex gap-4 mb-6 border-b pb-2">
             <button onClick={()=>setTab('users')} className={tab==='users'?'text-blue-600 font-bold':''}>USERS</button>
             <button onClick={()=>setTab('tools')} className={tab==='tools'?'text-blue-600 font-bold':''}>TOOLS ({data.tools.length})</button>
             <button onClick={()=>setTab('config')} className={tab==='config'?'text-blue-600 font-bold':''}>SYSTEM PROMPT</button>
          </div>
          {tab === 'users' && <div className="bg-white p-4 rounded">{data.users.map(u => <div key={u._id} className="border-b p-2 flex justify-between"><span>{u.username} ({u.role})</span><span>Reqs: {u.usage?.requests||0}</span></div>)}</div>}
          {tab === 'tools' && <div className="grid gap-4 md:grid-cols-2">{data.tools.map(t => <div key={t._id} className="bg-white p-4 rounded border shadow"><div className="flex justify-between"><h3 className="font-bold text-blue-600">{t.name}</h3><button onClick={()=>delTool(t._id)} className="text-red-500 text-xs border border-red-200 p-1">DEL</button></div><p className="text-xs text-gray-500">By {t.userId?.username}</p><p className="italic text-sm my-2">{t.description}</p><pre className="bg-black text-green-400 p-2 text-xs overflow-auto">{t.code}</pre></div>)}</div>}
          {tab === 'config' && <div className="bg-white p-6 rounded"><h3 className="font-bold">Prompt Global (Invisível)</h3><textarea className="w-full h-40 p-2 border my-4" value={prompt} onChange={e => setPrompt(e.target.value)} /><button onClick={save} className="bg-green-600 text-white px-4 py-2 rounded">SALVAR</button></div>}
      </div>
    </div>
  );
}
