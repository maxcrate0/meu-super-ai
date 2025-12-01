const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  personal_api_key: { type: String, default: '' },
  displayName: { type: String, default: '' },
  bio: { type: String, default: '' },
  theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
  usage: { requests: { type: Number, default: 0 } },
  adminMessage: {
    content: { type: String, default: '' },
    sentAt: { type: Date },
    read: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);