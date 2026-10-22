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
const Admin = require('../../src/models/Admin');
const AdminAuditLog = require('../../src/models/AdminAuditLog');
const UserActivity = require('../../src/models/UserActivity');
const jwt = require('jsonwebtoken');

const BASE = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const created = [];
const createdAdmins = [];
const sockets = [];
const startedAt = new Date();
// A made-up network address for this run (198.18.0.0/15 is for tests). The
// server trusts the address passed along from this computer, so checks that
// use it get their own login limit (20 failed tries per 15 minutes per
// address) and can run many times in a row.
const runAddress = { 'X-Forwarded-For': `198.18.${crypto.randomInt(256)}.${1 + crypto.randomInt(254)}` };
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

// `headers`: extra ones, e.g. the app's X-App-Platform / X-App-Version.
async function api(method, route, token, body, headers = {}) {
  const response = await fetch(`${BASE}/api${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return answerOf(response);
}

async function answerOf(response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { notJson: text.slice(0, 80) };
  }
  return {
    status: response.status,
    data,
    json: (response.headers.get('content-type') ?? '').includes('json'),
    headers: response.headers,
  };
}

// An admin-panel account ('super_admin' or 'admin') with a session, as if
// it had logged in (the same token utils/adminSession.js issues).
async function makeAdmin(role) {
  const id = crypto.randomBytes(5).toString('hex');
  const admin = await Admin.create({
    email: `e2e-admin-${id}@example.test`,
    password: 'not-a-real-hash',
    name: `E2E ${role}`,
    role,
    mustChangePassword: false,
  });
  createdAdmins.push(admin._id);
  const session = jwt.sign({ adminId: String(admin._id), tv: admin.tokenVersion }, process.env.ADMIN_JWT_SECRET, {
    expiresIn: 3600,
    audience: 'accessai-admin',
    algorithm: 'HS256',
  });
  return { id: String(admin._id), session };
}

// A call to /api/admin… with that admin's session cookie (none: logged out).
async function adminApi(method, route, admin, body) {
  const response = await fetch(`${BASE}/api/admin${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(admin ? { Cookie: `admin_session=${admin.session}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return answerOf(response);
}

// The same, for a download (CSV): the status, content type and raw text.
async function adminRaw(method, route, admin) {
  const response = await fetch(`${BASE}/api/admin${route}`, {
    method,
    headers: admin ? { Cookie: `admin_session=${admin.session}` } : {},
  });
  return { status: response.status, type: response.headers.get('content-type') ?? '', text: await response.text() };
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
  await Admin.deleteMany({ _id: { $in: createdAdmins } });
  await AdminAuditLog.deleteMany({ adminId: { $in: createdAdmins } });
  // Failed logins with emails that have no account aren't tied to anyone;
  // this run's (from this computer) go too, so "Needs a look" doesn't fill
  // up with test runs.
  await UserActivity.deleteMany({
    userId: { $exists: false },
    createdAt: { $gte: startedAt },
    ip: { $in: ['127.0.0.1', '::1', runAddress['X-Forwarded-For']] },
  });
  await mongoose.disconnect();
}

const summary = () => ({ passed, failed });

module.exports = { BASE, runAddress, check, connect, makeUser, makeAdmin, befriend, api, adminApi, adminRaw, openSocket, waitFor, sleep, cleanup, summary };
