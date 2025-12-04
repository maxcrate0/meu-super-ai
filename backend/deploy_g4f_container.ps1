#Requires -Version 5.1

# Script para fazer deploy do G4F Python Server no Azure Container Instance

# --- CONFIGURAÇÕES ---
$RG = "meu-super-ai-rg"
$CONTAINER_NAME = "g4f-server"
$ACR_NAME = "meusuperaiacr"
$IMAGE_NAME = "$ACR_NAME.azurecr.io/g4f-server:latest"
$LOCATION = "centralus"
$DNS_LABEL = "meu-super-ai-g4f"

Write-Host "=== DEPLOY G4F CONTAINER: $CONTAINER_NAME ==="

Write-Host "1) Login no ACR"
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" acr login --name $ACR_NAME

Write-Host "2) Build da imagem Docker"
Set-Location "$PSScriptRoot/g4f-server"
docker build -t "$IMAGE_NAME" .

Write-Host "3) Push para ACR"
docker push "$IMAGE_NAME"

Write-Host "4) Obtendo credenciais do ACR"
$ACR_USERNAME = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" acr credential show --name $ACR_NAME --query username -o tsv
$ACR_PASSWORD = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" acr credential show --name $ACR_NAME --query passwords[0].value -o tsv

Write-Host "5) Deletando container antigo (se existir)"
$containerExists = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" container show --name $CONTAINER_NAME --resource-group $RG 2>$null
if ($LASTEXITCODE -eq 0) {
    & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" container delete --name $CONTAINER_NAME --resource-group $RG --yes
    Write-Host "Aguardando remoção do container antigo..."
    # Espera até o container sumir (timeout 60s)
    for ($i = 1; $i -le 12; $i++) {
        $containerExists = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" container show --name $CONTAINER_NAME --resource-group $RG 2>$null
        if ($LASTEXITCODE -ne 0) {
            break
        }
        Start-Sleep -Seconds 5
    }
} else {
    Write-Host "Container antigo não encontrado"
}

Write-Host "6) Criando novo container"
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" container create `
    --resource-group $RG `
    --name $CONTAINER_NAME `
    --image "$IMAGE_NAME" `
    --cpu 1 `
    --memory 2 `
    --ports 8080 `
    --dns-name-label $DNS_LABEL `
    --location $LOCATION `
    --registry-login-server "$ACR_NAME.azurecr.io" `
    --registry-username "$ACR_USERNAME" `
    --registry-password "$ACR_PASSWORD" `
    --os-type Linux `
    --restart-policy Always

Write-Host "7) Aguardando container iniciar..."
Start-Sleep -Seconds 10

Write-Host "8) Verificando status"
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" container show --name $CONTAINER_NAME --resource-group $RG --query "{state:instanceView.state, ip:ipAddress.ip, fqdn:ipAddress.fqdn}" -o table

Write-Host ""
Write-Host "=== DEPLOY CONCLUÍDO ==="
Write-Host "URL: http://$DNS_LABEL.$LOCATION.azurecontainer.io:8080"
Write-Host ""

# Teste de saúde
Write-Host "Testando endpoint..."
Start-Sleep -Seconds 5
try {
    Invoke-WebRequest -Uri "http://$DNS_LABEL.$LOCATION.azurecontainer.io:8080/health" -TimeoutSec 10 | Out-Null
} catch {
    Write-Host "Aguarde alguns segundos para o container iniciar completamente"
}
