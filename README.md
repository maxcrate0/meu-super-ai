# meu-super-ai

Plataforma de IA com múltiplos modelos gratuitos integrados.

## 🚀 Funcionalidades

- ✅ **Múltiplos Modelos de IA** - Acesso a dezenas de modelos gratuitos
- ✅ **Sempre Funciona** - Sistema com fallback automático entre providers
- ✅ **Sem Configuração Inicial** - Funciona out-of-the-box com providers gratuitos
- ✅ **Interface Moderna** - React + Tailwind CSS
- ✅ **Backend Robusto** - Node.js com fallback inteligente

## 🎯 Providers Disponíveis

### JavaScript Providers (Sempre Disponíveis)
- **Pollinations AI** - Gratuito, sem API key
- **DeepInfra** - Tier gratuito
- **Cloudflare Workers AI** - Gratuito

### Com API Key Gratuita (Opcional, mas Recomendado)
- **Groq** - Ultra rápido! (https://console.groq.com)
- **Cerebras** - Rápido (https://cloud.cerebras.ai)
- **OpenRouter** - Muitos modelos (https://openrouter.ai)

## 📦 Instalação

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuração (Opcional)

Para melhor desempenho, adicione API keys gratuitas no painel de admin:
1. Acesse `/admin` após fazer login
2. Vá em "Configurações Globais"
3. Adicione suas API keys (todas gratuitas!)

## 📚 Documentação Detalhada

- [Integração G4F](backend/G4F_INTEGRATION.md) - Detalhes sobre os providers

## ⚙️ Deploy

### Frontend (Vercel)
O frontend já está configurado para deploy no Vercel. Basta fazer commit no GitHub.

### Backend (Azure)
Para deploy no backend:
```bash
cd backend
./deploy_azure.sh
```

## 🐛 Troubleshooting

### Modelos não aparecem?
- ✅ Isso é normal se o servidor G4F Python não estiver rodando
- ✅ O sistema funciona perfeitamente apenas com providers JavaScript
- ℹ️ Para ver mais modelos, adicione API keys gratuitas no painel de admin

### Erro ao usar modelo?
- ✅ O sistema tem fallback automático
- ✅ Se um provider falhar, tenta outro automaticamente
- ℹ️ Verifique se tem API keys configuradas para melhor experiência