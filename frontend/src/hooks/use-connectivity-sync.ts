import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncConversations } from '@/db/sync';

/**
 * Watches for the device coming back online and kicks off a best-effort
 * conversation sync when it does. Mounted once, near the app root, so a
 * reconnect anywhere in the app (not just while History is open) gets
 * picked up. History also syncs on its own when it gains focus (see
 * history.tsx), so this is a proactive extra, not the only trigger.
 */
export function useConnectivitySync() {
  const wasOnline = useRef<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      const cameOnline = wasOnline.current === false && isOnline;
      wasOnline.current = isOnline;

      if (cameOnline) {
        void syncConversations();
      }
    });

    return () => unsubscribe();
  }, []);
}
