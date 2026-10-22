// Date filters for the admin lists (HANDOFF.md §52). Admins pick days, and
// a day means a day in the Philippines (the app's time zone, like the Learn
// week in learnController.js) — not a UTC day.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-21" → the real moment that day starts in Manila, or null. */
function manilaDayStart(day) {
  if (typeof day !== 'string' || !DAY_PATTERN.test(day)) return null;
  const [year, month, date] = day.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, date);
  // Date.UTC rolls over (month 13 → next January, 31 April → 1 May): refuse those.
  const check = new Date(utc);
  if (Number.isNaN(utc) || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) {
    return null;
  }
  return new Date(utc - MANILA_OFFSET_MS);
}

/**
 * A Mongo condition for `field` between two Manila days, both included:
 * { from: '2026-10-01', to: '2026-10-21' } → { field: { $gte, $lt } }.
 * Empty when neither is given.
 */
function dayRangeFilter(field, { from, to } = {}) {
  const range = {};
  const start = manilaDayStart(from);
  const end = manilaDayStart(to);
  if (start) range.$gte = start;
  if (end) range.$lt = new Date(end.getTime() + DAY_MS);
  return Object.keys(range).length ? { [field]: range } : {};
}

module.exports = { manilaDayStart, dayRangeFilter, DAY_PATTERN, MANILA_OFFSET_MS, DAY_MS };
