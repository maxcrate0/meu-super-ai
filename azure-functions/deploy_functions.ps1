#Requires -Version 5.1

# ============================================
# Deploy Azure Functions - Meu Super AI
# ============================================

Write-Host "🚀 Iniciando deploy das Azure Functions..."

# Configurações
$RESOURCE_GROUP = "meu-super-ai-rg"
$STORAGE_ACCOUNT = "meusuperaistorage"
$FUNCTION_APP = "meu-super-ai-functions"
$LOCATION = "eastus"

# Verifica se está logado no Azure
$accountCheck = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Você não está logado no Azure. Execute: az login"
    exit 1
}

Write-Host "✅ Azure CLI autenticado"

# Verifica se o Resource Group existe
$rgCheck = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" group show --name $RESOURCE_GROUP 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "📦 Criando Resource Group..."
    & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" group create --name $RESOURCE_GROUP --location $LOCATION
}

# Verifica se a Storage Account existe
$storageCheck = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "📦 Criando Storage Account..."
    & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" storage account create `
        --name $STORAGE_ACCOUNT `
        --resource-group $RESOURCE_GROUP `
        --location $LOCATION `
        --sku Standard_LRS
}

# Verifica se a Function App existe
$functionCheck = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" functionapp show --name $FUNCTION_APP --resource-group $RESOURCE_GROUP 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "📦 Criando Function App..."
    & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" functionapp create `
        --name $FUNCTION_APP `
        --resource-group $RESOURCE_GROUP `
        --storage-account $STORAGE_ACCOUNT `
        --consumption-plan-location $LOCATION `
        --runtime node `
        --runtime-version 20 `
        --functions-version 4 `
        --os-type Linux

    Write-Host "⏳ Aguardando Function App inicializar..."
    Start-Sleep -Seconds 30
}

# Configura CORS
Write-Host "🔧 Configurando CORS..."
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" functionapp cors add `
    --name $FUNCTION_APP `
    --resource-group $RESOURCE_GROUP `
    --allowed-origins "*" 2>$null

# Carrega variáveis de ambiente do backend
$envFile = "../backend/.env"
if (Test-Path $envFile) {
    Write-Host "🔧 Configurando variáveis de ambiente..."

    # Lê o arquivo .env e configura as variáveis
    $envContent = Get-Content $envFile
    $settings = @()

    foreach ($line in $envContent) {
        if ($line -match '^([^=]+)=(.*)$') {
            $key = $matches[1]
            $value = $matches[2]
            $settings += "$key=$value"
        }
    }

    if ($settings.Count -gt 0) {
        & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" functionapp config appsettings set `
            --name $FUNCTION_APP `
            --resource-group $RESOURCE_GROUP `
            --settings $settings
    }
}

# Instala dependências
Write-Host "📦 Instalando dependências..."
npm install --production

# Deploy
Write-Host "🚀 Fazendo deploy..."
func azure functionapp publish $FUNCTION_APP --javascript

Write-Host ""
Write-Host "✅ Deploy concluído!"
Write-Host ""
Write-Host "📍 URL das Functions:"
Write-Host "   https://$FUNCTION_APP.azurewebsites.net/api/chat"
Write-Host "   https://$FUNCTION_APP.azurewebsites.net/api/chat/tools"
Write-Host "   https://$FUNCTION_APP.azurewebsites.net/api/swarm"
Write-Host ""
Write-Host "💡 Configure FUNCTIONS_URL no frontend para usar as Functions!"
