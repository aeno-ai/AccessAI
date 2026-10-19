import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { apiFetch } from '@/api/apiClient';

/**
 * Push notifications: friends' SOS alerts and messages reach this phone
 * even when AccessAI is closed.
 *
 * How it works: expo-notifications asks Google (Android, through Firebase)
 * or Apple (iPhone) for this phone's "push token" — an address. We save it
 * on the AccessAI server (PUT /api/push/token). When a friend sends an SOS,
 * the server sends the alert to that address through Expo's free push
 * service (backend utils/push.js).
 *
 * Works in the development build (and store builds) once Firebase is set up
 * (see HANDOFF.md). It switches itself off, without errors, in Expo Go
 * (Android Expo Go can't receive push), in a build made before
 * expo-notifications was added, and on iPhone until there's a paid Apple
 * developer account.
 */
type NotificationsModule = typeof import('expo-notifications');

export const pushSupported = !isRunningInExpoGo() && requireOptionalNativeModule('ExpoPushTokenManager') !== null;

// Loaded only when it can work, so Expo Go never even imports it.
export const Notifications: NotificationsModule | null = pushSupported
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-notifications') as NotificationsModule)
  : null;

const DEVICE_ID_KEY = 'device:id:v1';
const REGISTERED_KEY = 'push:registered:v1';
// The phone's own push token and the Expo address made from it, so the same
// phone token never asks Expo's server again.
const DEVICE_TOKEN_KEY = 'push:device:v1';

type DevicePushToken = Awaited<ReturnType<NonNullable<NotificationsModule>['getDevicePushTokenAsync']>>;

// The newest phone push token this app has seen. Asking Android for it also
// fires the "token changed" event with the same token — comparing against
// this is what stops that event from starting another registration (which
// used to loop for as long as someone was signed in).
let lastDeviceToken: string | null = null;

/** The phone push token the last registration used (null before the first). */
export function lastKnownDeviceToken(): string | null {
  return lastDeviceToken;
}

// One registration at a time: a second call for the same account while one
// is running gets the same answer instead of starting its own.
let running: { userId: string; done: Promise<'on' | 'off' | 'denied'> } | null = null;

/** A random id for this phone, so signing in again replaces its old address. */
async function deviceId(): Promise<string> {
  const saved = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (saved) return saved;
  const id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

/**
 * Android groups notifications into "channels" the person can tune in their
 * phone's settings. An SOS uses the loudest kind.
 *
 * The ids must match what the server sends (backend sosController.js and
 * directMessageController.js). A channel's sound and importance can never
 * change once created (Android's rule — even deleting and re-creating it
 * brings the old settings back), so a fix means a NEW id. `sound` is left
 * out on purpose: it names a custom sound file; leaving it out means the
 * phone's normal notification sound.
 */
export const CHANNELS = { sos: 'sos_alerts', sosUpdates: 'sos_updates', messages: 'chat_messages' } as const;
// Ids from an earlier version that had a broken sound setting.
const OLD_CHANNELS = ['sos', 'sos-updates', 'messages'];

async function ensureChannels(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  const { AndroidImportance, AndroidNotificationVisibility } = Notifications;
  for (const id of OLD_CHANNELS) {
    await Notifications.deleteNotificationChannelAsync(id).catch(() => {});
  }
  await Notifications.setNotificationChannelAsync(CHANNELS.sos, {
    name: 'SOS alerts',
    description: 'A friend in whose SOS circle you are needs help.',
    importance: AndroidImportance.MAX,
    vibrationPattern: [0, 800, 400, 800, 400, 800],
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.sosUpdates, {
    name: 'SOS updates',
    description: 'A friend is on the way, or someone is safe now.',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 300, 200, 300],
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.messages, {
    name: 'Messages',
    description: "Friends' chat messages.",
    importance: AndroidImportance.HIGH,
  });
}

/** The Expo address for this phone token — from the phone's memory when it's the same token as before. */
async function expoTokenFor(device: DevicePushToken, projectId: string | undefined): Promise<string> {
  const deviceToken = String(device.data);
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(DEVICE_TOKEN_KEY)) ?? 'null') as {
      device?: string;
      expo?: string;
      projectId?: string;
    } | null;
    if (saved?.device === deviceToken && saved.projectId === projectId && saved.expo) return saved.expo;
  } catch {
    // Unreadable — ask Expo again.
  }
  const { data: expo } = await Notifications!.getExpoPushTokenAsync({ ...(projectId ? { projectId } : {}), devicePushToken: device });
  await AsyncStorage.setItem(DEVICE_TOKEN_KEY, JSON.stringify({ device: deviceToken, expo, projectId }));
  return expo;
}

/**
 * Asks permission (once) and saves this phone's push address for `userId`.
 * Quietly does nothing if push can't work here or the person said no.
 * `device`: the new phone token from a "token changed" event, if that's what
 * started this (so the phone isn't asked again).
 */
export function registerForPush(userId: string, device?: DevicePushToken): Promise<'on' | 'off' | 'denied'> {
  if (running?.userId === userId && !device) return running.done;
  const previous = running?.done ?? Promise.resolve('off' as const);
  const done = previous
    .catch(() => 'off' as const)
    .then(() => register(userId, device))
    .finally(() => {
      if (running?.done === done) running = null;
    });
  running = { userId, done };
  return done;
}

async function register(userId: string, newDevice?: DevicePushToken): Promise<'on' | 'off' | 'denied'> {
  if (!Notifications) return 'off';
  try {
    await ensureChannels(); // Android 13+ only shows the permission prompt after a channel exists
    let { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    if (!granted && canAskAgain) {
      ({ granted } = await Notifications.requestPermissionsAsync());
    }
    if (!granted) return 'denied';

    const device = newDevice ?? (await Notifications.getDevicePushTokenAsync());
    lastDeviceToken = String(device.data);
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = await expoTokenFor(device, projectId);
    const id = await deviceId();
    const already = await AsyncStorage.getItem(REGISTERED_KEY);
    if (already !== `${userId}:${token}`) {
      await apiFetch('/push/token', {
        method: 'PUT',
        body: JSON.stringify({ token, deviceId: id, platform: Platform.OS === 'ios' ? 'ios' : 'android' }),
      });
      await AsyncStorage.setItem(REGISTERED_KEY, `${userId}:${token}`);
    }
    return 'on';
  } catch {
    // No Firebase set up yet, no internet, iPhone without an Apple account…
    // The app works the same, just without notifications while it's closed.
    return 'off';
  }
}

/**
 * This phone's id, sent with POST /auth/logout so the server drops its
 * push address. Null where push doesn't work (nothing to drop).
 */
export async function pushDeviceId(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    return await deviceId();
  } catch {
    return null;
  }
}

/**
 * Signing out, on this phone: forgets the registration and clears its
 * notifications. The server drops the address through POST /auth/logout
 * (use-bootstrap signOut); offline, it's dropped when the next person signs
 * in on this phone (backend pushController).
 */
export async function unregisterPush(): Promise<void> {
  if (!Notifications) return;
  try {
    await AsyncStorage.removeItem(REGISTERED_KEY);
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Nothing else to do.
  }
}
