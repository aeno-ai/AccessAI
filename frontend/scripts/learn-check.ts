// Checks Learn's engine (src/learn/) without a phone:
//   npx tsx scripts/learn-check.ts
// The content uses only words the sign reader knows and has every sign's
// steps and clip name; the locked levels keep the course's length; lessons
// come out the same every time; unlocking lessons (Learn keeps no score —
// HANDOFF.md §38) and the camera pass rule; every clip recorded and small.
/// <reference types="node" />
import './learn-check-assets';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { COURSES, LOCKED } from '../src/learn/content';
import { allLessons, buildExercises, canDo, coursePath, findLesson, lessonPlan, type Abilities } from '../src/learn/lessons';
import * as progressModule from '../src/learn/progress';
import { courseProgress } from '../src/learn/progress';
import { normalizeLabel, signMatches } from '../src/learn/signMatch';
import type { Completion, Course, Sign } from '../src/learn/types';

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ''}`);
  }
}

const COURSE_LIST: Course[] = ['fsl', 'asl'];
const ALL: Abilities = { video: true, camera: true, describe: false };
// The course's length before Learn was cut down for the defense (lessons + reviews).
const FULL_LENGTH: Record<Course, number> = { fsl: 40, asl: 37 };

console.log('content — only words the sign reader knows, each with its steps and clip');
for (const course of COURSE_LIST) {
  const name = course.toUpperCase();
  const labelsFile = join(__dirname, '..', '..', 'ai', 'models', 'sign', course, 'words', 'labels.json');
  const known = new Set(Object.values(JSON.parse(readFileSync(labelsFile, 'utf8')) as Record<string, string>));
  const signs = COURSES[course].flatMap((unit) => unit.signs);
  const unknown = signs.filter((sign) => !known.has(sign.label)).map((sign) => sign.label);
  check(`${name}: every label is a word the sign reader learned (${known.size} known)`, unknown.length === 0, unknown);
  check(`${name}: each sign once`, new Set(signs.map((sign) => sign.label)).size === signs.length);
  check(`${name}: 12 signs, so 12 clips to record`, signs.length === 12, signs.length);
  check(`${name}: every sign has steps`, signs.every((sign) => sign.steps.length > 0 && sign.steps.every((step) => step.trim() !== '')));
  const naming = signs.filter((sign) => {
    const word = sign.display.toLowerCase().replace(/[^a-z' ]/g, '').trim();
    return sign.steps.some((step) => new RegExp(`\\b${word}\\b`).test(step.toLowerCase()));
  });
  check(`${name}: no step says the word (a quiz reads them out)`, naming.length === 0, naming.map((sign) => sign.label));
  const clips = signs.map((sign) => sign.clip);
  check(`${name}: clip names are unique, lowercase-with-hyphens`, new Set(clips).size === clips.length && clips.every((clip) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(clip)), clips);
  const clipPath = (clip: string) => join(__dirname, '..', 'assets', 'signs', course, `${clip}.mp4`);
  const noFile = clips.filter((clip) => !existsSync(clipPath(clip)));
  check(`${name}: assets/signs/${course}/ has a file for every clip`, noFile.length === 0, noFile);
  // HANDOFF.md §30: recorded (not the 0-byte placeholder), and at most 10 MB.
  const sizes = clips.filter((clip) => existsSync(clipPath(clip))).map((clip) => ({ clip, mb: statSync(clipPath(clip)).size / 1048576 }));
  const notRecorded = sizes.filter((entry) => entry.mb * 1048576 <= 1024).map((entry) => entry.clip);
  check(`${name}: every clip is recorded`, notRecorded.length === 0, notRecorded);
  const tooBig = sizes.filter((entry) => entry.mb > 10).map((entry) => `${entry.clip} ${entry.mb.toFixed(1)} MB`);
  check(`${name}: every clip is 10 MB or less`, tooBig.length === 0, tooBig);

  const real = allLessons(course).length;
  const locked = LOCKED[course].reduce((sum, unit) => sum + unit.levels.length, 0);
  check(`${name}: 4 real levels (3 lessons and a review)`, real === 4, real);
  check(`${name}: ${real} real + ${locked} locked = the course's full ${FULL_LENGTH[course]} levels`, real + locked === FULL_LENGTH[course], real + locked);
  check(`${name}: locked levels hold only a title and an icon`, LOCKED[course].every((unit) => unit.levels.every((level) => JSON.stringify(Object.keys(level).sort()) === '["icon","title"]')));
}
check("FSL's curly-apostrophe labels are kept exactly", COURSES.fsl.some((u) => u.signs.some((s) => s.label === 'DON’T KNOW')));

