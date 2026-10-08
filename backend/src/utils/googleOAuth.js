const jwt = require('jsonwebtoken');
const { normalizeEmail } = require('validator');

// "Sign in with Google", run by this server instead of the app. The
// app only opens a browser and waits for a link back, which works in plain
// Expo Go — Google's native sign-in library needs a custom build.
//
// Setup, in backend/.env:
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — a "Web application" OAuth
//     client from Google Cloud Console → APIs & Services → Credentials.
//   BACKEND_PUBLIC_URL — the HTTPS address this server is reachable at,
//     e.g. https://something.trycloudflare.com. Google only sends users back
//     to HTTPS addresses (or localhost), never to a LAN IP. Add
//     <BACKEND_PUBLIC_URL>/api/auth/google/callback to the client's
//     "Authorized redirect URIs".

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

// Must match "scheme" in frontend/app.json.
const APP_SCHEME = 'frontend';

const isConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.BACKEND_PUBLIC_URL);

const publicUrl = () => process.env.BACKEND_PUBLIC_URL.replace(/\/+$/, '');

const callbackUrl = () => `${publicUrl()}/api/auth/google/callback`;

// Where sign-in may send the user back to: the app's own scheme, plus Expo
// Go's exp:// links outside production. Anything else is refused, or a
// link crafted by someone else could send a victim's sign-in to them.
const isAllowedAppRedirect = (url) =>
  typeof url === 'string' &&
  (url.startsWith(`${APP_SCHEME}://`) || (process.env.NODE_ENV !== 'production' && /^exps?:\/\//.test(url)));

const buildAuthUrl = (state) =>
  `${AUTH_URL}?${new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    // Always show the account picker, so a shared phone never silently
    // signs in as whoever used Google on it last.
    prompt: 'select_account',
  })}`;

// Swaps the one-time code Google sent to the callback for who the user is.
async function fetchGoogleProfile(code) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(),
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}): ${await response.text()}`);
  }

  // The ID token's signature isn't checked: it came straight from Google
  // over HTTPS in reply to our own request, which OpenID Connect allows in
  // place of one (Core spec §3.1.3.7). Who it's for and when still are.
  const { id_token: idToken } = await response.json();
  const claims = jwt.decode(idToken);
  if (
    !claims ||
    claims.aud !== process.env.GOOGLE_CLIENT_ID ||
    !GOOGLE_ISSUERS.includes(claims.iss) ||
    claims.exp * 1000 <= Date.now()
  ) {
    throw new Error('Google returned an ID token that is not for this app or has expired');
  }

  return {
    googleId: claims.sub,
    // Normalized exactly as the validators normalize a typed-in email, so
    // it matches the address an existing account was registered with.
    email: typeof claims.email === 'string' ? normalizeEmail(claims.email) || null : null,
    emailVerified: claims.email_verified === true,
    // Only suggestions for the sign-up form, which allows 30 characters.
    firstName: (claims.given_name ?? '').slice(0, 30),
    lastName: (claims.family_name ?? '').slice(0, 30),
  };
}

module.exports = { isConfigured, publicUrl, isAllowedAppRedirect, buildAuthUrl, fetchGoogleProfile };
