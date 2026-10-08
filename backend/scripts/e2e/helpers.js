// Shared tools for the end-to-end checks in this folder. They run against
// the REAL server (start it first: `npm run dev` or `npm run dev:api`) and
// the real database, using throwaway accounts that are erased at the end —
// even when a check fails.
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const { io } = require('socket.io-client');
const User = require('../../src/models/Users');
const Friendship = require('../../src/models/Friendship');
const { signUserToken } = require('../../src/utils/userSession');
const { purgeUser } = require('../../src/utils/accountDeletion');

const BASE = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const created = [];
const sockets = [];
let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ''}`);
  }
}

async function connect() {
  await mongoose.connect(process.env.MONGO_URI);
}

// A verified account that can use the app right away.
async function makeUser(firstName, role = 'pwd') {
  const id = crypto.randomBytes(5).toString('hex');
  const user = await User.create({
    email: `e2e-${id}@example.test`,
    name: `${firstName} Test`,
    firstName,
    lastName: 'Test',
    role,
    emailVerified: true,
  });
  created.push(user._id);
  return { id: String(user._id), token: signUserToken(user), name: firstName };
}

// Accepted friends; `aAddsBToSos` puts b in a's SOS circle.
async function befriend(a, b, { aAddsBToSos = false } = {}) {
  await Friendship.create({
    requester: a.id,
    recipient: b.id,
    pairKey: Friendship.pairKeyOf(a.id, b.id),
    status: 'accepted',
    acceptedAt: new Date(),
    requesterSos: aAddsBToSos,
  });
}

async function api(method, route, token, body) {
  const response = await fetch(`${BASE}/api${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { notJson: text.slice(0, 80) };
  }
  return { status: response.status, data, json: (response.headers.get('content-type') ?? '').includes('json') };
}

// A live socket like the app's, collecting every event it receives.
async function openSocket(user) {
  const socket = io(BASE, { auth: { token: user.token }, transports: ['websocket'], reconnection: false });
  socket.received = [];
  socket.onAny((event, payload) => socket.received.push({ event, payload }));
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    setTimeout(() => reject(new Error('socket did not connect')), 5000);
  });
  return socket;
}

// Waits for an event matching `test` (default: any payload).
function waitFor(socket, event, test = () => true, timeoutMs = 4000) {
  const already = socket.received.find((entry) => entry.event === event && test(entry.payload));
  if (already) return Promise.resolve(already.payload);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, timeoutMs);
    function handler(payload) {
      if (!test(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanup() {
  for (const socket of sockets) socket.disconnect();
  for (const id of created) {
    await purgeUser(id).catch((error) => console.error('cleanup failed for', id, error.message));
  }
  await mongoose.disconnect();
}

const summary = () => ({ passed, failed });

module.exports = { BASE, check, connect, makeUser, befriend, api, openSocket, waitFor, sleep, cleanup, summary };
