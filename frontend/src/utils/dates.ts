const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * e.g. "October 10, 2026". Built by hand rather than with
 * toLocaleDateString so it reads the same on every phone, whatever its
 * language settings (same reasoning as conversationTitle.ts).
 */
export function formatLongDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Whole days left until `date`, rounded up, so "3 hours from now" counts
 * as 1 day rather than 0. Never negative.
 */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / DAY_MS));
}
