import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Read by screen readers when the title alone doesn't say what happens. */
  accessibilityHint?: string;
};

export function PrimaryButton({ title, onPress, loading, disabled, accessibilityHint }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <TouchableOpacity
      style={[styles.button, disabled ? styles.disabled : null]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
    >
      {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.text}>{title}</Text>}
    </TouchableOpacity>
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
    },
    disabled: {
      opacity: 0.6,
    },
    text: {
      color: t.colors.onPrimary,
      fontWeight: t.weight('700'),
      fontSize: t.font(16),
      textAlign: 'center',
    },
  });
