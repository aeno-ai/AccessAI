import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_STORAGE_KEY = 'hasSeenOnboarding';
const ACCESSIBILITY_PREFERENCE_KEY = 'accessibilityPreference';

export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
  return value === 'true';
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
}

export async function saveAccessibilityPreference(optionId: string): Promise<void> {
  await AsyncStorage.setItem(ACCESSIBILITY_PREFERENCE_KEY, optionId);
}

export async function getAccessibilityPreference(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESSIBILITY_PREFERENCE_KEY);
}
