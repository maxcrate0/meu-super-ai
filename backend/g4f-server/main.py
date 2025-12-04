#!/usr/bin/env python3
"""
GPT4Free API Server - Servidor FastAPI que expõe o g4f para consumo via HTTP
Este servidor pode rodar localmente ou em um container Docker
"""

import os
import json
import asyncio
import time
import logging
from typing import Optional, List, Dict, AsyncGenerator
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import g4f
from g4f.client import AsyncClient
from g4f.models import ModelUtils
from g4f.Provider import __providers__

app = FastAPI(
    title="GPT4Free API Server",
    description="API que expõe todos os providers do gpt4free",
    version="1.0.0"
)

# CORS - permite qualquer origem
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cliente assíncrono do g4f
client = AsyncClient()
logger = logging.getLogger("g4f-server")

MODELS_CACHE_TTL = int(os.environ.get("MODELS_CACHE_TTL", "300"))

# ============ CACHE DE MODELOS ============
# Cache para evitar iterar sobre providers a cada requisição
models_cache = {
    "data": None,
    "timestamp": 0
}

def _cached_models():
    if models_cache["data"] is None:
        return None
    if time.time() - models_cache["timestamp"] > MODELS_CACHE_TTL:
        return None
    return models_cache["data"]


def _set_cache(payload):
    models_cache["data"] = payload
    models_cache["timestamp"] = time.time()


def _find_provider_by_name(name: Optional[str]):
    if not name:
        return None
    for provider in __providers__:
        try:
            if provider.__name__.lower() == name.lower():
                return provider
        except Exception:
            continue
    return None


def _normalize_model_and_provider(model: Optional[str]):
    if not model or model == "auto":
        return None, None

    if isinstance(model, str) and model.startswith("g4f:"):
        model = model[4:]
        if not model or model == "auto":
            return None, None

    if isinstance(model, str) and ":" in model:
        prov, mdl = model.split(":", 1)
        return _find_provider_by_name(prov), mdl

    return None, model


def _public_providers():
    for provider in __providers__:
        try:
            if provider.working and not getattr(provider, "needs_auth", False):
                yield provider
        except Exception:
            continue


def _provider_models(provider):
    if hasattr(provider, "models") and provider.models:
        if isinstance(provider.models, list):
            return [str(m) for m in provider.models if m]
        if isinstance(provider.models, dict):
            return list(provider.models.keys())
    return []

# ============ MODELOS PYDANTIC ============

class Message(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str = "auto"
    messages: List[Message]
    stream: bool = False
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    provider: Optional[str] = None
    web_search: bool = False

class ImageGenerationRequest(BaseModel):
    prompt: str
    model: Optional[str] = "flux"
    size: Optional[str] = "1024x1024"
    provider: Optional[str] = None

# ============ ENDPOINTS ============

@app.get("/")
async def root():
    """Health check e informações do servidor"""
    return {
        "status": "online",
        "name": "GPT4Free API Server",
        "version": "1.0.0",
        "g4f_version": getattr(g4f, '__version__', 'unknown'),
        "endpoints": {
            "chat": "/v1/chat/completions",
            "models": "/v1/models",
            "providers": "/v1/providers",
            "images": "/v1/images/generations"
        }
    }

@app.get("/v1/models")
async def list_models():
    """Lista todos os modelos disponíveis de todos os providers funcionais e gratuitos"""
    try:
        cached = _cached_models()
        if cached:
            return cached

        seen_models: Dict[str, Dict[str, object]] = {}

        for provider in _public_providers():
            provider_name = provider.__name__
            for model in _provider_models(provider):
                try:
                    if ModelUtils.get_model(model) is None:
                        continue
                except Exception:
                    continue

                entry = seen_models.setdefault(model, {
                    "id": model,
                    "object": "model",
                    "type": "chat",
                    "owned_by": "g4f",
                    "providers": []
                })
                if provider_name not in entry["providers"]:
                    entry["providers"].append(provider_name)

        model_list = sorted(seen_models.values(), key=lambda x: x["id"].lower())
        result = {"data": model_list, "object": "list", "total": len(model_list)}
        _set_cache(result)
        return result
    except Exception as e:
        logger.exception("Failed to list models")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/models/all")
async def list_all_models_with_providers():
    """Lista TODOS os modelos organizados por provider"""
    try:
        providers_with_models = []
        all_unique_models = set()

        for provider in _public_providers():
            provider_models = _provider_models(provider)
            if not provider_models:
                continue

            for mdl in provider_models:
                all_unique_models.add(mdl)

            providers_with_models.append({
                "provider": provider.__name__,
                "models": sorted(provider_models),
                "count": len(provider_models),
                "url": getattr(provider, "url", None)
            })

        providers_with_models.sort(key=lambda x: -x["count"])
        return {
            "data": providers_with_models,
            "total_providers": len(providers_with_models),
            "total_unique_models": len(all_unique_models),
            "object": "list"
        }
    except Exception as e:
        logger.exception("Failed to list providers with models")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/providers")
async def list_providers():
    """Lista todos os providers disponíveis"""
    try:
        providers_list = []

        for provider in _public_providers():
            providers_list.append({
                "id": provider.__name__,
                "working": provider.working,
                "needs_auth": getattr(provider, "needs_auth", False),
                "supports_stream": getattr(provider, "supports_stream", True),
                "url": getattr(provider, "url", None),
                "models": _provider_models(provider)
            })

        return {"data": providers_list, "object": "list"}
    except Exception as e:
        logger.exception("Failed to list providers")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    """Endpoint de chat completions compatível com OpenAI"""
    try:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        
        # Configura provider se especificado (request.provider) ou definido no próprio model (prov:model)
        provider = _find_provider_by_name(request.provider)

        prov_from_model, normalized_model = _normalize_model_and_provider(request.model)
        if prov_from_model and not provider:
            provider = prov_from_model

        model_to_use = None if (not normalized_model or normalized_model == "auto") else normalized_model

        if model_to_use and ModelUtils.get_model(model_to_use) is None:
            logger.warning("Modelo '%s' não encontrado, usando auto", model_to_use)
            model_to_use = None

        if model_to_use is None and provider is None:
            for candidate in _public_providers():
                if getattr(candidate, "url", None):
                    provider = candidate
                    logger.info("[G4F] Usando provider fallback: %s", candidate.__name__)
                    break

        logger.info("[G4F] Usando model=%s, provider=%s", model_to_use, provider.__name__ if provider else None)
        if request.stream:
            return StreamingResponse(
                stream_chat_response(
                    model=model_to_use,
                    messages=messages,
                    provider=provider,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                    web_search=request.web_search
                ),
                media_type="text/event-stream"
            )
        else:
            # Resposta não-streaming - usa AsyncClient corretamente
            # Baseado no exemplo oficial: etc/examples/text_completions_demo_async.py
            response = await client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                provider=provider,
                web_search=request.web_search
            )
            
            # Extrai conteúdo da resposta
            content = ""
            if hasattr(response, 'choices') and response.choices:
                if hasattr(response.choices[0], 'message'):
                    content = response.choices[0].message.content or ""
            
            # Obtém provider usado
            used_provider = "g4f"
            if hasattr(response, 'provider'):
                used_provider = str(response.provider)
            
            return {
                "id": f"chatcmpl-{id(response)}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": request.model,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": content
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": sum(len(m.content.split()) for m in request.messages),
                    "completion_tokens": len(content.split()) if content else 0,
                    "total_tokens": 0
                },
                "provider": used_provider
            }
            
    except Exception as e:
            logger.exception("Chat completion failed")
        raise HTTPException(status_code=500, detail=str(e))

