#!/bin/bash

set -euo pipefail

# Script para fazer deploy do G4F Python Server no Azure Container Instance

# --- CONFIGURAÇÕES ---
RG="meu-super-ai-rg"
CONTAINER_NAME="g4f-server"
ACR_NAME="meusuperaiacr"
IMAGE_NAME="$ACR_NAME.azurecr.io/g4f-server:latest"
LOCATION="centralus"
DNS_LABEL="meu-super-ai-g4f"

echo "=== DEPLOY G4F CONTAINER: $CONTAINER_NAME ==="

echo "1) Login no ACR"
az acr login --name $ACR_NAME

echo "2) Build da imagem Docker"
cd "$(dirname "$0")/g4f-server"
docker build -t "$IMAGE_NAME" .

echo "3) Push para ACR"
docker push "$IMAGE_NAME"

echo "4) Obtendo credenciais do ACR"
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

echo "5) Deletando container antigo (se existir)"
if az container show --name $CONTAINER_NAME --resource-group $RG >/dev/null 2>&1; then
  az container delete --name $CONTAINER_NAME --resource-group $RG --yes
  echo "Aguardando remoção do container antigo..."
  # Espera até o container sumir (timeout 60s)
  for i in {1..12}; do
    if ! az container show --name $CONTAINER_NAME --resource-group $RG >/dev/null 2>&1; then
      break
    fi
    sleep 5
  done
else
  echo "Container antigo não encontrado"
fi

echo "6) Criando novo container"
az container create \
  --resource-group $RG \
  --name $CONTAINER_NAME \
  --image "$IMAGE_NAME" \
  --cpu 1 \
  --memory 2 \
  --ports 8080 \
  --dns-name-label $DNS_LABEL \
  --location $LOCATION \
  --registry-login-server "$ACR_NAME.azurecr.io" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --os-type Linux \
  --restart-policy Always

echo "7) Aguardando container iniciar..."
sleep 10

echo "8) Verificando status"
az container show --name $CONTAINER_NAME --resource-group $RG --query "{state:instanceView.state, ip:ipAddress.ip, fqdn:ipAddress.fqdn}" -o table

echo ""
echo "=== DEPLOY CONCLUÍDO ==="
echo "URL: http://$DNS_LABEL.$LOCATION.azurecontainer.io:8080"
echo ""

# Teste de saúde
echo "Testando endpoint..."
sleep 5
curl -s "http://$DNS_LABEL.$LOCATION.azurecontainer.io:8080/health" || echo "Aguarde alguns segundos para o container iniciar completamente"

exit 0
