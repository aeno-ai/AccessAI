const { validationResult } = require('express-validator');

// Drop this after a list of express-validator rule chains on any route.
// The rule chains themselves only check the request and record problems —
// this middleware is what actually stops the request and responds if any
// rule failed. Without it, the checks would run but nothing would act on
// the result.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map((err) => ({ field: err.path, message: err.msg })),
    });
  }
  next();
}

module.exports = validate;
