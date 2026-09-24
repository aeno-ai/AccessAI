// Creates a super admin for the web admin panel — the ONLY way to get the
// first admin account, since the panel has no public sign-up.
//
// Run from the backend/ folder:
//   npm run create-admin -- --email you@example.com --name "Your Name"
//
// Locked out (forgot password, account locked or disabled)? Reset it:
//   npm run create-admin -- --email you@example.com --reset
//
// Either way, a random temporary password is generated and printed once.
// You'll be made to replace it the first time you log in to the panel, so
// no real password is ever typed into (or saved in) the terminal.
require('dotenv').config();
const crypto = require('crypto');
const { parseArgs } = require('util');
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same rules as validators/authValidators.js strongPassword(): 8+ chars,
// an uppercase letter and a number. 16 random base64url characters almost
// always qualify already; regenerate in the rare case one doesn't.
function generateTemporaryPassword() {
  let password;
  do {
    password = crypto.randomBytes(12).toString('base64url');
  } while (!/[A-Z]/.test(password) || !/\d/.test(password));
  return password;
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      reset: { type: 'boolean', default: false },
    },
  });

  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();

  if (!email || !EMAIL_REGEX.test(email)) {
    fail('Usage: npm run create-admin -- --email you@example.com --name "Your Name" [--reset]');
  }
  if (!values.reset && !name) {
    fail('--name is required when creating a new admin.');
  }
  if (!process.env.MONGO_URI) {
    fail('MONGO_URI is not set. Run this from the backend/ folder so backend/.env is picked up.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await Admin.hashPassword(temporaryPassword);
  const existing = await Admin.findOne({ email });

  if (values.reset) {
    if (!existing) fail(`No admin with email ${email} exists.`);

    existing.password = passwordHash;
    existing.mustChangePassword = true;
    existing.isActive = true;
    existing.failedLoginAttempts = 0;
    existing.lockUntil = undefined;
    existing.tokenVersion += 1;
    await existing.save();
    console.log(`\nReset password for ${existing.email} (${existing.role}).`);
  } else {
    if (existing) fail(`An admin with email ${email} already exists. Use --reset to reset their password.`);

    await Admin.create({
      email,
      name,
      role: 'super_admin',
      password: passwordHash,
      mustChangePassword: true,
    });
    console.log(`\nCreated super admin ${email}.`);
  }

  console.log(`Temporary password: ${temporaryPassword}`);
  console.log("You'll be asked to change it the first time you log in to the admin panel.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
