import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { isApiError } from '@/api/apiClient';
import { SosFlow, type SosFlowKind } from '@/components/sos/SosFlow';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { useShake } from '@/hooks/use-shake';
import { useFriends } from '@/realtime/FriendsProvider';
import { announce } from '@/utils/a11y';
import { speakMixed } from '@/utils/speechHelper';
import {
  describePlace,
  dropSosOutbox,
  locate,
  metersBetween,
  peekSosOutbox,
  PENDING_SOS_MAX_AGE_MS,
  PLACE_LOOKUP_MS,
  resolveSos,
  saveSosOutbox,
  shareSosLocation,
  triggerSos,
  type Coordinates,
  type PendingSos,
  type SosMethod,
  type SosResult,
} from '@/utils/sos';

type SosContextValue = {
  /** Whether this account can send an SOS at all (PWD accounts). */
  available: boolean;
  /** The hold-to-send button: review the message, then send. */
  openReview: () => void;
  /** Settings → Test SOS: the countdown, marked as a test. */
  startTest: () => void;
  /** Accel ("send SOS"): the countdown, which can still be cancelled. */
  startCountdown: (method: SosMethod) => void;
  /** True while the SOS dialog is open (Accel and "Hey Accel" stay quiet then). */
  flowOpen: boolean;
  /**
   * "I'm safe": ends the user's active SOS and tells their friends — or, if
   * it hasn't gone out yet (made offline), simply never sends it.
   */
  markSafe: () => Promise<void>;
  /** An SOS made offline is waiting on this phone, to go out once back online. */
  sosPending: boolean;
  /** True while this phone is sharing its live location for an active SOS. */
  sharingLocation: boolean;
};

const SosContext = createContext<SosContextValue | null>(null);

const LOCATION_EVERY_MS = 30 * 1000;
const MIN_MOVE_METERS = 15;
const RESEND_AFTER_MS = 2 * 60 * 1000;


/**
 * Owns the SOS flow for the whole app, so any trigger — the hold button on
 * Home, shaking the phone on any screen, the test in Settings, Accel — opens
 * the same dialog. SOS is for PWD accounts (the backend refuses others); it's
 * only switched off when the role is known to be non-PWD, so an emergency
 * button never silently vanishes because the role couldn't be read.
 *
 * After a real SOS it keeps sharing the phone's location with the friends
 * who got it — every 30 seconds for 30 minutes, or until "I'm safe" — while
 * AccessAI is open (the screen is kept on meanwhile). Phones don't let an
 * app track location in the background without special permission, so it
 * pauses when the app is left and picks up again on return.
 *
 * Offline first: an SOS that can't reach AccessAI is kept on the phone (the
 * text to emergency contacts opens at once anyway) and sent the moment the
 * phone is back online or AccessAI opens, with the newest position and when
 * it really happened. "I'm safe" before then means it's never sent.
 */
