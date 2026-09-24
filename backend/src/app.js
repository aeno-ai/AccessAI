// DEFINING LANG YUNG NEED NG SERVER

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();

// Comma-separated list of allowed origins, e.g. "http://localhost:8081,https://example.com".
// Left unset, every origin is allowed — keeps local dev friction-free. Set it
// in production to actually restrict who can call this API from a browser.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : null;

const corsOptions = allowedOrigins
  ? {
      origin(origin, callback) {
        // Requests with no Origin header (native apps, curl, server-to-server) are always allowed —
        // CORS is a browser-enforced concept and doesn't apply to them anyway.
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
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
  res.status(404).json({ message: 'Not found' });
});

// ============= Centralized error handler ==============
// Every controller forwards caught errors here via next(error) instead of
// building its own response. The real error is logged server-side; the
// client only ever gets a generic message — never a stack trace or
// error.message, which could leak internal details (file paths, driver
// errors, query shapes, etc.) to whoever's calling the API.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: 'Something went wrong' });
});

module.exports = app;