import { useEffect, useState } from 'react';

/**
 * True a moment after `active` turns on (after login): once the first screen
 * has drawn and the app has a quiet moment, plus `delayMs`. Work that isn't
 * urgent — the live connection, push registration, "Hey Laya" — waits for
 * it, so logging in or verifying an email shows the next screen at once
 * instead of everything starting together (slowest in a development build).
 *
 * `session` (e.g. the user id) restarts the wait for a new sign-in.
 */
export function useAfterFirstScreen(active: boolean, session: unknown = null, delayMs = 1000): boolean {
  const [readyFor, setReadyFor] = useState<{ session: unknown } | null>(null);

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Never waits more than 2 s for the quiet moment.
    const idle = requestIdleCallback(
      () => {
        timer = setTimeout(() => setReadyFor({ session }), delayMs);
      },
      { timeout: 2000 },
    );
    return () => {
      cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, [active, session, delayMs]);

  return active && readyFor !== null && readyFor.session === session;
}
