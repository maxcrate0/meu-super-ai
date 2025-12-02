# GPT4Free API Server
# Imagem otimizada para rodar o servidor g4f

FROM python:3.11-slim

# Metadados
LABEL maintainer="Meu Super AI"
LABEL description="GPT4Free API Server"
LABEL version="1.0"

# Evita prompts interativos
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Instala dependências do sistema necessárias para curl_cffi e browser_cookie3
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libcurl4-openssl-dev \
    libssl-dev \
    libffi-dev \
    chromium \
    chromium-driver \
    && rm -rf /var/lib/apt/lists/*

# Define diretório de trabalho
WORKDIR /app

# Copia requirements primeiro para cache de camadas
COPY requirements.txt .

# Instala dependências Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copia código da aplicação
COPY . .

# Expõe a porta
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Comando para iniciar o servidor
CMD ["python", "main.py"]
