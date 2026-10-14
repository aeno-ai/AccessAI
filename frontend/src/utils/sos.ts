import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import { apiFetch, isUnreachable } from '@/api/apiClient';
import { DEFAULT_SOS_MESSAGE } from '@/constants/dashboard';
import { getCachedContacts } from '@/utils/emergencyContacts';

export type Coordinates = {
  latitude: number;
  longitude: number;
  /** How exact the phone's GPS was, in meters (smaller is better). */
  accuracy?: number | null;
};

/** How the SOS was started — saved with the event (the backend keeps it as free text). */
export type SosMethod = 'app-hold-confirm' | 'shake' | 'test' | 'voice';

/** The Philippines' national emergency hotline. */
export const EMERGENCY_NUMBER = '911';

const LOCATE_TIMEOUT_MS = 8000;
const PLACE_TIMEOUT_MS = 2500;
/** The sender's phone looks the place up this long, after the SOS has already gone out. */
export const PLACE_LOOKUP_MS = 10000;

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
    return position
      ? { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }
      : null;
  } catch {
    return null;
  }
}

/**
 * A place a person can picture ("Rizal Ave, Manila") from the phone's own
 * built-in address lookup (no paid map service). Usually needs internet, so
 * it gives up after `timeoutMs` and returns null — the coordinates and map
 * link are always sent anyway.
 */
