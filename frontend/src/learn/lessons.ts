import { CLIPS } from './clips';
import { COURSES } from './content';
import type { Course, Sign, Unit } from './types';

/**
 * The course path and the exercises in each lesson. Everything here is
 * worked out from the content alone, the same way every time (a lesson's
 * exercises are "shuffled" with its own id as the seed), so it works offline
 * and every phone builds the same lessons.
 *
 * A unit's signs come 4 at a time, one lesson each; a review of the whole
 * unit comes at the end.
 */
export const NEW_SIGNS_PER_LESSON = 4;

export type LessonKind = 'lesson' | 'review';

export type Lesson = {
  /** e.g. "fsl-greetings-1", "fsl-greetings-review" — saved with each completion. */
  id: string;
  course: Course;
  unitId: string;
  unitTitle: string;
  kind: LessonKind;
  /** 1, 2, 3… within the unit (the review is last). */
  number: number;
  title: string;
  /** New signs (a lesson) or the whole unit (a review). */
  signs: Sign[];
};

export type PathUnit = Unit & { number: number; lessons: Lesson[] };

const unitsCache = new Map<Course, Unit[]>();

/** The course's units from content.ts, each sign with its recorded clip (or null, not recorded yet). */
export function courseUnits(course: Course): Unit[] {
  const cached = unitsCache.get(course);
  if (cached) return cached;
  const units = COURSES[course].map((unit) => ({
    ...unit,
    signs: unit.signs.map((sign): Sign => ({ ...sign, video: CLIPS[course][sign.clip.toLowerCase()] ?? null })),
  }));
  unitsCache.set(course, units);
  return units;
}

const pathCache = new Map<Course, PathUnit[]>();

/** The course's units, each with its lessons and review, in order. */
export function coursePath(course: Course): PathUnit[] {
  const cached = pathCache.get(course);
  if (cached) return cached;
  const units = courseUnits(course).map((unit, unitIndex) => {
    const lessons: Lesson[] = [];
    for (let start = 0; start < unit.signs.length; start += NEW_SIGNS_PER_LESSON) {
      const number = lessons.length + 1;
      const signs = unit.signs.slice(start, start + NEW_SIGNS_PER_LESSON);
      lessons.push({
        id: `${course}-${unit.id}-${number}`,
        course,
        unitId: unit.id,
        unitTitle: unit.title,
        kind: 'lesson',
        number,
        title: `Lesson ${number}`,
        signs,
      });
    }
    lessons.push({
      id: `${course}-${unit.id}-review`,
      course,
      unitId: unit.id,
      unitTitle: unit.title,
      kind: 'review',
      number: lessons.length + 1,
      title: 'Review',
      signs: unit.signs,
    });
    return { ...unit, number: unitIndex + 1, lessons };
  });
  pathCache.set(course, units);
  return units;
}

/** Every lesson of the course in path order. */
export const allLessons = (course: Course): Lesson[] => coursePath(course).flatMap((unit) => unit.lessons);

export function findLesson(id: string): Lesson | null {
  const course = id.slice(0, 3);
  if (course !== 'fsl' && course !== 'asl') return null;
  return allLessons(course).find((lesson) => lesson.id === id) ?? null;
}

/** Every sign of a course, for practice and the word lists. */
export const allSigns = (course: Course): Sign[] => courseUnits(course).flatMap((unit) => unit.signs);

// ---------------------------------------------------------------- exercises

export type Exercise =
  /** Meet a new sign: its clip, name and how it's made; "Try it" with the camera. */
  | { kind: 'intro'; sign: Sign }
  /** Watch a sign (or hear its steps) → pick what it means. */
  | { kind: 'watch-pick'; sign: Sign; options: Sign[] }
  /** Read a word → pick the video that signs it. */
  | { kind: 'read-pick'; sign: Sign; options: Sign[] }
  /** Make the sign in front of the camera. */
  | { kind: 'do-sign'; sign: Sign }
  /** Match each video to its word. */
  | { kind: 'match'; pairs: Sign[] };

