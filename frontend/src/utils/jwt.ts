/**
 * Minimal, dependency-free JWT payload decoding.
 *
 * This performs NO signature verification — it is not possible to verify a
 * JWT signature on-device without the server's secret, and that is not the
 * goal here. This is used purely as a fast, offline-friendly local check
 * (e.g. "has this token's exp claim already passed?") so the app can react
 * instantly on boot/resume without waiting on a network call. The actual
 * security boundary remains the backend, which verifies the signature on
 * every request (see `backend/src/middleware/authMiddleware.js`).
 */

type JwtPayload = {
  userId?: string;
  role?: string;
  firstName?: string;
  iat?: number;
  exp?: number;
};

function base64UrlDecode(segment: string): string | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

    if (typeof atob === 'function') {
      // Available on web and modern Hermes. `atob` gives one character per
      // byte, so the UTF-8 bytes are reassembled here — the first name in
      // the payload can have letters like "ñ". decodeURIComponent does that
      // without depending on `TextDecoder`, whose availability varies more
      // across RN engine versions.
      const binary = atob(padded);
      const percentEncoded = Array.from(binary, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`);
      return decodeURIComponent(percentEncoded.join(''));
    }

    // Some RN/Hermes setups polyfill a global `Buffer` instead of `atob`.
    // Access it loosely so this file doesn't need @types/node just for this
    // fallback branch.
    const globalBuffer = (globalThis as { Buffer?: { from(data: string, encoding: string): { toString(encoding: string): string } } })
      .Buffer;
    if (globalBuffer) {
      return globalBuffer.from(padded, 'base64').toString('utf-8');
    }

    return null;
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const decoded = base64UrlDecode(parts[1]);
  if (!decoded) {
    return null;
  }

  try {
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true if the token is missing, malformed, or its `exp` claim is in
 * the past (or absent). Treat "can't tell" as expired — fail closed.
 */
export function isTokenExpired(token: string | null | undefined): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }
  return payload.exp * 1000 <= Date.now();
}
