# Scripts de Deploy - Windows PowerShell

Este documento explica como usar os scripts de deploy convertidos para PowerShell (.ps1) para Windows.

## Scripts Disponíveis

### Backend
- `deploy_azure.ps1` - Deploy básico do backend para Azure Web App
- `deploy_azure_container.ps1` - Deploy do backend usando containers Azure
- `deploy_g4f_container.ps1` - Deploy do servidor G4F como container

### Azure Functions
- `azure-functions/deploy_functions.ps1` - Deploy das Azure Functions principais
- `azure-function-g4f/deploy.ps1` - Deploy da função G4F model updater

## Pré-requisitos

1. **Azure CLI instalado**: `az` deve estar disponível no PATH
2. **Azure Functions Core Tools** (para funções): `func` deve estar disponível
3. **Docker** (para deploys container): Docker Desktop instalado
4. **Autenticação Azure**: Execute `az login` antes de usar os scripts

## Como Usar

### 1. Deploy Básico do Backend
```powershell
cd backend
.\deploy_azure.ps1
```

### 2. Deploy com Container
```powershell
cd backend
.\deploy_azure_container.ps1
```

### 3. Deploy do G4F Container
```powershell
cd backend
.\deploy_g4f_container.ps1
```

### 4. Deploy das Azure Functions
```powershell
cd azure-functions
.\deploy_functions.ps1
```

### 5. Deploy da Função G4F
```powershell
cd azure-function-g4f
.\deploy.ps1
```

## Configuração

### Variáveis de Ambiente
Os scripts usam variáveis de ambiente. Configure-as conforme necessário:

```powershell
# Para deploy básico
$env:AZURE_RESOURCE_GROUP = "seu-resource-group"
$env:AZURE_WEBAPP_NAME = "seu-webapp-name"

# Para containers
$env:AZURE_CONTAINER_REGISTRY = "seu-acr"
$env:DOCKER_IMAGE_TAG = "latest"
```

### Arquivo .env (opcional)
Para as Azure Functions, você pode criar um arquivo `.env` na pasta do projeto:

```
AZURE_RESOURCE_GROUP=seu-resource-group
AZURE_FUNCTIONS_APP_NAME=seu-function-app
AZURE_STORAGE_ACCOUNT=seu-storage-account
```

## Troubleshooting

### Erro de Autenticação
Se receber erro de autenticação, execute:
```powershell
az login
```

### Permissões Insuficientes
Para operações que requerem permissões elevadas, execute o PowerShell como Administrador.

### Docker Não Encontrado
Certifique-se que Docker Desktop está instalado e rodando.

## Diferenças dos Scripts Originais (.sh)

- **Sintaxe**: Convertida de bash para PowerShell
- **Comandos**: `az` permanece o mesmo, mas com sintaxe PowerShell
- **Variáveis**: Usam `$env:` para variáveis de ambiente
- **Paths**: Usam barras invertidas (`\`) para Windows
- **Compressão**: Usa `Compress-Archive` em vez de `zip`

## Suporte

Para problemas específicos, verifique os logs de saída dos comandos Azure CLI nos scripts.