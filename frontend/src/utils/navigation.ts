import { router, type Href } from 'expo-router';

/**
 * Back to the previous screen — or, when there's nowhere to go back to (a
 * second quick tap on Back, or "Done" after already landing there), to
 * `fallback`, instead of the "GO_BACK was not handled" error.
 */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.navigate(fallback);
}
