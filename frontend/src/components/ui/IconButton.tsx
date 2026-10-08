import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IconName } from '@/constants/onboarding';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type IconButtonProps = {
  icon: IconName;
  /** Required: what TalkBack / VoiceOver says. Icons alone say nothing. */
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  hint?: string;
  /** plain = icon only, tinted = soft circle, filled = solid primary circle. */
  variant?: 'plain' | 'tinted' | 'filled';
  /** Overrides the icon color (and the fill, for `filled`). */
  color?: string;
  iconSize?: number;
  disabled?: boolean;
  selected?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * An icon-only button that's always at least 48×48 — the minimum comfortable
 * tap target — and always has a spoken label.
 */
export function IconButton({
  icon,
  label,
  onPress,
  onLongPress,
  hint,
  variant = 'plain',
  color,
  iconSize = 22,
  disabled,
  selected,
  busy,
  style,
}: IconButtonProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const iconColor =
    variant === 'filled' ? colors.onPrimary : color ?? (variant === 'tinted' ? colors.onPrimaryLight : colors.textPrimary);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: Boolean(disabled), selected, busy }}
      style={({ pressed }) => [
        styles.base,
        variant === 'tinted' && styles.tinted,
        variant === 'filled' && [styles.filled, color ? { backgroundColor: color } : null],
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={iconColor} />
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    base: {
      minWidth: 48,
      minHeight: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tinted: {
      backgroundColor: t.colors.primaryLight,
    },
    filled: {
      backgroundColor: t.colors.primary,
    },
    disabled: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.7,
    },
  });
