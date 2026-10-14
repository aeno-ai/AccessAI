import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { registerScreen, type ScreenEntry } from '@/accel/screenRegistry';

export { currentScreen, screenOffers, type ScreenEntry } from '@/accel/screenRegistry';

/**
 * Tells Accel what this screen shows and can do while it's in focus (see
 * accel/screenRegistry.ts). The entry is read fresh each time Accel asks,
 * so its handlers always see the screen's current state; leaving the
 * screen removes it.
 */
export function useAccelScreen(entry: ScreenEntry): void {
  const latest = useRef(entry);
  useEffect(() => {
    latest.current = entry;
  });
  useFocusEffect(useCallback(() => registerScreen(() => latest.current), []));
}
