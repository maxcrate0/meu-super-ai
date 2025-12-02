// Traduções do site - Português (pt) e Inglês (en)

export const translations = {
  pt: {
    // Geral
    loading: 'Carregando sistema...',
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    remove: 'Remover',
    close: 'Fechar',
    search: 'Pesquisar',
    settings: 'Configurações',
    logout: 'Sair',
    login: 'Entrar',
    register: 'Cadastrar',
    
    // Homepage
    home: {
      navbar: {
        tools: 'Ferramentas',
        docs: 'Documentação',
        admin: 'Painel Admin',
        hello: 'Olá',
        login: 'Entrar',
        register: 'Registrar',
        logout: 'Sair',
        loggedAs: 'Logado como',
        moreTools: 'Mais ferramentas em breve...'
      },
      hero: {
        title: 'jgspAI',
        subtitle: 'Plataforma de Inteligência Artificial avançada com múltiplas ferramentas para potencializar sua produtividade.',
        cta: 'Começar a Usar',
        docsBtn: 'Ver Documentação'
      },
      tools: {
        chat: {
          name: 'Chat AI',
          desc: 'Converse com IAs avançadas'
        }
      },
      features: {
        chat: {
          title: 'Chat AI Avançado',
          desc: 'Converse com modelos de IA de última geração, crie ferramentas customizadas e automatize tarefas.'
        },
        code: {
          title: 'Execução de Código',
          desc: 'Execute comandos bash, scripts Python e muito mais diretamente pela IA.'
        },
        web: {
          title: 'Pesquisa Web',
          desc: 'A IA pode pesquisar na web, extrair conteúdo de sites e monitorar requisições.'
        },
        tools: {
          title: 'Ferramentas Customizáveis',
          desc: 'Crie suas próprias ferramentas e automações que a IA pode usar.'
        }
      },
      featuresSection: {
        title: 'Recursos Poderosos'
      },
      allInOne: {
        title: 'Tudo em um só lugar',
        desc: 'Acesse dezenas de modelos de IA de diferentes provedores em uma única plataforma. De GPT a Claude, de Gemini a Llama — todos disponíveis com suporte a OpenRouter e GPT4Free.',
        andMore: 'E mais...'
      },
      g4f: {
        badge: 'Novo',
        title: 'Integração com',
        desc: 'Além dos modelos do OpenRouter, agora você também tem acesso aos provedores do GPT4Free — uma coleção de APIs gratuitas que oferecem acesso a modelos como GPT-4, Claude e outros sem necessidade de API keys.',
        features: [
          'Dois provedores em uma interface',
          'Pesquise modelos facilmente',
          'Alterne entre OpenRouter e G4F',
          'Sem necessidade de configuração extra'
        ],
        modelSelector: 'Seletor de Modelos',
        searchPlaceholder: 'Pesquisar modelos...'
      },
      security: {
        title: 'Segurança em Primeiro Lugar',
        desc: 'Seus dados são protegidos. Comandos perigosos são bloqueados automaticamente. Você tem controle total sobre suas ferramentas e conversas.'
      },
      comingSoon: 'Mais conteúdo em breve',
      donation: {
        title: 'Apoie o Projeto',
        desc: 'Se você gosta do jgspAI, considere fazer uma doação para ajudar a manter o projeto funcionando.'
      },
      footer: {
        rights: 'Todos os direitos reservados'
      }
    },
    
    // Login
    login: {
      title: 'Entrar',
      login: 'Entrar',
      createAccount: 'Criar Conta',
      username: 'Usuário',
      usernamePlaceholder: 'Digite seu usuário',
      password: 'Senha',
      passwordPlaceholder: 'Digite sua senha',
      loginBtn: 'ENTRAR',
      createAccountBtn: 'CRIAR CONTA',
      alreadyHaveAccount: 'Já tem conta? Entrar',
      noAccount: 'Não tem conta? Criar agora',
      backToHome: 'Voltar para Home',
      subtitle: 'Chat com modelos de IA gratuitos',
      fillAll: 'Preencha todos os campos',
      accountCreated: 'Conta criada! Faça login.',
      connectionError: 'Erro de conexão',
      poweredBy: 'Powered by OpenRouter & GPT4Free • Modelos gratuitos de IA'
    },
    
    // Chat
    chat: {
      newChat: 'Novo Chat',
      history: 'Histórico',
      myChats: 'Meus Chats',
      noChats: 'Nenhum chat ainda',
      placeholder: 'Digite sua mensagem...',
      send: 'Enviar',
      thinking: 'Processando...',
      thinkingSwarm: 'Processando (pode usar agentes paralelos)...',
      usingTools: 'Usando ferramentas...',
      swarmActive: 'SWARM',
      swarmOn: 'Swarm ON',
      swarmOff: 'Swarm OFF',
      swarmDesc: 'A IA pode delegar tarefas para agentes paralelos em paralelo, economizando contexto e aumentando eficiência. Ideal para tarefas complexas!',
      swarmDescG4f: 'A IA pode tentar usar ferramentas avançadas no G4F. Nem todas as ferramentas funcionam em todos os provedores gratuitos.',
      provider: 'Provedor',
      providerAI: 'Provedor de IA',
      model: 'Modelo',
      settings: 'Configurações do Chat',
      configChat: 'Config Chat',
      systemPrompt: 'System Prompt',
      systemPromptPlaceholder: 'Instruções personalizadas para a IA...',
      enableSwarm: 'Habilitar Ferramentas (Swarm)',
      adminPanel: 'Painel Admin',
      accountSettings: 'Configurações da Conta',
      tools: 'Ferramentas',
      myTools: 'Minhas Ferramentas',
      noTools: 'Nenhuma ferramenta criada ainda',
      noToolsHint: 'Peça para a IA criar uma ferramenta para você!',
      noToolsExample: 'Exemplo: "Crie uma ferramenta que calcula o IMC"',
      toolUsage: 'Usos',
      toolLastUsed: 'Último uso',
      viewCode: 'Ver código',
      uploadFiles: 'Enviar Arquivos',
      attachFiles: 'Anexar arquivos',
      attachments: 'Anexos',
      deleteChat: 'Apagar este chat?',
      confirmDelete: 'Tem certeza que deseja excluir este chat?',
      confirmDeleteTool: 'Tem certeza que deseja deletar esta ferramenta?',
      error: 'ERRO',
      timeout: 'Timeout - A IA demorou muito para responder.',
      newChatWelcome: '💬 Novo Chat',
      newChatHint: 'Envie uma mensagem para começar',
      modeSwarmActive: 'Modo Swarm Ativo',
      you: 'Você',
      assistant: 'Assistente',
      swarmIterations: 'Swarm',
      adminMessage: 'Mensagem do Administrador',
      understood: 'Entendi',
      textModel: 'Chat/Texto',
      imageModel: 'Geração de Imagens',
      audioModel: 'Geração de Áudio',
      videoModel: 'Geração de Vídeo',
      searchModels: 'Pesquisar modelos...',
      modelsAvailable: 'modelos disponíveis',
      refreshModels: 'Atualizar modelos',
      apply: 'Aplicar',
      donate: 'Doar'
    },
    
    // Configurações do usuário
    userSettings: {
      title: 'Configurações da Conta',
      displayName: 'Nome de Exibição',
      bio: 'Bio/Informações',
      bioPlaceholder: 'Conte algo sobre você para a IA...',
      theme: 'Tema',
      themeDark: 'Escuro',
      themeLight: 'Claro',
      personalApiKey: 'Chave API Pessoal (OpenRouter)',
      apiKeyPlaceholder: 'sk-or-v1-...',
      apiKeyInfo: 'Opcional. Se não fornecida, usa a chave global.',
      save: 'Salvar Configurações'
    },
    
    // Admin
    admin: {
      title: 'Painel Admin',
      users: 'Usuários',
      chats: 'Chats',
      requests: 'Requests',
      tools: 'Ferramentas',
      apiKeys: 'Gerenciar API Keys',
      defaultModels: 'Modelos Padrão',
      systemPrompt: 'System Prompt Global',
      contentEditor: 'Editor de Conteúdo',
      sendMessage: 'Enviar Mensagem',
      deleteUser: 'Excluir Usuário',
      viewChats: 'Ver Chats',
      viewTools: 'Ver Ferramentas',
      selectUser: 'Selecione um usuário para ver detalhes',
      model: 'Modelo',
      apiKeyModal: {
        title: 'Gerenciar API Keys',
        openrouter: 'OpenRouter',
        groq: 'Groq ⚡',
        important: 'Importante',
        openrouterDesc: 'Chave usada por todos os usuários sem chave pessoal. Obtenha em openrouter.ai',
        groqDesc: 'Groq oferece inferência ultra-rápida! Obtenha key grátis em console.groq.com',
        currentKey: 'Chave atual',
        newKey: 'Nova Chave API',
        saveOpenRouter: 'Salvar OpenRouter Key',
        saveGroq: 'Salvar Groq Key',
        groqTip: '💡 Groq é gratuito e muito mais rápido! Obtenha sua key em'
      },
      modelsModal: {
        title: 'Modelos Padrão',
        desc: 'Defina qual modelo será usado automaticamente para cada tipo de tarefa.',
        text: 'Texto',
        image: 'Imagem',
        audio: 'Áudio',
        video: 'Vídeo',
        selectModel: 'Selecione um modelo',
        save: 'Salvar Modelos'
      },
      systemPromptModal: {
        title: 'System Prompt Global',
        desc: 'Este prompt será aplicado a TODAS as conversas (invisível aos usuários).',
        placeholder: 'Instruções globais para a IA...',
        save: 'Salvar Prompt'
      }
    },
    
    // Docs
    docs: {
      title: 'Documentação',
      backToHome: 'Voltar ao Início'
    }
  },
  
  en: {
    // General
    loading: 'Loading system...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    remove: 'Remove',
    close: 'Close',
    search: 'Search',
    settings: 'Settings',
    logout: 'Logout',
    login: 'Login',
    register: 'Register',
    
    // Homepage
    home: {
      navbar: {
        tools: 'Tools',
        docs: 'Documentation',
        admin: 'Admin Panel',
        hello: 'Hello',
        login: 'Login',
        register: 'Register',
        logout: 'Logout',
        loggedAs: 'Logged in as',
        moreTools: 'More tools coming soon...'
      },
      hero: {
        title: 'jgspAI',
        subtitle: 'Advanced Artificial Intelligence platform with multiple tools to boost your productivity.',
        cta: 'Get Started',
        docsBtn: 'View Documentation'
      },
      tools: {
        chat: {
          name: 'Chat AI',
          desc: 'Chat with advanced AIs'
        }
      },
      features: {
        chat: {
          title: 'Advanced AI Chat',
          desc: 'Chat with state-of-the-art AI models, create custom tools and automate tasks.'
        },
        code: {
          title: 'Code Execution',
          desc: 'Execute bash commands, Python scripts and much more directly through the AI.'
        },
        web: {
          title: 'Web Search',
          desc: 'The AI can search the web, extract content from websites and monitor requests.'
        },
        tools: {
          title: 'Customizable Tools',
          desc: 'Create your own tools and automations that the AI can use.'
        }
      },
      featuresSection: {
        title: 'Powerful Features'
      },
      allInOne: {
        title: 'All in one place',
        desc: 'Access dozens of AI models from different providers in a single platform. From GPT to Claude, from Gemini to Llama — all available with OpenRouter and GPT4Free support.',
        andMore: 'And more...'
      },
      g4f: {
        badge: 'New',
        title: 'Integration with',
        desc: 'Besides OpenRouter models, you now also have access to GPT4Free providers — a collection of free APIs that offer access to models like GPT-4, Claude and others without needing API keys.',
        features: [
          'Two providers in one interface',
          'Search models easily',
          'Switch between OpenRouter and G4F',
          'No extra configuration needed'
        ],
        modelSelector: 'Model Selector',
        searchPlaceholder: 'Search models...'
      },
      security: {
        title: 'Security First',
        desc: 'Your data is protected. Dangerous commands are automatically blocked. You have full control over your tools and conversations.'
      },
      comingSoon: 'More content coming soon',
      donation: {
        title: 'Support the Project',
        desc: 'If you like jgspAI, consider making a donation to help keep the project running.'
      },
      footer: {
        rights: 'All rights reserved'
      }
    },
    
    // Login
    login: {
      title: 'Login',
      login: 'Login',
      createAccount: 'Create Account',
      username: 'Username',
      usernamePlaceholder: 'Enter your username',
      password: 'Password',
      passwordPlaceholder: 'Enter your password',
      loginBtn: 'LOGIN',
      createAccountBtn: 'CREATE ACCOUNT',
      alreadyHaveAccount: 'Already have an account? Login',
      noAccount: "Don't have an account? Create now",
      backToHome: 'Back to Home',
      subtitle: 'Chat with free AI models',
      fillAll: 'Fill in all fields',
      accountCreated: 'Account created! Please login.',
      connectionError: 'Connection error',
      poweredBy: 'Powered by OpenRouter & GPT4Free • Free AI models'
    },
    
    // Chat
    chat: {
      newChat: 'New Chat',
      history: 'History',
      myChats: 'My Chats',
      noChats: 'No chats yet',
      placeholder: 'Type your message...',
      send: 'Send',
      thinking: 'Processing...',
      thinkingSwarm: 'Processing (may use parallel agents)...',
      usingTools: 'Using tools...',
      swarmActive: 'SWARM',
      swarmOn: 'Swarm ON',
      swarmOff: 'Swarm OFF',
      swarmDesc: 'AI can delegate tasks to parallel agents, saving context and increasing efficiency. Ideal for complex tasks!',
      swarmDescG4f: 'AI can try to use advanced tools on G4F. Not all tools work on all free providers.',
      provider: 'Provider',
      providerAI: 'AI Provider',
      model: 'Model',
      settings: 'Chat Settings',
      configChat: 'Chat Config',
      systemPrompt: 'System Prompt',
      systemPromptPlaceholder: 'Custom instructions for the AI...',
      enableSwarm: 'Enable Tools (Swarm)',
      adminPanel: 'Admin Panel',
      accountSettings: 'Account Settings',
      tools: 'Tools',
      myTools: 'My Tools',
      noTools: 'No tools created yet',
      noToolsHint: 'Ask the AI to create a tool for you!',
      noToolsExample: 'Example: "Create a tool that calculates BMI"',
      toolUsage: 'Uses',
      toolLastUsed: 'Last used',
      viewCode: 'View code',
      uploadFiles: 'Upload Files',
      attachFiles: 'Attach files',
      attachments: 'Attachments',
      deleteChat: 'Delete this chat?',
      confirmDelete: 'Are you sure you want to delete this chat?',
      confirmDeleteTool: 'Are you sure you want to delete this tool?',
      error: 'ERROR',
      timeout: 'Timeout - AI took too long to respond.',
      newChatWelcome: '💬 New Chat',
      newChatHint: 'Send a message to start',
      modeSwarmActive: 'Swarm Mode Active',
      you: 'You',
      assistant: 'Assistant',
      swarmIterations: 'Swarm',
      adminMessage: 'Admin Message',
      understood: 'Got it',
      textModel: 'Chat/Text',
      imageModel: 'Image Generation',
      audioModel: 'Audio Generation',
      videoModel: 'Video Generation',
      searchModels: 'Search models...',
      modelsAvailable: 'models available',
      refreshModels: 'Refresh models',
      apply: 'Apply',
      donate: 'Donate'
    },
    
    // User Settings
    userSettings: {
      title: 'Account Settings',
      displayName: 'Display Name',
      bio: 'Bio/Information',
      bioPlaceholder: 'Tell something about yourself to the AI...',
      theme: 'Theme',
      themeDark: 'Dark',
      themeLight: 'Light',
      personalApiKey: 'Personal API Key (OpenRouter)',
      apiKeyPlaceholder: 'sk-or-v1-...',
      apiKeyInfo: 'Optional. If not provided, uses the global key.',
      save: 'Save Settings'
    },
    
    // Admin
    admin: {
      title: 'Admin Panel',
      users: 'Users',
      chats: 'Chats',
      requests: 'Requests',
      tools: 'Tools',
      apiKeys: 'Manage API Keys',
      defaultModels: 'Default Models',
      systemPrompt: 'Global System Prompt',
      contentEditor: 'Content Editor',
      sendMessage: 'Send Message',
      deleteUser: 'Delete User',
      viewChats: 'View Chats',
      viewTools: 'View Tools',
      selectUser: 'Select a user to view details',
      model: 'Model',
      apiKeyModal: {
        title: 'Manage API Keys',
        openrouter: 'OpenRouter',
        groq: 'Groq ⚡',
        important: 'Important',
        openrouterDesc: 'Key used by all users without a personal key. Get one at openrouter.ai',
        groqDesc: 'Groq offers ultra-fast inference! Get a free key at console.groq.com',
        currentKey: 'Current key',
        newKey: 'New API Key',
        saveOpenRouter: 'Save OpenRouter Key',
        saveGroq: 'Save Groq Key',
        groqTip: '💡 Groq is free and much faster! Get your key at'
      },
      modelsModal: {
        title: 'Default Models',
        desc: 'Set which model will be used automatically for each type of task.',
        text: 'Text',
        image: 'Image',
        audio: 'Audio',
        video: 'Video',
        selectModel: 'Select a model',
        save: 'Save Models'
      },
      systemPromptModal: {
        title: 'Global System Prompt',
        desc: 'This prompt will be applied to ALL conversations (invisible to users).',
        placeholder: 'Global instructions for the AI...',
        save: 'Save Prompt'
      }
    },
    
    // Docs
    docs: {
      title: 'Documentation',
      backToHome: 'Back to Home'
    }
  }
};

// Detecta o idioma do navegador
export const detectLanguage = () => {
  const browserLang = navigator.language || navigator.userLanguage;
  // Se começar com 'pt' (pt, pt-BR, pt-PT), usa português
  if (browserLang?.toLowerCase().startsWith('pt')) {
    return 'pt';
  }
  // Qualquer outro idioma usa inglês
  return 'en';
};

// Helper para obter tradução por path (ex: 'home.hero.title')
export const getTranslation = (lang, path) => {
  const keys = path.split('.');
  let result = translations[lang];
  
  for (const key of keys) {
    if (result && result[key] !== undefined) {
      result = result[key];
    } else {
      // Fallback para inglês se não encontrar
      result = translations['en'];
      for (const k of keys) {
        if (result && result[k] !== undefined) {
          result = result[k];
        } else {
          return path; // Retorna o path se não encontrar
        }
      }
      break;
    }
  }
  
  return result;
};
