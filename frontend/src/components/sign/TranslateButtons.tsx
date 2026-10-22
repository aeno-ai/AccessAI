import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { TRANSLATE_NAMES, type TranslateTo } from '@/utils/signedText';

type Props = {
  /** Does the translating; resolves when done. */
  onTranslate: (to: TranslateTo) => Promise<void>;
  /** Smaller, for the message box notice. */
  compact?: boolean;
};

/** "Translate: English · Filipino" for signed text (HANDOFF.md §52 E). */
export function TranslateButtons({ onTranslate, compact = false }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState<TranslateTo | null>(null);

  const press = async (to: TranslateTo) => {
    if (busy) return;
    setBusy(to);
    try {
      await onTranslate(to);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.row}>
      <Ionicons name="language-outline" size={compact ? 16 : 18} color={colors.primary} />
      <Text style={[styles.label, compact && styles.labelCompact]}>Translate:</Text>
      {(Object.keys(TRANSLATE_NAMES) as TranslateTo[]).map((to) => (
        <Pressable
          key={to}
          style={[styles.pill, compact && styles.pillCompact]}
          onPress={() => void press(to)}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel={`Translate into ${TRANSLATE_NAMES[to]}`}
          accessibilityState={{ busy: busy === to, disabled: busy !== null }}
        >
          {busy === to ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          <Text style={[styles.pillText, compact && styles.pillTextCompact]}>{TRANSLATE_NAMES[to]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    label: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.textSecondary,
    },
    labelCompact: {
      fontSize: t.font(13),
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.surface,
    },
    pillCompact: {
      minHeight: 40,
      paddingHorizontal: 12,
    },
    pillText: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    pillTextCompact: {
      fontSize: t.font(14),
    },
  });
