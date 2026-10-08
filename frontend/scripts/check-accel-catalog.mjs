// Checks that the app's list of Accel actions (src/accel/catalog.ts) and the
// AI service's list (../ai/intents.json) have exactly the same ids.
//   node scripts/check-accel-catalog.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ai = JSON.parse(readFileSync(join(here, '..', '..', 'ai', 'intents.json'), 'utf8'));
const aiIds = new Set(ai.intents.map((intent) => intent.id));

const catalog = readFileSync(join(here, '..', 'src', 'accel', 'catalog.ts'), 'utf8');
const body = catalog.slice(catalog.indexOf('export const INTENTS'), catalog.indexOf('satisfies Record'));
const appIds = new Set([...body.matchAll(/^ {2}'?([a-z_]+(?:\.[a-z_]+)?)'?: \{/gm)].map((match) => match[1]));

const missingInApp = [...aiIds].filter((id) => !appIds.has(id));
const missingInAi = [...appIds].filter((id) => !aiIds.has(id));
if (missingInApp.length || missingInAi.length) {
  if (missingInApp.length) console.log('In ai/intents.json but not in the app:', missingInApp.join(', '));
  if (missingInAi.length) console.log('In the app but not in ai/intents.json:', missingInAi.join(', '));
  process.exit(1);
}
console.log(`OK — ${appIds.size} Accel actions, same ids in the app and the AI service.`);