console.log('\nlessons — the same every time, and sensible');
for (const course of COURSE_LIST) {
  const lessons = allLessons(course);
  const units = coursePath(course);
  check(`${course.toUpperCase()}: ${units.length} unit, ${lessons.length} levels, each unit ends with a review`, units.every((u) => u.lessons[u.lessons.length - 1].kind === 'review'));
  check(`${course.toUpperCase()}: lesson ids are unique and match the server's rule`, new Set(lessons.map((l) => l.id)).size === lessons.length && lessons.every((l) => /^(fsl|asl)-[a-z0-9-]+$/.test(l.id) && l.id.length <= 80));
  check(`${course.toUpperCase()}: lessons teach at most 4 new signs`, lessons.every((l) => l.kind === 'review' || (l.signs.length >= 1 && l.signs.length <= 4)));
  const twice = lessons.every((l) => JSON.stringify(lessonPlan(l)) === JSON.stringify(lessonPlan(l)));
  check(`${course.toUpperCase()}: building a lesson twice gives the same exercises`, twice);
  const sound = lessons.every((lesson) =>
    lessonPlan(lesson).every((e) => {
      if (e.kind === 'watch-pick' || e.kind === 'read-pick') {
        const labels = e.options.map((o) => o.label);
        return labels.includes(e.sign.label) && new Set(labels).size === labels.length;
      }
      if (e.kind === 'match') return e.pairs.length >= 3 && new Set(e.pairs.map((p) => p.label)).size === e.pairs.length;
      return true;
    }),
  );
  check(`${course.toUpperCase()}: every question has the right answer among its choices, no repeats`, sound);
}
const first = findLesson('fsl-first-signs-1');
check('a lesson starts with its new signs, then ~8 mixed exercises, a match last', Boolean(first) && (() => {
  const plan = lessonPlan(first!);
  return plan.slice(0, 4).every((e) => e.kind === 'intro') && plan.length >= 10 && plan[plan.length - 1].kind === 'match';
})(), first && lessonPlan(first).map((e) => e.kind));
check('a review has no intro cards', lessonPlan(findLesson('asl-first-signs-review')!).every((e) => e.kind !== 'intro'));
check('the old 205-sign lessons are gone', findLesson('fsl-greetings-1') === null && findLesson('asl-basics-1') === null);
const lesson = findLesson('asl-first-signs-1')!;
const offline = buildExercises(lesson, { video: false, camera: false, describe: false });
check('no clips, no camera: only the intro cards are left (they show the steps)', offline.every((e) => e.kind === 'intro') && offline.length === lesson.signs.length, offline.map((e) => e.kind));
const told = buildExercises(lesson, { ...ALL, describe: true });
check('told in words (screen reader or Blind profile): "what sign do these steps make" questions, nothing that needs seeing', told.some((e) => e.kind === 'watch-pick') && !told.some((e) => e.kind === 'read-pick' || e.kind === 'match'), told.map((e) => e.kind));
check('told in words: every watch-pick question has steps to read', told.filter((e) => e.kind === 'watch-pick').every((e) => e.kind === 'watch-pick' && e.sign.steps.length > 0));
// With clips (stand-ins here), and one without.
const withClip = (sign: Sign): Sign => ({ ...sign, video: 1 });
const noClip = (sign: Sign): Sign => ({ ...sign, video: null });
const [a, b, c] = lesson.signs.map(withClip);
check('with clips: picking the video and matching work', canDo({ kind: 'read-pick', sign: a, options: [a, b, c] }, ALL) && canDo({ kind: 'match', pairs: [a, b, c] }, ALL));
check('a missing clip: questions that need it are left out', !canDo({ kind: 'read-pick', sign: a, options: [a, b, noClip(c)] }, ALL) && !canDo({ kind: 'watch-pick', sign: noClip(a), options: [] }, ALL));
check('no camera: no "do the sign" exercises', !buildExercises(lesson, { ...ALL, camera: false }).some((e) => e.kind === 'do-sign'));

console.log('\nthe camera pass rule');
check('FSL: the best guess must be the sign', signMatches('fsl', 'MOTHER', [{ label: 'MOTHER' }, { label: 'FATHER' }]));
check('FSL: second best is not enough', !signMatches('fsl', 'MOTHER', [{ label: 'FATHER' }, { label: 'MOTHER' }]));
check('ASL: within the top 3 passes', signMatches('asl', 'help', [{ label: 'want' }, { label: 'need' }, { label: 'help' }]));
check('ASL: 4th does not', !signMatches('asl', 'help', [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'help' }]));
check("curly vs straight apostrophes and case don't matter", signMatches('fsl', 'DON’T KNOW', [{ label: "don't  know" }]) && normalizeLabel(' im fine ') === 'IM FINE');

console.log('\nunlocks — no score kept');
const NOW = Date.UTC(2026, 9, 12, 2, 0);
const done = (lessonId: string, extra: Partial<Completion> = {}): Completion => ({
  clientId: `${lessonId}-${Math.random()}`,
  course: 'fsl',
  lessonId,
  mistakes: 0,
  cameraPassed: 0,
  completedAt: NOW,
  ...extra,
});
let progress = courseProgress('fsl', []);
check('new learner: the first lesson is open, the second locked', progress.states.get('fsl-first-signs-1') === 'open' && progress.states.get('fsl-first-signs-2') === 'locked' && progress.next === 'fsl-first-signs-1');
progress = courseProgress('fsl', [done('fsl-first-signs-1')]);
check('finishing a lesson opens the next', progress.states.get('fsl-first-signs-2') === 'open' && progress.next === 'fsl-first-signs-2');
check('mistakes never hold a lesson back', courseProgress('fsl', [done('fsl-first-signs-1', { mistakes: 9 })]).next === 'fsl-first-signs-2');
check('a lesson finished before 2026-10-17 (with XP) still counts', courseProgress('fsl', [done('fsl-first-signs-1', { xp: 25 })]).lessonsDone === 1);
check('the other course keeps its own progress', courseProgress('asl', [done('fsl-first-signs-1')]).lessonsDone === 0);
const firstUnit = coursePath('fsl')[0].lessons.map((l) => done(l.id));
check('all real levels done: nothing left to open (the locked ones stay locked)', courseProgress('fsl', firstUnit).next === null);
const gone = ['lessonXp', 'levelOf', 'streakOf', 'heartsNow', 'loseHeart', 'BADGES', 'earnedBadges'].filter((name) => name in progressModule);
check('no XP, levels, streaks, hearts or badges left in Learn', gone.length === 0, gone);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
