#!/bin/bash

# Script unificado para deploy no Azure
# Uso:
#   ./deploy_azure.sh              # Deploy do webapp Node.js (padrão)
#   ./deploy_azure.sh --container  # Deploy do backend como container
#   ./deploy_azure.sh --g4f        # Deploy do G4F server como ACI

set -euo pipefail

# --- CONFIGURAÇÕES GERAIS ---
RG="GeminiAI"
PLAN="PlanoGratis"
APP="gemini-api-13003"
LOCATION="mexicocentral"

# Configurações específicas
ACR=$(echo "${APP//-/}" | tr '[:upper:]' '[:lower:]')
G4F_CONTAINER_NAME="g4f-server"
G4F_ACR_NAME="meusuperaiacr"
G4F_IMAGE_NAME="$G4F_ACR_NAME.azurecr.io/g4f-server:latest"
G4F_DNS_LABEL="meu-super-ai-g4f"
G4F_LOCATION="centralus"
G4F_RG="meu-super-ai-rg"

# Detecta o tipo de deploy
DEPLOY_TYPE="webapp"
if [ "${1:-}" = "--container" ]; then
    DEPLOY_TYPE="container"
elif [ "${1:-}" = "--g4f" ]; then
    DEPLOY_TYPE="g4f"
fi

echo "=== DEPLOY AZURE: $DEPLOY_TYPE ==="

# Função para garantir RG e Plan
ensure_infrastructure() {
    echo "1) Garantindo Resource Group e App Service Plan"
    az group create --name $RG --location $LOCATION >/dev/null 2>&1 || true
    az appservice plan create --name $PLAN --resource-group $RG --sku ${1:-F1} --is-linux --location $LOCATION >/dev/null 2>&1 || true
}

# Função para deploy final do webapp (sempre por último)
deploy_webapp() {
    if [ "$DEPLOY_TYPE" = "webapp" ]; then
        echo "Enviando código para a Azure..."
        cd ..
        az webapp deployment source config-zip --resource-group $RG --name $APP --src backend.zip >/dev/null 2>&1
        echo "--- DEPLOY WEBAPP CONCLUÍDO! ---"
    elif [ "$DEPLOY_TYPE" = "container" ]; then
        echo "Reiniciando Web App"
        az webapp restart --name $APP --resource-group $RG >/dev/null 2>&1
        echo "--- DEPLOY CONTAINER CONCLUÍDO ---"
    fi
    
    echo "Link: https://$APP.azurewebsites.net/api/admin/data"
}

# DEPLOY DO WEBAPP (padrão)
if [ "$DEPLOY_TYPE" = "webapp" ]; then
    echo "--- INICIANDO DEPLOY WEBAPP: $APP ---"

    ensure_infrastructure "F1"

    # 2. Garante que o Web App existe
    az webapp create --resource-group $RG --plan $PLAN --name $APP --runtime "NODE:20-lts" >/dev/null 2>&1 || true

    # 3. Configurações de Build
    az webapp config appsettings set --resource-group $RG --name $APP --settings \
        SCM_DO_BUILD_DURING_DEPLOYMENT="true" \
        WEBSITE_NODE_DEFAULT_VERSION="~20" >/dev/null 2>&1 || true

    # 4. Empacota o código
    echo "Compactando arquivos..."
    rm -f ../backend.zip
    zip -r ../backend.zip . -x "node_modules/*" ".env" "webapp_logs.zip" "*.log" >/dev/null 2>&1

    # 5. Envia para a nuvem
    deploy_webapp

