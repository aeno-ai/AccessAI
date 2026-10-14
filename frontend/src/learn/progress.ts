import { allLessons, coursePath, type LessonKind } from './lessons';
import type { Completion, Course, DailyGoal, Hearts } from './types';

/**
 * Everything about a learner's progress is worked out from their list of
 * finished lessons (completions) — nothing else is stored. So it works
 * offline, and a new phone rebuilds it from the copy on their account.
 */

// ---------------------------------------------------------------- XP and levels

export const XP = { lesson: 10, review: 5, perfect: 5, cameraPass: 3 } as const;
export const MAX_LESSON_XP = 30; // the server refuses more

/**
 * XP for a finished lesson: 10 (a review: 5), +5 if it had quiz questions
 * and none was wrong, +3 for each sign done right with the camera.
 */
export function lessonXp(kind: LessonKind, { mistakes, quizQuestions, cameraPassed }: { mistakes: number; quizQuestions: number; cameraPassed: number }): number {
  const base = kind === 'review' ? XP.review : XP.lesson;
  const perfect = quizQuestions > 0 && mistakes === 0 ? XP.perfect : 0;
  return Math.min(MAX_LESSON_XP, base + perfect + cameraPassed * XP.cameraPass);
}

/** XP needed to reach level L: 25·(L−1)·L — level 2 at 50, 3 at 150, 5 at 500, 10 at 2250. */
export const xpForLevel = (level: number) => 25 * (level - 1) * level;

export function levelOf(xp: number): { level: number; intoLevel: number; levelSize: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return { level, intoLevel: xp - xpForLevel(level), levelSize: xpForLevel(level + 1) - xpForLevel(level) };
}

// ---------------------------------------------------------------- days, streaks, the daily goal

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The day in the Philippines (UTC+8) as a number: days since 1970. */
export const manilaDay = (ms: number) => Math.floor((ms + MANILA_OFFSET_MS) / DAY_MS);

export const DAILY_GOALS: DailyGoal[] = [10, 20, 30, 50];
export const DEFAULT_DAILY_GOAL: DailyGoal = 20;

export const xpOn = (completions: Completion[], day: number) =>
  completions.reduce((sum, c) => (manilaDay(c.completedAt) === day ? sum + c.xp : sum), 0);

/**
 * Days in a row with at least one lesson. Today still counts as "kept" when
 * nothing's done yet today (the streak only breaks once a whole day passes).
 */
export function streakOf(completions: Completion[], now: number): { current: number; best: number; doneToday: boolean } {
  const days = [...new Set(completions.map((c) => manilaDay(c.completedAt)))].sort((a, b) => a - b);
  const today = manilaDay(now);
  const has = new Set(days);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i += 1) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  let current = 0;
  for (let day = has.has(today) ? today : today - 1; has.has(day); day -= 1) current += 1;
  return { current, best, doneToday: has.has(today) };
}

// ---------------------------------------------------------------- one course

export type LessonState = 'done' | 'open' | 'locked';

export type CourseProgress = {
  xp: number;
  level: number;
  intoLevel: number;
  levelSize: number;
  done: Set<string>;
  /** Each lesson opens once the one before it is done. */
  states: Map<string, LessonState>;
  /** The next lesson to do (null when the course is finished). */
  next: string | null;
  lessonsDone: number;
  lessonsTotal: number;
};

export function courseProgress(course: Course, completions: Completion[]): CourseProgress {
  const mine = completions.filter((c) => c.course === course);
  const xp = mine.reduce((sum, c) => sum + c.xp, 0);
  const done = new Set(mine.map((c) => c.lessonId));
  const states = new Map<string, LessonState>();
  let next: string | null = null;
  let previousDone = true;
  const lessons = allLessons(course);
  for (const lesson of lessons) {
    const state: LessonState = done.has(lesson.id) ? 'done' : previousDone ? 'open' : 'locked';
    if (state === 'open' && next === null) next = lesson.id;
    states.set(lesson.id, state);
    previousDone = state === 'done';
  }
  return {
    xp,
    ...levelOf(xp),
    done,
    states,
    next,
    lessonsDone: lessons.filter((lesson) => done.has(lesson.id)).length,
    lessonsTotal: lessons.length,
  };
}

// ---------------------------------------------------------------- hearts

export const MAX_HEARTS = 5;
export const HEART_EVERY_MS = 30 * 60 * 1000;

