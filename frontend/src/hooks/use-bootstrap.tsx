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
import { setConversationAccount } from '@/db/conversations';
import { clearFriendData } from '@/db/friends';
import { clearCachedContacts } from '@/utils/emergencyContacts';
import { pushDeviceId, unregisterPush } from '@/notifications/push';
import { clearSosCache } from '@/realtime/sosCache';
import { usePreferences } from '@/hooks/use-preferences';
import { decodeJwtPayload, isTokenExpired } from '@/utils/jwt';
import { adoptLegacy, hasCompletedOnboarding, markOnboardingComplete } from '@/utils/onboardingStorage';
import { clearToken, getToken, setToken } from '@/utils/tokenStorage';

export type UserRole = 'pwd' | 'non_pwd';

type BootstrapContextValue = {
  ready: boolean;
  isLoggedIn: boolean;
  hasOnboarded: boolean;
  role: UserRole | null;
  /** For greetings. Null for sessions from before the token carried it. */
  firstName: string | null;
  /** The signed-in account's id (read from the token), e.g. to check a notification is for them. */
  userId: string | null;
  /**
   * Stores the login and loads that account's own preferences and
   * onboarding. `isNew`: a just-created account (verified email, Google
   * sign-up) — always onboarding, and never the phone's older settings.
   */
  signIn: (token: string, options?: { isNew?: boolean }) => Promise<void>;
  /** Signing out on purpose (the menu): the server records it and drops this phone's push address. */
  signOut: () => Promise<void>;
  /**
   * Why the server signed this phone out, when it said (an admin paused the
   * account or is deleting it) — shown on the login screen until the next login.
   */
  signOutNotice: string | null;
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

function userIdFromToken(token: string | null): string | null {
  const userId = decodeJwtPayload(token)?.userId;
  return typeof userId === 'string' && userId ? userId : null;
}

/** The user's first name, read from the token the same way as the role. */
function firstNameFromToken(token: string | null): string | null {
  const firstName = decodeJwtPayload(token)?.firstName;
  return typeof firstName === 'string' && firstName.trim() ? firstName.trim() : null;
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
    // Short timeout: a server that's down shouldn't hold the splash screen.
    const me = await apiFetch<{ token?: string }>('/auth/me', { timeoutMs: 6000 });
    // A login in use is renewed for another 30 days (the server sends a
    // fresh token once a day), so it never runs out while the app is used.
    if (typeof me?.token === 'string' && me.token) await setToken(me.token);
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
  // Outside this provider (display settings load before the splash hides);
  // each sign-in switches it to that account's own preferences.
  const { loadAccount } = usePreferences();
  const [ready, setReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [signOutNotice, setSignOutNotice] = useState<string | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const token = await getToken();
      const valid = await resolveSession(token);
      const id = valid ? userIdFromToken(token) : null;
      // The account signed in when this version first runs keeps the
      // phone's old onboarding and preferences (see adoptLegacy).
      if (id) {
        await adoptLegacy(id);
        await setConversationAccount(id, { adopt: true });
        await loadAccount(id);
      }
      const onboarded = valid ? await hasCompletedOnboarding(id) : false;
      if (cancelled) {
        return;
      }
      setIsLoggedIn(valid);
      setRole(valid ? roleFromToken(token) : null);
      setFirstName(valid ? firstNameFromToken(token) : null);
      setUserId(id);
      setHasOnboarded(onboarded);
      setReady(true);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [loadAccount]);

  const signIn = useCallback(
    async (token: string, options: { isNew?: boolean } = {}) => {
      await setToken(token);
      const id = userIdFromToken(token);
      // Before the app shows: this account's own text size, colors, Laya…
      if (id && !options.isNew) await adoptLegacy(id);
      // Only this account's in-person conversations from here on.
      await setConversationAccount(id, { adopt: !options.isNew });
      await loadAccount(id);
      const onboarded = options.isNew ? false : await hasCompletedOnboarding(id);
      setRole(roleFromToken(token));
      setFirstName(firstNameFromToken(token));
      setUserId(id);
      setHasOnboarded(onboarded);
      setSignOutNotice(null);
      setIsLoggedIn(true);
    },
    [loadAccount],
  );

  // Forgets the login and this account's data on the phone. Used by
  // signOut and when the server refuses the login (a 401).
  const endSession = useCallback(async () => {
    await unregisterPush();
    await clearToken();
    // Emergency contacts, friends and chats are kept on the phone so they
    // work offline; the next person to log in here must never see (or text)
    // this account's.
    await clearCachedContacts();
    await clearFriendData().catch(() => undefined);
    await clearSosCache();
    // Their preferences, and their in-person conversations (hidden from
    // anyone else), stay saved for when they log back in.
    await setConversationAccount(null);
    await loadAccount(null);
    setIsLoggedIn(false);
    setRole(null);
    setFirstName(null);
    setUserId(null);
  }, [loadAccount]);

  const signOut = useCallback(async () => {
    // Before the token goes: telling the server needs it. Never waits long —
    // offline, signing out still works at once.
    try {
      const deviceId = await pushDeviceId();
      await apiFetch('/auth/logout', {
        method: 'POST',
        timeoutMs: 3000,
        body: JSON.stringify(deviceId ? { deviceId } : {}),
      });
    } catch {
      // Offline or refused: this phone signs out anyway.
    }
    await endSession();
  }, [endSession]);

  const completeOnboarding = useCallback(async () => {
    if (userId) await markOnboardingComplete(userId);
    setHasOnboarded(true);
  }, [userId]);

  // A token stays valid for 30 days, so it can silently expire while the app
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
          setFirstName(null);
          setUserId(null);
        }
      })();
    });

    return () => subscription.remove();
  }, []);

  // Any API call anywhere that comes back 401 should end the session
  // immediately, not just at the next boot/resume check. Not signOut: its
  // /auth/logout call would only be refused again.
  useEffect(
    () =>
      onUnauthorized((reason) => {
        setSignOutNotice(reason?.message ?? null);
        void endSession();
      }),
    [endSession],
  );

  const value = useMemo(
    () => ({
      ready,
      isLoggedIn,
      hasOnboarded,
      role,
      firstName,
      userId,
      signIn,
      signOut,
      signOutNotice,
      completeOnboarding,
    }),
    [ready, isLoggedIn, hasOnboarded, role, firstName, userId, signIn, signOut, signOutNotice, completeOnboarding],
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
