# GPT4Free Integration

Este projeto integra o **gpt4free** (https://github.com/xtekky/gpt4free) ao backend, oferecendo acesso a mais de 100 providers de IA gratuitamente.

## Arquitetura

```
┌─────────────────────┐     HTTP      ┌─────────────────────┐
│   Frontend React    │ ────────────► │  Backend Node.js    │
│   (Vercel)          │               │  (Azure)            │
└─────────────────────┘               └───────────┬─────────┘
                                                  │
                            ┌─────────────────────┼─────────────────────┐
                            │                     │                     │
                            ▼                     ▼                     ▼
                   ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
                   │  G4F Python    │   │  Pollinations  │   │  Groq/Cerebras │
                   │  Server        │   │  DeepInfra     │   │  OpenRouter    │
                   │  (Docker)      │   │  Cloudflare    │   │  HuggingFace   │
                   └────────────────┘   └────────────────┘   └────────────────┘
```

## Opções de Uso

### 1. Via JavaScript Client (Atual - Sem Docker)

O backend já usa um client JavaScript (`g4f-client.mjs`) que acessa:
- **Pollinations AI** - Gratuito, sem API key
- **DeepInfra** - Tier gratuito
- **Cloudflare Workers AI** - Gratuito
- **Groq** - API key gratuita (https://console.groq.com)
- **Cerebras** - API key gratuita (https://cloud.cerebras.ai)
- **OpenRouter** - API key gratuita (https://openrouter.ai)

### 2. Via G4F Python Server (Docker)

Para acessar TODOS os providers do gpt4free Python (100+):

```bash
cd backend

# Inicia apenas o servidor G4F Python
docker-compose up g4f-server

# Ou inicia tudo (G4F + Backend)
docker-compose up
```

O servidor ficará disponível em `http://localhost:8080`.

#### Endpoints do G4F Python:

- `GET /api/g4f/status` - Status do servidor
- `GET /api/g4f/models` - Lista modelos disponíveis
- `GET /api/g4f/providers` - Lista providers Python
- `POST /api/g4f/chat` - Chat completions
- `POST /api/g4f/images` - Geração de imagens

#### Exemplo de uso:

```javascript
// Chat
const response = await fetch('/api/g4f/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello!' }],
    provider: 'Copilot' // opcional - especifica o provider Python
  })
});

// Imagem
const imageResponse = await fetch('/api/g4f/images', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A beautiful sunset',
    model: 'flux'
  })
});
```

## Providers Python Disponíveis

Os principais providers do gpt4free Python são:

| Provider | Descrição | Requer Auth |
|----------|-----------|-------------|
| Copilot | Microsoft Copilot (Bing) | Não* |
| Bing | Bing Chat | Não* |
| DeepInfra | Modelos open source | Não |
| HuggingChat | HuggingFace Chat | Cookies |
| OpenaiChat | ChatGPT (via scraping) | Cookies |
| Gemini | Google Gemini | Cookies |
| GeminiPro | Gemini API | API Key |
| MetaAI | Meta AI | Não |
| You | You.com | Não |
| PollinationsAI | Pollinations | Não |
| Cloudflare | CF Workers AI | Não |
| DDG | DuckDuckGo AI | Não |
| Blackbox | Blackbox AI | Não |
| Puter | Puter.js | Não |
| Qwen | Qwen/Tongyi | Não* |

*Alguns providers podem precisar de cookies/sessão do navegador para funcionar

## Configuração de Ambiente

```bash
# No .env do backend

# URL do servidor G4F Python (se rodar em outro lugar)
G4F_API_URL=http://localhost:8080

# API Keys opcionais (para providers que requerem)
GROQ_API_KEY=gsk_xxx
CEREBRAS_API_KEY=xxx
OPENROUTER_API_KEY=sk-or-xxx
HUGGINGFACE_API_KEY=hf_xxx
```

## Deploy

### Desenvolvimento Local

```bash
# Inicia o G4F Python
cd backend
docker-compose up g4f-server -d

# Inicia o backend Node.js
npm run dev
```

### Produção (Azure + Docker)

O G4F Python pode ser deployado como:
1. **Azure Container Instance** (ACI)
2. **Azure Container Apps**
3. **VPS com Docker**

```bash
# Build da imagem
docker build -t g4f-server ./g4f-server

# Push para registry
docker tag g4f-server myregistry.azurecr.io/g4f-server
docker push myregistry.azurecr.io/g4f-server

# Deploy como Container Instance
az container create \
  --name g4f-api \
  --resource-group GeminiAI \
  --image myregistry.azurecr.io/g4f-server \
  --ports 8080 \
  --cpu 2 \
  --memory 2
```

## Troubleshooting

### G4F Python não inicia

```bash
# Verifica logs
docker-compose logs g4f-server

# Reconstrói a imagem
docker-compose build --no-cache g4f-server
```

### Provider específico não funciona

Alguns providers Python requerem:
- Cookies do navegador
- Captcha bypass (nodriver)
- Sessão autenticada

Para providers que precisam de cookies, copie os cookies do navegador para:
```
~/.g4f/cookies/
```

## Modelos Recomendados

| Uso | Modelo | Provider |
|-----|--------|----------|
| Chat rápido | llama-3.3-70b-versatile | Groq |
| Código | qwen-2.5-coder-32b | Groq |
| Raciocínio | deepseek-r1 | DeepInfra |
| Imagens | flux | Pollinations |
| Geral | gpt-4o | G4F Python |
