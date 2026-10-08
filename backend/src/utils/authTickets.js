const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Tickets are short-lived signed notes the server passes itself during
// Google sign-in, through the browser or the app. The `typ` claim says what
// each one is for, and verifyTicket only accepts the type asked for.
//
// They're signed with a key derived from JWT_SECRET instead of JWT_SECRET
// itself, so a ticket can never be passed off as a login token to protect().
let ticketKey = null;
const getTicketKey = () => {
  if (!ticketKey) {
    ticketKey = crypto.createHmac('sha256', process.env.JWT_SECRET).update('accessai-auth-ticket').digest();
  }
  return ticketKey;
};

const signTicket = (type, payload, expiresIn) =>
  jwt.sign({ ...payload, typ: type }, getTicketKey(), { expiresIn });

// The ticket's payload, or null if it's forged, expired, or a different type.
const verifyTicket = (ticket, type) => {
  if (typeof ticket !== 'string') return null;
  try {
    const payload = jwt.verify(ticket, getTicketKey(), { algorithms: ['HS256'] });
    return payload.typ === type ? payload : null;
  } catch {
    return null;
  }
};

module.exports = { signTicket, verifyTicket };
