#!/bin/bash

# ============================================
# Deploy Azure Functions - Meu Super AI
# ============================================

set -e

echo "🚀 Iniciando deploy das Azure Functions..."

# Configurações
RESOURCE_GROUP="meu-super-ai-rg"
STORAGE_ACCOUNT="meusuperaistorage"
FUNCTION_APP="meu-super-ai-functions"
LOCATION="eastus"

# Verifica se está logado no Azure
if ! az account show &> /dev/null; then
    echo "❌ Você não está logado no Azure. Execute: az login"
    exit 1
fi

echo "✅ Azure CLI autenticado"

# Verifica se o Resource Group existe
if ! az group show --name $RESOURCE_GROUP &> /dev/null; then
    echo "📦 Criando Resource Group..."
    az group create --name $RESOURCE_GROUP --location $LOCATION
fi

# Verifica se a Storage Account existe
if ! az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo "📦 Criando Storage Account..."
    az storage account create \
        --name $STORAGE_ACCOUNT \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku Standard_LRS
fi

# Verifica se a Function App existe
if ! az functionapp show --name $FUNCTION_APP --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo "📦 Criando Function App..."
    az functionapp create \
        --name $FUNCTION_APP \
        --resource-group $RESOURCE_GROUP \
        --storage-account $STORAGE_ACCOUNT \
        --consumption-plan-location $LOCATION \
        --runtime node \
        --runtime-version 20 \
        --functions-version 4 \
        --os-type Linux
    
    echo "⏳ Aguardando Function App inicializar..."
    sleep 30
fi

# Configura CORS
echo "🔧 Configurando CORS..."
az functionapp cors add \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --allowed-origins "*" 2>/dev/null || true

# Carrega variáveis de ambiente do backend
if [ -f "../backend/.env" ]; then
    echo "🔧 Configurando variáveis de ambiente..."
    source ../backend/.env
    
    az functionapp config appsettings set \
        --name $FUNCTION_APP \
        --resource-group $RESOURCE_GROUP \
        --settings \
        "MONGODB_URI=$MONGODB_URI" \
        "JWT_SECRET=$JWT_SECRET" \
        "GLOBAL_API_KEY=$GLOBAL_API_KEY" \
        "GROQ_API_KEY=${GROQ_API_KEY:-}" \
        "CEREBRAS_API_KEY=${CEREBRAS_API_KEY:-}"
fi

# Instala dependências
echo "📦 Instalando dependências..."
npm install --production

# Deploy
echo "🚀 Fazendo deploy..."
func azure functionapp publish $FUNCTION_APP --javascript

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📍 URL das Functions:"
echo "   https://$FUNCTION_APP.azurewebsites.net/api/chat"
echo "   https://$FUNCTION_APP.azurewebsites.net/api/chat/tools"
echo "   https://$FUNCTION_APP.azurewebsites.net/api/swarm"
echo ""
echo "💡 Configure FUNCTIONS_URL no frontend para usar as Functions!"
