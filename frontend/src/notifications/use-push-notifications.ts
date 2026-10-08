import { useEffect } from 'react';
import { router } from 'expo-router';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { Notifications, registerForPush } from '@/notifications/push';

type PushData = { type?: string; friendId?: string; eventId?: string; userId?: string };

const OBJECT_ID = /^[a-f0-9]{24}$/;

/**
 * Where tapping a notification goes: a message → that chat; an SOS → Home,
 * where the SOS card (and the full-screen alert, if not seen yet) is.
 * Only for the account that's signed in now, and only to those two places —
 * a notification can never send the app anywhere else.
 */
function openFrom(data: PushData, currentUserId: string | null) {
  if (!currentUserId || data.userId !== currentUserId) return;
  if (data.type === 'dm' && data.friendId && OBJECT_ID.test(data.friendId)) {
    router.push({ pathname: '/chat/[friendId]', params: { friendId: data.friendId } });
  } else if (data.type === 'sos') {
    router.navigate('/');
  }
}

/**
 * Turns on push notifications for the signed-in user (asks permission the
 * first time) and handles taps on them — including the tap that opened the
 * app from closed. Does nothing where push isn't available (see push.ts).
 */
export function usePushNotifications() {
  const { isLoggedIn, userId } = useBootstrap();

  useEffect(() => {
    if (!Notifications || !isLoggedIn || !userId) return;
    void registerForPush(userId);

    // While AccessAI is open, its own alerts (full-screen SOS, spoken
    // messages) already show — so no banner on top, just the list entry.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      openFrom(response.notification.request.content.data as PushData, userId);
    });
    // The tap that opened the app from closed.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openFrom(response.notification.request.content.data as PushData, userId);
    });
    const tokenChanged = Notifications.addPushTokenListener(() => void registerForPush(userId));

    return () => {
      tapped.remove();
      tokenChanged.remove();
    };
  }, [isLoggedIn, userId]);
}
