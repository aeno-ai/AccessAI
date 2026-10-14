import { useCallback, useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isApiError } from '@/api/apiClient';

/**
 * "Wait 42 s" before another code can be emailed — one countdown per email
 * address and kind of code, shared by every screen and kept on the phone. So
 * going back and asking again, or closing the app, never resets it. The
 * server decides the real wait (backend utils/codeGate.js: one code a minute,
 * 5 a day) and sends it as `retryAfter`; this only shows it.
 */
export type CodeKind = 'verify_email' | 'reset_password' | 'add_password' | 'change_email' | 'delete_account';

type Entry = { until: number; daily: boolean };

const STORAGE_KEY = 'code-cooldowns:v1';
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let loaded = false;

const keyOf = (email: string, kind: CodeKind) => `${kind}|${email.trim().toLowerCase()}`;

function changed() {
  listeners.forEach((listener) => listener());
}

function save() {
  const now = Date.now();
  const live = [...entries].filter(([, entry]) => entry.until > now);
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(live))).catch(() => undefined);
}

function loadOnce() {
  if (loaded) return;
  loaded = true;
  void AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, Entry>;
      for (const [key, entry] of Object.entries(saved)) {
        // A countdown started since the app opened is newer — keep it.
        if (entry.until > Date.now() && !entries.has(key)) entries.set(key, entry);
      }
      changed();
    })
    .catch(() => undefined);
}

/** Starts (or restarts) the wait for this email and kind: `retryAfter` seconds, from the server. */
export function startCodeCooldown(email: string, kind: CodeKind, retryAfter: unknown, daily = false) {
  const seconds = Number(retryAfter);
  if (!email.trim() || !Number.isFinite(seconds) || seconds <= 0) return;
  entries.set(keyOf(email, kind), { until: Date.now() + seconds * 1000, daily });
  tick = Date.now();
  save();
  changed();
}

/** No wait any more (e.g. the email didn't go out, so "Resend code" works at once). */
export function clearCodeCooldown(email: string, kind: CodeKind) {
  if (entries.delete(keyOf(email, kind))) {
    save();
    changed();
  }
}

/**
 * A "too soon" (CODE_WAIT) or "too many today" (CODE_DAILY_LIMIT) answer
 * starts the countdown the server asked for. True if it was one of those.
 */
export function cooldownFromError(error: unknown, email: string, kind: CodeKind): boolean {
  if (!isApiError(error) || error.status !== 429 || error.body.retryAfter === undefined) return false;
  startCodeCooldown(email, kind, error.body.retryAfter, error.body.code === 'CODE_DAILY_LIMIT');
  return true;
}

// ---- one clock for every countdown on screen (ticks only while one is shown)
let tick = Date.now();
const tickListeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function subscribeTick(listener: () => void) {
  tickListeners.add(listener);
  if (!ticker) {
    ticker = setInterval(() => {
      tick = Date.now();
      tickListeners.forEach((each) => each());
    }, 1000);
  }
  return () => {
    tickListeners.delete(listener);
    if (!tickListeners.size && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

function subscribeEntries(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Seconds left before another code can be asked for, and whether that's "try again tomorrow". */
export function useCodeCooldown(email: string, kind: CodeKind) {
  useEffect(loadOnce, []);
  const key = keyOf(email, kind);
  const entry = useSyncExternalStore(subscribeEntries, () => entries.get(key));
  const now = useSyncExternalStore(subscribeTick, () => tick);
  const secondsLeft = entry ? Math.max(0, Math.ceil((entry.until - now) / 1000)) : 0;

  const start = useCallback((retryAfter: unknown, daily = false) => startCodeCooldown(email, kind, retryAfter, daily), [email, kind]);
  const clear = useCallback(() => clearCodeCooldown(email, kind), [email, kind]);
  const fromError = useCallback((error: unknown) => cooldownFromError(error, email, kind), [email, kind]);

  return { secondsLeft, daily: Boolean(entry?.daily) && secondsLeft > 0, start, clear, fromError };
}

/** "Wait 42 s", or "Try again tomorrow" — for a button that sends a code. */
export function cooldownLabel(secondsLeft: number, daily: boolean): string {
  if (daily) return 'Try again tomorrow';
  return `Wait ${secondsLeft} s`;
}
