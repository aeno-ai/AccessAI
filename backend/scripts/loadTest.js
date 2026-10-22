// How much the backend can take, with 1 copy vs 2 copies (HANDOFF.md §52):
//
//   npm run load-test
//
// Starts the server on port 3301 — first one copy (npm start), then two
// copies (npm run start:cluster, shared through MongoDB) — and hits a real
// signed-in request (GET /api/friends/me: token check + database) as fast as
// it can for DURATION seconds with autocannon. 300 throwaway accounts take
// turns, so the per-person rate limit (120 at once) doesn't cap the test.
// Prints requests/second and response times for both; cleans up after.
require('dotenv').config();
const path = require('path');
const { spawn } = require('child_process');
const autocannon = require('autocannon');
const h = require('./e2e/helpers');

const PORT = 3301;
const DURATION = Number(process.env.LOAD_SECONDS) || 15;
const CONNECTIONS = Number(process.env.LOAD_CONNECTIONS) || 50;
const USERS = 300;

function start(script, extraEnv) {
  return spawn(process.execPath, [path.join(__dirname, '..', 'src', script)], {
    env: { ...process.env, PORT: String(PORT), ...extraEnv },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

async function waitReady(ms = 60000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) return;
    } catch {
      // not up yet
    }
    await h.sleep(500);
  }
  throw new Error("the server didn't start");
}

function stop(child) {
  return new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 15000).unref();
  });
}

async function measure(label, tokens) {
  let i = 0;
  const result = await autocannon({
    url: `http://localhost:${PORT}`,
    connections: CONNECTIONS,
    duration: DURATION,
    requests: [
      {
        method: 'GET',
        path: '/api/friends/me',
        setupRequest: (req) => ({ ...req, headers: { ...req.headers, authorization: `Bearer ${tokens[i++ % tokens.length]}` } }),
      },
    ],
  });
  const ok = result['2xx'];
  const line = {
    setup: label,
    'requests/s (avg)': Math.round(result.requests.average),
    'ok responses': ok,
    'errors/timeouts': result.errors + result.timeouts,
    'non-2xx': result.non2xx,
    'latency p50 (ms)': result.latency.p50,
    'latency p99 (ms)': result.latency.p99,
  };
  console.log(`${label}: ${line['requests/s (avg)']} requests/s, p50 ${line['latency p50 (ms)']} ms, p99 ${line['latency p99 (ms)']} ms`);
  return line;
}

async function main() {
  await h.connect();
  console.log(`Making ${USERS} throwaway accounts…`);
  const users = [];
  for (let n = 0; n < USERS; n += 50) {
    users.push(...(await Promise.all(Array.from({ length: Math.min(50, USERS - n) }, (_, k) => h.makeUser(`Load${n + k}`)))));
  }
  const tokens = users.map((u) => u.token);
  const rows = [];
  try {
    console.log(`\n${DURATION} s each, ${CONNECTIONS} connections at once, GET /api/friends/me\n`);
    let server = start('server.js', {});
    await waitReady();
    await measure('warm-up', tokens.slice(0, 20)).catch(() => {});
    rows.push(await measure('1 copy (npm start)', tokens));
    await stop(server);

    server = start('cluster.js', { CLUSTER_WORKERS: '2' });
    await waitReady();
    await h.sleep(2000);
    rows.push(await measure('2 copies (npm run start:cluster)', tokens));
    await stop(server);
  } finally {
    await h.cleanup().catch((e) => console.error('cleanup failed:', e.message));
  }
  console.log('');
  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
