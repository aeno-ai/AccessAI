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

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** e.g. "3:10 PM", by hand for the same reason. */
export function formatClock(date: Date): string {
  const hours = date.getHours();
  return `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/**
 * When something happened this past week, the way a person says it:
 * "today, 3:10 PM", "yesterday, 3:10 PM", "Monday, 3:10 PM" — older than
 * that, "October 10, 2026".
 */
export function whenText(ms: number, now: number = Date.now()): string {
  const date = new Date(ms);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (ms >= startOfToday) return `today, ${formatClock(date)}`;
  if (ms >= startOfToday - DAY_MS) return `yesterday, ${formatClock(date)}`;
  if (ms >= startOfToday - 6 * DAY_MS) return `${WEEKDAYS[date.getDay()]}, ${formatClock(date)}`;
  return formatLongDate(date);
}

const MONTHS_FIL = ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'];
const WEEKDAYS_FIL = ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'];

/**
 * whenText in English or Filipino (what Laya says): "ngayong araw, 3:10
 * PM", "kahapon, 3:10 PM", "Lunes, 3:10 PM", "Oktubre 10, 2026".
 */
export function whenTextIn(lang: 'en' | 'fil', ms: number, now: number = Date.now()): string {
  if (lang === 'en') return whenText(ms, now);
  const date = new Date(ms);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (ms >= startOfToday) return `ngayong araw, ${formatClock(date)}`;
  if (ms >= startOfToday - DAY_MS) return `kahapon, ${formatClock(date)}`;
  if (ms >= startOfToday - 6 * DAY_MS) return `noong ${WEEKDAYS_FIL[date.getDay()]}, ${formatClock(date)}`;
  return `${MONTHS_FIL[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Whole days left until `date`, rounded up, so "3 hours from now" counts
 * as 1 day rather than 0. Never negative.
 */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / DAY_MS));
}
