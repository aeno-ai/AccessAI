import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Vibration, View } from 'react-native';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { announce } from '@/utils/a11y';
import { speakMixed } from '@/utils/speechHelper';

/**
 * - message: a friend's chat message
 * - sos: someone's emergency (always spoken)
 * - sos-update: news about an SOS — "Ana is on the way", "Ben is safe now"
 *   (always spoken too: the person who sent an SOS may not see the screen)
 */
export type AlertKind = 'message' | 'sos' | 'sos-update';

type Notification = {
  kind: AlertKind;
  /** What to say: read aloud, or announced by TalkBack / VoiceOver. */
  text: string;
};

type AlertsContextValue = {
  /**
   * Gets the user's attention in whatever ways they've chosen in Settings:
   * a vibration, a screen flash (for Deaf users), and the text read aloud —
   * or announced instead, when a screen reader is on, so the two never talk
   * over each other.
   */
  notify: (notification: Notification) => void;
};

const VIBRATIONS: Record<AlertKind, number[]> = {
  message: [0, 60, 90, 60],
  sos: [0, 500, 200, 500, 200, 500],
  'sos-update': [0, 200, 120, 200],
};

// Two flashes, each 250 ms on and 350 ms off — well under the 3-per-second
// limit for flashing content (WCAG 2.3.1).
const FLASH_ON_MS = 250;
const FLASH_OFF_MS = 350;
const FLASHES = 2;
// With reduced motion: one steady highlighted border instead of flashing.
const STILL_HIGHLIGHT_MS = 1500;

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { prefs } = usePreferences();
  const { colors, reduceMotion } = useAppTheme();
  const screenReaderOn = useScreenReader();
  const [flash, setFlash] = useState<{ kind: AlertKind; still: boolean } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const startFlash = useCallback(
    (kind: AlertKind) => {
      clearTimers();
      if (reduceMotion) {
        setFlash({ kind, still: true });
        timers.current.push(setTimeout(() => setFlash(null), STILL_HIGHLIGHT_MS));
        return;
      }
      for (let i = 0; i < FLASHES; i++) {
        const onAt = i * (FLASH_ON_MS + FLASH_OFF_MS);
        timers.current.push(setTimeout(() => setFlash({ kind, still: false }), onAt));
        timers.current.push(setTimeout(() => setFlash(null), onAt + FLASH_ON_MS));
      }
    },
    [reduceMotion],
  );

  const notify = useCallback(
    ({ kind, text }: Notification) => {
      if (prefs.vibrateAlerts) {
        Vibration.vibrate(VIBRATIONS[kind]);
      }
      if (prefs.flashAlerts) {
        startFlash(kind);
      }
      if (screenReaderOn) {
        announce(text);
      } else if (kind !== 'message' || prefs.readIncomingAloud) {
        // Anything about an SOS is always spoken; ordinary messages only if asked for.
        void speakMixed(text, { rate: prefs.speechRate });
      }
    },
    [prefs.vibrateAlerts, prefs.flashAlerts, prefs.readIncomingAloud, prefs.speechRate, screenReaderOn, startFlash],
  );

  const value = useMemo(() => ({ notify }), [notify]);
  const flashColor = flash?.kind === 'message' || !flash ? colors.primary : colors.danger;

  return (
    <AlertsContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {flash ? (
          <View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[
              StyleSheet.absoluteFill,
              flash.still
                ? { borderWidth: 10, borderColor: flashColor }
                : { backgroundColor: flashColor, opacity: 0.45 },
            ]}
          />
        ) : null}
      </View>
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error('useAlerts must be used inside AlertsProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
