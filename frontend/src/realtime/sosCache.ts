import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FriendSos } from '@/utils/sos';

// Friends' active SOS alerts, kept on the phone so the Home card (with the
// last known location) still shows when the phone is offline. Cleared on
// sign-out with the rest of the friends data.
const ACTIVE_KEY = 'sos:friends-active:v1';
// SOS alerts this phone has already shown full-screen, so opening the app
// again doesn't show the same one twice.
const SHOWN_KEY = 'sos:shown:v1';
const MAX_SHOWN = 50;

export async function loadCachedFriendSos(): Promise<FriendSos[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as FriendSos[]) : [];
  } catch {
    return [];
  }
}

export async function cacheFriendSos(list: FriendSos[]): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(list)).catch(() => {});
}

export async function wasShown(eventId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SHOWN_KEY);
    return raw ? (JSON.parse(raw) as string[]).includes(eventId) : false;
  } catch {
    return false;
  }
}

export async function markShown(eventId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SHOWN_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes(eventId)) {
      await AsyncStorage.setItem(SHOWN_KEY, JSON.stringify([...list, eventId].slice(-MAX_SHOWN)));
    }
  } catch {
    // Worst case the alert shows again — never lost.
  }
}

export async function clearSosCache(): Promise<void> {
  await AsyncStorage.multiRemove([ACTIVE_KEY, SHOWN_KEY]).catch(() => {});
}
