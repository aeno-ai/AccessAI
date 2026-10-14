// Checks Learn's engine (src/learn/) without a phone:
//   npx tsx scripts/learn-check.ts
// The content uses only words the sign reader knows and has every sign's
// steps and clip name; the locked levels keep the course's length; lessons
// come out the same every time; the XP / level / streak / hearts maths (on a
// fake clock) and the camera pass rule.
/// <reference types="node" />
import './learn-check-assets';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COURSES, LOCKED } from '../src/learn/content';
import { allLessons, buildExercises, canDo, coursePath, findLesson, lessonPlan, type Abilities } from '../src/learn/lessons';
import {
  courseProgress,
  earnedBadges,
  fullHearts,
  heartsNow,
  HEART_EVERY_MS,
  lessonXp,
  levelOf,
  loseHeart,
  manilaDay,
  streakOf,
  xpForLevel,
  xpOn,
} from '../src/learn/progress';
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
  const noFile = clips.filter((clip) => !existsSync(join(__dirname, '..', 'assets', 'signs', course, `${clip}.mp4`)));
  check(`${name}: assets/signs/${course}/ has a file (or its placeholder) for every clip`, noFile.length === 0, noFile);

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
// With clips (stand-ins here — not recorded yet).
const withClip = (sign: Sign): Sign => ({ ...sign, video: 1 });
const [a, b, c] = lesson.signs.map(withClip);
check('with clips: picking the video and matching work', canDo({ kind: 'read-pick', sign: a, options: [a, b, c] }, ALL) && canDo({ kind: 'match', pairs: [a, b, c] }, ALL));
check('a missing clip: questions that need it are left out', !canDo({ kind: 'read-pick', sign: a, options: [a, b, lesson.signs[2]] }, ALL) && !canDo({ kind: 'watch-pick', sign: lesson.signs[0], options: [] }, ALL));
check('no camera: no "do the sign" exercises', !buildExercises(lesson, { ...ALL, camera: false }).some((e) => e.kind === 'do-sign'));

console.log('\nthe camera pass rule');
check('FSL: the best guess must be the sign', signMatches('fsl', 'MOTHER', [{ label: 'MOTHER' }, { label: 'FATHER' }]));
check('FSL: second best is not enough', !signMatches('fsl', 'MOTHER', [{ label: 'FATHER' }, { label: 'MOTHER' }]));
check('ASL: within the top 3 passes', signMatches('asl', 'help', [{ label: 'want' }, { label: 'need' }, { label: 'help' }]));
check('ASL: 4th does not', !signMatches('asl', 'help', [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'help' }]));
check("curly vs straight apostrophes and case don't matter", signMatches('fsl', 'DON’T KNOW', [{ label: "don't  know" }]) && normalizeLabel(' im fine ') === 'IM FINE');

console.log('\nXP, levels, streaks, the daily goal');
check('lesson 10 XP, perfect +5, each camera sign +3', lessonXp('lesson', { mistakes: 0, quizQuestions: 6, cameraPassed: 2 }) === 21);
check('a review is 5 XP; no quiz → no perfect bonus', lessonXp('review', { mistakes: 0, quizQuestions: 0, cameraPassed: 0 }) === 5);
check('a mistake loses the perfect bonus', lessonXp('lesson', { mistakes: 1, quizQuestions: 6, cameraPassed: 0 }) === 10);
check('never more than 30 XP', lessonXp('lesson', { mistakes: 0, quizQuestions: 6, cameraPassed: 10 }) === 30);
check('levels at 50, 150, 500 and 2250 XP', xpForLevel(2) === 50 && xpForLevel(3) === 150 && xpForLevel(5) === 500 && xpForLevel(10) === 2250);
check('49 XP is level 1, 50 is level 2 (0 into it, 100 to go)', levelOf(49).level === 1 && JSON.stringify(levelOf(50)) === JSON.stringify({ level: 2, intoLevel: 0, levelSize: 100 }));

