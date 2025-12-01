const mongoose = require('mongoose');
const CustomToolSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  code: { type: String, required: true },
  parameters: { type: mongoose.Schema.Types.Mixed, default: {} }, // Parâmetros da ferramenta
  isActive: { type: Boolean, default: true },
  executionCount: { type: Number, default: 0 },
  lastExecuted: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
CustomToolSchema.index({ userId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('CustomTool', CustomToolSchema);
