import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, isApiError } from '@/api/apiClient';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useFriends } from '@/realtime/FriendsProvider';
import type { Lesson } from './lessons';
import {
  DEFAULT_DAILY_GOAL,
  earnedBadges,
  fullHearts,
  lessonXp,
  loseHeart as loseOne,
  type BadgeId,
} from './progress';
import type { Completion, DailyGoal, Hearts } from './types';

/**
 * Learn's saved state for the signed-in account, offline first:
 *   - the log of finished lessons (everything else is worked out from it —
 *     see progress.ts), and an outbox of the ones the account doesn't have yet;
 *   - hearts and the daily goal (this phone only).
 * Kept on the phone under `learn:v1:<userId>`. The outbox is sent, and the
 * account's copy fetched back (for a new phone), when Learn opens, when the
 * live connection comes back, and after each lesson.
 */
type LearnState = {
  completions: Completion[];
  outbox: string[];
  hearts: Hearts;
  dailyGoal: DailyGoal;
};

const storageKey = (userId: string) => `learn:v1:${userId}`;
const SYNC_CHUNK = 200;

const freshState = (): LearnState => ({ completions: [], outbox: [], hearts: fullHearts(Date.now()), dailyGoal: DEFAULT_DAILY_GOAL });

const newClientId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const byTime = (a: Completion, b: Completion) => a.completedAt - b.completedAt;

export type LessonResult = { lesson: Lesson; mistakes: number; quizQuestions: number; cameraPassed: number };

type LearnContextValue = {
  ready: boolean;
  completions: Completion[];
  hearts: Hearts;
  dailyGoal: DailyGoal;
  setDailyGoal: (goal: DailyGoal) => void;
  /** A wrong quiz answer. */
  loseHeart: () => void;
  /** Saves a finished lesson (works offline) and returns what it earned. */
  finishLesson: (result: LessonResult) => Promise<{ completion: Completion; newBadges: BadgeId[] }>;
  /** Sends what's waiting and fetches the account's copy. Quiet offline. */
  sync: () => Promise<void>;
};

const LearnContext = createContext<LearnContextValue | null>(null);

export function LearnProvider({ children }: { children: ReactNode }) {
  const { userId } = useBootstrap();
  const { connected } = useFriends();
  const [state, setState] = useState<LearnState>(freshState);
  // Whose state is loaded: ready once it's the signed-in account's.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const ready = userId !== null && loadedFor === userId;
  const stateRef = useRef(state);
  const userRef = useRef<string | null>(null);
  const syncing = useRef<Promise<void> | null>(null);

  const update = useCallback((change: (current: LearnState) => LearnState) => {
    const next = change(stateRef.current);
    stateRef.current = next;
    setState(next);
    const owner = userRef.current;
    if (owner) void AsyncStorage.setItem(storageKey(owner), JSON.stringify(next)).catch(() => undefined);
  }, []);

  // This account's saved Learn state.
  useEffect(() => {
    userRef.current = userId;
    if (!userId) return;
    let cancelled = false;
    void AsyncStorage.getItem(storageKey(userId))
      .then((raw) => (raw ? { ...freshState(), ...(JSON.parse(raw) as Partial<LearnState>) } : freshState()))
      .catch(freshState)
      .then((loaded) => {
        if (cancelled) return;
        stateRef.current = loaded;
        setState(loaded);
        setLoadedFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const sync = useCallback(() => {
    if (syncing.current) return syncing.current;
    const owner = userRef.current;
    if (!owner) return Promise.resolve();
    syncing.current = (async () => {
      try {
        // 1. Send what the account doesn't have yet, 200 at a time.
        const waiting = stateRef.current.completions.filter((c) => stateRef.current.outbox.includes(c.clientId));
        for (let start = 0; start < waiting.length; start += SYNC_CHUNK) {
          const chunk = waiting.slice(start, start + SYNC_CHUNK);
          const sent = new Set<string>();
          try {
            await apiFetch('/learn/sync', { method: 'POST', body: JSON.stringify({ completions: chunk }) });
            chunk.forEach((c) => sent.add(c.clientId));
          } catch (error) {
            if (!isApiError(error) || error.status !== 400) throw error; // offline: try again later
            // One the server won't take (say, the phone's clock was far off)
            // mustn't hold up the rest: send them one by one, and keep a
            // refused one on this phone only.
            for (const completion of chunk) {
              try {
                await apiFetch('/learn/sync', { method: 'POST', body: JSON.stringify({ completions: [completion] }) });
              } catch (single) {
                if (!isApiError(single) || single.status !== 400) throw single;
              }
              sent.add(completion.clientId);
            }
          }
          if (userRef.current !== owner) return;
          update((current) => ({ ...current, outbox: current.outbox.filter((id) => !sent.has(id)) }));
        }
        // 2. The account's copy: finished on another phone, or before a reinstall.
        const { completions: theirs } = await apiFetch<{ completions: Completion[] }>('/learn/progress');
        if (userRef.current !== owner) return;
        const known = new Set(stateRef.current.completions.map((c) => c.clientId));
        const missing = theirs.filter((c) => !known.has(c.clientId));
        if (missing.length) update((current) => ({ ...current, completions: [...current.completions, ...missing].sort(byTime) }));
      } catch {
        // Offline or the server is busy: the outbox waits for next time.
      } finally {
        syncing.current = null;
      }
    })();
    return syncing.current;
  }, [update]);

  // When the account's state is loaded, and whenever the live connection comes back.
  useEffect(() => {
    if (ready && connected) void sync();
  }, [ready, connected, sync]);

  const loseHeart = useCallback(() => {
    update((current) => ({ ...current, hearts: loseOne(current.hearts, Date.now()) }));
  }, [update]);

  const setDailyGoal = useCallback((goal: DailyGoal) => update((current) => ({ ...current, dailyGoal: goal })), [update]);

  const finishLesson = useCallback(
    async ({ lesson, mistakes, quizQuestions, cameraPassed }: LessonResult) => {
      const now = Date.now();
      const completion: Completion = {
        clientId: newClientId(),
        course: lesson.course,
        lessonId: lesson.id,
        xp: lessonXp(lesson.kind, { mistakes, quizQuestions, cameraPassed }),
        mistakes,
        cameraPassed,
        completedAt: now,
      };
      const before = earnedBadges(stateRef.current.completions, now);
      update((current) => ({
        ...current,
        completions: [...current.completions, completion],
        outbox: [...current.outbox, completion.clientId],
        // A review fills the hearts back up.
        hearts: lesson.kind === 'review' ? fullHearts(now) : current.hearts,
      }));
      const after = earnedBadges(stateRef.current.completions, now);
      void sync();
      return { completion, newBadges: [...after].filter((id) => !before.has(id)) };
    },
    [update, sync],
  );

  const value = useMemo(
    () => ({
      ready,
      completions: state.completions,
      hearts: state.hearts,
      dailyGoal: state.dailyGoal,
      setDailyGoal,
      loseHeart,
      finishLesson,
      sync,
    }),
    [ready, state, setDailyGoal, loseHeart, finishLesson, sync],
  );

  return <LearnContext.Provider value={value}>{children}</LearnContext.Provider>;
}

export function useLearn() {
  const context = useContext(LearnContext);
  if (!context) throw new Error('useLearn must be used inside LearnProvider');
  return context;
}

/** The time now, updated every `everyMs` while the screen is open (hearts coming back). */
export function useNow(everyMs = 30 * 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
