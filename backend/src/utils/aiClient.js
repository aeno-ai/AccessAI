const fs = require('fs');
const path = require('path');

// Talks to the Python AI service in the repo's ai/ folder (Ollama + vector
// search for Accel, MediaPipe + the sign models for sign language). It only
// listens on this computer (127.0.0.1), so the phone can never reach it
// directly — every call goes through these authenticated, rate-limited
// routes first.
const AI_URL = process.env.AI_SERVICE_URL || `http://127.0.0.1:${process.env.AI_PORT || 8001}`;
const DEFAULT_TIMEOUT_MS = Number(process.env.ACCEL_AI_TIMEOUT_MS) || 15000;

// Thrown whenever the AI service can't give a usable answer (not running,
// still loading its models, too slow, or it refused the request). Routes
// turn it into a friendly 503 and the app falls back to what works offline.
class AiUnavailable extends Error {
  constructor(reason, status) {
    super(reason);
    this.name = 'AiUnavailable';
    this.upstreamStatus = status;
  }
}

async function callAi(route, { method = 'GET', json, body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let response;
  try {
    response = await fetch(`${AI_URL}${route}`, {
      method,
      headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new AiUnavailable(error.name === 'TimeoutError' ? 'timeout' : 'not running');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    throw new AiUnavailable(`status ${response.status}`, response.status);
  }
  return data;
}

// The intent ids Accel may act on — the same list the Python service and the
// app use (ai/intents.json). Anything else coming back is ignored, so even a
// confused model can only ever choose from this list.
// Read on first use (and again while it's missing), so the order things
// start in doesn't matter.
let intentIds = null;
function knownIntent(id) {
  if (!intentIds) {
    try {
      const file = path.join(__dirname, '..', '..', '..', 'ai', 'intents.json');
      const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
      intentIds = new Set(catalog.intents.map((intent) => intent.id));
    } catch {
      console.warn('ai/intents.json not found — Accel will only use the rules on the phone.');
      return false;
    }
  }
  return intentIds.has(id);
}

module.exports = { callAi, AiUnavailable, knownIntent };
