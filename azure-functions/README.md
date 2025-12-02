# Azure Functions - Meu Super AI

Endpoints otimizados para processamento pesado de IA.

## Estrutura

```
azure-functions/
├── host.json              # Configuração global
├── package.json           # Dependências
├── local.settings.json    # Variáveis locais (não commitado)
├── deploy_functions.sh    # Script de deploy
├── shared/
│   └── db.js              # Módulo compartilhado (MongoDB, Auth, Cache)
├── chat-function/         # /api/chat - Chat simples
├── tools-function/        # /api/chat/tools - Chat com ferramentas (Swarm)
└── swarm-function/        # /api/swarm - Swarm direto
```

## Endpoints

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/chat` | POST | Chat simples (OpenRouter ou G4F) |
| `/api/chat/tools` | POST | Chat com ferramentas Swarm |
| `/api/swarm` | POST | Executa tarefa Swarm direta |

## Vantagens

- **Escala automática**: 0 a infinito (paga só pelo uso)
- **Gratuito**: 1M execuções/mês + 400.000 GB-s
- **Cold start**: ~2-5s na primeira execução
- **Timeout**: 5 minutos (configurável)

## Deploy

```bash
cd azure-functions
chmod +x deploy_functions.sh
./deploy_functions.sh
```

## Configuração no Frontend

Após o deploy, configure a URL das Functions no frontend:

```javascript
// Em ChatInterface.jsx, a URL é detectada automaticamente
// Mas você pode forçar usando:
const FUNCTIONS_URL = 'https://meu-super-ai-functions.azurewebsites.net';
```

## Variáveis de Ambiente

Configure no Azure Portal ou via CLI:

- `MONGODB_URI` - Conexão MongoDB
- `JWT_SECRET` - Segredo JWT (mesmo do backend)
- `GLOBAL_API_KEY` - API Key OpenRouter global
- `GROQ_API_KEY` - (Opcional) API Key Groq
- `CEREBRAS_API_KEY` - (Opcional) API Key Cerebras

## Desenvolvimento Local

```bash
# Instalar Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Configurar local.settings.json com suas variáveis

# Rodar localmente
func start
```
