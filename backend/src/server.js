require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./../config/db.js');
const { initRealtime } = require('./realtime/io');
const { purgeExpiredAccounts } = require('./utils/accountDeletion');
const { expireStaleSos } = require('./controllers/sosController');

const PORT = process.env.PORT;

// Admin sessions are signed with their own secret so a mobile-app token can
// never pass as an admin session. Refuse to start without one (or with one
// that's just a copy of JWT_SECRET) rather than fail on the first admin
// login.
if (!process.env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET === process.env.JWT_SECRET) {
  console.error('ADMIN_JWT_SECRET must be set in backend/.env and must differ from JWT_SECRET');
  process.exit(1);
}

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const SOS_EXPIRY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

connectDB().then(() => {
  // One HTTP server for both the REST API and the live socket (friends'
  // messages, SOS alerts, who's online) — see realtime/io.js.
  const server = http.createServer(app);
  initRealtime(server, app.locals.allowedOrigins);

  server.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
  });

  // Erases accounts whose 15-day deletion grace period has run out (and
  // sign-ups never verified within a week) — once at startup, then hourly. login/restore also check the date themselves,
  // so a server that was asleep never lets an overdue account back in.
  void purgeExpiredAccounts();
  setInterval(() => void purgeExpiredAccounts(), PURGE_INTERVAL_MS);

  // Ends SOS alerts nobody marked safe within 24 hours (15 minutes for a
  // test), so friends stop seeing them as active.
  void expireStaleSos();
  setInterval(() => void expireStaleSos(), SOS_EXPIRY_INTERVAL_MS);
});