// Monday 12 Oct 2026, 10:00 in Manila.
const NOW = Date.UTC(2026, 9, 12, 2, 0);
const DAY = 86400000;
const done = (daysAgo: number, xp = 10, extra: Partial<Completion> = {}): Completion => ({
  clientId: `c${daysAgo}-${xp}-${Math.random()}`,
  course: 'fsl',
  lessonId: 'fsl-first-signs-1',
  xp,
  mistakes: 0,
  cameraPassed: 0,
  completedAt: NOW - daysAgo * DAY,
  ...extra,
});
check('Manila days: 11:59 pm and 12:01 am are different days', manilaDay(Date.UTC(2026, 9, 11, 15, 59)) + 1 === manilaDay(Date.UTC(2026, 9, 11, 16, 1)));
let s = streakOf([done(0), done(1), done(2), done(4)], NOW);
check('3 days in a row up to today → streak 3 (best 3)', s.current === 3 && s.best === 3 && s.doneToday, s);
s = streakOf([done(1), done(2)], NOW);
check("nothing yet today: yesterday's streak still counts", s.current === 2 && !s.doneToday, s);
s = streakOf([done(2), done(3)], NOW);
check('a whole day missed: the streak is 0', s.current === 0 && s.best === 2, s);
check("today's XP for the daily goal", xpOn([done(0, 15), done(0, 10), done(1, 30)], manilaDay(NOW)) === 25);

console.log('\nhearts');
let hearts = fullHearts(NOW);
hearts = loseHeart(hearts, NOW);
check('a wrong answer: 5 → 4, and the 30-minute clock starts', hearts.count === 4 && heartsNow(hearts, NOW).nextInMs === HEART_EVERY_MS);
hearts = loseHeart(loseHeart(loseHeart(loseHeart(hearts, NOW), NOW), NOW), NOW);
check('down to 0, and never below', hearts.count === 0 && loseHeart(hearts, NOW).count === 0);
check('one back after 30 minutes', heartsNow(hearts, NOW + HEART_EVERY_MS).hearts.count === 1);
check('all 5 back after 2.5 hours, and no more', heartsNow(hearts, NOW + 10 * HEART_EVERY_MS).hearts.count === 5 && heartsNow(hearts, NOW + 10 * HEART_EVERY_MS).nextInMs === null);
const partly = heartsNow(hearts, NOW + HEART_EVERY_MS + 60000);
check('the clock carries over (next heart 29 min after the last one came)', partly.nextInMs === HEART_EVERY_MS - 60000, partly);

console.log('\nunlocks and badges');
let progress = courseProgress('fsl', []);
check('new learner: the first lesson is open, the second locked', progress.states.get('fsl-first-signs-1') === 'open' && progress.states.get('fsl-first-signs-2') === 'locked' && progress.next === 'fsl-first-signs-1');
progress = courseProgress('fsl', [done(0, 10, { lessonId: 'fsl-first-signs-1' })]);
check('finishing a lesson opens the next', progress.states.get('fsl-first-signs-2') === 'open' && progress.next === 'fsl-first-signs-2' && progress.xp === 10);
check('the other course keeps its own progress', courseProgress('asl', [done(0)]).lessonsDone === 0);
const firstUnit = coursePath('fsl')[0].lessons.map((l, i) => done(0, 10, { lessonId: l.id, clientId: `g${i}` }));
check('all real levels done: nothing left to open (the locked ones stay locked)', courseProgress('fsl', firstUnit).next === null);
let badges = earnedBadges([...firstUnit, done(1), done(2, 21, { cameraPassed: 2, mistakes: 0 })], NOW);
check('badges: first lesson, a unit done, 3 days in a row, first camera sign, perfect', ['first-lesson', 'unit', 'streak-3', 'first-camera', 'perfect'].every((b) => badges.has(b as never)), [...badges]);
badges = earnedBadges([done(0, 10, { mistakes: 0 })], NOW);
check('"perfect" needs quiz questions answered (no bonus XP → no badge)', !badges.has('perfect'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
