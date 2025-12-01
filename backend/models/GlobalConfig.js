const mongoose = require('mongoose');
const GlobalConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: '' }
});
module.exports = mongoose.model('GlobalConfig', GlobalConfigSchema);
