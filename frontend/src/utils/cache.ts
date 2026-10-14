/**
 * How AccessAI caches — offline first, "show saved, refresh quietly":
 *
 *   1. The phone's own database (SQLite: friends, chats, messages, SOS) is
 *      what screens show. It works with no signal.
 *   2. A screen never waits for the server to appear. It shows what's saved
 *      right away; the server is asked in the background.
 *   3. The server is asked at most once per `maxAge` per kind of data. Live
 *      events (the socket: new messages, presence, SOS) keep it current in
 *      between, so opening a tab again doesn't download everything again.
 *   4. New data replaces the old only when it's actually different — the
 *      same data in a new array would make every screen that shows it draw
 *      itself again for nothing.
 */

/** True when two plain values (lists, objects from the server) hold the same data. */
export function sameData(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** `next`, or `current` itself when nothing changed — for setState, so nothing redraws for nothing. */
export function keepIfSame<T>(current: T, next: T): T {
  return sameData(current, next) ? current : next;
}

/** Older than `maxAgeMs` (or never fetched): time to ask the server again. */
export function isStale(fetchedAt: number | null, maxAgeMs: number): boolean {
  return fetchedAt === null || Date.now() - fetchedAt > maxAgeMs;
}
