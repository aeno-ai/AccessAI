import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  /** Shown next to the spinner while busy ("Logging in…"), and read by screen readers. */
  loadingTitle?: string;
  disabled?: boolean;
  /** Read by screen readers when the title alone doesn't say what happens. */
  accessibilityHint?: string;
};

// The native touch ripple, in the button's text color made see-through.
const rippleFrom = (color: string) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}40` : undefined);

/**
 * The main button of a screen. Pressing shows a plain darker state (no
 * fading animation to cut off halfway), and while busy the spinner sits in
 * the title's place — the button never changes size, so nothing jumps.
 */
export function PrimaryButton({ title, onPress, loading, loadingTitle, disabled, accessibilityHint }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const inactive = Boolean(disabled || loading);
  const ripple = rippleFrom(colors.onPrimary);

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && !inactive ? styles.pressed : null, disabled ? styles.disabled : null]}
      android_ripple={ripple && !inactive ? { color: ripple } : undefined}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={loading ? (loadingTitle ?? title) : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
    >
      <View style={styles.content}>
        {loading && loadingTitle ? (
          <>
            <ActivityIndicator color={colors.onPrimary} />
            <Text style={styles.text}>{loadingTitle}</Text>
          </>
        ) : (
          <>
            {/* Kept (invisible) under the spinner, so the size stays the same. */}
            <Text style={[styles.text, loading ? styles.hidden : null]}>{title}</Text>
            {loading ? <ActivityIndicator color={colors.onPrimary} style={styles.overlay} /> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    button: {
      backgroundColor: t.colors.primary,
      borderRadius: 14,
      // minHeight, not height, so large text grows the button instead of
      // being clipped.
      minHeight: 52,
      paddingVertical: 12,
      paddingHorizontal: 16,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      overflow: 'hidden',
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.6,
    },
    content: {
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    text: {
      color: t.colors.onPrimary,
      fontWeight: t.weight('700'),
      fontSize: t.font(16),
      textAlign: 'center',
    },
    hidden: {
      opacity: 0,
    },
    overlay: {
      position: 'absolute',
    },
  });
