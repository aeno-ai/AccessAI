// Makes the database's indexes match the models: builds the ones the
// schemas declare and DROPS the ones they no longer do (Mongoose only ever
// adds indexes on its own, never removes old ones). HANDOFF §19.
//
//   node scripts/syncIndexes.js           show what would change
//   node scripts/syncIndexes.js --apply   change it
//
// Safe to run again: with nothing to change it does nothing. Building an
// index on a big collection takes a while but doesn't block reads/writes.
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');

const MODELS_DIR = path.join(__dirname, '..', 'src', 'models');

(async () => {
  const apply = process.argv.includes('--apply');
  for (const file of fs.readdirSync(MODELS_DIR)) {
    if (file.endsWith('.js')) require(path.join(MODELS_DIR, file));
  }

  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    for (const name of mongoose.modelNames().sort()) {
      const model = mongoose.model(name);
      const { toDrop, toCreate } = await model.diffIndexes();
      const adding = toCreate.map((spec) => JSON.stringify(spec.key ?? spec));
      if (!toDrop.length && !adding.length) {
        console.log(`${name}: up to date`);
        continue;
      }
      console.log(`${name}:`);
      for (const index of toDrop) console.log(`  - drop  ${index}`);
      for (const index of adding) console.log(`  + build ${index}`);
      if (apply) {
        const dropped = await model.syncIndexes();
        console.log(`  done${dropped.length ? ` (dropped ${dropped.join(', ')})` : ''}`);
      }
    }
    if (!apply) console.log('\nNothing changed. Run with --apply to change it.');
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
