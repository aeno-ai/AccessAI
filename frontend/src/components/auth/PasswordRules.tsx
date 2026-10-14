import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { PASSWORD_RULES } from '@/utils/password';

/** A live checklist under a new-password box: each rule ticks as it's met. */
export function PasswordRules({ password }: { password: string }) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.list}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <View key={rule.label} style={styles.row} accessible accessibilityLabel={`${rule.label}: ${met ? 'done' : 'not yet'}`}>
            <Ionicons
              name={met ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={met ? colors.success : colors.textMuted}
            />
            <Text style={[styles.text, met && styles.textMet]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: {
      gap: 6,
      marginTop: -4,
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    text: {
      fontSize: t.font(14),
      color: t.colors.textMuted,
    },
    textMet: {
      color: t.colors.textPrimary,
    },
  });
