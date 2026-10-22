// Proves the backend works as several copies (HANDOFF.md §52):
//
//   npm run scale-check
//
// Starts TWO copies of the server on two ports (3201, 3202), both sharing
// through MongoDB (SOCKET_ADAPTER=mongo, RATE_LIMIT_STORE=mongo), like two
// machines behind a load balancer, then checks with real requests:
//   1. a chat message sent through copy B reaches a phone connected to copy A;
//   2. copy B sees that phone as online (presence across copies);
//   3. one person's burst split across both copies is limited as ONE
//      person (~120 requests in total, not 120 on each copy);
//   4. each timed job runs on one copy only (its lease);
//   5. an admin suspending someone through copy B closes their connection on copy A.
// Uses throwaway accounts and cleans up after itself (like the e2e tests).
require('dotenv').config();
const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const { io } = require('socket.io-client');
const h = require('./e2e/helpers');

const PORTS = [3201, 3202];
const urlOf = (port) => `http://localhost:${port}`;

function startCopy(port) {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
    env: { ...process.env, PORT: String(port), SOCKET_ADAPTER: 'mongo', RATE_LIMIT_STORE: 'mongo' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const tag = `[copy :${port}]`;
  child.stdout.on('data', (d) => process.env.SCALE_VERBOSE && process.stdout.write(`${tag} ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`${tag} ${d}`));
  return child;
}

async function waitReady(port, ms = 60000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(`${urlOf(port)}/api/health`);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await h.sleep(500);
  }
  throw new Error(`copy on ${port} didn't start`);
}

const call = (port, method, route, token, body) =>
  fetch(`${urlOf(port)}/api${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const adminCall = (port, method, route, admin, body) =>
  fetch(`${urlOf(port)}/api/admin${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: `admin_session=${admin.session}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

function socketOn(port, user) {
  const socket = io(urlOf(port), { auth: { token: user.token }, transports: ['websocket'], reconnection: false });
  socket.received = [];
  socket.onAny((event, payload) => socket.received.push({ event, payload }));
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

async function main() {
  const copies = PORTS.map(startCopy);
  const stopAll = () => copies.forEach((c) => c.kill('SIGTERM'));
  process.on('exit', stopAll);
  try {
    await h.connect();
    await Promise.all(PORTS.map((p) => waitReady(p)));
    console.log(`Two server copies are up on ${PORTS.join(' and ')}, sharing through MongoDB.\n`);
    const [A, B] = PORTS;

    const ana = await h.makeUser('Ana');
    const ben = await h.makeUser('Ben');
    await h.befriend(ana, ben);

    // 1. Ana's phone is connected to copy A; Ben sends through copy B.
    const anaSocket = await socketOn(A, ana);
    await h.sleep(700);
    const sent = await call(B, 'POST', `/messages/${ana.id}`, ben.token, { clientId: `scale-${Date.now()}`, body: 'Hello from the other copy', createdAt: Date.now() });
    const got = await h.waitFor(anaSocket, 'dm:new', (p) => p?.message?.body === 'Hello from the other copy', 5000);
    h.check('a message sent through copy B reaches a phone on copy A', sent.status === 201 && Boolean(got), { status: sent.status, events: anaSocket.received.map((e) => e.event) });

    // 2. Presence: copy B sees Ana (connected to copy A) as online.
    const friends = await (await call(B, 'GET', '/friends', ben.token)).json();
    const anaRow = friends.find?.((f) => f.userId === ana.id);
    h.check('copy B sees Ana as online (her phone is on copy A)', anaRow?.online === true, anaRow);

    // 3. One burst of 130, every other request to the other copy.
    const results = await Promise.all(
      Array.from({ length: 130 }, (_, i) => call(i % 2 ? B : A, 'GET', '/friends/me', ana.token).then((r) => r.status)),
    );
    const passed = results.filter((s) => s === 200).length;
    const limited = results.filter((s) => s === 429).length;
    h.check(`a 130-request burst over both copies is limited as one person (${passed} passed, ${limited} slowed down)`, passed <= 126 && limited >= 4, { passed, limited });

    // 4. Each timed job is held by exactly one copy.
    const leases = await mongoose.connection.db.collection('job_leases').find({}).toArray();
    const purge = leases.find((l) => l._id === 'purge-expired-accounts');
    const sos = leases.find((l) => l._id === 'expire-stale-sos');
    h.check('each timed job is held by one copy at a time (its lease)', Boolean(purge?.owner && sos?.owner && purge.until > new Date()), leases);

    // 5. Suspend through copy B → Ana's connection on copy A closes.
    const boss = await h.makeAdmin('admin');
    const closed = new Promise((resolve) => anaSocket.on('disconnect', () => resolve(true)));
    const suspended = await adminCall(B, 'POST', `/users/${ana.id}/suspend`, boss, { days: 1, reason: 'Scale check' });
    const wasClosed = await Promise.race([closed, h.sleep(5000).then(() => false)]);
    h.check('suspending through copy B closes her connection on copy A', suspended.status === 200 && wasClosed === true, suspended.status);
    anaSocket.close();
  } finally {
    await h.cleanup().catch((e) => console.error('cleanup failed:', e.message));
    stopAll();
  }
  const { passed, failed } = h.summary();
  console.log(`
${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
