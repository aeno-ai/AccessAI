import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ListeningPhase } from '@/hooks/use-speech-to-text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type ListeningPanelProps = {
  phase: Exclude<ListeningPhase, 'idle'>;
  /** Input loudness, 0–1. */
  level: number;
  /** Words heard so far that aren't final yet. */
  interimText: string;
  /** When the mic opened (ms), for the timer. */
  startedAt: number | null;
  /** Set when listening offline: the one language being heard. */
  offlineLanguageName: string | null;
  /** Whose words are being captured, e.g. "Them" or "you". */
  listeningTo?: string;
  onStop: () => void;
};

const STATUS: Record<ListeningPanelProps['phase'], string> = {
  starting: 'Starting the microphone…',
  listening: 'Listening — speak now',
  hearing: 'Hearing you…',
};

// How tall each of the five bars gets at full volume, middle tallest.
const BAR_WEIGHTS = [0.55, 0.8, 1, 0.8, 0.55];
const BAR_MAX = 22;
const BAR_MIN = 4;

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Shown above the message box while the mic is on, so it's unmistakable
 * that the app is listening — even when the box already has text in it and
 * its placeholder can't be seen. Says what stage it's at, shows live input
 * level and the words as they're heard, and has a big Stop button.
 *
 * Deliberately not a live region: anything the screen reader said aloud now
 * would be picked up by the mic. The Composer gives a vibration when the mic
 * opens and announces the result once it closes instead.
 */
export function ListeningPanel({
  phase,
  level,
  interimText,
  startedAt,
  offlineLanguageName,
  listeningTo,
  onStop,
}: ListeningPanelProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [startedAt]);

  const elapsed = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
  const active = phase !== 'starting';

  return (
    <View style={styles.panel}>
      <View style={styles.statusRow}>
        <View
          style={styles.statusText}
          accessible
          accessibilityLabel={`${STATUS[phase]}${listeningTo ? `. Listening to ${listeningTo}` : ''}${offlineLanguageName ? `. Offline, ${offlineLanguageName} only` : ''}`}
        >
          <View style={styles.titleRow}>
            <View style={[styles.dot, !active && styles.dotStarting]} />
            <Text style={styles.title}>{STATUS[phase]}</Text>
          </View>
          <Text style={styles.meta}>
            {[listeningTo ? `Listening to ${listeningTo}` : null, active ? formatElapsed(elapsed) : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        <View style={styles.bars} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {BAR_WEIGHTS.map((weight, index) => (
            <View
              key={index}
              style={[
                styles.bar,
                { height: active ? BAR_MIN + (BAR_MAX - BAR_MIN) * level * weight : BAR_MIN },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={onStop}
          style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Stop listening"
        >
          <Ionicons name="stop" size={18} color={colors.onListening} />
          <Text style={styles.stopText}>Stop</Text>
        </Pressable>
      </View>

      {interimText ? (
        <Text style={styles.interim} numberOfLines={3}>
          “{interimText}”
        </Text>
      ) : null}

      {offlineLanguageName ? (
        <View style={styles.offlineRow}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.offlineText}>Listening offline · {offlineLanguageName}</Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    panel: {
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: t.colors.listening,
      backgroundColor: t.colors.surface,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    statusText: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: t.colors.listening,
    },
    dotStarting: {
      backgroundColor: t.colors.textMuted,
    },
    title: {
      flexShrink: 1,
      fontSize: t.font(15),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    meta: {
      marginTop: 2,
      marginLeft: 20,
      fontSize: t.font(12),
      color: t.colors.textSecondary,
    },
    bars: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      height: BAR_MAX,
    },
    bar: {
      width: 4,
      borderRadius: 2,
      backgroundColor: t.colors.listening,
    },
    stopButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 48,
      minWidth: 48,
      paddingHorizontal: 14,
      borderRadius: 24,
      backgroundColor: t.colors.listening,
      justifyContent: 'center',
    },
    stopText: {
      fontSize: t.font(14),
      fontWeight: t.weight('800'),
      color: t.colors.onListening,
    },
    pressed: {
      opacity: 0.8,
    },
    interim: {
      marginTop: 8,
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      fontStyle: 'italic',
      color: t.colors.textPrimary,
    },
    offlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    offlineText: {
      fontSize: t.font(12),
      color: t.colors.textSecondary,
    },
  });
