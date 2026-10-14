import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/api/apiClient';
import { clearCodeCooldown } from '@/hooks/use-code-cooldown';

// When to ask after a code was requested: Gmail usually answers in ~2 s.
const CHECK_AFTER_MS = [3000, 7000, 15000];

/**
 * Sign-up and "Forgot password" codes are emailed in the background, so a
 * failed email would be invisible. After each request, this asks the server
 * a few times whether it went out (GET /auth/code-status); if it didn't,
 * `failed` turns true and the wait is cleared, so "Resend code" works at once.
 */
export function useCodeDelivery(email: string, purpose: 'verify_email' | 'reset_password') {
  const [failed, setFailed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  /** Call right after a code was requested. */
  const watch = useCallback(() => {
    stop();
    setFailed(false);
    if (!email.trim()) return;
    timers.current = CHECK_AFTER_MS.map((delay) =>
      setTimeout(() => {
        void apiFetch<{ delivery?: string }>(
          `/auth/code-status?email=${encodeURIComponent(email.trim())}&purpose=${purpose}`,
        )
          .then((status) => {
            if (status.delivery === 'failed') {
              stop();
              setFailed(true);
              clearCodeCooldown(email, purpose);
            } else if (status.delivery === 'sent') {
              stop();
            }
          })
          .catch(() => undefined); // offline: nothing to tell
      }, delay),
    );
  }, [email, purpose, stop]);

  useEffect(() => stop, [stop]);

  return { failed, watch };
}
