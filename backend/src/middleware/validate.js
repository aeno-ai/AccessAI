const { validationResult } = require('express-validator');
const { GENERIC } = require('../validators/common');

// Drop this after a list of express-validator rule chains on any route.
// The rule chains themselves only check the request and record problems —
// this middleware is what actually stops the request and responds if any
// rule failed. Without it, the checks would run but nothing would act on
// the result.
//
// Only ONE plain message goes back (the first problem found) — no list of
// fields, paths or rule names. The apps show it as-is, so it has to read
// like a sentence to a person, not like a report to a developer.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array({ onlyFirstError: true })[0]?.msg;
    // "Invalid value" is express-validator's default when a rule has no
    // message of its own.
    const message = typeof first === 'string' && first && first !== 'Invalid value' ? first : GENERIC;
    return res.status(400).json({ message });
  }
  next();
}

module.exports = validate;
