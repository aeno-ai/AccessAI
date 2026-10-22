const nodemailer = require('nodemailer');

// Sends email over SMTP. Any SMTP service works; the defaults are Gmail's,
// so a Gmail address plus an App Password (Google Account → Security →
// 2-Step Verification → App passwords) is all the setup needed:
//
//   SMTP_USER=you@gmail.com
//   SMTP_PASS=abcd efgh ijkl mnop
//
// Optional: SMTP_HOST, SMTP_PORT (465 = TLS from the start, anything else
// upgrades with STARTTLS) and MAIL_FROM (defaults to SMTP_USER).
//
// Hosts that block the SMTP ports (Render's free plan blocks 25/465/587)
// can send through Brevo's web API instead, over normal HTTPS. Set
//
//   BREVO_API_KEY=xkeysib-...
//   MAIL_FROM=AccessAI <you@gmail.com>   (a sender verified in Brevo)
//
// and Brevo is used instead of SMTP.
//
// Without either, development servers print each email to this console
// instead of sending it, so sign-up can be tested with no email account at
// all. Production refuses.

let transporter = null;

const BREVO_URL = 'https://api.brevo.com/v3';
const usesBrevo = () => Boolean(process.env.BREVO_API_KEY);
const isConfigured = () => usesBrevo() || Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

// "AccessAI <you@gmail.com>", "AccessAI you@gmail.com" or "you@gmail.com"
// → { name, email }.
function senderFrom(text = '') {
  const email = (/[^\s<>]+@[^\s<>]+/.exec(text) || [''])[0];
  const name = text.replace(email, '').replace(/[<>]/g, '').trim();
  return { name: name || 'AccessAI', email };
}

async function brevoRequest(path, options = {}) {
  const response = await fetch(`${BREVO_URL}${path}`, {
    ...options,
    headers: { 'api-key': process.env.BREVO_API_KEY, accept: 'application/json', 'content-type': 'application/json' },
    // Same idea as the SMTP timeouts below: never hang on a bad network.
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(new Error(`Brevo ${response.status}: ${body.message || response.statusText}`), { status: response.status });
  }
  return response.json().catch(() => ({}));
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Keeps the logged-in connection open between emails: logging in to
      // Gmail takes ~1.2 s, so only the first email pays for it.
      pool: true,
      maxConnections: 2,
      // Never hang for minutes on a bad network (nodemailer's defaults are
      // up to 10 minutes).
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text }) {
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email is not configured: set BREVO_API_KEY, or SMTP_USER and SMTP_PASS');
    }
    console.log(`[mailer] SMTP not configured — not sent.\n  To: ${to}\n  Subject: ${subject}\n  ${text}`);
    return;
  }

  if (usesBrevo()) {
    await brevoRequest('/smtp/email', {
      method: 'POST',
      body: JSON.stringify({
        sender: senderFrom(process.env.MAIL_FROM || process.env.SMTP_USER),
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });
    return;
  }

  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || `AccessAI <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}

/**
 * Logs whether the email login works, once at server start — so a revoked
 * Gmail App Password shows up here, not as codes that silently never arrive.
 */
async function checkMailLogin() {
  if (!isConfigured()) {
    console.log('[mail] SMTP not set up: codes are printed in this terminal instead of emailed.');
    return;
  }
  const started = Date.now();
  if (usesBrevo()) {
    try {
      await brevoRequest('/account');
      console.log(`[mail] Brevo key OK (${((Date.now() - started) / 1000).toFixed(1)} s)`);
    } catch (error) {
      const hint = error.status === 401 ? ' — the API key was refused (deleted or mistyped)' : '';
      console.error(`[mail] Brevo check FAILED: ${error.message}${hint}`);
    }
    return;
  }
  try {
    await getTransporter().verify();
    console.log(`[mail] Gmail login OK (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  } catch (error) {
    const hint = error.responseCode === 535 ? ' — the App Password was refused (revoked or mistyped), see HANDOFF §2.6' : '';
    console.error(`[mail] Gmail login FAILED: ${error.responseCode ? `${error.responseCode} ` : ''}${error.message}${hint}`);
  }
}

module.exports = { sendMail, checkMailLogin };