# DEPLOY DO CONTAINER
elif [ "$DEPLOY_TYPE" = "container" ]; then
    echo "--- DEPLOY CONTAINER: $APP usando ACR $ACR ---"

    ensure_infrastructure "B1"

    echo "2) Garantindo que o ACR exista"
    if az acr show --name $ACR --resource-group $RG >/dev/null 2>&1; then
        echo "ACR $ACR já existe"
    else
        echo "Criando ACR: $ACR"
        az acr create --name $ACR --resource-group $RG --sku Basic --location $LOCATION --admin-enabled false >/dev/null 2>&1
    fi

    echo "3) Fazendo login no ACR"
    az acr login --name $ACR >/dev/null 2>&1

    echo "4) Build da imagem Docker"
    DOCKERFILE="Dockerfile.backend"
    if [ ! -f "$DOCKERFILE" ]; then
        DOCKERFILE="g4f-server/Dockerfile"
    fi
    if [ ! -f "$DOCKERFILE" ]; then
        echo "Erro: nenhum Dockerfile encontrado"
        exit 1
    fi

    echo "Usando Dockerfile: $DOCKERFILE"
    IMAGE_NAME="$ACR.azurecr.io/$APP:latest"
    docker build -t "$IMAGE_NAME" -f "$DOCKERFILE" . >/dev/null 2>&1

    echo "5) Push para ACR"
    docker push "$IMAGE_NAME" >/dev/null 2>&1

    echo "6) Criando/atualizando Web App para usar imagem de container"
    if az webapp show --name $APP --resource-group $RG >/dev/null 2>&1; then
        echo "Web App $APP já existe; atualizando configuração de container"
    else
        echo "Criando Web App $APP"
        az webapp create --resource-group $RG --plan $PLAN --name $APP --deployment-container-image-name "$IMAGE_NAME" >/dev/null 2>&1
    fi

    echo "Atribuindo identidade gerenciada ao Web App"
    az webapp identity assign --resource-group $RG --name $APP >/dev/null 2>&1

    PRINCIPAL_ID=$(az webapp show --name $APP --resource-group $RG --query identity.principalId -o tsv)
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    ACR_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG/providers/Microsoft.ContainerRegistry/registries/$ACR"

    echo "Concedendo role 'AcrPull' para o Web App no ACR"
    az role assignment create --assignee $PRINCIPAL_ID --role acrpull --scope $ACR_ID >/dev/null 2>&1 || true

    echo "Configurando Web App para usar a imagem do ACR"
    az webapp config container set --name $APP --resource-group $RG \
        --docker-custom-image-name "$IMAGE_NAME" \
        --docker-registry-server-url "https://$ACR.azurecr.io" >/dev/null 2>&1

    deploy_webapp

# DEPLOY DO G4F ACI
elif [ "$DEPLOY_TYPE" = "g4f" ]; then
    echo "=== DEPLOY G4F CONTAINER: $G4F_CONTAINER_NAME ==="

    echo "1) Login no ACR"
    az acr login --name $G4F_ACR_NAME >/dev/null 2>&1

    echo "2) Build da imagem Docker"
    cd g4f-server
    docker build -t "$G4F_IMAGE_NAME" . >/dev/null 2>&1

    echo "3) Push para ACR"
    docker push "$G4F_IMAGE_NAME" >/dev/null 2>&1

    echo "4) Obtendo credenciais do ACR"
    ACR_USERNAME=$(az acr credential show --name $G4F_ACR_NAME --query username -o tsv)
    ACR_PASSWORD=$(az acr credential show --name $G4F_ACR_NAME --query passwords[0].value -o tsv)

    echo "5) Deletando container antigo (se existir)"
    if az container show --name $G4F_CONTAINER_NAME --resource-group $G4F_RG >/dev/null 2>&1; then
        az container delete --name $G4F_CONTAINER_NAME --resource-group $G4F_RG --yes >/dev/null 2>&1
        echo "Aguardando remoção do container antigo..."
        for i in {1..12}; do
            if ! az container show --name $G4F_CONTAINER_NAME --resource-group $G4F_RG >/dev/null 2>&1; then
                break
            fi
            sleep 5
        done
    else
        echo "Container antigo não encontrado"
    fi

    echo "6) Criando novo container"
    az container create \
        --resource-group $G4F_RG \
        --name $G4F_CONTAINER_NAME \
        --image "$G4F_IMAGE_NAME" \
        --cpu 1 \
        --memory 2 \
        --ports 8080 \
        --dns-name-label $G4F_DNS_LABEL \
        --location $G4F_LOCATION \
        --registry-login-server "$G4F_ACR_NAME.azurecr.io" \
        --registry-username "$ACR_USERNAME" \
        --registry-password "$ACR_PASSWORD" \
        --os-type Linux \
        --restart-policy Always >/dev/null 2>&1

    echo "7) Aguardando container iniciar..."
    sleep 10

    echo "8) Verificando status"
    az container show --name $G4F_CONTAINER_NAME --resource-group $G4F_RG \
        --query "{state:instanceView.state, ip:ipAddress.ip, fqdn:ipAddress.fqdn}" -o table

    echo ""
    echo "=== DEPLOY G4F CONCLUÍDO ==="
    echo "URL: http://$G4F_DNS_LABEL.$G4F_LOCATION.azurecontainer.io:8080"

    # Teste de saúde
    echo "Testando endpoint..."
    sleep 5
    curl -s "http://$G4F_DNS_LABEL.$G4F_LOCATION.azurecontainer.io:8080/" | head -5 || echo "Aguarde alguns segundos para o container iniciar completamente"

fi

echo ""
echo "Deploy concluído com sucesso!"
exit 0