import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type ToggleRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Drawn with a divider above it, for stacking rows inside one card. */
  divided?: boolean;
};

/**
 * An on/off setting. The whole row is the tap target and is a single
 * screen-reader "switch" ("Bold text, switch, off") — the Switch inside is
 * hidden from TalkBack / VoiceOver so it isn't focused twice.
 */
export function ToggleRow({ label, description, value, onValueChange, disabled, divided }: ToggleRowProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.row, divided && styles.divided, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: colors.inputBorder, true: colors.primary }}
          thumbColor={colors.surface}
          ios_backgroundColor={colors.inputBorder}
        />
      </View>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    divided: {
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    text: {
      flex: 1,
    },
    label: {
      fontSize: t.font(15),
      fontWeight: t.weight('600'),
      color: t.colors.textPrimary,
    },
    description: {
      marginTop: 2,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textSecondary,
    },
    disabled: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.75,
    },
  });