/** What this phone can do right now — exercises that need more are left out. */
export type Abilities = {
  /** Clips can play (the video player is in this app version; they're on the phone, so no internet needed). */
  video: boolean;
  /** Camera practice works (online, the sign reader answers, the camera is allowed). */
  camera: boolean;
  /** Signs are told in spoken steps, not only shown: a screen reader is on, or the Blind / low-vision profile. */
  describe: boolean;
};

/** A small seeded random generator (mulberry32), so a lesson shuffles the same way every time. */
function seeded(text: string): () => number {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i += 1) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** `count` wrong answers for `sign`: from its own unit first, then the rest of the course. */
function distractors(sign: Sign, unitSigns: Sign[], course: Course, count: number, random: () => number): Sign[] {
  const others = (list: Sign[]) => list.filter((other) => other.label !== sign.label);
  const sameUnit = shuffle(others(unitSigns), random);
  const rest = shuffle(
    others(allSigns(course)).filter((other) => !unitSigns.includes(other)),
    random,
  );
  return [...sameUnit, ...rest].slice(0, count);
}

const withAnswer = (sign: Sign, wrong: Sign[], random: () => number) => shuffle([sign, ...wrong], random);

/**
 * Every exercise the lesson COULD have, before leaving out what this phone
 * can't do. Same lesson → same plan, always.
 *   lesson: intro cards for its new signs, then (shuffled) each sign watched
 *     and picked, two signs read and picked by video, up to two signs made
 *     with the camera (easiest first), and a match of 4 at the end;
 *   review: six signs watched, two read, two made, a match of 4.
 */
export function lessonPlan(lesson: Lesson): Exercise[] {
  const random = seeded(lesson.id);
  const unit = courseUnits(lesson.course).find((u) => u.id === lesson.unitId);
  const unitSigns = unit?.signs ?? lesson.signs;
  const review = lesson.kind === 'review';
  const focus = review ? shuffle(lesson.signs, random).slice(0, 6) : lesson.signs;

  const middle: Exercise[] = [];
  for (const sign of focus) {
    middle.push({ kind: 'watch-pick', sign, options: withAnswer(sign, distractors(sign, unitSigns, lesson.course, 3, random), random) });
  }
  for (const sign of shuffle(focus, random).slice(0, 2)) {
    middle.push({ kind: 'read-pick', sign, options: withAnswer(sign, distractors(sign, unitSigns, lesson.course, 2, random), random) });
  }
  const toMake = [...focus].sort((a, b) => Number(b.easy) - Number(a.easy)).slice(0, 2);
  for (const sign of toMake) middle.push({ kind: 'do-sign', sign });

  // The match uses the lesson's signs, topped up with the unit's earlier ones.
  const learnedBefore = unitSigns.slice(0, Math.max(0, unitSigns.indexOf(lesson.signs[0])));
  const pairs = [...shuffle(focus, random), ...shuffle(learnedBefore, random)].slice(0, 4);

  return [
    ...(review ? [] : lesson.signs.map((sign): Exercise => ({ kind: 'intro', sign }))),
    ...shuffle(middle, random),
    ...(pairs.length >= 3 ? [{ kind: 'match', pairs: shuffle(pairs, random) } as Exercise] : []),
  ];
}

const showable = (sign: Sign) => sign.video !== null;

/** Whether this phone can do `exercise` now. */
export function canDo(exercise: Exercise, abilities: Abilities): boolean {
  switch (exercise.kind) {
    case 'intro':
      return true;
    case 'watch-pick':
      // Watched, or (told in words) heard as its steps.
      return (abilities.video && showable(exercise.sign)) || (abilities.describe && exercise.sign.steps.length > 0);
    case 'read-pick':
      return abilities.video && !abilities.describe && exercise.options.every(showable);
    case 'match':
      return abilities.video && !abilities.describe && exercise.pairs.every(showable);
    case 'do-sign':
      return abilities.camera;
  }
}

/** The lesson as this phone will play it. */
export const buildExercises = (lesson: Lesson, abilities: Abilities): Exercise[] =>
  lessonPlan(lesson).filter((exercise) => canDo(exercise, abilities));

/** A quiz question: a wrong answer costs a heart. (Never the camera.) */
export const isQuiz = (exercise: Exercise) =>
  exercise.kind === 'watch-pick' || exercise.kind === 'read-pick' || exercise.kind === 'match';
