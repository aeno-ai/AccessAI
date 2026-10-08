import { Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IconName } from '@/constants/onboarding';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type FeatureTileProps = {
  icon: IconName;
  title: string;
  description: string;
};

/**
 * A 2-up grid tile for the dashboard's "Core AI Features" showcase. Purely
 * informational — it tells the user what's available inside the single
 * conversation screen, it doesn't navigate anywhere itself. The greeting
 * card and the AI Conversation Mode banner are the actual entry points.
 * Screen readers read it as one piece of plain text, never as a button.
 */
export function FeatureTile({ icon, title, description }: FeatureTileProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.tile} accessible accessibilityRole="text" accessibilityLabel={`${title}. ${description}`}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={20} color={colors.onPrimaryLight} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    tile: {
      flexBasis: '48%',
      flexGrow: 1,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 16,
      padding: 14,
      shadowColor: t.colors.primary,
      shadowOpacity: t.isDark ? 0 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: t.isDark ? 0 : 2,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: t.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    title: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
      marginBottom: 2,
    },
    description: {
      fontSize: t.font(12),
      color: t.colors.textSecondary,
      lineHeight: t.lineHeight(16),
    },
  });
