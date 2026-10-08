// DEFINING LANG YUNG NEED NG SERVER

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const { generalLimiter } = require('./middleware/rateLimiter');
const rejectOperatorKeys = require('./middleware/rejectOperatorKeys');
const { GENERIC } = require('./validators/common');

const app = express();

// Comma-separated list of allowed origins, e.g. "http://localhost:8081,https://example.com".
// Left unset, every origin is allowed — keeps local dev friction-free. Set it
// in production to actually restrict who can call this API from a browser.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : null;

// The live socket (realtime/io.js) uses the same allow-list.
app.locals.allowedOrigins = allowedOrigins;

const corsOptions = allowedOrigins
  ? {
      origin(origin, callback) {
        // Requests with no Origin header (native apps, curl, server-to-server) are always allowed —
        // CORS is a browser-enforced concept and doesn't apply to them anyway.
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(Object.assign(new Error('Not allowed by CORS'), { status: 403, code: 'CORS' }));
      },
      // Lets an allow-listed admin site on a different origin send its
      // session cookie. Only meaningful alongside the allow-list above —
      // browsers refuse credentials when every origin is allowed.
      credentials: true,
    }
  : undefined;

app.use(helmet());              // secure headers — from your security-layer discussion, baked in from line one
app.use(cors(corsOptions));     // controls which origins can call this API
app.use(generalLimiter);        // baseline anti-abuse limit on every route
app.use(express.json());        // lets Express read JSON request bodies
app.use(rejectOperatorKeys);    // no "$..." / dotted keys in bodies or URL params (NoSQL injection)
app.use(cookieParser());        // reads the admin panel's session cookie into req.cookies

// ROUTES

// ============== Auth Routes ==============
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// ============= Health Routes ==============
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Easter egg route to see if the server is running
app.get('/hi', (req, res) => {
  res.json({ status: 'HIIIIIIIIIIIIIII' }); // test ( easter egg ) route to see if the server is running
});
// ============= Contact Routes ==============
const contactRoutes = require('./routes/contactRoutes');
app.use('/api/contacts', contactRoutes);

// ============= SOS Routes ==============
const sosRoutes = require('./routes/sosRoutes');
app.use('/api/sos', sosRoutes);

// ============= Conversation Sync Routes ==============
const conversationRoutes = require('./routes/conversationRoutes');
app.use('/api/conversations', conversationRoutes);

// ============= Friends & Online Chat Routes ==============
// Friends connect by friend code; chats between them are pushed live over
// the socket in realtime/io.js.
const friendRoutes = require('./routes/friendRoutes');
const directMessageRoutes = require('./routes/directMessageRoutes');
app.use('/api/friends', friendRoutes);
app.use('/api/messages', directMessageRoutes);

// ============= Push notifications ==============
// Each phone registers its Expo push address here, so friends' SOS alerts
// and messages reach it even when AccessAI is closed (utils/push.js).
const pushRoutes = require('./routes/pushRoutes');
app.use('/api/push', pushRoutes);

// ============= AI: Accel voice assistant & sign language ==============
// Thin, authenticated doors to the Python AI service (ai/ folder, started by
// `npm run dev`). If that service isn't running, these answer 503 and the
// app falls back to what works on the phone.
const assistantRoutes = require('./routes/assistantRoutes');
const signRoutes = require('./routes/signRoutes');
app.use('/api/assistant', assistantRoutes);
app.use('/api/sign', signRoutes);

// ============= Admin Panel Routes (web only) ==============
// Separate login, separate token secret, cookie-based session — see
// middleware/adminAuthMiddleware.js. Mobile-app tokens don't work here, and
// admin sessions don't work on the mobile routes above.
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const adminAccountRoutes = require('./routes/adminAccountRoutes');
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/admins', adminAccountRoutes);

// ============= 404 ==============
app.use((req, res) => {
  res.status(404).json({ message: "That isn't available." });
});

// ============= Centralized error handler ==============
// Every controller forwards caught errors here via next(error) instead of
// building its own response. The real error is logged server-side; the
// client only ever gets one plain sentence — never a stack trace or
// error.message, which could leak internal details (file paths, driver
// errors, query shapes, etc.) to whoever's calling the API. Always JSON,
// so no HTML error page can reach the app.
function friendlyError(err) {
  if (err.type === 'entity.parse.failed') return [400, "That request wasn't valid."]; // malformed JSON
  if (err.type === 'entity.too.large') return [413, "That's too long."];
  if (err.code === 'CORS') return [403, "This site isn't allowed to use AccessAI."];
  // Bad ids or values that slipped past validation and reached the database.
  if (['CastError', 'ValidationError', 'StrictModeError'].includes(err.name)) return [400, GENERIC];
  if (err.code === 11000) return [409, 'That already exists.'];
  const status = Number(err.status || err.statusCode);
  if (status >= 400 && status < 500) return [status, GENERIC];
  return [500, 'Something went wrong on our side. Please try again.'];
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);
  const [status, message] = friendlyError(err);
  res.status(status).json({ message });
});

module.exports = app;