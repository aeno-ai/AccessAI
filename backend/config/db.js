const mongoose = require('mongoose');

// Said once per change, so a dropped Atlas connection shows in the log
// (the driver reconnects by itself). Not when we close it on purpose, and
// not for a failed first try (connectDB says those itself).
let closing = false;
let connectedOnce = false;
mongoose.connection.on('connected', () => { connectedOnce = true; });
mongoose.connection.on('disconnected', () => {
  if (!closing && connectedOnce) console.warn('MongoDB disconnected — reconnecting…');
});
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));

// Waits between tries when Atlas can't be reached at startup: 2 s, 4 s, 8 s,
// then every 15 s until it answers.
const RETRY_DELAYS_MS = [2000, 4000, 8000, 15000];

// Retrying can't fix these — a missing address or a wrong password.
const isConfigError = (error) =>
  !process.env.MONGO_URI || /bad auth|authentication failed/i.test(error.message);

const connectDB = async () => {
  for (let attempt = 1; ; attempt += 1) {
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
      console.log(attempt > 1 ? `MongoDB connected (try ${attempt})` : 'MongoDB connected');
      return;
    } catch (error) {
      if (isConfigError(error)) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1); // no point running an API that can't reach its database
      }
      // A bad network at startup (school Wi-Fi, a DNS hiccup) used to stop the
      // server for good — nodemon then waits for a file change. Keep trying.
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length) - 1];
      console.warn(`MongoDB not reachable (${error.message}) — trying again in ${delay / 1000} s…`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// For a clean shutdown (server.js).
const disconnectDB = async () => {
  closing = true;
  await mongoose.disconnect();
};

module.exports = connectDB;
module.exports.disconnectDB = disconnectDB;