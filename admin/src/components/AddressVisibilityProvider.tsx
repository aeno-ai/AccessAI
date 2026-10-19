import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  ADDRESS_VISIBILITY_KEY,
  AddressVisibilityContext,
  readAddressVisibility,
} from '../hooks/useAddressVisibility';

// The one "Show addresses" switch every page shares (hooks/useAddressVisibility.ts).
export function AddressVisibilityProvider({ children }: { children: ReactNode }) {
  const [shown, setShownState] = useState(readAddressVisibility);

  const setShown = useCallback((next: boolean) => {
    setShownState(next);
    try {
      if (next) sessionStorage.setItem(ADDRESS_VISIBILITY_KEY, '1');
      else sessionStorage.removeItem(ADDRESS_VISIBILITY_KEY);
    } catch {
      // Kept for this page only.
    }
  }, []);

  const value = useMemo(() => ({ shown, setShown }), [shown, setShown]);
  return <AddressVisibilityContext.Provider value={value}>{children}</AddressVisibilityContext.Provider>;
}
