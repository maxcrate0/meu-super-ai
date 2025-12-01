import { Client, PollinationsAI, DeepInfra, Puter, HuggingFace, Worker, Audio } from "./client.js";

const providers = {
    "default": {class: Client, baseUrl: "https://g4f.dev/api/auto", apiEndpoint: "https://g4f.dev/ai/{now}", tags: ""},
    "api-airforce": {class: Client, baseUrl: "https://api.airforce/v1", tags: "🎨 👓"},
    "anon-drop": {class: Client, baseUrl: "https://anondrop.net/v1", tags: ""},
    "audio": {class: Audio, baseUrl: "https://g4f.dev/api/audio", tags: "🎧"},
    "azure": {class: Client, baseUrl: "https://g4f.dev/api/azure", tags: "👓"},
    "custom": {class: Client, tags: ""},
    "deep-infra": {class: DeepInfra, tags: "🎨 👓"},
    "gemini": {class: Client, baseUrl: "https://g4f.dev/api/gemini", tags: "👓"},
    "gpt-oss-120b": {class: Client, baseUrl: "https://g4f.dev/api/gpt-oss-120b", tags: ""},
    "grok": {class: Client, baseUrl: "https://g4f.dev/api/grok", tags: ""},
    "hugging-face": {class: HuggingFace, tags: ""},
    "ollama": {class: Client, baseUrl: "https://g4f.dev/api/ollama", tags: ""},
    "openrouter": {class: Client, baseUrl: "https://g4f.dev/api/openrouter", tags: "👓"},
    "pollinations-ai": {class: PollinationsAI, baseUrl: "https://g4f.dev/api/pollinations.ai", tags: "🎨 👓"},
    "puter": {class: Puter, tags: "👓"},
    "stringable-inf": {class: Client, baseUrl: "https://stringableinf.com/api", apiEndpoint: "https://stringableinf.com/api/v1/chat/completions", tags: "", extraHeaders: {"HTTP-Referer": "https://g4f.dev/", "X-Title": "G4F Chat"}},
    "typegpt": {class: Client, baseUrl: "https://g4f.dev/api/typegpt", tags: ""},
    "together": {class: Client, tags: "👓"},
    "worker": {class: Worker, baseUrl: "https://g4f.dev/api/worker", tags: "🎨"}
};

// Factory function to create a client instance based on provider
function createClient(provider, options = {}) {
    const config = providers[provider];
    if (!config) {
        throw new Error(`Provider "${provider}" not found.`);
    }
    
    // Set baseUrl
    if (provider === "custom" && typeof localStorage !== "undefined" && localStorage.getItem("Custom-api_base")) {
        options.baseUrl = localStorage.getItem("Custom-api_base");
    } else if (config.baseUrl) {
        options.baseUrl = config.baseUrl;
    }
    
    // Set apiEndpoint if specified
    if (config.apiEndpoint) {
        options.apiEndpoint = config.apiEndpoint;
    }
    
    // Set extraHeaders if specified
    if (config.extraHeaders) {
        options.extraHeaders = { ...options.extraHeaders, ...config.extraHeaders };
    }
    
    // Instantiate the client
    const client = new config.class(options);
    return client;
}
export { createClient };
export default providers;