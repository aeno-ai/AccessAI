import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import type { Sign } from '@/learn/types';
import { useFeedback } from '@/learn/useFeedback';

/** "Step 1. … Step 2. …", the way the steps are said out loud. */
export const spokenSteps = (sign: Sign) => sign.steps.map((step, i) => `Step ${i + 1}. ${step}`).join(' ');

type Props = {
  sign: Sign;
  /** Said before the steps, e.g. "New sign: Thank you." (a quiz asks its question instead). */
  intro?: string;
  /** Said after them, e.g. the quiz's choices. */
  outro?: string;
  /** Say them once by itself when shown (Blind / low-vision, no screen reader). */
  speakNow?: boolean;
};

/**
 * How to make a sign, step by step: each step its own line (a screen reader
 * reads them one at a time), and "Hear the steps" to have them said aloud.
 */
export function SignSteps({ sign, intro, outro, speakNow = false }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const say = useFeedback();
  const spoken = [intro, spokenSteps(sign), outro].filter(Boolean).join(' ');

  // Once per sign, as it appears.
  const spokenFor = useRef<string | null>(null);
  useEffect(() => {
    if (!speakNow || spokenFor.current === sign.label) return;
    spokenFor.current = sign.label;
    say(spoken);
  }, [speakNow, sign.label, spoken, say]);

  if (!sign.steps.length) return null;
  return (
    <View style={styles.how}>
      <Text style={styles.title} accessibilityRole="header">
        How to sign it
      </Text>
      {sign.steps.map((step, i) => (
        <Text key={i} style={styles.step} accessibilityLabel={`Step ${i + 1} of ${sign.steps.length}. ${step}`}>
          {i + 1}. {step}
        </Text>
      ))}
      <Pressable
        style={styles.hear}
        onPress={() => say(spoken, { always: true })}
        accessibilityRole="button"
        accessibilityLabel="Hear the steps"
      >
        <Ionicons name="volume-high-outline" size={18} color={colors.primary} />
        <Text style={styles.hearText}>Hear the steps</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    how: {
      gap: 6,
      padding: 12,
      borderRadius: 12,
      backgroundColor: t.colors.surfaceAlt,
    },
    title: {
      fontSize: t.font(15),
      fontWeight: t.weight('800'),
      color: t.colors.textSecondary,
    },
    step: {
      fontSize: t.font(16),
      color: t.colors.textPrimary,
    },
    hear: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      alignSelf: 'flex-start',
    },
    hearText: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
      textDecorationLine: 'underline',
    },
  });
