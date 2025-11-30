#!/bin/bash

# --- CONFIGURAÇÕES ---
GRP="GeminiAI"
PLAN="PlanoGratis"
APP="gemini-api-13003" # Nome do seu app existente
LOCATION="mexicocentral"

echo "--- INICIANDO DEPLOY PARA: $APP ---"

# 1. Garante que o Grupo e o Plano existem
az group create --name $GRP --location $LOCATION
az appservice plan create --name $PLAN --resource-group $GRP --sku F1 --is-linux

# 2. Garante que o Web App existe (ou atualiza configurações)
# IMPORTANTE: Forçando NODE:20-lts para evitar o erro de versão antiga
az webapp create --resource-group $GRP --plan $PLAN --name $APP --runtime "NODE:20-lts"

# 3. Configurações de Build (Importante para evitar erros de deploy)
az webapp config appsettings set --resource-group $GRP --name $APP --settings SCM_DO_BUILD_DURING_DEPLOYMENT="true" WEBSITE_NODE_DEFAULT_VERSION="~20"

# 4. Empacota o código
echo "Compactando arquivos..."
# Remove zip antigo se existir
rm -f ../backend.zip
# Cria o zip ignorando a pasta node_modules (ela será instalada na Azure)
zip -r ../backend.zip . -x "node_modules/*" ".env"

# 5. Envia para a nuvem
echo "Enviando código para a Azure..."
cd ..
az webapp deployment source config-zip --resource-group $GRP --name $APP --src backend.zip

echo "--- DEPLOY CONCLUÍDO! ---"
echo "Link: https://$APP.azurewebsites.net/api/admin/data"