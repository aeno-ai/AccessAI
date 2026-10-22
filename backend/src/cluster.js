// Several copies of the backend on one port (HANDOFF.md §52):
//
//   npm run start:cluster              (2 copies)
//   CLUSTER_WORKERS=4 npm run start:cluster
//
// Node's cluster module starts CLUSTER_WORKERS copies of server.js that share
// the same port; each new connection goes to one of them. Because a copy
// keeps nothing to itself that matters, any copy can answer any request:
//   - live chat/SOS connections are shared through MongoDB (SOCKET_ADAPTER=mongo),
//   - rate limits are counted in MongoDB (RATE_LIMIT_STORE=mongo),
//   - each timed job runs on one copy at a time (a lease, utils/jobLease.js),
//   - logins are signed tokens any copy can check.
// The app's live connection is WebSocket-only, so no "sticky sessions" are
// needed. A copy that crashes is started again. On a real server the same
// copies could run on several machines behind a load balancer instead.
//
// Plain `npm run dev` / `npm start` still runs ONE copy, exactly as before.
require('dotenv').config();
const cluster = require('node:cluster');

const WORKERS = Math.max(1, Number(process.env.CLUSTER_WORKERS) || 2);

if (cluster.isPrimary) {
  // The copies share everything through MongoDB (unless told otherwise).
  process.env.SOCKET_ADAPTER ??= 'mongo';
  process.env.RATE_LIMIT_STORE ??= 'mongo';
  console.log(`Starting ${WORKERS} server copies on port ${process.env.PORT || 3000} (shared through MongoDB)…`);

  let stopping = false;
  for (let i = 0; i < WORKERS; i += 1) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    if (stopping) return;
    console.error(`Server copy ${worker.process.pid} stopped (${signal ?? code}); starting a new one.`);
    cluster.fork();
  });

  // Ctrl+C / a host stopping us: each copy finishes what it's doing (server.js).
  const stop = (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal}: stopping ${Object.keys(cluster.workers).length} copies…`);
    for (const worker of Object.values(cluster.workers)) worker.process.kill(signal);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
} else {
  require('./server');
}
