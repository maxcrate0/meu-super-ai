#!/bin/bash

set -euo pipefail

# Script para construir a imagem Docker do backend, enviar para Azure Container Registry
# e configurar o Azure Web App para usar essa imagem (Web App for Containers).

# --- CONFIGURAÇÕES ---
RG="GeminiAI"
PLAN="PlanoGratis"
APP="gemini-api-13003"
LOCATION="mexicocentral"

# Nome do ACR derivado do nome do app (remove hífens e força minúsculas)
ACR=$(echo "${APP//-/}" | tr '[:upper:]' '[:lower:]')
IMAGE_NAME="$ACR.azurecr.io/$APP:latest"

echo "--- DEPLOY CONTAINER: $APP usando ACR $ACR ---"

echo "1) Garantindo Resource Group e App Service Plan"
az group create --name $RG --location $LOCATION >/dev/null
az appservice plan create --name $PLAN --resource-group $RG --sku B1 --is-linux --location $LOCATION || true

echo "2) Garantindo que o ACR exista (cria se não existir)"
if az acr show --name $ACR --resource-group $RG >/dev/null 2>&1; then
  echo "ACR $ACR já existe"
else
  echo "Criando ACR: $ACR"
  az acr create --name $ACR --resource-group $RG --sku Basic --location $LOCATION --admin-enabled false
fi

echo "3) Fazendo login no ACR"
az acr login --name $ACR

echo "4) Build da imagem Docker"
# Usa o Dockerfile backend (espera estar no diretório backend ao executar)
DOCKERFILE="Dockerfile.backend"
if [ ! -f "$DOCKERFILE" ]; then
  # tenta o Dockerfile dentro de g4f-server
  DOCKERFILE="g4f-server/Dockerfile"
fi
if [ ! -f "$DOCKERFILE" ]; then
  echo "Erro: nenhum Dockerfile encontrado (procurei Dockerfile.backend e g4f-server/Dockerfile)"
  exit 1
fi

echo "Usando Dockerfile: $DOCKERFILE"
docker build -t "$IMAGE_NAME" -f "$DOCKERFILE" .

echo "5) Push para ACR"
docker push "$IMAGE_NAME"

echo "6) Criando/atualizando Web App para usar imagem de container"
if az webapp show --name $APP --resource-group $RG >/dev/null 2>&1; then
  echo "Web App $APP já existe; atualizando configuração de container"
else
  echo "Criando Web App $APP"
  az webapp create --resource-group $RG --plan $PLAN --name $APP --deployment-container-image-name "$IMAGE_NAME"
fi

echo "Atribuindo identidade gerenciada ao Web App (para permitir pull do ACR)"
az webapp identity assign --resource-group $RG --name $APP >/dev/null

PRINCIPAL_ID=$(az webapp show --name $APP --resource-group $RG --query identity.principalId -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
ACR_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG/providers/Microsoft.ContainerRegistry/registries/$ACR"

echo "Concedendo role 'AcrPull' para principal do Web App no ACR"
az role assignment create --assignee $PRINCIPAL_ID --role acrpull --scope $ACR_ID || true

echo "Configurando Web App para usar a imagem do ACR"
az webapp config container set --name $APP --resource-group $RG --docker-custom-image-name "$IMAGE_NAME" --docker-registry-server-url "https://$ACR.azurecr.io"

echo "Reiniciando Web App"
az webapp restart --name $APP --resource-group $RG

echo "--- DEPLOY CONTAINER CONCLUÍDO ---"
echo "Link: https://$APP.azurewebsites.net/api/admin/data"

exit 0
