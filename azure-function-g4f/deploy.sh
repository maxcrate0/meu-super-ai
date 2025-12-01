#!/bin/bash

# Script para deploy da Azure Function que atualiza modelos g4f
# Necessita: Azure CLI instalado e logado

FUNCTION_APP_NAME="jgspai-g4f-updater"
RESOURCE_GROUP="GeminiAI"
LOCATION="brazilsouth"
STORAGE_ACCOUNT="jgspaig4fstorage"

echo "=== Deploy Azure Function - G4F Model Updater ==="

# Cria storage account se não existir
echo "Criando Storage Account..."
az storage account create \
    --name $STORAGE_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --sku Standard_LRS \
    --allow-blob-public-access false \
    2>/dev/null || echo "Storage já existe"

# Cria Function App se não existir
echo "Criando Function App..."
az functionapp create \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --storage-account $STORAGE_ACCOUNT \
    --consumption-plan-location $LOCATION \
    --runtime python \
    --runtime-version 3.11 \
    --functions-version 4 \
    --os-type Linux \
    2>/dev/null || echo "Function App já existe"

# Configura variáveis de ambiente
echo "Configurando variáveis de ambiente..."
# Pega MONGODB_URI do App Service existente
MONGODB_URI=$(az webapp config appsettings list \
    --name gemini-api-13003 \
    --resource-group $RESOURCE_GROUP \
    --query "[?name=='MONGODB_URI'].value" \
    --output tsv)

if [ -n "$MONGODB_URI" ]; then
    az functionapp config appsettings set \
        --name $FUNCTION_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --settings "MONGODB_URI=$MONGODB_URI"
    echo "MONGODB_URI configurado!"
else
    echo "⚠️  MONGODB_URI não encontrado. Configure manualmente."
fi

# Deploy do código
echo "Fazendo deploy do código..."
cd "$(dirname "$0")"
func azure functionapp publish $FUNCTION_APP_NAME --python

echo ""
echo "=== Deploy Concluído! ==="
echo "Function App: https://$FUNCTION_APP_NAME.azurewebsites.net"
echo ""
echo "Endpoints:"
echo "  - GET /api/g4f-models - Lista modelos (público)"
echo "  - POST /api/update-g4f - Força atualização (requer function key)"
echo ""
echo "Timer: Executa automaticamente todos os dias às 3:00 AM UTC"
