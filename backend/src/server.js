require('dotenv').config();
const app = require('./app');
const connectDB = require('./../config/db.js');

const PORT = process.env.PORT;

// Admin sessions are signed with their own secret so a mobile-app token can
// never pass as an admin session. Refuse to start without one (or with one
// that's just a copy of JWT_SECRET) rather than fail on the first admin
// login.
if (!process.env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET === process.env.JWT_SECRET) {
  console.error('ADMIN_JWT_SECRET must be set in backend/.env and must differ from JWT_SECRET');
  process.exit(1);
}

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
  });
});