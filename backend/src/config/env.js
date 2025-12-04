const config = {
  port: Number(process.env.PORT || 3001),
  apiPrefix: process.env.API_PREFIX || '/api',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meu-super-ai',
  defaultModel: process.env.DEFAULT_MODEL || 'google/gemini-2.0-flash-exp:free',
  openRouter: {
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    referer: process.env.OPENROUTER_REFERER || 'https://meu-super-ai.vercel.app',
  },
  g4f: {
    baseUrl: process.env.G4F_API_URL || '',
  },
};

module.exports = config;
