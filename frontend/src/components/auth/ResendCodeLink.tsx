import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type Props = {
  /** Seconds until another code may be sent (0 = now). */
  secondsLeft: number;
  /** Too many codes today: "Try again tomorrow". */
  daily?: boolean;
  busy?: boolean;
  onPress: () => void;
};

/** "Resend code in 42s" → "Resend code". The server allows one code a minute and 5 a day. */
export function ResendCodeLink({ secondsLeft, daily = false, busy = false, onPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  const disabled = secondsLeft > 0 || busy;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.text, disabled && styles.disabled]}>
        {daily ? 'Too many codes today. Try again tomorrow' : secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
      </Text>
    </TouchableOpacity>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      marginTop: 20,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      color: t.colors.primary,
      fontWeight: t.weight('700'),
      fontSize: t.font(14),
    },
    disabled: {
      color: t.colors.textMuted,
    },
  });
