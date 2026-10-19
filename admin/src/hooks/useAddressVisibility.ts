import { createContext, useContext } from 'react';

// Network addresses are hidden on screen until an admin asks to see them
// (owner, 2026-10-18) — one switch for every address on every page, so
// someone looking over the admin's shoulder doesn't see them. Only the
// screen: the server still sends them. Remembered for this browser tab
// only (components/AddressVisibilityProvider.tsx), and forgotten at logout.

export const ADDRESS_VISIBILITY_KEY = 'admin:showAddresses';

/** Whether this tab was showing addresses (false unless switched on). */
export function readAddressVisibility(): boolean {
  try {
    return sessionStorage.getItem(ADDRESS_VISIBILITY_KEY) === '1';
  } catch {
    return false;
  }
}

/** Hides addresses again (called on logout). */
export function clearAddressVisibility(): void {
  try {
    sessionStorage.removeItem(ADDRESS_VISIBILITY_KEY);
  } catch {
    // Nothing saved, nothing to clear.
  }
}

export type AddressVisibility = { shown: boolean; setShown: (shown: boolean) => void };

export const AddressVisibilityContext = createContext<AddressVisibility>({ shown: false, setShown: () => undefined });

export function useAddressVisibility(): AddressVisibility {
  return useContext(AddressVisibilityContext);
}
