// Starts the Python AI service (the repo's ai/ folder) next to the backend,
// so `npm run dev` is all it takes — plus Ollama running (`ollama serve`).
//
// First run: makes a private Python environment in ai/.venv and installs
// ai/requirements.txt (a few minutes, ~600 MB). After that it only
// reinstalls when requirements.txt changes.
//
// It never stops the backend: if Python is missing or something fails, it
// prints one line and exits quietly — Accel then uses only the rules on the
// phone, and sign language says the server isn't reachable.
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AI_DIR = path.join(__dirname, '..', '..', 'ai');
const VENV = path.join(AI_DIR, '.venv');
const IS_WINDOWS = process.platform === 'win32';
const VENV_PYTHON = IS_WINDOWS ? path.join(VENV, 'Scripts', 'python.exe') : path.join(VENV, 'bin', 'python');
const REQUIREMENTS = path.join(AI_DIR, 'requirements.txt');
const HASH_FILE = path.join(VENV, '.requirements-hash');
const PORT = process.env.AI_PORT || '8001';

const log = (message) => console.log(`[ai] ${message}`);

function stop(message) {
  log(message);
  process.exit(0);
}

// MediaPipe 0.10.14 (what the sign models were trained with) needs Python
// 3.9–3.12, so 3.12 is asked for by name first.
function findPython() {
  const candidates = [];
  if (process.env.AI_PYTHON) candidates.push([process.env.AI_PYTHON, []]);
  if (IS_WINDOWS) candidates.push(['py', ['-3.12']], ['py', ['-3.11']], ['py', ['-3.10']]);
  candidates.push(['python3.12', []], ['python3', []], ['python', []]);
  for (const [command, args] of candidates) {
    const check = spawnSync(command, [...args, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], {
      encoding: 'utf8',
    });
    const version = check.status === 0 ? check.stdout.trim() : null;
    if (version && /^3\.(9|10|11|12)$/.test(version)) return { command, args, version };
  }
  return null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: AI_DIR, ...options });
  return result.status === 0;
}

function ensureEnvironment() {
  if (!fs.existsSync(VENV_PYTHON)) {
    const python = findPython();
    if (!python) {
      stop('Python 3.12 not found, so the AI service is off. Install it from python.org (tick "Add to PATH").');
    }
    log(`Creating ai/.venv with Python ${python.version} (first run only)…`);
    if (!run(python.command, [...python.args, '-m', 'venv', VENV])) stop('Could not create ai/.venv.');
  }

  const wanted = crypto.createHash('sha256').update(fs.readFileSync(REQUIREMENTS)).digest('hex');
  const installed = fs.existsSync(HASH_FILE) ? fs.readFileSync(HASH_FILE, 'utf8').trim() : '';
  if (wanted !== installed) {
    log('Installing the AI service packages (first run takes a few minutes)…');
    run(VENV_PYTHON, ['-m', 'pip', 'install', '--disable-pip-version-check', '-q', '--upgrade', 'pip']);
    if (!run(VENV_PYTHON, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', REQUIREMENTS])) {
      stop('Installing the AI packages failed (see above). The backend keeps running without AI.');
    }
    fs.writeFileSync(HASH_FILE, wanted);
  }
}

// Keeps the service running: if it crashes, start it again after a pause
// that grows each time (up to a minute).
function startService(attempt = 0) {
  const child = spawn(
    VENV_PYTHON,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', PORT, '--log-level', 'warning'],
    { cwd: AI_DIR, stdio: 'inherit', env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' } },
  );
  const startedAt = Date.now();
  const forward = (signal) => child.kill(signal);
  process.on('SIGINT', forward);
  process.on('SIGTERM', forward);
  child.on('exit', (code, signal) => {
    process.off('SIGINT', forward);
    process.off('SIGTERM', forward);
    if (signal === 'SIGINT' || signal === 'SIGTERM') process.exit(0);
    const ranLong = Date.now() - startedAt > 60 * 1000;
    const next = ranLong ? 0 : attempt + 1;
    const delay = Math.min(60, 2 ** next) * 1000;
    log(`The AI service stopped (code ${code}). Starting it again in ${delay / 1000} s…`);
    setTimeout(() => startService(next), delay);
  });
}

async function alreadyRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

(async () => {
  if (process.env.AI_DISABLED === '1') stop('AI_DISABLED=1, so the AI service is off.');
  if (!fs.existsSync(REQUIREMENTS)) stop('ai/requirements.txt is missing, so the AI service is off.');
  if (await alreadyRunning()) stop(`An AI service is already running on port ${PORT} — using that one.`);
  ensureEnvironment();
  log(`Starting on http://127.0.0.1:${PORT} — it waits for Ollama (\`ollama serve\`) and loads the models.`);
  startService();
})();
