import { useCallback, useEffect, useState } from 'react';

/**
 * Seconds left on a countdown that ticks down to 0, and a function to start
 * it again. Used for "Resend code in 42s" — the backend only allows one
 * emailed code a minute.
 */
export function useCountdown(initialSeconds = 0): [number, (seconds: number) => void] {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  const running = secondsLeft > 0;
  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const restart = useCallback((seconds: number) => setSecondsLeft(seconds), []);

  return [secondsLeft, restart];
}
