// A pretend friend, "Andrew (Demo)", for trying SOS and chat with only one
// phone. He is a PWD account this script controls through the real API,
// exactly like a second phone would. Nothing here logs in as you.
//
//   npm run sos-demo -- setup --email you@example.com   create Andrew and send you a friend request
//   npm run sos-demo -- listen [--minutes 15] [--respond]
//                                                       show what Andrew receives (your SOS, messages);
//                                                       --respond: Andrew answers "I'm on my way"
//   npm run sos-demo -- sos [--test] [--place "Rizal Park, Manila"] [--lat 14.5826 --lng 120.9787]
//                                                       Andrew sends you an SOS
//   npm run sos-demo -- walk [--steps 3]                Andrew's live location moves (a step every 31 s)
//   npm run sos-demo -- safe                            Andrew says "I'm safe"
//   npm run sos-demo -- message "Hello!"                Andrew messages you
//   npm run sos-demo -- cleanup                         delete Andrew and everything of his
//
// The backend must be running (`npm run dev`).
require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { io } = require('socket.io-client');
const User = require('../src/models/Users');
const { signUserToken } = require('../src/utils/userSession');
const { ensureFriendCode } = require('../src/utils/friendCode');
const { purgeUser } = require('../src/utils/accountDeletion');

const BASE = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const DEMO_EMAIL = 'andrew.demo@accessai.test';
const STATE_FILE = path.join(os.tmpdir(), 'accessai-sos-demo.json');
const RIZAL_PARK = { latitude: 14.5826, longitude: 120.9787 };

