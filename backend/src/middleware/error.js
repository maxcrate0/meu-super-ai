function notFound(_req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

function errorHandler(err, _req, res, _next) {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Erro interno do servidor' });
}

module.exports = { notFound, errorHandler };
