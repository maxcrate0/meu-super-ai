require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { connectDB } = require('./src/config/db');
const { authRequired, adminOnly } = require('./src/middleware/auth');

const authRoutes = require('./src/routes/auth');
const modelRoutes = require('./src/routes/models');
const chatRoutes = require('./src/routes/chats');
const adminRoutes = require('./src/routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;
const API_PREFIX = process.env.API_PREFIX || '/api';

// Middlewares básicos
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Healthcheck
app.get(['/health', `${API_PREFIX}/health`], (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Router agrupado para permitir prefixo /api
const api = express.Router();

// Rotas públicas
api.use(authRoutes);
api.use(modelRoutes);

// Rotas autenticadas
api.use(authRequired, chatRoutes);
api.use(authRequired, adminOnly, adminRoutes);

app.use(API_PREFIX, api);

// Tratamento de rota não encontrada
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Tratamento de erros
app.use((err, _req, res, _next) => {
  console.error('Erro inesperado', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`API ouvindo em http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Falha ao iniciar servidor', err);
  process.exit(1);
});
