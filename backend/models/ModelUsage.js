const mongoose = require('mongoose');

const ModelUsageSchema = new mongoose.Schema({
  modelId: { type: String, required: true, index: true },
  provider: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
  tokens: { type: Number, default: 0 },
  success: { type: Boolean, default: true }
});

// Índices compostos para queries eficientes
ModelUsageSchema.index({ modelId: 1, timestamp: -1 });
ModelUsageSchema.index({ userId: 1, timestamp: -1 });
ModelUsageSchema.index({ provider: 1, timestamp: -1 });

module.exports = mongoose.model('ModelUsage', ModelUsageSchema);
