import { useNetInfo } from '@react-native-community/netinfo';

/**
 * Whether the phone can reach the internet right now, for screens that need
 * to disable an online-only action (with a reason) rather than fail it.
 * Optimistic until NetInfo has answered, so nothing flickers to "offline"
 * on first render.
 */
export function useIsOnline(): boolean {
  const { isConnected, isInternetReachable } = useNetInfo();
  return isConnected !== false && isInternetReachable !== false;
}
