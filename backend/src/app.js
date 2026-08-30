// DEFINING LANG YUNG NEED NG SERVER

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

app.use(helmet());          // secure headers — from your security-layer discussion, baked in from line one
app.use(cors());            // controls which origins can call this API
app.use(express.json());    // lets Express read JSON request bodies

// ROUTES
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/hi', (req, res) => {
  res.json({ status: 'HIIIIIIIIIIIIIII' }); // test ( easter egg ) route to see if the server is running
});

module.exports = app;