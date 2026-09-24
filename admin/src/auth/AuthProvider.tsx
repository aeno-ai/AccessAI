import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, onUnauthorized } from '../api/client';
import type { Admin, Permission } from '../types';
import { AuthContext } from './auth-context';

type AdminResponse = { admin: Admin };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggedOut, setLoggedOut] = useState(false);

  // The browser can't read the httpOnly session cookie, so the only way to
  // know whether we're logged in is to ask the server.
  useEffect(() => {
    let cancelled = false;

    apiFetch<AdminResponse>('/auth/me')
      .then((data) => {
        if (!cancelled) setAdmin(data.admin);
      })
      .catch(() => {
        if (!cancelled) setAdmin(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => onUnauthorized(() => setAdmin(null)), []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<AdminResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setLoggedOut(false);
    setAdmin(data.admin);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Even if the request failed, stop showing the panel.
    } finally {
      setLoggedOut(true);
      setAdmin(null);
    }
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => admin?.permissions.includes(permission) ?? false,
    [admin],
  );

  const value = useMemo(
    () => ({ admin, loading, loggedOut, login, logout, updateAdmin: setAdmin, hasPermission }),
    [admin, loading, loggedOut, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
