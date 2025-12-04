const express = require('express');
const PageContent = require('../../models/PageContent');

const router = express.Router();

const DEFAULTS = {
  homepage: {
    page: 'homepage',
    sections: [
      {
        id: 'hero',
        type: 'hero',
        title: 'jgspAI',
        subtitle: 'Plataforma de chat com múltiplos modelos de IA.',
        order: 0,
        visible: true,
      },
      {
        id: 'features',
        type: 'feature',
        title: 'Principais recursos',
        subtitle: 'Modelos gratuitos, painel admin simples e suporte a GPT4Free.',
        order: 1,
        visible: true,
      },
    ],
  },
  docs: {
    page: 'docs',
    sections: [
      {
        id: 'getting-started',
        type: 'text',
        title: 'Introdução',
        content: 'Use /register e /login para autenticar e comece a conversar em /chat.',
        order: 0,
        visible: true,
      },
    ],
  },
};

router.get('/content/:page', async (req, res) => {
  const page = req.params.page;
  try {
    const stored = await PageContent.findOne({ page }).lean();
    if (stored) return res.json(stored);
    const fallback = DEFAULTS[page] || { page, sections: [] };
    res.json(fallback);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao carregar conteúdo', details: err.message });
  }
});

module.exports = router;
