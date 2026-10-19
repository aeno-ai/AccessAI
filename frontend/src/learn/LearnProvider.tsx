import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, isApiError } from '@/api/apiClient';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useFriends } from '@/realtime/FriendsProvider';
import type { Lesson } from './lessons';
import type { Completion } from './types';

/**
 * Learn's saved state for the signed-in account, offline first: the log of
 * finished lessons (everything else is worked out from it — see
 * progress.ts), and an outbox of the ones the account doesn't have yet.
 * Kept on the phone under `learn:v1:<userId>`. The outbox is sent, and the
 * account's copy fetched back (for a new phone), when Learn opens, when the
 * live connection comes back, and after each lesson.
 *
 * Hearts and the daily goal were removed on 2026-10-17 (HANDOFF.md §38);
 * phones that saved them simply ignore them now.
 */
type LearnState = {
  completions: Completion[];
  outbox: string[];
};

const storageKey = (userId: string) => `learn:v1:${userId}`;
const SYNC_CHUNK = 200;

const freshState = (): LearnState => ({ completions: [], outbox: [] });

const newClientId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const byTime = (a: Completion, b: Completion) => a.completedAt - b.completedAt;

export type LessonResult = { lesson: Lesson; mistakes: number; cameraPassed: number };

type LearnContextValue = {
  ready: boolean;
  completions: Completion[];
  /** Saves a finished lesson (works offline). */
  finishLesson: (result: LessonResult) => Promise<{ completion: Completion }>;
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
      .then((raw) => {
        if (!raw) return freshState();
        const saved = JSON.parse(raw) as Partial<LearnState>;
        return { completions: saved.completions ?? [], outbox: saved.outbox ?? [] };
      })
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

  const finishLesson = useCallback(
    async ({ lesson, mistakes, cameraPassed }: LessonResult) => {
      const completion: Completion = {
        clientId: newClientId(),
        course: lesson.course,
        lessonId: lesson.id,
        mistakes,
        cameraPassed,
        completedAt: Date.now(),
      };
      update((current) => ({
        ...current,
        completions: [...current.completions, completion],
        outbox: [...current.outbox, completion.clientId],
      }));
      void sync();
      return { completion };
    },
    [update, sync],
  );

  const value = useMemo(
    () => ({ ready, completions: state.completions, finishLesson, sync }),
    [ready, state, finishLesson, sync],
  );

  return <LearnContext.Provider value={value}>{children}</LearnContext.Provider>;
}

export function useLearn() {
  const context = useContext(LearnContext);
  if (!context) throw new Error('useLearn must be used inside LearnProvider');
  return context;
}