const [command, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const option = (name, fallback) => {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 && rest[index + 1] !== undefined ? rest[index + 1] : fallback;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mapLink = ({ latitude, longitude }) => `https://maps.google.com/?q=${latitude},${longitude}`;

const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
};
const writeState = (patch) => fs.writeFileSync(STATE_FILE, JSON.stringify({ ...readState(), ...patch }, null, 2));

async function api(method, route, token, body) {
  const response = await fetch(`${BASE}/api${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function getDemo({ create = false } = {}) {
  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user && create) {
    user = await User.create({
      email: DEMO_EMAIL,
      name: 'Andrew Demo',
      firstName: 'Andrew',
      lastName: 'Demo',
      role: 'pwd',
      emailVerified: true,
    });
  }
  if (!user) throw new Error('Andrew doesn\'t exist yet. Run: npm run sos-demo -- setup --email you@example.com');
  return { user, token: signUserToken(user) };
}

function targetId() {
  const { targetId: id } = readState();
  if (!id) throw new Error('Run setup first: npm run sos-demo -- setup --email you@example.com');
  return id;
}

async function setup() {
  const email = String(option('email', '')).trim().toLowerCase();
  if (!email) throw new Error('Add --email with the account on your phone.');
  const target = await User.findOne({ email });
  if (!target) throw new Error(`No account uses ${email}.`);
  const { user: demo, token } = await getDemo({ create: true });
  writeState({ targetId: String(target._id), targetEmail: email });
  const code = await ensureFriendCode(target);
  const r = await api('POST', '/friends/requests', token, { code });
  if (r.status >= 400) {
    console.log(`Friend request: ${r.data.message ?? r.status}`);
  } else if (r.data.status === 'accepted') {
    console.log('You and Andrew (Demo) are now friends.');
  } else {
    console.log('Andrew (Demo) sent you a friend request.');
    console.log('On your phone: Friends → Requests → Accept.');
  }
  console.log(`(Andrew is a PWD account: ${demo.email})`);
}

async function listen() {
  const { token } = await getDemo();
  const minutes = Number(option('minutes', 15));
  const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
  socket.on('connect', () => console.log(`Andrew is online, listening for ${minutes} min. Send an SOS or a message from your phone.\n`));
  socket.on('connect_error', (error) => console.log(`Couldn't connect: ${error.message}`));
  socket.on('friends:changed', () => console.log('• Friends changed (a request was accepted or removed).'));
  socket.on('dm:new', ({ message }) => {
    if (message?.kind === 'sos') return; // shown as the alert below
    console.log(`• Message from you: "${message?.body}"`);
  });
  socket.on('sos:alert', async (sos) => {
    console.log('\n================ SOS RECEIVED ================');
    console.log(`From:     ${sos.name}${sos.isTest ? '   (TEST)' : ''}`);
    console.log(`Message:  ${sos.message ?? '(none)'}`);
    console.log(`Place:    ${sos.place ?? '(no place name — only coordinates)'}`);
    if (sos.location) {
      console.log(`GPS:      ${sos.location.latitude}, ${sos.location.longitude}`);
      console.log(`Map:      ${mapLink(sos.location)}`);
    } else {
      console.log('GPS:      (no location — location was off or not allowed)');
    }
    console.log('==============================================\n');
    if (flag('respond')) {
      await sleep(5000);
      const r = await api('POST', `/sos/${sos.eventId}/respond`, token, { kind: 'on_my_way' });
      console.log(r.status === 200 ? '• Andrew answered "I\'m on my way" — your phone should say it.' : `• Couldn't answer: ${r.data.message}`);
    }
  });
  socket.on('sos:response', ({ name, kind }) =>
    console.log(`• ${name ?? 'You'} answered Andrew's SOS: ${kind === 'on_my_way' ? '"I\'m on my way"' : '"I\'ve seen it"'}`),
  );
  socket.on('sos:location', ({ location }) => location && console.log(`• Your live location moved: ${mapLink(location)}`));
  socket.on('sos:resolved', ({ reason }) => console.log(`• Your SOS ended (${reason === 'safe' ? '"I\'m safe"' : reason}).`));
  await sleep(minutes * 60 * 1000);
  socket.disconnect();
  console.log('Stopped listening.');
}

async function sos() {
  const { token } = await getDemo();
  const friendId = targetId();
  // Andrew's SOS circle must include you for you to get it.
  const circle = await api('PATCH', `/friends/${friendId}/sos`, token, { inCircle: true });
  if (circle.status >= 400) throw new Error(`Couldn't add you to Andrew's SOS circle: ${circle.data.message} (accept his friend request first)`);
  const place = option('place', 'Rizal Park, Manila');
  const isTest = flag('test');
  const at =
    option('lat') && option('lng')
      ? { latitude: Number(option('lat')), longitude: Number(option('lng')) }
      : RIZAL_PARK;
  const r = await api('POST', '/sos/trigger', token, {
    triggerMethod: 'app-hold-confirm',
    message: `I need help, I'm at ${place}. Please come ASAP`,
    location: at,
    place,
    ...(isTest ? { isTest: true } : {}),
  });
  if (r.status >= 400) throw new Error(r.data.message ?? `SOS failed (${r.status})`);
  writeState({ eventId: r.data.eventId, at });
  console.log(`Andrew sent ${isTest ? 'a TEST' : 'an'} SOS → ${r.data.alertedNames?.join(', ') || 'nobody'}.`);
  console.log('Your phone should show the alert now. Try Map, "I\'m on my way", and Message.');
  console.log('Next: npm run sos-demo -- walk   (he moves)   ·   npm run sos-demo -- safe');
}

async function walk() {
  const { token } = await getDemo();
  const { eventId, at } = readState();
  if (!eventId) throw new Error('Send an SOS first: npm run sos-demo -- sos');
  let where = at ?? RIZAL_PARK;
  const steps = Number(option('steps', 3));
  for (let step = 1; step <= steps; step += 1) {
    console.log(`Step ${step}/${steps}: waiting 31 s (live location is shared every 30 s)…`);
    await sleep(31 * 1000);
    where = { latitude: +(where.latitude + 0.0004).toFixed(6), longitude: +(where.longitude + 0.0004).toFixed(6) };
    const r = await api('PATCH', `/sos/${eventId}/location`, token, { ...where, accuracy: 12 });
    if (r.status >= 400) throw new Error(r.data.message ?? `Location update failed (${r.status})`);
    writeState({ at: where });
    console.log(`  moved ~60 m → ${mapLink(where)} ${r.data.saved ? '' : '(too soon, skipped)'}`);
  }
}

async function safe() {
  const { token } = await getDemo();
  const { eventId } = readState();
  if (!eventId) throw new Error('No SOS to end.');
  const r = await api('PATCH', `/sos/${eventId}/resolve`, token);
  if (r.status >= 400) throw new Error(r.data.message ?? `Couldn't end it (${r.status})`);
  writeState({ eventId: null });
  console.log('Andrew said "I\'m safe". Your phone\'s alert should turn to "safe now".');
}

async function message() {
  const { token } = await getDemo();
  const body = rest.filter((part) => !part.startsWith('--')).join(' ').trim() || 'Hi! This is Andrew (Demo).';
  const r = await api('POST', `/messages/${targetId()}`, token, {
    clientId: crypto.randomUUID(),
    body,
    createdAt: Date.now(),
  });
  if (r.status >= 400) throw new Error(r.data.message ?? `Message failed (${r.status})`);
  console.log(`Andrew sent you: "${body}"`);
}

async function cleanup() {
  const demo = await User.findOne({ email: DEMO_EMAIL });
  if (demo) await purgeUser(demo._id);
  fs.rmSync(STATE_FILE, { force: true });
  console.log(demo ? 'Andrew (Demo) and everything of his is deleted.' : 'Nothing to clean up.');
}

const COMMANDS = { setup, listen, sos, walk, safe, message, cleanup };

(async () => {
  const run = COMMANDS[command];
  if (!run) {
    console.log('Commands: setup --email <you> · listen [--respond] · sos [--test] · walk · safe · message "text" · cleanup');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  try {
    await run();
  } catch (error) {
    console.log(`✗ ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
