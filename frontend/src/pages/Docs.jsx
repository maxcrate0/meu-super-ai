import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Cpu, ArrowLeft, Book, Terminal, MessageSquare, Wrench, 
  Globe, Shield, Code, Zap, ChevronRight, Search
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://gemini-api-13003.azurewebsites.net';

export default function Docs() {
  const [content, setContent] = useState(null);
  const [activeSection, setActiveSection] = useState('intro');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch(`${API}/api/content/docs`)
      .then(r => r.json())
      .then(data => {
        if (data.sections) setContent(data);
      })
      .catch(() => {});
  }, []);

  const defaultDocs = {
    intro: {
      title: 'Introdução',
      content: `
# Bem-vindo ao jgspAI

O **jgspAI** é uma plataforma de inteligência artificial que oferece acesso a modelos de IA avançados com funcionalidades extras como execução de código, pesquisa web e ferramentas customizáveis.

## Começando

1. **Crie uma conta** ou faça login
2. Acesse o **Chat AI** no menu de ferramentas
3. Comece a conversar com a IA!

A IA tem acesso a diversas ferramentas que podem ser usadas automaticamente conforme necessário.
      `
    },
    chatai: {
      title: 'Chat AI',
      content: `
# Chat AI

O Chat AI é a principal ferramenta da plataforma. Ele permite conversas com modelos de IA de última geração.

## Modelos Disponíveis

Todos os modelos gratuitos do OpenRouter estão disponíveis, incluindo:
- Google Gemini
- Meta Llama
- Mistral
- E muitos outros

## Recursos

- **Histórico de Conversas**: Suas conversas são salvas automaticamente
- **System Prompt Personalizado**: Configure instruções para a IA
- **Múltiplos Chats**: Crie quantos chats precisar
- **Anexos**: Envie imagens e arquivos para a IA analisar
      `
    },
    tools: {
      title: 'Ferramentas da IA',
      content: `
# Ferramentas Disponíveis para a IA

A IA tem acesso a diversas ferramentas que usa automaticamente:

## 🔄 Swarm (Delegação)
Permite que a IA delegue tarefas para agentes paralelos, processando múltiplas tarefas simultaneamente.

## 🛠️ Ferramentas Customizadas
- \`create_custom_tool\`: Cria uma ferramenta reutilizável
- \`execute_custom_tool\`: Executa uma ferramenta criada
- \`list_custom_tools\`: Lista suas ferramentas
- \`delete_custom_tool\`: Remove uma ferramenta

## 💻 Terminal Bash
\`\`\`
execute_bash: Executa comandos no terminal
\`\`\`
Comandos perigosos são bloqueados por segurança.

## 🌐 Web
- \`web_search\`: Pesquisa na web via DuckDuckGo
- \`web_scrape\`: Extrai conteúdo de páginas
- \`http_request\`: Faz requisições HTTP

## 🔍 Navegador (Puppeteer)
- \`browser_console\`: Executa JS no console de sites
- \`network_monitor\`: Monitora requisições de rede
      `
    },
    customtools: {
      title: 'Criando Ferramentas',
      content: `
# Criando Ferramentas Customizadas

Você pode pedir para a IA criar ferramentas personalizadas que ficam salvas na sua conta.

## Exemplo

Peça à IA:
> "Crie uma ferramenta para calcular IMC"

A IA irá criar algo como:

\`\`\`javascript
// Nome: calcular_imc
// Descrição: Calcula o Índice de Massa Corporal
const { peso, altura } = params;
const imc = peso / (altura * altura);
let classificacao;
if (imc < 18.5) classificacao = 'Abaixo do peso';
else if (imc < 25) classificacao = 'Peso normal';
else if (imc < 30) classificacao = 'Sobrepeso';
else classificacao = 'Obesidade';
return { imc: imc.toFixed(2), classificacao };
\`\`\`

## Usando a Ferramenta

Depois de criada, basta pedir:
> "Use a ferramenta calcular_imc com peso 70 e altura 1.75"
      `
    },
    security: {
      title: 'Segurança',
      content: `
# Segurança

## Execução de Comandos

O terminal bash tem proteções contra comandos perigosos:

### ❌ Bloqueados:
- \`rm -rf /\` (remoção recursiva)
- \`sudo\` (elevação de privilégios)
- Fork bombs
- Escrita em dispositivos do sistema

### ✅ Permitidos:
- Comandos de leitura (\`ls\`, \`cat\`, \`grep\`)
- Execução de scripts (\`python\`, \`node\`)
- Requisições de rede (\`curl\`, \`wget\`)

## Dados

- Suas conversas são privadas
- Administradores podem ver estatísticas gerais
- Você pode deletar seus dados a qualquer momento
      `
    },
    api: {
      title: 'API',
      content: `
# API

## Autenticação

Todas as requisições autenticadas precisam do header:
\`\`\`
Authorization: Bearer <seu_token>
\`\`\`

## Endpoints Principais

### Autenticação
\`\`\`
POST /api/register - Criar conta
POST /api/login - Fazer login
\`\`\`

### Chat
\`\`\`
GET  /api/chats - Listar chats
POST /api/chats - Criar chat
GET  /api/chats/:id - Obter chat
POST /api/chat - Enviar mensagem (simples)
POST /api/chat/tools - Enviar mensagem (com ferramentas)
\`\`\`

### Ferramentas
\`\`\`
GET    /api/tools - Listar ferramentas
POST   /api/tools - Criar ferramenta
DELETE /api/tools/:id - Deletar ferramenta
\`\`\`
      `
    }
  };

  const sections = [
    { id: 'intro', title: 'Introdução', icon: Book },
    { id: 'chatai', title: 'Chat AI', icon: MessageSquare },
    { id: 'tools', title: 'Ferramentas da IA', icon: Wrench },
    { id: 'customtools', title: 'Criando Ferramentas', icon: Code },
    { id: 'security', title: 'Segurança', icon: Shield },
    { id: 'api', title: 'API', icon: Terminal },
  ];

  const getContent = (sectionId) => {
    const customSection = content?.sections?.find(s => s.id === sectionId);
    if (customSection?.content) return customSection.content;
    return defaultDocs[sectionId]?.content || '';
  };

  // Renderiza markdown simples
  const renderMarkdown = (text) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeContent = [];
    let codeLanguage = '';

    lines.forEach((line, i) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={i} className="bg-gray-900 rounded-lg p-4 overflow-x-auto my-4">
              <code className="text-sm text-green-400">{codeContent.join('\n')}</code>
            </pre>
          );
          codeContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLanguage = line.replace('```', '');
        }
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className="text-3xl font-bold mt-8 mb-4">{line.substring(2)}</h1>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="text-2xl font-semibold mt-6 mb-3 text-indigo-400">{line.substring(3)}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="text-xl font-medium mt-4 mb-2">{line.substring(4)}</h3>);
      } else if (line.startsWith('- ')) {
        elements.push(
          <li key={i} className="ml-4 text-gray-300">
            {renderInline(line.substring(2))}
          </li>
        );
      } else if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={i} className="border-l-4 border-indigo-500 pl-4 my-2 text-gray-400 italic">
            {line.substring(2)}
          </blockquote>
        );
      } else if (line.trim()) {
        elements.push(
          <p key={i} className="text-gray-300 my-2">
            {renderInline(line)}
          </p>
        );
      }
    });

    return elements;
  };

  const renderInline = (text) => {
    // Processa **bold**, `code`, etc
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-400">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900/80 backdrop-blur-md border-r border-indigo-500/20 fixed h-full overflow-y-auto">
        <div className="p-4 border-b border-indigo-500/20">
          <Link to="/" className="flex items-center space-x-2 text-gray-300 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar</span>
          </Link>
          <div className="flex items-center space-x-2">
            <Cpu className="h-6 w-6 text-indigo-400" />
            <span className="font-bold">Documentação</span>
          </div>
        </div>

        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-indigo-500/20 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <nav className="space-y-1">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-left ${
                  activeSection === section.id 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-gray-400 hover:bg-indigo-500/20 hover:text-white'
                }`}
              >
                <section.icon className="h-4 w-4" />
                <span className="text-sm">{section.title}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <main className="ml-64 flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-8">
            <Link to="/" className="hover:text-white">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <span>Docs</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-indigo-400">{sections.find(s => s.id === activeSection)?.title}</span>
          </div>

          {/* Content */}
          <article className="prose prose-invert max-w-none">
            {renderMarkdown(getContent(activeSection))}
          </article>

          {/* Navigation */}
          <div className="flex justify-between mt-12 pt-8 border-t border-indigo-500/20">
            {sections.findIndex(s => s.id === activeSection) > 0 && (
              <button
                onClick={() => setActiveSection(sections[sections.findIndex(s => s.id === activeSection) - 1].id)}
                className="flex items-center space-x-2 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{sections[sections.findIndex(s => s.id === activeSection) - 1].title}</span>
              </button>
            )}
            {sections.findIndex(s => s.id === activeSection) < sections.length - 1 && (
              <button
                onClick={() => setActiveSection(sections[sections.findIndex(s => s.id === activeSection) + 1].id)}
                className="flex items-center space-x-2 text-gray-400 hover:text-white ml-auto"
              >
                <span>{sections[sections.findIndex(s => s.id === activeSection) + 1].title}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
