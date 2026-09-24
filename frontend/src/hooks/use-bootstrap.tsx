import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { apiFetch } from '@/api/apiClient';
import { onUnauthorized } from '@/utils/authEvents';
import { decodeJwtPayload, isTokenExpired } from '@/utils/jwt';
import { hasCompletedOnboarding, markOnboardingComplete } from '@/utils/onboardingStorage';
import { clearToken, getToken, setToken } from '@/utils/tokenStorage';

export type UserRole = 'pwd' | 'non_pwd';

type BootstrapContextValue = {
  ready: boolean;
  isLoggedIn: boolean;
  hasOnboarded: boolean;
  role: UserRole | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

/**
 * The account type is baked into the token by the backend, so it can be read
 * straight from the stored token — no network call, works offline.
 */
function roleFromToken(token: string | null): UserRole | null {
  const role = decodeJwtPayload(token)?.role;
  return role === 'pwd' || role === 'non_pwd' ? role : null;
}

/**
 * Determines whether a stored token represents a still-valid session, and
 * keeps on-device token storage consistent with that answer.
 *
 * 1. No token -> not logged in.
 * 2. Locally expired (read straight from the JWT's own `exp` claim, no
 *    network needed) -> clear it, not logged in. This keeps the dashboard
 *    reachable offline: a valid cached token never needs a network call to
 *    be accepted.
 * 3. Otherwise, confirm with `GET /auth/me` when reachable, so a
 *    tampered/invalid-signature token is also caught, not just an expired
 *    one. If that request fails for any reason other than a confirmed 401
 *    (e.g. no connectivity), trust the local check instead of signing out a
 *    user who has a valid cached token but no signal.
 */
async function resolveSession(token: string | null): Promise<boolean> {
  if (!token) {
    return false;
  }

  if (isTokenExpired(token)) {
    await clearToken();
    return false;
  }

  let unauthorized = false;
  const unsubscribe = onUnauthorized(() => {
    unauthorized = true;
  });

  try {
    await apiFetch('/auth/me');
    return true;
  } catch {
    if (unauthorized) {
      await clearToken();
      return false;
    }
    // Request failed for some other reason (most likely offline) — trust
    // the local expiry check rather than lock the user out.
    return true;
  } finally {
    unsubscribe();
  }
}

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [token, onboarded] = await Promise.all([getToken(), hasCompletedOnboarding()]);
      const valid = await resolveSession(token);
      if (cancelled) {
        return;
      }
      setIsLoggedIn(valid);
      setRole(valid ? roleFromToken(token) : null);
      setHasOnboarded(onboarded);
      setReady(true);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (token: string) => {
    await setToken(token);
    setRole(roleFromToken(token));
    setIsLoggedIn(true);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setIsLoggedIn(false);
    setRole(null);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await markOnboardingComplete();
    setHasOnboarded(true);
  }, []);

  // A token stays valid for 7 days, so it can silently expire while the app
  // sits backgrounded. Re-check whenever the app returns to the foreground
  // so a stale dashboard isn't left showing until some other API call
  // happens to fail.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const cameToForeground = /inactive|background/.test(appStateRef.current) && nextState === 'active';
      appStateRef.current = nextState;

      if (!cameToForeground) {
        return;
      }

      void (async () => {
        const token = await getToken();
        const valid = await resolveSession(token);
        setIsLoggedIn(valid);
        if (!valid) {
          setRole(null);
        }
      })();
    });

    return () => subscription.remove();
  }, []);

  // Any API call anywhere that comes back 401 should end the session
  // immediately, not just at the next boot/resume check.
  useEffect(() => onUnauthorized(() => void signOut()), [signOut]);

  const value = useMemo(
    () => ({
      ready,
      isLoggedIn,
      hasOnboarded,
      role,
      signIn,
      signOut,
      completeOnboarding,
    }),
    [ready, isLoggedIn, hasOnboarded, role, signIn, signOut, completeOnboarding],
  );

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useBootstrap() {
  const context = useContext(BootstrapContext);
  if (!context) {
    throw new Error('useBootstrap must be used inside BootstrapProvider');
  }
  return context;
}
