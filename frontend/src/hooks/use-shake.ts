import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import type { ShakeSensitivity } from '@/hooks/use-preferences';

// Total acceleration (in g — 1 g is the phone lying still) that counts as
// one hard shake. Light is easiest to set off; Firm needs a real effort.
// Tuned so walking (~1.2–1.5 g) never counts; tune further on real phones.
const THRESHOLD_G: Record<ShakeSensitivity, number> = {
  light: 1.8,
  normal: 2.4,
  firm: 3.0,
};

const SHAKES_NEEDED = 3;
const WINDOW_MS = 1500;
// One back-and-forth movement produces a burst of readings; this keeps it
// from counting as several shakes.
const MIN_GAP_MS = 150;
const COOLDOWN_MS = 10_000;
const UPDATE_INTERVAL_MS = 100;

/**
 * Calls `onShake` when the phone is shaken hard three times within 1.5
 * seconds. Only listens while `enabled` and the app is open on screen —
 * phones don't let apps read the motion sensors in the background, so this
 * can't work with the app closed (the phone's own emergency SOS can).
 */
export function useShake(onShake: () => void, { enabled, sensitivity }: { enabled: boolean; sensitivity: ShakeSensitivity }) {
  const onShakeRef = useRef(onShake);
  useEffect(() => {
    onShakeRef.current = onShake;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let subscription: { remove: () => void } | null = null;
    let peaks: number[] = [];
    let cooldownUntil = 0;
    let cancelled = false;
    let starting = false;

    const listen = async () => {
      if (subscription || starting || cancelled) return;
      starting = true;
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      starting = false;
      // Gone to the background (or turned off) while checking.
      if (!available || cancelled || subscription || AppState.currentState !== 'active') return;
      Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const now = Date.now();
        if (now < cooldownUntil) return;
        const force = Math.sqrt(x * x + y * y + z * z);
        if (force < THRESHOLD_G[sensitivity]) return;
        const last = peaks[peaks.length - 1];
        if (last !== undefined && now - last < MIN_GAP_MS) return;
        peaks = [...peaks.filter((time) => now - time < WINDOW_MS), now];
        if (peaks.length >= SHAKES_NEEDED) {
          peaks = [];
          cooldownUntil = now + COOLDOWN_MS;
          onShakeRef.current();
        }
      });
    };

    const stop = () => {
      subscription?.remove();
      subscription = null;
      peaks = [];
    };

    if (AppState.currentState === 'active') void listen();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void listen();
      else stop();
    });

    return () => {
      cancelled = true;
      appState.remove();
      stop();
    };
  }, [enabled, sensitivity]);
}
