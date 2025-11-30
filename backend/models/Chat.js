const mongoose = require('mongoose');
const ChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'Novo Chat' },
  model: { type: String, default: 'google/gemini-2.0-flash-exp:free' },
  userSystemPrompt: { type: String, default: '' },
  messages: [{ 
    role: { type: String }, 
    content: { type: String }, 
    tool_call_id: { type: String },
    timestamp: { type: Date, default: Date.now } 
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Chat', ChatSchema);
