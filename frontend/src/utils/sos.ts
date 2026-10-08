import { Linking } from 'react-native';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import { apiFetch, isUnreachable } from '@/api/apiClient';
import { DEFAULT_SOS_MESSAGE } from '@/constants/dashboard';
import { getCachedContacts } from '@/utils/emergencyContacts';

export type Coordinates = { latitude: number; longitude: number };

/** How the SOS was started — saved with the event (the backend keeps it as free text). */
export type SosMethod = 'app-hold-confirm' | 'shake' | 'test' | 'voice';

/** The Philippines' national emergency hotline. */
export const EMERGENCY_NUMBER = '911';

const LOCATE_TIMEOUT_MS = 8000;
const PLACE_TIMEOUT_MS = 2500;

/**
 * The phone's position, from its own GPS — works with no internet. Uses the
 * last known fix if a fresh one takes too long, and null if location is off
 * or not allowed (the SOS still goes out, just without coordinates).
 */
export async function locate(accuracy: Location.Accuracy = Location.Accuracy.High): Promise<Coordinates | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) {
      return null;
    }
    const fresh = Location.getCurrentPositionAsync({ accuracy });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATE_TIMEOUT_MS));
    const position = (await Promise.race([fresh, timeout])) ?? (await Location.getLastKnownPositionAsync());
    return position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : null;
  } catch {
    return null;
  }
}

/**
 * A place a person can picture ("Rizal Ave, Manila") from the phone's
 * own map lookup. Often needs internet, so it gives up quickly and returns
 * null — the coordinates and map link are always sent anyway.
 */
export async function describePlace(coords: Coordinates | null): Promise<string | null> {
  if (!coords) return null;
  try {
    const lookup = Location.reverseGeocodeAsync(coords);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), PLACE_TIMEOUT_MS));
    const [place] = (await Promise.race([lookup, timeout])) ?? [];
    if (!place) return null;
    const street = place.street ?? place.name;
    const area = place.district ?? place.city ?? place.subregion ?? place.region;
    const parts = [street, area].filter((part, index, all) => part && all.indexOf(part) === index);
    return parts.length ? parts.join(', ').slice(0, 200) : null;
  } catch {
    return null;
  }
}

export function defaultSosMessage(coords: Coordinates | null, place?: string | null): string {
  const where = place ?? (coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : 'my current location');
  return DEFAULT_SOS_MESSAGE.replace('{location}', where);
}

export function mapsLink(coords: Coordinates): string {
  return `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
}

export type SosResult =
  | {
      sent: true;
      eventId: string | null;
      contactsToNotify: number;
      friendsAlerted: number;
      friendsOnline: number;
      alertedNames: string[];
      /** Until when the phone keeps sharing its location (ms), or null for a test. */
      sharingUntil: number | null;
    }
  | { sent: false; offline: boolean; error: string };

type TriggerResponse = {
  eventId?: string;
  contactsToNotify?: number;
  friendsAlerted?: number;
  friendsOnline?: number;
  alertedNames?: string[];
  sharingUntil?: number | null;
};

/**
 * Records the SOS with AccessAI, which alerts the user's SOS circle of
 * friends (live, by push notification, and in their chat). Never throws: a
 * failure comes back as `sent: false`, so the caller can fall back to
 * texting.
 */
export async function triggerSos(params: {
  method: SosMethod;
  message: string;
  coords: Coordinates | null;
  place?: string | null;
  isTest?: boolean;
}): Promise<SosResult> {
  try {
    const data = await apiFetch<TriggerResponse>('/sos/trigger', {
      method: 'POST',
      timeoutMs: 10000,
      body: JSON.stringify({
        triggerMethod: params.method,
        location: params.coords ?? undefined,
        place: params.place ?? undefined,
        message: params.message,
        isTest: params.isTest ?? false,
      }),
    });
    return {
      sent: true,
      eventId: data.eventId ?? null,
      contactsToNotify: data.contactsToNotify ?? 0,
      friendsAlerted: data.friendsAlerted ?? 0,
      friendsOnline: data.friendsOnline ?? 0,
      alertedNames: data.alertedNames ?? [],
      sharingUntil: data.sharingUntil ?? null,
    };
  } catch (error) {
    // No answer from the server (or a proxy saying it's down) means we
    // effectively weren't online.
    const offline = isUnreachable(error);
    return {
      sent: false,
      offline,
      error: offline ? 'No internet connection.' : error instanceof Error ? error.message : 'Could not send the SOS.',
    };
  }
}

/** Shares where the sender is now with everyone who got the SOS. */
export async function shareSosLocation(eventId: string, coords: Coordinates, accuracy?: number | null) {
  return apiFetch<{ saved: boolean }>(`/sos/${eventId}/location`, {
    method: 'PATCH',
    timeoutMs: 10000,
    body: JSON.stringify({ ...coords, ...(accuracy != null ? { accuracy } : {}) }),
  });
}

/** "I'm safe": ends the SOS and tells every friend who got it. */
export async function resolveSos(eventId: string) {
  return apiFetch(`/sos/${eventId}/resolve`, { method: 'PATCH', timeoutMs: 10000 });
}

export type SosAnswer = 'seen' | 'on_my_way';

/** A friend answering an SOS: the sender hears it. */
export async function respondToSos(eventId: string, kind: SosAnswer) {
  return apiFetch<{ kind: SosAnswer }>(`/sos/${eventId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ kind }),
  });
}

/** A friend's SOS that's still going — what the Home card shows. */
export type FriendSos = {
  eventId: string;
  friendId: string;
  name: string;
  message: string;
  isTest: boolean;
  createdAt: number;
  location: (Coordinates & { at: number }) | null;
  place: string | null;
  sharingUntil: number | null;
  myResponse: SosAnswer | null;
};

/** The user's own SOS that's still going, with who answered. */
export type MySos = {
  eventId: string;
  createdAt: number;
  isTest: boolean;
  sharingUntil: number | null;
  friendsAlerted: number;
  responses: { friendId: string; name: string; kind: SosAnswer; at: number }[];
};

export async function fetchActiveSos() {
  return apiFetch<{ friends: FriendSos[]; mine: MySos | null }>('/sos/active', { timeoutMs: 10000 });
}

export type TextResult = 'opened' | 'no-contacts' | 'unavailable';

/**
 * Opens the phone's messaging app with an SMS to every emergency contact,
 * message and map link filled in. SMS goes over the mobile network, so it
 * works without internet — but the user still has to press Send there:
 * phones don't let apps send texts silently.
 */
export async function textEmergencyContacts(message: string, coords: Coordinates | null): Promise<TextResult> {
  const contacts = await getCachedContacts();
  if (contacts.length === 0) {
    return 'no-contacts';
  }
  if (!(await SMS.isAvailableAsync())) {
    return 'unavailable';
  }
  const body = coords ? `${message}\nMap: ${mapsLink(coords)}` : message;
  await SMS.sendSMSAsync(
    contacts.map((contact) => contact.phoneNumber),
    body,
  );
  return 'opened';
}

/** Opens the dialer on the emergency hotline (the user confirms the call). */
export function callEmergencyNumber(): void {
  void Linking.openURL(`tel:${EMERGENCY_NUMBER}`);
}

/** "Ana, Ben and Cara" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
