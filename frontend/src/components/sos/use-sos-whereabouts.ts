import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import {
  accuracyText,
  describePlace,
  distanceAndDirection,
  locate,
  metersBetween,
  PLACE_LOOKUP_MS,
  type Coordinates,
  type FriendSos,
} from '@/utils/sos';

// This phone's own position, shared by every SOS alert and card, kept a
// minute (asking the GPS for each would be slow and drain the battery).
const MY_POSITION_MAX_AGE_MS = 60 * 1000;
let mine: { coords: Coordinates; at: number } | null = null;
let finding: Promise<Coordinates | null> | null = null;

function myPosition(): Promise<Coordinates | null> {
  if (mine && Date.now() - mine.at < MY_POSITION_MAX_AGE_MS) return Promise.resolve(mine.coords);
  finding ??= locate(Location.Accuracy.Balanced)
    .then((coords) => {
      if (coords) mine = { coords, at: Date.now() };
      return coords;
    })
    .finally(() => {
      finding = null;
    });
  return finding;
}

// Places looked up on this phone, per SOS. Looked up again only after the
// person moved more than 100 m, and at most every 2 minutes.
const RELOOK_METERS = 100;
const RELOOK_MS = 2 * 60 * 1000;
const places = new Map<string, { coords: Coordinates; at: number; place: string | null }>();

/**
 * Where a friend in trouble is, in words a person can use:
 * - place: "Rizal Ave, Manila" — from their phone, or else looked up on this
 *   one with the phone's built-in address lookup;
 * - distance: "About 350 m north of you" — worked out here, no internet
 *   (left out if this phone's location isn't allowed);
 * - accuracy: "accurate to 15 m" / "rough location".
 */
export function useSosWhereabouts(sos: FriendSos) {
  const [lookedUp, setLookedUp] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const latitude = sos.location?.latitude;
  const longitude = sos.location?.longitude;

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    let cancelled = false;
    void myPosition().then((me) => {
      if (!cancelled && me) setDistance(distanceAndDirection(me, { latitude, longitude }));
    });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    if (sos.place || latitude == null || longitude == null) return;
    const here = { latitude, longitude };
    const known = places.get(sos.eventId);
    if (known && (metersBetween(known.coords, here) < RELOOK_METERS || Date.now() - known.at < RELOOK_MS)) return;
    let cancelled = false;
    void describePlace(here, PLACE_LOOKUP_MS).then((found) => {
      places.set(sos.eventId, { coords: here, at: Date.now(), place: found ?? known?.place ?? null });
      if (!cancelled && found) setLookedUp(found);
    });
    return () => {
      cancelled = true;
    };
  }, [sos.eventId, sos.place, latitude, longitude]);

  return {
    place: sos.place ?? lookedUp ?? places.get(sos.eventId)?.place ?? null,
    distance,
    accuracy: accuracyText(sos.location?.accuracy),
  };
}

/** "About 350 m north of you" → "about 350 meters north of you", for reading aloud. */
export function spokenDistance(distance: string): string {
  return distance.replace(/(\d) m\b/, '$1 meters').replace(/(\d) km\b/, '$1 kilometers').replace(/^\w/, (c) => c.toLowerCase());
}

/** "sent 3 min ago, while offline" when an SOS was made offline and arrived later; otherwise null. */
export function offlineNote(sos: FriendSos, ago: (at: number) => string): string | null {
  if (!sos.occurredAt || sos.createdAt - sos.occurredAt < 60 * 1000) return null;
  return `Pressed ${ago(sos.occurredAt)}, while ${sos.name} had no internet.`;
}
