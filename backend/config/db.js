const mongoose = require('mongoose');

// Said once per change, so a dropped Atlas connection shows in the log
// (the driver reconnects by itself). Not when we close it on purpose.
let closing = false;
mongoose.connection.on('disconnected', () => {
  if (!closing) console.warn('MongoDB disconnected — reconnecting…');
});
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Up to 20 queries at once from this server (the friend list now asks
      // for every friend in parallel). The driver's default is 100 per
      // database node; 20 is plenty for one copy and keeps several copies
      // well under the free Atlas tier's 500-connection limit.
      maxPoolSize: 20,
      // With no reachable database, fail a query after 5 s instead of 30 s,
      // so the app hears "try again" quickly.
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1); // no point running an API that can't reach its database
  }
};

// For a clean shutdown (server.js).
const disconnectDB = async () => {
  closing = true;
  await mongoose.disconnect();
};

module.exports = connectDB;
module.exports.disconnectDB = disconnectDB;