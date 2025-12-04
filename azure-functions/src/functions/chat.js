const { app } = require('@azure/functions');
const {
    baseHeaders,
    DEFAULT_MODEL,
    verifyToken,
    getApiKey,
    getGlobalSystemPrompt,
    buildMessages,
    incrementUsage,
    getOpenAIClient,
    jsonResponse,
    callG4F,
} = require('./shared');

app.http('chat', {
    methods: ['GET', 'POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'chat',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return { status: 200, headers: baseHeaders, body: '' };
        if (request.method === 'GET') return jsonResponse(200, { ok: true, service: 'chat' });

        try {
            const user = await verifyToken(request.headers.get('authorization'));
            const body = await request.json();
            const { messages, model, userSystemPrompt, provider } = body || {};

            if (!Array.isArray(messages)) {
                return jsonResponse(400, { error: 'messages é obrigatório' });
            }

            const globalPrompt = await getGlobalSystemPrompt();
            const msgs = buildMessages(messages, globalPrompt, userSystemPrompt, user.bio);

            const messagePayload = provider === 'g4f'
                ? await callG4F(model, msgs)
                : await (async () => {
                    const apiKey = await getApiKey(user);
                    if (!apiKey) return null;
                    const openai = getOpenAIClient(apiKey);
                    const resp = await openai.chat.completions.create({
                        model: model || DEFAULT_MODEL,
                        messages: msgs
                    });
                    return resp.choices[0].message;
                })();

            if (!messagePayload) {
                return jsonResponse(400, { error: 'API Key não configurada' });
            }

            incrementUsage(user._id);
            return jsonResponse(200, messagePayload);
        } catch (e) {
            context.log('chat error:', e.message);
            const status = e.message.includes('Token') || e.message.includes('Usuário') ? 401 : 500;
            return jsonResponse(status, { error: e.message });
        }
    }
});
