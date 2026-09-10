import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { hasCompletedOnboarding, markOnboardingComplete } from '@/utils/onboardingStorage';
import { clearToken, getToken, setToken } from '@/utils/tokenStorage';

type BootstrapContextValue = {
  ready: boolean;
  isLoggedIn: boolean;
  hasOnboarded: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [token, onboarded] = await Promise.all([getToken(), hasCompletedOnboarding()]);
      if (cancelled) {
        return;
      }
      setIsLoggedIn(Boolean(token));
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
    setIsLoggedIn(true);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setIsLoggedIn(false);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await markOnboardingComplete();
    setHasOnboarded(true);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      isLoggedIn,
      hasOnboarded,
      signIn,
      signOut,
      completeOnboarding,
    }),
    [ready, isLoggedIn, hasOnboarded, signIn, signOut, completeOnboarding],
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