async def stream_chat_response(
    model: Optional[str],
    messages: List[Dict],
    provider: Optional[object] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    web_search: bool = False
) -> AsyncGenerator[str, None]:
    """Gera resposta em streaming - baseado no exemplo oficial messages_stream.py"""
    try:
        # Cria o stream - se `model` for None deixa como None (auto), caso contrário usa o valor já normalizado
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            provider=provider,
            stream=True,
            web_search=web_search
        )

        # Itera sobre os chunks do stream
        async for chunk in stream:
            try:
                # Tenta extrair conteúdo do delta (forma comum em streams)
                content = None
                if getattr(chunk, 'choices', None):
                    choice = chunk.choices[0]
                    # delta.content costuma ser usado em streams incrementais
                    delta = getattr(choice, 'delta', None)
                    if delta and getattr(delta, 'content', None):
                        content = delta.content
                    # alguns providers retornam message.content diretamente
                    if not content and getattr(choice, 'message', None):
                        content = getattr(choice.message, 'content', None)

                if content:
                    data = {
                        "id": f"chatcmpl-{id(chunk)}",
                        "object": "chat.completion.chunk",
                        "model": model or "auto",
                        "choices": [{
                            "index": 0,
                            "delta": {"content": content},
                            "finish_reason": None
                        }]
                    }
                    yield f"data: {json.dumps(data)}\n\n"
            except (AttributeError, IndexError):
                # Chunk sem conteúdo, ignora
                continue

        # Envia chunk final com finish_reason
        final_data = {
            "id": f"chatcmpl-final",
            "object": "chat.completion.chunk",
            "model": model or "auto",
            "choices": [{
                "index": 0,
                "delta": {},
                "finish_reason": "stop"
            }]
        }
        yield f"data: {json.dumps(final_data)}\n\n"

        # Envia [DONE] para sinalizar fim do stream
        yield "data: [DONE]\n\n"

    except Exception as e:
        error_data = {"error": {"message": str(e), "type": "server_error"}}
        yield f"data: {json.dumps(error_data)}\n\n"
        yield "data: [DONE]\n\n"

@app.post("/v1/images/generations")
async def image_generations(request: ImageGenerationRequest):
    """Endpoint de geração de imagens"""
    try:
        response = await client.images.generate(
            prompt=request.prompt,
            model=request.model or "flux",
        )
        
        return {
            "created": int(asyncio.get_event_loop().time()),
            "data": [
                {"url": img.url if hasattr(img, 'url') else img.get('url', '')}
                for img in (response.data if hasattr(response, 'data') else [response])
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/providers/{provider_name}")
async def get_provider_info(provider_name: str):
    """Retorna informações detalhadas de um provider específico"""
    try:
        for provider in __providers__:
            if provider.__name__.lower() == provider_name.lower():
                return {
                    "id": provider.__name__,
                    "working": provider.working,
                    "needs_auth": getattr(provider, 'needs_auth', False),
                    "supports_stream": getattr(provider, 'supports_stream', True),
                    "supports_message_history": getattr(provider, 'supports_message_history', True),
                    "url": getattr(provider, 'url', None),
                    "models": getattr(provider, 'models', []) if hasattr(provider, 'models') else []
                }
        
        raise HTTPException(status_code=404, detail=f"Provider '{provider_name}' not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ PROVIDERS ESPECÍFICOS ============

@app.post("/v1/providers/{provider_name}/chat/completions")
async def provider_chat_completions(provider_name: str, request: ChatCompletionRequest):
    """Chat completions usando um provider específico"""
    request.provider = provider_name
    return await chat_completions(request)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
