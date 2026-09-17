import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { colors, Spacing } from '@/constants/theme';
import { useBootstrap } from '@/hooks/use-bootstrap';

/**
 * Content shown inside the hamburger menu (a slide-out drawer on phone, a
 * persistent side panel on wide/web screens — see `(app)/_layout.tsx`).
 * There's nothing specific to put here yet beyond Sign Out, so this is kept
 * intentionally minimal and ready for more items later, per the plan.
 */
export function AppDrawerContent(props: DrawerContentComponentProps) {
  const { signOut } = useBootstrap();

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <AppLogo size={40} />
        <Text style={styles.wordmark}>PDAccessAI</Text>
      </View>

      <View style={styles.section}>
        <DrawerItem
          label="Sign Out"
          icon={({ color, size }) => <Ionicons name="log-out-outline" size={size} color={color} />}
          onPress={() => void signOut()}
          labelStyle={styles.itemLabel}
        />
      </View>

      <Text style={styles.comingSoon}>More options coming soon.</Text>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    marginBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  wordmark: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  section: {
    marginTop: Spacing.two,
  },
  itemLabel: {
    fontWeight: '600',
  },
  comingSoon: {
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    fontSize: 12,
    color: colors.textMuted,
  },
});
