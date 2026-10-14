import type { Course } from './types';

/**
 * Did the learner make the sign? Decided on the phone from the sign
 * reader's 5 best guesses (best first):
 *   - FSL: its best guess must be the sign (it's right 98% of the time);
 *   - ASL: the sign must be among its top 3 (it's right 60% of the time on
 *     its first guess, 88% within 5 — so the bar is lower, or good signing
 *     would fail too often).
 */
export const PASS_WITHIN: Record<Course, number> = { fsl: 1, asl: 3 };

/** Labels compared loosely: case, curly vs straight apostrophes, extra spaces. */
export function normalizeLabel(label: string): string {
  return label.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toUpperCase();
}

export function signMatches(course: Course, target: string, top5: { label: string }[]): boolean {
  const wanted = normalizeLabel(target);
  return top5.slice(0, PASS_WITHIN[course]).some((guess) => normalizeLabel(guess.label) === wanted);
}
