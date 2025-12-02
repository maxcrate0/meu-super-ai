const mongoose = require('mongoose');
const ChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: 'Novo Chat' },
  model: { type: String, default: 'google/gemini-2.0-flash-exp:free' },
  userSystemPrompt: { type: String, default: '' },
  messages: [{ 
    role: { type: String }, 
    content: { type: String }, 
    tool_call_id: { type: String },
    attachments: [{
      type: { type: String }, // 'image', 'file', 'code'
      name: { type: String },
      url: { type: String },
      mimeType: { type: String },
      size: { type: Number },
      content: { type: String } // Para arquivos de texto/código
    }],
    timestamp: { type: Date, default: Date.now } 
  }],
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now, index: true }
});

// Índices compostos para queries frequentes
ChatSchema.index({ userId: 1, updatedAt: -1 });
ChatSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Chat', ChatSchema);
