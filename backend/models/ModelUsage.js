const mongoose = require('mongoose');

const ModelUsageSchema = new mongoose.Schema({
  modelId: { type: String, required: true, index: true },
  provider: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
  tokens: { type: Number, default: 0 },
  success: { type: Boolean, default: true },
  error: { type: String, default: null }, // Mensagem de erro se houver
  errorType: { type: String, enum: ['rate_limit', 'model_error', 'network', 'auth', 'other', null], default: null }
});

// Índices compostos para queries eficientes
ModelUsageSchema.index({ modelId: 1, timestamp: -1 });
ModelUsageSchema.index({ userId: 1, timestamp: -1 });
ModelUsageSchema.index({ provider: 1, timestamp: -1 });
ModelUsageSchema.index({ modelId: 1, success: 1 }); // Para buscar erros por modelo

module.exports = mongoose.model('ModelUsage', ModelUsageSchema);
