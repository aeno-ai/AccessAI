const { body } = require('express-validator');

// What the app shows when a request is wrong in a way the person can't fix
// by retyping something — a bad id, a missing internal field, a value of
// the wrong type. Those only happen with a buggy or tampered client, so the
// message stays plain and says nothing about how the API works inside.
// Problems a person CAN fix (their email, password, name, phone number)
// keep their own specific messages in each validator file.
const GENERIC = "Something's not right with that request. Please try again.";

// JSON true/false only — not "true", 1, or [true].
const strictBoolean = (field, message = GENERIC) =>
  body(field)
    .custom((value) => typeof value === 'boolean')
    .withMessage(message);

// A JSON number in range — not "12", [12] or {"$gt": 0}. (express-validator
// runs its built-in checks like isFloat on every item of an array, so an
// array of good numbers would otherwise pass.)
const numberInRange = (field, min, max, message = GENERIC) =>
  body(field)
    .custom((value) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max)
    .withMessage(message);

module.exports = { GENERIC, strictBoolean, numberInRange };
