# meu-super-ai

## 🚀 Deploy no Azure

Este projeto possui um script unificado para deploy no Azure com três modos diferentes:

### Pré-requisitos
- Azure CLI instalado e logado (`az login`)
- Docker instalado (para modos container)
- Permissões para criar recursos no Azure

### Modos de Deploy

#### 1. Deploy do WebApp Node.js (Padrão)
```bash
cd backend
./deploy_azure.sh
```
- Faz deploy do código Node.js diretamente no Azure Web App
- Ideal para desenvolvimento rápido
- Usa plano F1 (gratuito)

#### 2. Deploy do Backend como Container
```bash
cd backend
./deploy_azure.sh --container
```
- Constrói imagem Docker do backend
- Faz push para Azure Container Registry (ACR)
- Configura Web App para usar container
- Usa plano B1 (básico)

#### 3. Deploy do G4F Server (ACI)
```bash
cd backend
./deploy_azure.sh --g4f
```
- Constrói imagem Docker do G4F Python Server
- Faz deploy como Azure Container Instance (ACI)
- Disponível em URL pública independente

### Configurações
- **Resource Group**: GeminiAI
- **App Service Plan**: PlanoGratis
- **Web App**: gemini-api-13003
- **ACR**: geminiapi13003
- **Localização**: Mexico Central

### Arquitetura
```
Frontend (Vercel) ────► Backend (Azure Web App/Container)
                          │
                          └───► G4F Server (Azure Container Instance)
```

### Monitoramento
Após o deploy, verifique:
- Web App: https://gemini-api-13003.azurewebsites.net/api/admin/data
- G4F Server: http://meu-super-ai-g4f.centralus.azurecontainer.io:8080

## 📋 Sobre o Projeto

Sistema de IA com chat integrado, suporte a múltiplos providers e ferramentas customizáveis.

### Tecnologias
- **Frontend**: React + Vite (Vercel)
- **Backend**: Node.js (Azure Web App/Container)
- **G4F Server**: Python FastAPI (Azure Container Instance)
- **Banco**: MongoDB
- **IA**: GPT-4, Claude, Gemini, Llama, etc. via G4F

### Funcionalidades
- Chat com múltiplos modelos de IA
- Criação de ferramentas customizadas
- Execução de código
- Geração de imagens
- Interface responsiva

## 🛠️ Desenvolvimento Local

### Backend
```bash
cd backend
npm install
npm start
```

### G4F Server
```bash
cd backend/g4f-server
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte, abra uma issue no GitHub ou entre em contato com a equipe de desenvolvimento.