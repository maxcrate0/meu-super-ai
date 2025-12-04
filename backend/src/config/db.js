const mongoose = require('mongoose');
const config = require('./env');

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    autoIndex: true,
  });
  return mongoose.connection;
}

module.exports = { connectDB };
