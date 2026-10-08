import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, apiUrl } from '@/api/apiClient';
import { block, unblock } from '@/audio/recognizer';
import { SosAlertModal } from '@/components/sos/SosAlertModal';
import { backfill, flushOutbox, saveServerMessage, type ServerMessage } from '@/db/directMessages';
import { listCachedFriends, replaceCachedFriends, type Friend } from '@/db/friends';
import { useAlerts } from '@/hooks/use-alerts';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { EventHub } from '@/realtime/events';
import { cacheFriendSos, loadCachedFriendSos, markShown, wasShown } from '@/realtime/sosCache';
import { fetchActiveSos, respondToSos, type FriendSos, type MySos, type SosAnswer } from '@/utils/sos';
import { getToken } from '@/utils/tokenStorage';

export type FriendRequest = {
  id: string;
  person: { userId: string; name: string; firstName: string; note: string };
  createdAt: number;
};

/** What the server sends a friend in someone's SOS circle (backend sosController). */
type SosAlertPayload = Omit<FriendSos, 'location' | 'myResponse'> & {
  location: { latitude: number; longitude: number } | null;
};

type SosEnded = 'safe' | 'expired';

// A missed SOS older than this isn't shown full-screen on opening the app
// (it stays on the Home card until it ends).
const MISSED_ALERT_WINDOW_MS = 6 * 60 * 60 * 1000;

type LiveEvents = {
  'dm:new': { friendId: string; message: ServerMessage };
  'dm:read': { friendId: string; readAt: number };
};

type FriendsContextValue = {
  /** True while the live connection to AccessAI is up. */
  connected: boolean;
  /** Saved on the phone, so this works offline. */
  friends: Friend[];
  requests: { incoming: FriendRequest[]; outgoing: FriendRequest[] };
  /** Your own friend code, once known (needs the internet the first time). */
  friendCode: string | null;
  /** Reloads friends and requests from AccessAI (keeps the saved list if offline). */
  refresh: () => Promise<Friend[]>;
  /** Live chat events for the open chat screen. Returns an unsubscribe function. */
  onLive: EventHub<LiveEvents>['on'];
  /**
   * The chat currently on screen. Its new messages don't count as unread
   * (they're still read aloud / announced, per the user's settings).
   */
  setActiveChat: (friendId: string | null) => void;
  /** Friends' SOS alerts that are still going (newest location included). Saved for offline. */
  friendSos: FriendSos[];
  /** The user's own SOS that's still going, with who answered — or null. */
  mySos: MySos | null;
  /** Remember the SOS just sent (before the server is asked again). */
  setMySos: (sos: MySos | null) => void;
  /** Answer a friend's SOS: they hear it. Throws a readable error if it can't be sent. */
  respondSos: (eventId: string, kind: SosAnswer) => Promise<void>;
  /** Opens a friend's SOS full-screen again (from the Home card). */
  showSos: (eventId: string) => void;
};

const FriendsContext = createContext<FriendsContextValue | null>(null);

// The socket lives on the same server as the API, without the /api part.
const SOCKET_URL = apiUrl('').replace(/\/api\/?$/, '');

const timeOf = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * Friends and online chat for the whole app: keeps the live connection to
 * AccessAI open while signed in, keeps the friends list and requests current,
 * stores incoming messages on the phone, and alerts the user (vibrate /
 * flash / read aloud, per their settings) to new messages and SOS alerts.
 * On every (re)connection it sends messages written offline, fetches
 * anything that arrived while away, and checks for friends' SOS alerts that
 * are still going — so an SOS is never missed just because the app was
 * closed.
 */
