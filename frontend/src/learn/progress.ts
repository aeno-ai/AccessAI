import { allLessons } from './lessons';
import type { Completion, Course } from './types';

/**
 * Everything about a learner's progress is worked out from their list of
 * finished lessons (completions) — nothing else is stored. So it works
 * offline, and a new phone rebuilds it from the copy on their account.
 *
 * Learn keeps no score (owner, 2026-10-17, HANDOFF.md §38): no XP, levels,
 * daily goal, streak, hearts or badges — just which lessons are done. The
 * leaderboard counts lessons finished this week (on the server).
 */

export type LessonState = 'done' | 'open' | 'locked';

export type CourseProgress = {
  done: Set<string>;
  /** Each lesson opens once the one before it is done. */
  states: Map<string, LessonState>;
  /** The next lesson to do (null when the course is finished). */
  next: string | null;
  lessonsDone: number;
  lessonsTotal: number;
};

export function courseProgress(course: Course, completions: Completion[]): CourseProgress {
  const done = new Set(completions.filter((c) => c.course === course).map((c) => c.lessonId));
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
    done,
    states,
    next,
    lessonsDone: lessons.filter((lesson) => done.has(lesson.id)).length,
    lessonsTotal: lessons.length,
  };
}
