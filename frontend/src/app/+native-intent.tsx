import { GOOGLE_REDIRECT_PATH } from '@/constants/auth';

const GOOGLE_REDIRECT = new RegExp(`(^|/)${GOOGLE_REDIRECT_PATH}($|[?#/])`);

/**
 * Google sign-in ends by opening a `google-auth` link, which
 * GoogleSignInButton is already waiting for. On Android that link also
 * reaches the router, which would try to open a "google-auth" screen that
 * doesn't exist. Returning null tells it to stay where it is.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (GOOGLE_REDIRECT.test(path)) {
    return null;
  }
  return path;
}
