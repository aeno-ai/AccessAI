import { createContext, useContext } from 'react';
import type { Admin, Permission } from '../types';

export type AuthContextValue = {
  admin: Admin | null;
  loading: boolean;
  // True when the session ended because this person clicked "Log out" (as
  // opposed to it expiring or being revoked).
  loggedOut: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateAdmin: (admin: Admin) => void;
  // For showing/hiding UI only. The backend checks permissions again on
  // every request — hiding a button is a convenience, not the security.
  hasPermission: (permission: Permission) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
