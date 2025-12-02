const mongoose = require('mongoose');
const GlobalConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed, default: '' },
  updatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('GlobalConfig', GlobalConfigSchema);
