const mongoose = require('mongoose');

const DEFAULT_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meu-super-ai';

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  mongoose.set('strictQuery', true);
  await mongoose.connect(DEFAULT_URI, {
    autoIndex: true,
  });
  return mongoose.connection;
}

module.exports = { connectDB };
