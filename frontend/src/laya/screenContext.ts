import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { registerScreen, type ScreenEntry } from '@/laya/screenRegistry';

export { currentScreen, screenOffers, type ScreenEntry } from '@/laya/screenRegistry';

/**
 * Tells Laya what this screen shows and can do while it's in focus (see
 * laya/screenRegistry.ts). The entry is read fresh each time Laya asks,
 * so its handlers always see the screen's current state; leaving the
 * screen removes it.
 */
export function useLayaScreen(entry: ScreenEntry): void {
  const latest = useRef(entry);
  useEffect(() => {
    latest.current = entry;
  });
  useFocusEffect(useCallback(() => registerScreen(() => latest.current), []));
}
