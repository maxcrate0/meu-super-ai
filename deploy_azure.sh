#!/bin/bash
GRP="GeminiAI"
PLAN="PlanoGratis"
APP="gemini-api-$RANDOM" # Nome unico

# Substitua abaixo pela SUA string do passo anterior!
MONGO="mongodb://gemini-db-joaogabriel:NyNtMXO1aBSj4zuI2nr4z6secgeVkxet8Pq6LoDeBFrVqEgzMHYcsJMmicE1GVyUhsuATxRqlR6aACDbIYWRmQ==@gemini-db-joaogabriel.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@gemini-db-joaogabriel@" 
KEY="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"

az group create --name $GRP --location mexicocentral

az appservice plan create --name $PLAN --resource-group $GRP --sku F1 --is-linux
az webapp create --resource-group $GRP --plan $PLAN --name $APP --runtime "NODE:20-lts"

az webapp config appsettings set --resource-group $GRP --name $APP --settings MONGODB_URI="$MONGO" GLOBAL_API_KEY="$KEY" JWT_SECRET="segredo123" SCM_DO_BUILD_DURING_DEPLOYMENT="true"

echo "Zipping..."
cd backend && zip -r ../backend.zip . && cd ..

echo "Deploying..."
az webapp deployment source config-zip --resource-group $GRP --name $APP --src backend.zip

echo "URL DO BACKEND: https://$APP.azurewebsites.net