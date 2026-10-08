import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type ConsentCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

/**
 * A tick box with its label, for things the user has to agree to. The whole
 * row is one tap target (at least 48dp tall), and screen readers announce it
 * as a checkbox along with whether it's ticked.
 */
export function ConsentCheckbox({ checked, onChange, label }: ConsentCheckboxProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onChange(!checked)}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48,
      paddingVertical: 6,
    },
    box: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: t.colors.textMuted,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    boxChecked: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },
    label: {
      flex: 1,
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textPrimary,
    },
  });
