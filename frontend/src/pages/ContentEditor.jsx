import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, Save, Plus, Trash2, Eye, EyeOff, ChevronUp, 
  ChevronDown, GripVertical, Image, Type, Layout, Code,
  FileText, Loader2, Check, X, ExternalLink
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net';

export default function ContentEditor() {
  const [activePage, setActivePage] = useState('homepage');
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  const token = localStorage.getItem('token');
  const headers = { Authorization: 'Bearer ' + token };

  useEffect(() => {
    loadContent(activePage);
  }, [activePage]);

  const loadContent = async (page) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/content/${page}`, { headers });
      setContent(res.data);
    } catch (err) {
      alert('Erro ao carregar conteúdo: ' + err.message);
    }
    setLoading(false);
  };

  const saveContent = async () => {
    if (!content) return;
    setSaving(true);
    try {
      await axios.put(`${API}/api/admin/content/${activePage}`, 
        { sections: content.sections },
        { headers }
      );
      setHasChanges(false);
      alert('Conteúdo salvo com sucesso!');
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    }
    setSaving(false);
  };

  const updateSection = (sectionId, updates) => {
    setContent(prev => ({
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId ? { ...s, ...updates } : s
      )
    }));
    setHasChanges(true);
  };

  const addSection = (type) => {
    const newSection = {
      id: 'section_' + Date.now(),
      type,
      title: 'Nova Seção',
      subtitle: '',
      content: '',
      imageUrl: '',
      buttonText: '',
      buttonLink: '',
      order: content.sections.length,
      visible: true
    };
    
    setContent(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
    setEditingSection(newSection.id);
    setHasChanges(true);
  };

  const deleteSection = (sectionId) => {
    if (!confirm('Tem certeza que deseja excluir esta seção?')) return;
    setContent(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId)
    }));
    setHasChanges(true);
  };

  const moveSection = (sectionId, direction) => {
    const sections = [...content.sections];
    const index = sections.findIndex(s => s.id === sectionId);
    
    if (direction === 'up' && index > 0) {
      [sections[index], sections[index - 1]] = [sections[index - 1], sections[index]];
    } else if (direction === 'down' && index < sections.length - 1) {
      [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
    }
    
    // Atualiza ordem
    sections.forEach((s, i) => s.order = i);
    
    setContent(prev => ({ ...prev, sections }));
    setHasChanges(true);
  };

  const sectionTypes = [
    { id: 'hero', name: 'Hero (Banner)', icon: Layout },
    { id: 'text', name: 'Texto', icon: Type },
    { id: 'feature', name: 'Features', icon: FileText },
    { id: 'image', name: 'Imagem', icon: Image },
    { id: 'code', name: 'Código', icon: Code },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/admin" className="flex items-center space-x-2 text-gray-400 hover:text-white">
              <ArrowLeft size={20} />
              <span>Voltar</span>
            </Link>
            <div className="h-6 w-px bg-gray-700" />
            <h1 className="text-xl font-bold">Editor de Conteúdo</h1>
          </div>

          <div className="flex items-center space-x-4">
            {hasChanges && (
              <span className="text-yellow-400 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                Alterações não salvas
              </span>
            )}
            <a 
              href={activePage === 'homepage' ? '/' : '/docs'} 
              target="_blank"
              className="flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <ExternalLink size={18} />
              Preview
            </a>
            <button
              onClick={saveContent}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg transition"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Salvar
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Tabs */}
        <div className="flex space-x-2 mb-6">
          {['homepage', 'docs'].map(page => (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activePage === page 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {page === 'homepage' ? 'Homepage' : 'Documentação'}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Sections List */}
          <div className="lg:col-span-2 space-y-4">
            {content?.sections?.length === 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
                <p className="text-gray-500 mb-4">Nenhuma seção criada</p>
                <p className="text-sm text-gray-600">Adicione seções usando o painel à direita</p>
              </div>
            )}

            {content?.sections?.sort((a, b) => a.order - b.order).map((section, index) => (
              <div 
                key={section.id}
                className={`bg-gray-800 border rounded-lg overflow-hidden transition ${
                  editingSection === section.id 
                    ? 'border-purple-500' 
                    : 'border-gray-700'
                } ${!section.visible ? 'opacity-60' : ''}`}
              >
                {/* Section Header */}
                <div className="flex items-center gap-2 p-4 bg-gray-800/50 border-b border-gray-700">
                  <GripVertical className="text-gray-600 cursor-grab" size={20} />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-gray-700 px-2 py-1 rounded uppercase">
                        {section.type}
                      </span>
                      <span className="font-medium truncate">
                        {section.title || 'Sem título'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => moveSection(section.id, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                    >
                      <ChevronUp size={18} />
                    </button>
                    <button 
                      onClick={() => moveSection(section.id, 'down')}
                      disabled={index === content.sections.length - 1}
                      className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                    >
                      <ChevronDown size={18} />
                    </button>
                    <button 
                      onClick={() => updateSection(section.id, { visible: !section.visible })}
                      className="p-1 text-gray-500 hover:text-white"
                      title={section.visible ? 'Ocultar' : 'Mostrar'}
                    >
                      {section.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                    <button 
                      onClick={() => setEditingSection(editingSection === section.id ? null : section.id)}
                      className={`p-1 ${editingSection === section.id ? 'text-purple-400' : 'text-gray-500 hover:text-white'}`}
                    >
                      <FileText size={18} />
                    </button>
                    <button 
                      onClick={() => deleteSection(section.id)}
                      className="p-1 text-red-500 hover:text-red-400"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Section Editor */}
                {editingSection === section.id && (
                  <div className="p-4 space-y-4 bg-gray-850">
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Título</label>
                      <input
                        type="text"
                        value={section.title || ''}
                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                        className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600 focus:border-purple-500 outline-none"
                        placeholder="Título da seção"
                      />
                    </div>

                    {['hero', 'feature'].includes(section.type) && (
                      <div>
                        <label className="text-sm text-gray-400 block mb-2">Subtítulo</label>
                        <input
                          type="text"
                          value={section.subtitle || ''}
                          onChange={(e) => updateSection(section.id, { subtitle: e.target.value })}
                          className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600 focus:border-purple-500 outline-none"
                          placeholder="Subtítulo ou descrição curta"
                        />
                      </div>
                    )}

                    {['text', 'code'].includes(section.type) && (
                      <div>
                        <label className="text-sm text-gray-400 block mb-2">
                          Conteúdo {section.type === 'text' ? '(Markdown suportado)' : '(Código)'}
                        </label>
                        <textarea
                          value={section.content || ''}
                          onChange={(e) => updateSection(section.id, { content: e.target.value })}
                          className={`w-full bg-gray-900 p-3 rounded-lg border border-gray-600 focus:border-purple-500 outline-none min-h-[200px] resize-y ${
                            section.type === 'code' ? 'font-mono text-sm' : ''
                          }`}
                          placeholder={section.type === 'text' ? '# Título\n\nTexto em **negrito** e `código`.' : '// Seu código aqui'}
                        />
                      </div>
                    )}

                    {section.type === 'image' && (
                      <div>
                        <label className="text-sm text-gray-400 block mb-2">URL da Imagem</label>
                        <input
                          type="text"
                          value={section.imageUrl || ''}
                          onChange={(e) => updateSection(section.id, { imageUrl: e.target.value })}
                          className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600 focus:border-purple-500 outline-none"
                          placeholder="https://..."
                        />
                        {section.imageUrl && (
                          <img src={section.imageUrl} alt="Preview" className="mt-4 max-w-full h-40 object-cover rounded-lg" />
                        )}
                      </div>
                    )}

                    {section.type === 'hero' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-400 block mb-2">Texto do Botão</label>
                          <input
                            type="text"
                            value={section.buttonText || ''}
                            onChange={(e) => updateSection(section.id, { buttonText: e.target.value })}
                            className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600 focus:border-purple-500 outline-none"
                            placeholder="Começar Agora"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-400 block mb-2">Link do Botão</label>
                          <input
                            type="text"
                            value={section.buttonLink || ''}
                            onChange={(e) => updateSection(section.id, { buttonLink: e.target.value })}
                            className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600 focus:border-purple-500 outline-none"
                            placeholder="/chat"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={() => setEditingSection(null)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                      >
                        <Check size={18} />
                        Fechar Editor
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Section Panel */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sticky top-24">
              <h3 className="font-semibold mb-4">Adicionar Seção</h3>
              <div className="space-y-2">
                {sectionTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => addSection(type.id)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-left"
                  >
                    <type.icon size={20} className="text-purple-400" />
                    <span>{type.name}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-700">
                <h4 className="text-sm text-gray-400 mb-3">Dicas</h4>
                <ul className="text-xs text-gray-500 space-y-2">
                  <li>• Use <strong>Hero</strong> para o banner principal</li>
                  <li>• <strong>Texto</strong> suporta Markdown</li>
                  <li>• Arraste seções para reordenar</li>
                  <li>• Clique no olho para ocultar/mostrar</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
