import AsyncStorage from '@react-native-async-storage/async-storage';

// Remembered per account, on each phone (keyed by the user id): a new
// account always gets onboarding and its own preferences, even on a phone
// someone else already used.
const onboardingKey = (userId: string) => `onboarding:v1:${userId}`;
const choiceKey = (userId: string) => `accessibilityPreference:${userId}`;
/** Where an account's preferences are saved (see use-preferences). */
export const preferencesKey = (userId: string) => `preferences:v1:${userId}`;

// Before 2026-10-10 all three were once per phone.
const LEGACY_ONBOARDING = 'hasSeenOnboarding';
const LEGACY_CHOICE = 'accessibilityPreference';
export const LEGACY_PREFERENCES = 'preferences:v1';

/** `null`: a session from before the login token carried the user id — the old phone-wide answer. */
export async function hasCompletedOnboarding(userId: string | null): Promise<boolean> {
  const value = await AsyncStorage.getItem(userId ? onboardingKey(userId) : LEGACY_ONBOARDING);
  return value === 'true';
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  await AsyncStorage.setItem(onboardingKey(userId), 'true');
}

export async function saveAccessibilityPreference(userId: string, optionId: string): Promise<void> {
  await AsyncStorage.setItem(choiceKey(userId), optionId);
}

export async function getAccessibilityPreference(userId: string): Promise<string | null> {
  return AsyncStorage.getItem(choiceKey(userId));
}

/**
 * The upgrade from once-per-phone: the old onboarding flag, profile choice
 * and preferences go to the account that's signed in when this version
 * first runs (or the next existing account to log in) — once, then they're
 * removed. A brand-new account never calls this, so it never inherits them.
 */
export async function adoptLegacy(userId: string): Promise<void> {
  try {
    const old = Object.fromEntries(await AsyncStorage.multiGet([LEGACY_ONBOARDING, LEGACY_CHOICE, LEGACY_PREFERENCES]));
    if (!old[LEGACY_ONBOARDING] && !old[LEGACY_CHOICE] && !old[LEGACY_PREFERENCES]) return;
    const moves: [string, string][] = [];
    if (old[LEGACY_ONBOARDING] === 'true') moves.push([onboardingKey(userId), 'true']);
    if (old[LEGACY_CHOICE]) moves.push([choiceKey(userId), old[LEGACY_CHOICE]]);
    if (old[LEGACY_PREFERENCES] && !(await AsyncStorage.getItem(preferencesKey(userId)))) {
      moves.push([preferencesKey(userId), old[LEGACY_PREFERENCES]]);
    }
    if (moves.length) await AsyncStorage.multiSet(moves);
    await AsyncStorage.multiRemove([LEGACY_ONBOARDING, LEGACY_CHOICE, LEGACY_PREFERENCES]);
  } catch {
    // Storage trouble: try again next time.
  }
}
