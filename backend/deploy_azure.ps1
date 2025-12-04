# --- CONFIGURAÇÕES ---
$GRP = "GeminiAI"
$PLAN = "PlanoGratis"
$APP = "gemini-api-13003" # Nome do seu app existente
$LOCATION = "mexicocentral"

Write-Host "--- INICIANDO DEPLOY PARA: $APP ---"

# 1. Garante que o Grupo e o Plano existem
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" group create --name $GRP --location $LOCATION
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" appservice plan create --name $PLAN --resource-group $GRP --sku F1 --is-linux

# 2. Garante que o Web App existe (ou atualiza configurações)
# IMPORTANTE: Forçando NODE:20-lts para evitar o erro de versão antiga
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp create --resource-group $GRP --plan $PLAN --name $APP --runtime "NODE:20-lts"

# 3. Configurações de Build (Importante para evitar erros de deploy)
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp config appsettings set --resource-group $GRP --name $APP --settings SCM_DO_BUILD_DURING_DEPLOYMENT="true" WEBSITE_NODE_DEFAULT_VERSION="~20"

# 4. Empacota o código
Write-Host "Compactando arquivos..."
# Remove zip antigo se existir
if (Test-Path "../backend.zip") { Remove-Item "../backend.zip" -Force }
# Cria o zip ignorando a pasta node_modules (ela será instalada na Azure)
Get-ChildItem -Path "." -Exclude "node_modules", ".env" | Compress-Archive -DestinationPath "../backend.zip" -Force

# 5. Envia para a nuvem
Write-Host "Enviando código para a Azure..."
Set-Location ".."
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp deployment source config-zip --resource-group $GRP --name $APP --src backend.zip

Write-Host "--- DEPLOY CONCLUÍDO! ---"
Write-Host "Link: https://$APP.azurewebsites.net/api/admin/data"