export async function describePlace(coords: Coordinates | null, timeoutMs = PLACE_TIMEOUT_MS): Promise<string | null> {
  if (!coords) return null;
  try {
    const lookup = Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
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

/**
 * The SOS text: with the place when known ("I'm at Rizal Ave, Manila").
 * Without one, it points to the map instead of reading out numbers nobody
 * can picture — friends see the place, distance and map in the alert, and
 * the text message carries the map link.
 */
export function defaultSosMessage(coords: Coordinates | null, place?: string | null): string {
  if (place) return DEFAULT_SOS_MESSAGE.replace('{location}', place);
  return coords ? 'I need help. Please come ASAP. My location is on the map.' : 'I need help. Please come ASAP.';
}

export function mapsLink(coords: Coordinates): string {
  return `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
}

/** Google Maps walking directions to the person (a link, not a paid service). */
export function directionsLink(coords: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}&travelmode=walking`;
}

const EARTH_RADIUS_M = 6371000;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** Straight-line distance in meters. */
export function metersBetween(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(h));
}

const DIRECTIONS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

/** Which way `to` is from `from`, as one of 8 compass directions. */
function directionTo(from: Coordinates, to: Coordinates): string {
  const y = Math.sin(toRad(to.longitude - from.longitude)) * Math.cos(toRad(to.latitude));
  const x =
    Math.cos(toRad(from.latitude)) * Math.sin(toRad(to.latitude)) -
    Math.sin(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.cos(toRad(to.longitude - from.longitude));
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return DIRECTIONS[Math.round(((degrees + 360) % 360) / 45) % 8];
}

/** "About 350 m north of you", "1.2 km northeast of you" — worked out on the phone, no internet. */
export function distanceAndDirection(me: Coordinates, them: Coordinates): string {
  const meters = metersBetween(me, them);
  if (meters < 30) return 'Very close to you';
  const size =
    meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
  return `About ${size} ${directionTo(me, them)} of you`;
}

/** "accurate to 15 m", or "rough location" when the GPS was vague. */
export function accuracyText(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  return meters > 100 ? 'rough location' : `accurate to ${Math.max(5, Math.round(meters))} m`;
}

/** The coordinates as the server takes them (accuracy only when the phone knew it). */
function locationBody(coords: Coordinates) {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    ...(coords.accuracy != null && Number.isFinite(coords.accuracy) ? { accuracy: Math.round(coords.accuracy) } : {}),
  };
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
  /** An SOS made offline earlier: when it really happened (ms). */
  occurredAt?: number;
}): Promise<SosResult> {
  try {
    const data = await apiFetch<TriggerResponse>('/sos/trigger', {
      method: 'POST',
      timeoutMs: 10000,
      body: JSON.stringify({
        triggerMethod: params.method,
        location: params.coords ? locationBody(params.coords) : undefined,
        place: params.place ?? undefined,
        message: params.message,
        isTest: params.isTest ?? false,
        occurredAt: params.occurredAt ? new Date(params.occurredAt).toISOString() : undefined,
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

/**
 * Shares where the sender is now with everyone who got the SOS — and the
 * readable place, once the phone has looked it up (friends get it at once).
 */
export async function shareSosLocation(eventId: string, coords: Coordinates, extra: { place?: string | null } = {}) {
  return apiFetch<{ saved: boolean }>(`/sos/${eventId}/location`, {
    method: 'PATCH',
    timeoutMs: 10000,
    body: JSON.stringify({ ...locationBody(coords), ...(extra.place ? { place: extra.place } : {}) }),
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
  /** Made offline and sent later: when it really happened. */
  occurredAt?: number | null;
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

// ---- Recent SOS (Home): the last week's, ended ones too

/** Home's "Recent SOS" goes back this far (the server's limit too). */
export const RECENT_SOS_MS = 7 * 24 * 60 * 60 * 1000;

/** How an SOS ended: the sender said they're safe, it ran out of time, or a newer SOS replaced it. */
export type SosEndReason = 'safe' | 'expired' | 'replaced';

/** One SOS from the last 7 days. */
export type RecentSos = {
  eventId: string;
  isTest: boolean;
  createdAt: number;
  occurredAt: number | null;
  place: string | null;
  /** The last place sent while it was going — never followed after it ended. */
  location: (Coordinates & { at: number }) | null;
  active: boolean;
  endedAt: number | null;
  endedReason: SosEndReason | null;
  responses: { friendId: string; name: string; kind: SosAnswer; at: number }[];
};

export type FriendRecentSos = RecentSos & { friendId: string; name: string; myResponse: SosAnswer | null };

export type RecentSosList = {
  /** Each friend's latest SOS sent to me. */
  friends: FriendRecentSos[];
  /** My own latest (PWD accounts only). */
  mine: (RecentSos & { friendsAlerted: number }) | null;
};

export async function fetchRecentSos() {
  return apiFetch<RecentSosList>('/sos/recent', { timeoutMs: 10000 });
}

/** The last list from the server, kept on the phone so Home shows it offline. */
export type SavedRecentSos = RecentSosList & { fetchedAt: number };

const recentKey = (userId: string) => `sos:recent:v1:${userId}`;

export async function loadRecentSos(userId: string): Promise<SavedRecentSos | null> {
  try {
    const raw = await AsyncStorage.getItem(recentKey(userId));
    return raw ? (JSON.parse(raw) as SavedRecentSos) : null;
  } catch {
    return null;
  }
}

export async function saveRecentSos(userId: string, saved: SavedRecentSos): Promise<void> {
  await AsyncStorage.setItem(recentKey(userId), JSON.stringify(saved)).catch(() => undefined);
}

// ---- SOS outbox: an SOS made offline, kept on the phone until it can go out

/** An SOS that couldn't reach AccessAI (no internet): sent once the phone is back online. */
export type PendingSos = {
  message: string;
  method: SosMethod;
  place: string | null;
  coords: Coordinates | null;
  /** When the person pressed SOS (ms). */
  occurredAt: number;
};

/** The server takes an SOS made offline up to this long after (backend sosValidators.js). */
export const PENDING_SOS_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const outboxKey = (userId: string) => `sos:outbox:v1:${userId}`;

/** Saves it (one at a time: a newer SOS replaces an older one). */
export async function saveSosOutbox(userId: string, sos: PendingSos): Promise<void> {
  await AsyncStorage.setItem(outboxKey(userId), JSON.stringify(sos)).catch(() => undefined);
}

export async function peekSosOutbox(userId: string): Promise<PendingSos | null> {
  try {
    const raw = await AsyncStorage.getItem(outboxKey(userId));
    return raw ? (JSON.parse(raw) as PendingSos) : null;
  } catch {
    return null;
  }
}

export async function dropSosOutbox(userId: string): Promise<void> {
  await AsyncStorage.removeItem(outboxKey(userId)).catch(() => undefined);
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
