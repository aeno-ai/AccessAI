// Exports the logs for the Spark analytics job (HANDOFF.md §52):
//
//   cd backend && npm run export-logs
//
// Writes analytics/data/*.jsonl — one JSON record per line — from MongoDB:
//   activity.jsonl    login/activity records (type, reason, limit, phone, time;
//                     the account and network address as one-way hashes)
//   sos.jsonl         SOS records: when, test or real, how many alerted,
//                     when friends answered — NEVER the place, location or message
//   admin_log.jsonl   admin actions (action, result, time; admin as a hash)
//   learn.jsonl       Learn lessons finished (course, lesson, time)
// No names, emails, addresses, messages or locations leave the database:
// people are hashes, so the job can count and group without knowing who.
// The folder is gitignored.
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const AdminAuditLog = require('../src/models/AdminAuditLog');
const LearnCompletion = require('../src/models/LearnCompletion');
const SOSEvent = require('../src/models/SOSEvent');
const UserActivity = require('../src/models/UserActivity');

const OUT = path.join(__dirname, '..', '..', 'analytics', 'data');
// A secret per export, so the hashes can't be matched to anything outside it.
const SALT = crypto.randomBytes(16).toString('hex');
const hash = (value) => (value ? crypto.createHash('sha256').update(SALT + String(value)).digest('hex').slice(0, 16) : null);

async function dump(name, cursor, toRow) {
  const file = path.join(OUT, `${name}.jsonl`);
  const out = fs.createWriteStream(file);
  let n = 0;
  for await (const doc of cursor) {
    out.write(`${JSON.stringify(toRow(doc))}\n`);
    n += 1;
  }
  await new Promise((resolve) => out.end(resolve));
  console.log(`${name}: ${n} records → ${path.relative(process.cwd(), file)}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await mongoose.connect(process.env.MONGO_URI);
  await dump('activity', UserActivity.find({}).lean().cursor(), (a) => ({
    at: a.createdAt,
    type: a.type,
    reason: a.reason ?? null,
    limiter: a.limiter ?? null,
    platform: a.platform ?? 'unknown',
    appVersion: a.appVersion ?? null,
    user: hash(a.userId),
    address: hash(a.ip),
  }));
  // Only these fields are ever read (never location, lastLocation, place, message).
  await dump('sos', SOSEvent.find({}).select('createdAt occurredAt isTest triggerMethod recipients responses.at responses.kind resolvedReason').lean().cursor(), (e) => ({
    at: e.occurredAt ?? e.createdAt,
    isTest: e.isTest === true,
    trigger: e.triggerMethod ?? null,
    alerted: e.recipients?.length ?? 0,
    answers: (e.responses ?? []).map((r) => ({ at: r.at, kind: r.kind })),
    ended: e.resolvedReason ?? null,
  }));
  await dump('admin_log', AdminAuditLog.find({}).select('createdAt adminId action success').lean().cursor(), (l) => ({
    at: l.createdAt,
    admin: hash(l.adminId),
    action: l.action,
    success: l.success !== false,
  }));
  await dump('learn', LearnCompletion.find({}).select('completedAt course lessonId userId').lean().cursor(), (c) => ({
    at: c.completedAt,
    course: c.course,
    lesson: c.lessonId,
    user: hash(c.userId),
  }));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