export function FriendsProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useBootstrap();
  const { notify } = useAlerts();
  const [connected, setConnected] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendsContextValue['requests']>({ incoming: [], outgoing: [] });
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [friendSos, setFriendSos] = useState<FriendSos[]>([]);
  const [mySos, setMySos] = useState<MySos | null>(null);
  // The SOS shown full-screen (kept after it ends, to show "safe now").
  const [alert, setAlert] = useState<{ sos: FriendSos; ended: SosEnded | null } | null>(null);
  const [hub] = useState(() => new EventHub<LiveEvents>());
  const activeChat = useRef<string | null>(null);
  const friendsRef = useRef<Friend[]>([]);
  const friendSosRef = useRef<FriendSos[]>([]);
  const notifyRef = useRef(notify);

  useEffect(() => {
    friendsRef.current = friends;
    friendSosRef.current = friendSos;
    notifyRef.current = notify;
  });

  const refresh = useCallback(async (): Promise<Friend[]> => {
    try {
      const [list, pending, me] = await Promise.all([
        apiFetch<Friend[]>('/friends'),
        apiFetch<FriendsContextValue['requests']>('/friends/requests'),
        apiFetch<{ friendCode: string }>('/friends/me'),
      ]);
      await replaceCachedFriends(list);
      setFriends(list);
      setRequests(pending);
      setFriendCode(me.friendCode);
      return list;
    } catch {
      // Offline — the friends saved on the phone are still shown.
      const cached = await listCachedFriends();
      setFriends(cached);
      return cached;
    }
  }, []);

  // Friends' SOS list: always saved, so the Home card works offline.
  const updateFriendSos = useCallback((change: (current: FriendSos[]) => FriendSos[]) => {
    setFriendSos((current) => {
      const next = change(current);
      void cacheFriendSos(next);
      return next;
    });
  }, []);

  const showAlertFor = useCallback((sos: FriendSos) => {
    setAlert({ sos, ended: null });
    void markShown(sos.eventId);
  }, []);

  // Active SOS from the server, on every (re)connection: a friend who just
  // opened the app learns about an SOS they missed — shown full-screen once,
  // then on the Home card until it ends.
  const loadSos = useCallback(async () => {
    try {
      const { friends: active, mine } = await fetchActiveSos();
      updateFriendSos(() => active);
      setMySos(mine);
      for (const sos of active) {
        if (sos.myResponse || Date.now() - sos.createdAt > MISSED_ALERT_WINDOW_MS || (await wasShown(sos.eventId))) {
          continue;
        }
        showAlertFor(sos);
        notifyRef.current({
          kind: 'sos',
          text: `${sos.isTest ? 'Test SOS' : 'Emergency SOS'} from ${sos.name}, sent at ${timeOf(sos.createdAt)}. ${sos.message}`,
        });
        break;
      }
    } catch {
      // Offline: the saved list stays on the Home card.
    }
  }, [updateFriendSos, showAlertFor]);

  // Sends what was written offline, then catches up every chat.
  const catchUp = useCallback(async () => {
    const list = await refresh();
    await loadSos();
    await flushOutbox();
    for (const friend of list) {
      try {
        await backfill(friend.userId);
      } catch {
        return; // dropped offline again
      }
    }
  }, [refresh, loadSos]);

  // Lives inside the signed-in part of the app, so signing out unmounts it
  // (and its state) entirely; the check is only belt and braces.
  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    void listCachedFriends().then(setFriends);
    void loadCachedFriendSos().then(setFriendSos);

    const socket: Socket = io(SOCKET_URL, {
      // A function, so a reconnection always uses the current login token.
      auth: (send) => {
        void getToken().then((token) => send({ token }));
      },
      transports: ['websocket'],
      reconnectionDelayMax: 10_000,
    });

    // Tells the server whether AccessAI is on screen, so it knows when a
    // push notification is needed instead of a live alert.
    const reportAppState = () => socket.emit('app:state', { foreground: AppState.currentState === 'active' });
    const appStateSubscription = AppState.addEventListener('change', reportAppState);

    socket.on('connect', () => {
      setConnected(true);
      reportAppState();
      void catchUp();
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('friends:changed', () => void refresh());

    socket.on('presence', ({ userId, online }: { userId: string; online: boolean }) => {
      setFriends((current) => current.map((f) => (f.userId === userId ? { ...f, online } : f)));
    });

    socket.on('dm:new', async (payload: LiveEvents['dm:new']) => {
      await saveServerMessage(payload.friendId, payload.message);
      const isOpen = activeChat.current === payload.friendId;
      setFriends((current) =>
        current.map((f) =>
          f.userId === payload.friendId
            ? {
                ...f,
                unread: isOpen ? f.unread : f.unread + 1,
                lastMessage: {
                  body: payload.message.body,
                  kind: payload.message.kind,
                  fromMe: payload.message.fromMe,
                  createdAt: payload.message.createdAt,
                },
              }
            : f,
        ),
      );
      hub.emit('dm:new', payload);
      // SOS messages get their own, bigger alert (sos:alert).
      if (payload.message.kind !== 'sos') {
        const name = friendsRef.current.find((f) => f.userId === payload.friendId)?.firstName ?? 'A friend';
        notifyRef.current({ kind: 'message', text: `${name} said: ${payload.message.body}` });
      }
    });

    socket.on('dm:read', (payload: LiveEvents['dm:read']) => hub.emit('dm:read', payload));

    socket.on('sos:alert', (payload: SosAlertPayload) => {
      const sos: FriendSos = {
        ...payload,
        location: payload.location ? { ...payload.location, at: payload.createdAt } : null,
        myResponse: null,
      };
      updateFriendSos((current) => [sos, ...current.filter((s) => s.eventId !== sos.eventId && s.friendId !== sos.friendId)]);
      showAlertFor(sos);
      notifyRef.current({
        kind: 'sos',
        text: `${sos.isTest ? 'Test SOS' : 'Emergency SOS'} from ${sos.name}. ${sos.message}`,
      });
    });

    // The sender's phone shared a newer position.
    socket.on('sos:location', ({ eventId, location }: { eventId: string; location: FriendSos['location'] }) => {
      updateFriendSos((current) => current.map((s) => (s.eventId === eventId ? { ...s, location } : s)));
      setAlert((current) =>
        current && current.sos.eventId === eventId ? { ...current, sos: { ...current.sos, location } } : current,
      );
    });

    socket.on(
      'sos:resolved',
      ({ eventId, name, reason }: { eventId: string; name: string; reason: SosEnded | 'replaced' }) => {
        const wasFriends = friendSosRef.current.some((s) => s.eventId === eventId);
        updateFriendSos((current) => current.filter((s) => s.eventId !== eventId));
        setMySos((current) => (current?.eventId === eventId ? null : current));
        // A replaced SOS is followed straight away by the new one's alert.
        setAlert((current) =>
          current && current.sos.eventId === eventId ? (reason === 'replaced' ? null : { ...current, ended: reason }) : current,
        );
        if (reason === 'safe' && wasFriends) {
          notifyRef.current({ kind: 'sos-update', text: `${name} is safe now. Their SOS has ended.` });
        }
      },
    );

    // On the sender's phone: a friend answered their SOS.
    socket.on(
      'sos:response',
      ({ eventId, friendId, name, kind, at }: { eventId: string; friendId: string; name: string; kind: SosAnswer; at: number }) => {
        setMySos((current) =>
          current && current.eventId === eventId
            ? { ...current, responses: [...current.responses.filter((r) => r.friendId !== friendId), { friendId, name, kind, at }] }
            : current,
        );
        notifyRef.current({
          kind: 'sos-update',
          text: kind === 'on_my_way' ? `${name} is on the way.` : `${name} saw your SOS.`,
        });
      },
    );

    return () => {
      appStateSubscription.remove();
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, [isLoggedIn, refresh, catchUp, hub, updateFriendSos, showAlertFor]);

  // While a friend's SOS is on screen, "Hey Accel" stays quiet.
  useEffect(() => {
    if (alert) block('sos-alert');
    else unblock('sos-alert');
  }, [alert]);

  const setActiveChat = useCallback((friendId: string | null) => {
    activeChat.current = friendId;
    if (friendId) {
      setFriends((current) => current.map((f) => (f.userId === friendId ? { ...f, unread: 0 } : f)));
    }
  }, []);

  const onLive = useCallback<FriendsContextValue['onLive']>((event, handler) => hub.on(event, handler), [hub]);

  const respondSos = useCallback(
    async (eventId: string, kind: SosAnswer) => {
      const { kind: saved } = await respondToSos(eventId, kind);
      updateFriendSos((current) => current.map((s) => (s.eventId === eventId ? { ...s, myResponse: saved } : s)));
      setAlert((current) =>
        current && current.sos.eventId === eventId ? { ...current, sos: { ...current.sos, myResponse: saved } } : current,
      );
    },
    [updateFriendSos],
  );

  const showSos = useCallback((eventId: string) => {
    const sos = friendSosRef.current.find((s) => s.eventId === eventId);
    if (sos) setAlert({ sos, ended: null });
  }, []);

  const value = useMemo(
    () => ({
      connected,
      friends,
      requests,
      friendCode,
      refresh,
      onLive,
      setActiveChat,
      friendSos,
      mySos,
      setMySos,
      respondSos,
      showSos,
    }),
    [connected, friends, requests, friendCode, refresh, onLive, setActiveChat, friendSos, mySos, respondSos, showSos],
  );

  return (
    <FriendsContext.Provider value={value}>
      {children}
      {alert ? (
        <SosAlertModal
          sos={alert.sos}
          ended={alert.ended}
          onRespond={(kind) => respondSos(alert.sos.eventId, kind)}
          onClose={() => setAlert(null)}
        />
      ) : null}
    </FriendsContext.Provider>
  );
}

export function useFriends() {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used inside FriendsProvider');
  }
  return context;
}
