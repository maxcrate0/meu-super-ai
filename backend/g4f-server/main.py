#!/usr/bin/env python3
"""
GPT4Free API Server - Servidor FastAPI que expõe o g4f para consumo via HTTP
Este servidor pode rodar localmente ou em um container Docker
"""

import os
import json
import asyncio
from typing import Optional, List, Dict, Any, AsyncGenerator
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
import g4f
from g4f.client import AsyncClient
from g4f.Provider import __providers__
from g4f import models

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
    """Lista todos os modelos disponíveis"""
    try:
        model_list = []
        
        # Modelos de chat
        chat_models = [
            "gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-4-turbo",
            "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet", "claude-3-haiku",
            "claude-3.5-sonnet", "gemini-pro", "gemini-1.5-pro", "gemini-2.0-flash",
            "llama-3.1-70b", "llama-3.1-8b", "llama-3.2-90b", "llama-3.3-70b",
            "mixtral-8x7b", "mistral-7b", "mistral-large",
            "deepseek-v3", "deepseek-r1", "deepseek-chat",
            "qwen-2.5-72b", "qwen-2.5-coder-32b", "qwq-32b",
            "phi-4", "phi-3.5", "codestral", "command-r-plus",
        ]
        
        for model in chat_models:
            model_list.append({
                "id": model,
                "object": "model",
                "type": "chat",
                "owned_by": "g4f"
            })
        
        # Modelos de imagem
        image_models = [
            "flux", "flux-pro", "flux-dev", "flux-schnell",
            "stable-diffusion-3", "stable-diffusion-xl", "sdxl-turbo",
            "dall-e-3", "midjourney"
        ]
        
        for model in image_models:
            model_list.append({
                "id": model,
                "object": "model", 
                "type": "image",
                "owned_by": "g4f"
            })
        
        return {"data": model_list, "object": "list"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/providers")
async def list_providers():
    """Lista todos os providers disponíveis"""
    try:
        providers_list = []
        
        for provider in __providers__:
            if not provider.working:
                continue
                
            provider_info = {
                "id": provider.__name__,
                "working": provider.working,
                "needs_auth": getattr(provider, 'needs_auth', False),
                "supports_stream": getattr(provider, 'supports_stream', True),
                "url": getattr(provider, 'url', None),
            }
            
            # Tenta obter modelos suportados
            if hasattr(provider, 'models'):
                provider_info["models"] = provider.models if isinstance(provider.models, list) else []
            elif hasattr(provider, 'get_models'):
                try:
                    provider_info["models"] = provider.get_models()
                except:
                    provider_info["models"] = []
            else:
                provider_info["models"] = []
            
            providers_list.append(provider_info)
        
        return {"data": providers_list, "object": "list"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    """Endpoint de chat completions compatível com OpenAI"""
    try:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        
        # Configura provider se especificado
        provider = None
        if request.provider:
            provider_name = request.provider
            for p in __providers__:
                if p.__name__.lower() == provider_name.lower():
                    provider = p
                    break
        
        if request.stream:
            return StreamingResponse(
                stream_chat_response(
                    model=request.model,
                    messages=messages,
                    provider=provider,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                    web_search=request.web_search
                ),
                media_type="text/event-stream"
            )
        else:
            # Resposta não-streaming
            response = await client.chat.completions.create(
                model=request.model if request.model != "auto" else None,
                messages=messages,
                provider=provider,
                web_search=request.web_search
            )
            
            return {
                "id": f"chatcmpl-{id(response)}",
                "object": "chat.completion",
                "created": int(asyncio.get_event_loop().time()),
                "model": request.model,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": response.choices[0].message.content
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": sum(len(m.content.split()) for m in request.messages),
                    "completion_tokens": len(response.choices[0].message.content.split()),
                    "total_tokens": 0
                },
                "provider": getattr(response, 'provider', 'g4f')
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def stream_chat_response(
    model: str,
    messages: List[Dict],
    provider = None,
    temperature: float = None,
    max_tokens: int = None,
    web_search: bool = False
) -> AsyncGenerator[str, None]:
    """Gera resposta em streaming"""
    try:
        response = await client.chat.completions.create(
            model=model if model != "auto" else None,
            messages=messages,
            provider=provider,
            stream=True,
            web_search=web_search
        )
        
        async for chunk in response:
            if hasattr(chunk, 'choices') and chunk.choices:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    data = {
                        "id": f"chatcmpl-{id(chunk)}",
                        "object": "chat.completion.chunk",
                        "model": model,
                        "choices": [{
                            "index": 0,
                            "delta": {"content": delta.content},
                            "finish_reason": None
                        }]
                    }
                    yield f"data: {json.dumps(data)}\n\n"
        
        # Envia [DONE]
        yield "data: [DONE]\n\n"
        
    except Exception as e:
        error_data = {"error": {"message": str(e), "type": "server_error"}}
        yield f"data: {json.dumps(error_data)}\n\n"

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
