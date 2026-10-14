require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./../config/db.js');
const { initRealtime } = require('./realtime/io');
const { purgeExpiredAccounts } = require('./utils/accountDeletion');
const { expireStaleSos } = require('./controllers/sosController');
const { checkMailLogin } = require('./utils/mailer');

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
const SHUTDOWN_GRACE_MS = 10 * 1000;

// The timed jobs below run in every copy of the server. With more than one
// copy, set RUN_JOBS=false on all but one (HANDOFF §19). On by default.
const RUN_JOBS = process.env.RUN_JOBS !== 'false';

// A promise nobody caught: log it instead of losing it silently.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

connectDB().then(() => {
  // One HTTP server for both the REST API and the live socket (friends'
  // messages, SOS alerts, who's online) — see realtime/io.js.
  const server = http.createServer(app);
  // A request may take at most 60 s (a slow phone uploading a sign video
  // fits easily). Idle keep-alive connections are kept 65 s — longer than
  // the usual 60 s of a proxy in front, so the proxy always closes first
  // and never reuses a connection we just closed — and the headers timeout
  // must be longer still.
  server.requestTimeout = 60 * 1000;
  server.keepAliveTimeout = 65 * 1000;
  server.headersTimeout = 66 * 1000;
  const io = initRealtime(server, app.locals.allowedOrigins);

  server.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
  });

  // Is the email login (for sign-up and reset codes) working right now?
  void checkMailLogin();

  const timers = [];
  if (RUN_JOBS) {
    // Erases accounts whose 15-day deletion grace period has run out (and
    // sign-ups never verified within a week) — once at startup, then
    // hourly. login/restore also check the date themselves, so a server
    // that was asleep never lets an overdue account back in.
    void purgeExpiredAccounts();
    timers.push(setInterval(() => void purgeExpiredAccounts(), PURGE_INTERVAL_MS));

    // Ends SOS alerts nobody marked safe within 24 hours (15 minutes for a
    // test), so friends stop seeing them as active.
    void expireStaleSos();
    timers.push(setInterval(() => void expireStaleSos(), SOS_EXPIRY_INTERVAL_MS));
  } else {
    console.log('Timed jobs are off here (RUN_JOBS=false).');
  }

  // Stopping (Ctrl+C, or a host restarting the server): finish what's in
  // flight, then close the database. Phones simply reconnect to the next
  // copy. Forced after 10 s, so a stuck request can't keep it alive.
  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal}: shutting down…`);
    setTimeout(() => {
      console.error('Shutdown took too long; forcing exit.');
      process.exit(1);
    }, SHUTDOWN_GRACE_MS).unref();
    for (const timer of timers) clearInterval(timer);
    // Closes every live socket, then the HTTP server (no new requests).
    io.close(async () => {
      await connectDB.disconnectDB().catch(() => {});
      process.exit(0);
    });
    server.closeIdleConnections();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
});
