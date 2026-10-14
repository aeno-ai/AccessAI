import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import type { Sign } from '@/learn/types';

type Props = {
  pairs: Sign[];
  /** A video tile was tapped: show that sign in the player above. */
  onShow: (sign: Sign) => void;
  onMistake: () => void;
  onDone: () => void;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Match each video to its word. Tap a video (it plays above), then its word
 * — or the word first. A right pair is ticked and locked; a wrong one is a
 * mistake. One player for all the videos, so the phone isn't playing four.
 */
export function MatchPairs({ pairs, onShow, onMistake, onDone }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const words = useMemo(() => [...pairs].sort((a, b) => a.display.localeCompare(b.display)), [pairs]);
  const [video, setVideo] = useState<string | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [miss, setMiss] = useState(false);

  const tryPair = (videoLabel: string | null, wordLabel: string | null) => {
    if (!videoLabel || !wordLabel) return;
    if (videoLabel === wordLabel) {
      const next = new Set(matched).add(videoLabel);
      setMatched(next);
      setMiss(false);
      if (next.size === pairs.length) onDone();
    } else {
      setMiss(true);
      onMistake();
    }
    setVideo(null);
    setWord(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.columns}>
        <View style={styles.column} accessibilityLabel="Videos">
          {pairs.map((sign, index) => {
            const done = matched.has(sign.label);
            const selected = video === sign.label;
            return (
              <Pressable
                key={sign.label}
                style={[styles.tile, selected && styles.selected, done && styles.done]}
                disabled={done}
                onPress={() => {
                  onShow(sign);
                  setVideo(sign.label);
                  tryPair(sign.label, word);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: done }}
                accessibilityLabel={`Video ${LETTERS[index]}${done ? ', matched' : ''}`}
                accessibilityHint="Plays it above"
              >
                <Ionicons name={done ? 'checkmark-circle' : 'play-circle-outline'} size={22} color={colors.primary} />
                <Text style={styles.tileText}>Video {LETTERS[index]}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.column} accessibilityLabel="Words">
          {words.map((sign) => {
            const done = matched.has(sign.label);
            const selected = word === sign.label;
            return (
              <Pressable
                key={sign.label}
                style={[styles.tile, selected && styles.selected, done && styles.done]}
                disabled={done}
                onPress={() => {
                  setWord(sign.label);
                  tryPair(video, sign.label);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: done }}
                accessibilityLabel={`${sign.display}${done ? ', matched' : ''}`}
              >
                {done ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                <Text style={styles.tileText}>{sign.display}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text style={styles.note} accessibilityLiveRegion="polite">
        {miss ? 'Not a match. Try again.' : `${matched.size} of ${pairs.length} matched`}
      </Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      gap: 10,
    },
    columns: {
      flexDirection: 'row',
      gap: 10,
    },
    column: {
      flex: 1,
      gap: 10,
    },
    tile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 52,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.surface,
    },
    selected: {
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primaryLight,
    },
    // Matched: a tick and a quiet background — not faded, so the text stays readable.
    done: {
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceAlt,
    },
    tileText: {
      flex: 1,
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    note: {
      fontSize: t.font(15),
      fontWeight: t.weight('600'),
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
  });
