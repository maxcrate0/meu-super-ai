require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { connectDB } = require('./src/config/db');
const config = require('./src/config/env');
const { authRequired, adminOnly } = require('./src/middleware/auth');
const { notFound, errorHandler } = require('./src/middleware/error');

const authRoutes = require('./src/routes/auth');
const modelRoutes = require('./src/routes/models');
const chatRoutes = require('./src/routes/chats');
const adminRoutes = require('./src/routes/admin');
const contentRoutes = require('./src/routes/content');

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get(['/health', `${config.apiPrefix}/health`], (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

const api = express.Router();

api.use(authRoutes);
api.use(modelRoutes);
api.use(contentRoutes);

api.use(authRequired, chatRoutes);
api.use(authRequired, adminOnly, adminRoutes);

app.use(config.apiPrefix, api);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`API ouvindo em http://0.0.0.0:${config.port}${config.apiPrefix}`);
  });
}

start().catch((err) => {
  console.error('Falha ao iniciar servidor', err);
  process.exit(1);
});
