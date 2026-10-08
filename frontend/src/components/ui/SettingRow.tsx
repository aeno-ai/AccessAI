import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IconName } from '@/constants/onboarding';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type SettingRowProps = {
  title: string;
  description?: string;
  icon?: IconName;
  onPress: () => void;
  /** Drawn with a divider above it, for stacking rows inside one card. */
  divided?: boolean;
  /** Red text and icon, for destructive actions. */
  danger?: boolean;
  /** Hides the trailing chevron, for actions that don't open a page. */
  action?: boolean;
};

/** A row that opens another page (or runs an action), with an optional icon. */
export function SettingRow({ title, description, icon, onPress, divided, danger, action }: SettingRowProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const tint = danger ? colors.dangerText : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={description ? `${title}. ${description}` : title}
      style={({ pressed }) => [styles.row, divided && styles.divided, pressed && styles.pressed]}
    >
      {icon ? (
        <View style={[styles.iconBox, danger && styles.iconBoxDanger]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.title, danger && { color: colors.dangerText }]}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {action ? null : <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
    </Pressable>
  );
}

/** A screen-reader heading above a group of rows ("Display", "Account"…). */
export function SectionHeader({ title }: { title: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={styles.sectionHeader} accessibilityRole="header">
      {title}
    </Text>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 60,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    divided: {
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: t.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBoxDanger: {
      backgroundColor: t.colors.surfaceAlt,
    },
    text: {
      flex: 1,
    },
    title: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    description: {
      marginTop: 2,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textSecondary,
    },
    pressed: {
      opacity: 0.75,
    },
    sectionHeader: {
      marginTop: 20,
      marginBottom: 8,
      fontSize: t.font(13),
      fontWeight: t.weight('800'),
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: t.colors.textSecondary,
    },
  });
