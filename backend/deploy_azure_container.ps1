#Requires -Version 5.1

# Script para construir a imagem Docker do backend, enviar para Azure Container Registry
# e configurar o Azure Web App para usar essa imagem (Web App for Containers).

# --- CONFIGURAÇÕES ---
$RG = "GeminiAI"
$PLAN = "PlanoGratis"
$APP = "gemini-api-13003"
$LOCATION = "mexicocentral"

# Nome do ACR derivado do nome do app (remove hífens e força minúsculas)
$ACR = ($APP -replace '-', '').ToLower()
$IMAGE_NAME = "$ACR.azurecr.io/$APP:latest"

Write-Host "--- DEPLOY CONTAINER: $APP usando ACR $ACR ---"

Write-Host "1) Garantindo Resource Group e App Service Plan"
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" group create --name $RG --location $LOCATION | Out-Null
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" appservice plan create --name $PLAN --resource-group $RG --sku B1 --is-linux --location $LOCATION

Write-Host "2) Garantindo que o ACR exista (cria se não existir)"
$acrExists = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" acr show --name $ACR --resource-group $RG 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "ACR $ACR já existe"
} else {
    Write-Host "Criando ACR: $ACR"
    & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" acr create --name $ACR --resource-group $RG --sku Basic --location $LOCATION --admin-enabled false
}

Write-Host "3) Fazendo login no ACR"
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" acr login --name $ACR

Write-Host "4) Build da imagem Docker"
# Usa o Dockerfile backend (espera estar no diretório backend ao executar)
$DOCKERFILE = "Dockerfile.backend"
if (-not (Test-Path $DOCKERFILE)) {
    # tenta o Dockerfile dentro de g4f-server
    $DOCKERFILE = "g4f-server/Dockerfile"
}
if (-not (Test-Path $DOCKERFILE)) {
    Write-Error "Erro: nenhum Dockerfile encontrado (procurei Dockerfile.backend e g4f-server/Dockerfile)"
    exit 1
}

Write-Host "Usando Dockerfile: $DOCKERFILE"
docker build -t "$IMAGE_NAME" -f "$DOCKERFILE" .

Write-Host "5) Push para ACR"
docker push "$IMAGE_NAME"

Write-Host "6) Criando/atualizando Web App para usar imagem de container"
$appExists = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp show --name $APP --resource-group $RG 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Web App $APP já existe; atualizando configuração de container"
} else {
    Write-Host "Criando Web App $APP"
    & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp create --resource-group $RG --plan $PLAN --name $APP --deployment-container-image-name "$IMAGE_NAME"
}

Write-Host "Atribuindo identidade gerenciada ao Web App (para permitir pull do ACR)"
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp identity assign --resource-group $RG --name $APP | Out-Null

$PRINCIPAL_ID = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp show --name $APP --resource-group $RG --query identity.principalId -o tsv
$SUBSCRIPTION_ID = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show --query id -o tsv
$ACR_ID = "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG/providers/Microsoft.ContainerRegistry/registries/$ACR"

Write-Host "Concedendo role 'AcrPull' para principal do Web App no ACR"
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" role assignment create --assignee $PRINCIPAL_ID --role acrpull --scope $ACR_ID

Write-Host "Configurando Web App para usar a imagem do ACR"
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp config container set --name $APP --resource-group $RG --docker-custom-image-name "$IMAGE_NAME" --docker-registry-server-url "https://$ACR.azurecr.io"

Write-Host "Reiniciando Web App"
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp restart --name $APP --resource-group $RG

Write-Host "--- DEPLOY CONTAINER CONCLUÍDO ---"
Write-Host "Link: https://$APP.azurewebsites.net/api/admin/data"
