const { GENERIC } = require('../validators/common');

// Blocks NoSQL injection before any route sees the request.
//
// MongoDB filters treat keys starting with "$" as operators: if a login
// handler did User.findOne({ email: req.body.email }) and someone sent
// {"email": {"$ne": ""}}, that would match the first user in the database.
// Every validator already insists on plain strings, but this is the safety
// net for any route that forgets: no request body or URL parameter may
// contain a "$..." key, a dotted key ("a.b" reaches into nested fields), or
// the keys that can tamper with JavaScript objects (__proto__ and friends).
//
// req.query isn't walked: Express 5's query parser never builds nested
// objects from the URL, and the validators reject arrays there.
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 10;

function hasBadKey(value, depth = 0) {
  if (value === null || typeof value !== 'object') return false;
  if (depth > MAX_DEPTH) return true;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || FORBIDDEN.has(key)) return true;
    if (hasBadKey(value[key], depth + 1)) return true;
  }
  return false;
}

function rejectOperatorKeys(req, res, next) {
  if (hasBadKey(req.body) || hasBadKey(req.params)) {
    return res.status(400).json({ message: GENERIC });
  }
  next();
}

module.exports = rejectOperatorKeys;
