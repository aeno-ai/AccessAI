/** Must match RESEND_WAIT_SECONDS in backend/src/utils/emailCodes.js. */
export const RESEND_CODE_SECONDS = 60;

/**
 * The link Google sign-in ends on (see GoogleSignInButton). It isn't a
 * screen: app/+native-intent.tsx keeps the router from treating it as one.
 */
export const GOOGLE_REDIRECT_PATH = 'google-auth';
