#Requires -Version 5.1

# Script para deploy da Azure Function que atualiza modelos g4f
# Necessita: Azure CLI instalado e logado

$FUNCTION_APP_NAME = "jgspai-g4f-updater"
$RESOURCE_GROUP = "GeminiAI"
$LOCATION = "brazilsouth"
$STORAGE_ACCOUNT = "jgspaig4fstorage"

Write-Host "=== Deploy Azure Function - G4F Model Updater ==="

# Cria storage account se não existir
Write-Host "Criando Storage Account..."
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" storage account create `
    --name $STORAGE_ACCOUNT `
    --resource-group $RESOURCE_GROUP `
    --location $LOCATION `
    --sku Standard_LRS `
    --allow-blob-public-access false 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Storage já existe"
}

# Cria Function App se não existir
Write-Host "Criando Function App..."
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" functionapp create `
    --name $FUNCTION_APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --storage-account $STORAGE_ACCOUNT `
    --consumption-plan-location $LOCATION `
    --runtime python `
    --runtime-version 3.11 `
    --functions-version 4 `
    --os-type Linux 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Function App já existe"
}

# Configura variáveis de ambiente
Write-Host "Configurando variáveis de ambiente..."
# Pega MONGODB_URI do App Service existente
$MONGODB_URI = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp config appsettings list `
    --name gemini-api-13003 `
    --resource-group $RESOURCE_GROUP `
    --query "[?name=='MONGODB_URI'].value" `
    --output tsv

if ($MONGODB_URI -and $MONGODB_URI -ne "") {
    & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" functionapp config appsettings set `
        --name $FUNCTION_APP_NAME `
        --resource-group $RESOURCE_GROUP `
        --settings "MONGODB_URI=$MONGODB_URI"
    Write-Host "MONGODB_URI configurado!"
} else {
    Write-Host "⚠️  MONGODB_URI não encontrado. Configure manualmente."
}

# Deploy do código
Write-Host "Fazendo deploy do código..."
Set-Location $PSScriptRoot
func azure functionapp publish $FUNCTION_APP_NAME --python

Write-Host ""
Write-Host "=== Deploy Concluído! ==="
Write-Host "Function App: https://$FUNCTION_APP_NAME.azurewebsites.net"
Write-Host ""
Write-Host "Endpoints:"
Write-Host "  - GET /api/g4f-models - Lista modelos (público)"
Write-Host "  - POST /api/update-g4f - Força atualização (requer function key)"
Write-Host ""
Write-Host "Timer: Executa automaticamente todos os dias às 3:00 AM UTC"
