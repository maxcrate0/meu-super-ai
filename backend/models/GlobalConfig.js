const mongoose = require('mongoose');
const GlobalConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});
module.exports = mongoose.model('GlobalConfig', GlobalConfigSchema);
