require('dotenv').config();
const app = require('./app');
const connectDB = require('./../config/db.js');

const PORT = process.env.PORT;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
  });
});