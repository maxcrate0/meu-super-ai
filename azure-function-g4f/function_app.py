import azure.functions as func
import logging
import json
import os
from datetime import datetime
from pymongo import MongoClient

app = func.FunctionApp()

def get_g4f_models():
    """Lista todos os modelos e provedores disponíveis no g4f"""
    try:
        from g4f import models, Provider
        from g4f.models import ModelUtils
        
        model_list = []
        
        # Lista todos os modelos disponíveis
        for model_name in dir(models):
            if model_name.startswith('_'):
                continue
            model = getattr(models, model_name, None)
            if model and hasattr(model, 'name'):
                # Tenta pegar provedores do modelo
                providers = []
                if hasattr(model, 'best_provider'):
                    bp = model.best_provider
                    if hasattr(bp, '__name__'):
                        providers.append(bp.__name__)
                    elif hasattr(bp, 'providers'):
                        providers = [p.__name__ for p in bp.providers if hasattr(p, '__name__')]
                
                model_list.append({
                    'id': model.name if hasattr(model, 'name') else model_name,
                    'name': model_name.replace('_', ' ').title(),
                    'providers': providers,
                    'provider': 'g4f'
                })
        
        # Remove duplicatas
        seen = set()
        unique_models = []
        for m in model_list:
            if m['id'] not in seen:
                seen.add(m['id'])
                unique_models.append(m)
        
        return unique_models
    except Exception as e:
        logging.error(f"Erro ao listar modelos g4f: {e}")
        return []

def get_g4f_providers():
    """Lista todos os provedores disponíveis no g4f"""
    try:
        from g4f.Provider import __all__ as all_providers
        from g4f import Provider
        
        provider_list = []
        for provider_name in all_providers:
            try:
                provider = getattr(Provider, provider_name, None)
                if provider:
                    working = getattr(provider, 'working', True)
                    supports_stream = getattr(provider, 'supports_stream', False)
                    supports_gpt4 = getattr(provider, 'supports_gpt_4', False)
                    supports_gpt35 = getattr(provider, 'supports_gpt_35_turbo', True)
                    
                    # Pega modelos suportados
                    supported_models = []
                    if hasattr(provider, 'models'):
                        supported_models = list(provider.models) if provider.models else []
                    
                    provider_list.append({
                        'name': provider_name,
                        'working': working,
                        'supports_stream': supports_stream,
                        'supports_gpt4': supports_gpt4,
                        'supports_gpt35': supports_gpt35,
                        'models': supported_models[:10]  # Limita a 10 modelos
                    })
            except Exception as e:
                logging.warning(f"Erro ao processar provider {provider_name}: {e}")
                continue
        
        # Filtra apenas provedores funcionando
        working_providers = [p for p in provider_list if p['working']]
        return working_providers
    except Exception as e:
        logging.error(f"Erro ao listar provedores g4f: {e}")
        return []

def save_to_mongodb(models, providers):
    """Salva os modelos e provedores no MongoDB"""
    mongo_uri = os.environ.get('MONGODB_URI')
    if not mongo_uri:
        logging.error("MONGODB_URI não configurado")
        return False
    
    try:
        client = MongoClient(mongo_uri)
        db = client.get_default_database()
        
        # Salva na coleção g4f_cache
        collection = db['g4f_cache']
        
        # Atualiza ou insere o documento
        collection.update_one(
            {'_id': 'g4f_data'},
            {
                '$set': {
                    'models': models,
                    'providers': providers,
                    'updated_at': datetime.utcnow(),
                    'model_count': len(models),
                    'provider_count': len(providers)
                }
            },
            upsert=True
        )
        
        logging.info(f"Salvos {len(models)} modelos e {len(providers)} provedores no MongoDB")
        client.close()
        return True
    except Exception as e:
        logging.error(f"Erro ao salvar no MongoDB: {e}")
        return False

# Timer trigger - roda todos os dias às 3:00 AM UTC
@app.timer_trigger(schedule="0 0 3 * * *", arg_name="timer", run_on_startup=False)
def update_g4f_models(timer: func.TimerRequest) -> None:
    logging.info('Iniciando atualização dos modelos g4f...')
    
    if timer.past_due:
        logging.info('Timer está atrasado!')
    
    # Lista modelos e provedores
    models = get_g4f_models()
    providers = get_g4f_providers()
    
    logging.info(f"Encontrados {len(models)} modelos e {len(providers)} provedores")
    
    # Salva no MongoDB
    success = save_to_mongodb(models, providers)
    
    if success:
        logging.info('Atualização concluída com sucesso!')
    else:
        logging.error('Falha na atualização')

# HTTP trigger para forçar atualização manual (admin)
@app.route(route="update-g4f", auth_level=func.AuthLevel.FUNCTION)
def manual_update(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Atualização manual solicitada')
    
    models = get_g4f_models()
    providers = get_g4f_providers()
    
    success = save_to_mongodb(models, providers)
    
    if success:
        return func.HttpResponse(
            json.dumps({
                'success': True,
                'models': len(models),
                'providers': len(providers)
            }),
            mimetype="application/json"
        )
    else:
        return func.HttpResponse(
            json.dumps({'success': False, 'error': 'Failed to save to MongoDB'}),
            status_code=500,
            mimetype="application/json"
        )

# HTTP trigger para listar modelos (público)
@app.route(route="g4f-models", auth_level=func.AuthLevel.ANONYMOUS)
def get_models(req: func.HttpRequest) -> func.HttpResponse:
    mongo_uri = os.environ.get('MONGODB_URI')
    if not mongo_uri:
        return func.HttpResponse(
            json.dumps({'error': 'Database not configured'}),
            status_code=500,
            mimetype="application/json"
        )
    
    try:
        client = MongoClient(mongo_uri)
        db = client.get_default_database()
        data = db['g4f_cache'].find_one({'_id': 'g4f_data'})
        client.close()
        
        if data:
            return func.HttpResponse(
                json.dumps({
                    'models': data.get('models', []),
                    'providers': data.get('providers', []),
                    'updated_at': data.get('updated_at', '').isoformat() if data.get('updated_at') else None
                }, default=str),
                mimetype="application/json"
            )
        else:
            return func.HttpResponse(
                json.dumps({'models': [], 'providers': [], 'message': 'No data yet'}),
                mimetype="application/json"
            )
    except Exception as e:
        return func.HttpResponse(
            json.dumps({'error': str(e)}),
            status_code=500,
            mimetype="application/json"
        )