/** Hearts right now, with the ones that came back since; and when the next one comes. */
export function heartsNow(hearts: Hearts, now: number): { hearts: Hearts; nextInMs: number | null } {
  if (hearts.count >= MAX_HEARTS) return { hearts: { count: MAX_HEARTS, updatedAt: now }, nextInMs: null };
  const back = Math.floor(Math.max(0, now - hearts.updatedAt) / HEART_EVERY_MS);
  const count = Math.min(MAX_HEARTS, hearts.count + back);
  if (count >= MAX_HEARTS) return { hearts: { count: MAX_HEARTS, updatedAt: now }, nextInMs: null };
  const updatedAt = hearts.updatedAt + back * HEART_EVERY_MS;
  return { hearts: { count, updatedAt }, nextInMs: updatedAt + HEART_EVERY_MS - now };
}

/** A wrong quiz answer. (The 30-minute clock starts when the first heart goes.) */
export function loseHeart(hearts: Hearts, now: number): Hearts {
  const { hearts: current } = heartsNow(hearts, now);
  if (current.count <= 0) return current;
  return { count: current.count - 1, updatedAt: current.count >= MAX_HEARTS ? now : current.updatedAt };
}

export const fullHearts = (now: number): Hearts => ({ count: MAX_HEARTS, updatedAt: now });

// ---------------------------------------------------------------- badges

export type BadgeId =
  | 'first-lesson'
  | 'first-camera'
  | 'streak-3'
  | 'streak-7'
  | 'streak-30'
  | 'perfect'
  | 'unit'
  | 'course'
  | 'level-5'
  | 'level-10';

export const BADGES: { id: BadgeId; title: string; description: string; icon: string }[] = [
  { id: 'first-lesson', title: 'First lesson', description: 'Finish your first lesson.', icon: 'flag-outline' },
  { id: 'first-camera', title: 'First sign', description: 'Make a sign right in front of the camera.', icon: 'videocam-outline' },
  { id: 'perfect', title: 'Perfect', description: 'Finish a lesson with no wrong answers.', icon: 'star-outline' },
  { id: 'streak-3', title: '3 days in a row', description: 'Learn 3 days in a row.', icon: 'flame-outline' },
  { id: 'streak-7', title: '7 days in a row', description: 'Learn 7 days in a row.', icon: 'flame' },
  { id: 'streak-30', title: '30 days in a row', description: 'Learn 30 days in a row.', icon: 'bonfire-outline' },
  { id: 'unit', title: 'Unit done', description: 'Finish every lesson and the review of a unit.', icon: 'ribbon-outline' },
  { id: 'course', title: 'Course done', description: 'Finish a whole course.', icon: 'trophy-outline' },
  { id: 'level-5', title: 'Level 5', description: 'Reach level 5 in a course.', icon: 'trending-up-outline' },
  { id: 'level-10', title: 'Level 10', description: 'Reach level 10 in a course.', icon: 'rocket-outline' },
];

/** The badges earned so far (in either course). */
export function earnedBadges(completions: Completion[], now: number): Set<BadgeId> {
  const earned = new Set<BadgeId>();
  if (completions.length) earned.add('first-lesson');
  if (completions.some((c) => c.cameraPassed > 0)) earned.add('first-camera');
  // A perfect lesson needs quiz questions answered; "no mistakes" alone isn't
  // enough (a lesson can be all camera), so it only counts with the bonus XP.
  if (completions.some((c) => c.mistakes === 0 && c.xp - c.cameraPassed * XP.cameraPass >= (c.lessonId.endsWith('-review') ? XP.review : XP.lesson) + XP.perfect)) {
    earned.add('perfect');
  }
  const { best } = streakOf(completions, now);
  if (best >= 3) earned.add('streak-3');
  if (best >= 7) earned.add('streak-7');
  if (best >= 30) earned.add('streak-30');
  for (const course of ['fsl', 'asl'] as const) {
    const progress = courseProgress(course, completions);
    const units = coursePath(course);
    if (units.some((unit) => unit.lessons.every((lesson) => progress.done.has(lesson.id)))) earned.add('unit');
    if (progress.lessonsDone === progress.lessonsTotal) earned.add('course');
    if (progress.level >= 5) earned.add('level-5');
    if (progress.level >= 10) earned.add('level-10');
  }
  return earned;
}
