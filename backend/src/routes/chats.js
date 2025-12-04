const express = require('express');
const Chat = require('../../models/Chat');
const ModelUsage = require('../../models/ModelUsage');
const { generateChat } = require('../services/llm');

const router = express.Router();

router.get('/chats', async (req, res) => {
  const chats = await Chat.find({ userId: req.user._id })
    .sort({ updatedAt: -1 })
    .select('_id title model createdAt updatedAt messages')
    .lean();
  res.json(chats);
});

router.get('/chats/:id', async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!chat) return res.status(404).json({ error: 'Chat não encontrado' });
  res.json(chat);
});

router.patch('/chats/:id', async (req, res) => {
  const { title } = req.body;
  const chat = await Chat.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { title: title || 'Sem título', updatedAt: new Date() },
    { new: true }
  ).lean();
  if (!chat) return res.status(404).json({ error: 'Chat não encontrado' });
  res.json(chat);
});

router.delete('/chats/:id', async (req, res) => {
  await Chat.deleteOne({ _id: req.params.id, userId: req.user._id });
  res.json({ deleted: true });
});

router.post('/chat', async (req, res) => {
  const { chatId, messages = [], model } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Mensagens inválidas' });
  }

  try {
    const { content, provider, usage } = await generateChat({ model, messages });

    let chat = null;
    if (chatId) {
      chat = await Chat.findOneAndUpdate(
        { _id: chatId, userId: req.user._id },
        {
          $set: { model: model || undefined, updatedAt: new Date() },
          $push: {
            messages: {
              $each: [messages[messages.length - 1], { role: 'assistant', content }],
            },
          },
        },
        { new: true }
      );
    }

    if (!chat) {
      chat = await Chat.create({
        userId: req.user._id,
        model: model || undefined,
        title: messages[0]?.content?.slice(0, 40) || 'Nova conversa',
        messages: [...messages, { role: 'assistant', content }],
      });
    }

    await ModelUsage.create({
      modelId: model || undefined,
      provider,
      userId: req.user._id,
      username: req.user.username,
      success: true,
      tokens: usage?.total_tokens || 0,
    });

    res.json({ content, chatId: chat._id });
  } catch (err) {
    console.error('Erro chat', err.message);
    await ModelUsage.create({
      modelId: model || undefined,
      provider: 'unknown',
      userId: req.user._id,
      username: req.user.username,
      success: false,
      error: err.message,
      errorType: 'other',
    });
    res.status(500).json({ error: 'Falha ao gerar resposta', details: err.message });
  }
});

module.exports = router;
