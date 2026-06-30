const mongoose = require('mongoose');

/**
 * Connect to MongoDB using mongoose.
 * Reads MONGODB_URI from process.env or falls back to a local default.
 * Returns a Promise that resolves when connected, rejects on error.
 */
function connect() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/insure_app';

  mongoose.set('strictQuery', false);

  return new Promise((resolve, reject) => {
    mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(() => {
        console.log(`MongoDB connected to ${uri}`);
        resolve(mongoose.connection);
      })
      .catch((err) => {
        console.error('MongoDB connection error:', err);
        reject(err);
      });
  });
}

module.exports = { connect, mongoose };
