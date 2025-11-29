const mongoose = require('mongoose');
                                const ChatSchema = new mongoose.Schema({
                                  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                                    title: { type: String, default: 'Novo Chat' },
                                      messages: [{ role: { type: String }, content: { type: String }, timestamp: { type: Date, default: Date.now } }]
                                      }); module.exports = mongoose.model('Chat', ChatSchema);