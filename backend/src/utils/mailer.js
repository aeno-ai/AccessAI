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
// Without SMTP_USER/SMTP_PASS, development servers print each email to
// this console instead of sending it, so sign-up can be tested with no
// email account at all. Production refuses.

let transporter = null;

const isConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text }) {
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email is not configured: set SMTP_USER and SMTP_PASS');
    }
    console.log(`[mailer] SMTP not configured — not sent.\n  To: ${to}\n  Subject: ${subject}\n  ${text}`);
    return;
  }

  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || `AccessAI <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}

module.exports = { sendMail };
