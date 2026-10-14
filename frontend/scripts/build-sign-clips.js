// Finds Learn's recorded sign clips and lists them for the app:
//   assets/signs/fsl/*.mp4, assets/signs/asl/*.mp4  →  src/learn/clips.ts
//
// It runs by itself whenever the app's bundler starts (metro.config.js), so a
// new clip only needs `npx expo start -c`. By hand: `npm run clips`.
//
// The app can only bundle files it names in the code ahead of time (a fixed
// require() for each), which is why this list is written out. Files of 1 KB
// or less are the empty placeholders waiting for a recording: they're left
// out, and the app shows "Clip coming soon" for them.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIGNS = path.join(ROOT, 'assets', 'signs');
const OUT = path.join(ROOT, 'src', 'learn', 'clips.ts');
const COURSES = ['fsl', 'asl'];
// In order of preference when the same name is there twice.
const EXTENSIONS = ['.mp4', '.m4v', '.mov'];
const PLACEHOLDER_MAX_BYTES = 1024;

function clipsOf(course) {
  const folder = path.join(SIGNS, course);
  if (!fs.existsSync(folder)) return [];
  const byName = new Map();
  for (const file of fs.readdirSync(folder).sort()) {
    const ext = path.extname(file).toLowerCase();
    if (!EXTENSIONS.includes(ext)) continue;
    if (fs.statSync(path.join(folder, file)).size <= PLACEHOLDER_MAX_BYTES) continue;
    const name = path.basename(file, path.extname(file)).toLowerCase();
    const current = byName.get(name);
    if (!current || EXTENSIONS.indexOf(ext) < EXTENSIONS.indexOf(path.extname(current).toLowerCase())) {
      byName.set(name, file);
    }
  }
  return [...byName.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function render() {
  const lines = [
    '// Made by scripts/build-sign-clips.js from the clip files in assets/signs/.',
    "// It runs by itself whenever the app's bundler starts — don't edit this file;",
    '// add or replace the clips instead.',
    "import type { Course } from './types';",
    '',
    '/** Recorded clips by course and file name (without ".mp4"). A missing one isn\'t recorded yet. */',
    'export const CLIPS: Record<Course, Record<string, number>> = {',
  ];
  for (const course of COURSES) {
    const clips = clipsOf(course);
    if (!clips.length) {
      lines.push(`  ${course}: {},`);
      continue;
    }
    lines.push(`  ${course}: {`);
    for (const [name, file] of clips) {
      lines.push(`    ${JSON.stringify(name)}: require(${JSON.stringify(`../../assets/signs/${course}/${file}`)}),`);
    }
    lines.push('  },');
  }
  lines.push('};', '');
  return lines.join('\n');
}

/** Writes src/learn/clips.ts if the clips changed. Returns how many clips each course has. */
function buildSignClips() {
  const text = render();
  const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (before !== text) fs.writeFileSync(OUT, text);
  return Object.fromEntries(COURSES.map((course) => [course, clipsOf(course).length]));
}

module.exports = { buildSignClips };

if (require.main === module) {
  const counts = buildSignClips();
  console.log(`Sign clips: ${COURSES.map((course) => `${course.toUpperCase()} ${counts[course]}`).join(', ')} → src/learn/clips.ts`);
}