export function SosProvider({ children }: { children: ReactNode }) {
  const { role, userId } = useBootstrap();
  const { prefs } = usePreferences();
  const { mySos, setMySos, connected } = useFriends();
  const screenReaderOn = useScreenReader();
  const [sosPending, setSosPending] = useState(false);
  const flushing = useRef(false);
  const [flow, setFlow] = useState<{ kind: SosFlowKind; method: SosMethod } | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [sharingEnded, setSharingEnded] = useState<string | null>(null);
  const lastSent = useRef<{ coords: Coordinates; at: number } | null>(null);
  const available = role !== 'non_pwd';

  useShake(() => setFlow((current) => current ?? { kind: 'countdown', method: 'shake' }), {
    enabled: available && prefs.shakeToSos && flow === null,
    sensitivity: prefs.shakeSensitivity,
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  const eventId = mySos?.eventId ?? null;
  const sharingUntil = mySos?.sharingUntil ?? null;
  const sharingLocation = eventId !== null && !mySos?.isTest && sharingUntil !== null && sharingEnded !== eventId;

  // The 30 minutes are up.
  useEffect(() => {
    if (!eventId || sharingUntil === null) return;
    const timer = setTimeout(() => setSharingEnded(eventId), Math.max(0, sharingUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [eventId, sharingUntil]);

  // The live location loop.
  useEffect(() => {
    if (!sharingLocation || !appActive || !eventId || !mySos?.sharingUntil) {
      return;
    }
    const until = mySos.sharingUntil;
    void activateKeepAwakeAsync('sos').catch(() => {});
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (Date.now() > until) {
        setSharingEnded(eventId);
        return;
      }
      const coords = await locate(Location.Accuracy.Balanced);
      if (!coords || stopped) return;
      const last = lastSent.current;
      const moved = last ? metersBetween(last.coords, coords) : Infinity;
      if (last && moved < MIN_MOVE_METERS && Date.now() - last.at < RESEND_AFTER_MS) return;
      try {
        await shareSosLocation(eventId, coords);
        lastSent.current = { coords, at: Date.now() };
      } catch (error) {
        // 409: the SOS ended or its 30 minutes are up — stop.
        if (isApiError(error) && (error.status === 409 || error.status === 404)) setSharingEnded(eventId);
        // Offline: try again on the next tick.
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), LOCATION_EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      deactivateKeepAwake('sos');
    };
  }, [sharingLocation, appActive, eventId, mySos?.sharingUntil]);

  const onSent = useCallback(
    (result: SosResult & { sent: true }, isTest: boolean) => {
      if (!result.eventId) return;
      lastSent.current = null;
      setMySos({
        eventId: result.eventId,
        createdAt: Date.now(),
        isTest,
        sharingUntil: result.sharingUntil,
        friendsAlerted: result.friendsAlerted,
        responses: [],
      });
    },
    [setMySos],
  );

  // ---- the SOS outbox
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void peekSosOutbox(userId).then((saved) => {
      if (!cancelled && saved) setSosPending(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const queueSos = useCallback(
    async (sos: PendingSos) => {
      if (!userId) return;
      await saveSosOutbox(userId, sos);
      setSosPending(true);
    },
    [userId],
  );

  const tell = useCallback(
    (text: string) => {
      if (screenReaderOn) announce(text);
      else void speakMixed(text, { rate: prefs.speechRate, sos: true });
    },
    [screenReaderOn, prefs.speechRate],
  );

  // Online again (the live connection is up — also right after AccessAI
  // opens): send the saved SOS. One run at a time.
  const sendSaved = useCallback(async () => {
    if (!userId || flushing.current) return;
    flushing.current = true;
    try {
      const saved = await peekSosOutbox(userId);
      if (!saved || Date.now() - saved.occurredAt > PENDING_SOS_MAX_AGE_MS) {
        // Nothing waiting — or too old for the server to take any more.
        if (saved) await dropSosOutbox(userId);
        setSosPending(false);
        return;
      }
      const newest = (await locate(Location.Accuracy.Balanced)) ?? saved.coords;
      const outcome = await triggerSos({
        method: saved.method,
        message: saved.message,
        coords: newest,
        place: saved.place,
        occurredAt: saved.occurredAt,
      });
      if (!outcome.sent) {
        // Still offline: try again next time. Refused for good: drop it.
        if (!outcome.offline) {
          await dropSosOutbox(userId);
          setSosPending(false);
        }
        return;
      }
      await dropSosOutbox(userId);
      setSosPending(false);
      onSent(outcome, false);
      tell(outcome.friendsAlerted ? 'You are back online. Your SOS reached your friends.' : 'You are back online. Your SOS was saved.');
      // Online now: the readable place follows for friends.
      if (!saved.place && newest && outcome.eventId) {
        const id = outcome.eventId;
        void describePlace(newest, PLACE_LOOKUP_MS).then((place) => {
          if (place) void shareSosLocation(id, newest, { place }).catch(() => undefined);
        });
      }
    } finally {
      flushing.current = false;
    }
  }, [userId, onSent, tell]);

  useEffect(() => {
    if (connected && sosPending) void sendSaved();
  }, [connected, sosPending, sendSaved]);

  const markSafe = useCallback(async () => {
    // Not sent yet: it never will be.
    if (sosPending && userId) {
      await dropSosOutbox(userId);
      setSosPending(false);
      if (!eventId) return;
    }
    if (!eventId) return;
    await resolveSos(eventId); // throws a readable message when offline
    setSharingEnded(eventId);
    setMySos(null);
  }, [eventId, setMySos, sosPending, userId]);

  const openReview = useCallback(() => setFlow({ kind: 'review', method: 'app-hold-confirm' }), []);
  const startTest = useCallback(() => setFlow({ kind: 'test', method: 'test' }), []);
  const startCountdown = useCallback(
    (method: SosMethod) => setFlow((current) => current ?? { kind: 'countdown', method }),
    [],
  );
  const flowOpen = flow !== null;
  const value = useMemo(
    () => ({ available, openReview, startTest, startCountdown, flowOpen, markSafe, sharingLocation, sosPending }),
    [available, openReview, startTest, startCountdown, flowOpen, markSafe, sharingLocation, sosPending],
  );

  return (
    <SosContext.Provider value={value}>
      {children}
      {flow ? (
        <SosFlow
          kind={flow.kind}
          method={flow.method}
          onSent={(result) => onSent(result, flow.kind === 'test')}
          onQueued={queueSos}
          onMarkSafe={markSafe}
          onClose={() => setFlow(null)}
        />
      ) : null}
    </SosContext.Provider>
  );
}

export function useSos() {
  const context = useContext(SosContext);
  if (!context) {
    throw new Error('useSos must be used inside SosProvider');
  }
  return context;
}
