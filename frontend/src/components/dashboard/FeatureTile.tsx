import { Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { IconName } from '@/constants/onboarding';

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
 */
export function FeatureTile({ icon, title, description }: FeatureTileProps) {
  return (
    <View style={styles.tile}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    shadowColor: colors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
