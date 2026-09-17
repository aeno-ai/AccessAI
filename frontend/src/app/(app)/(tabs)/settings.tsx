import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBootstrap } from '@/hooks/use-bootstrap';

export default function SettingsScreen() {
  const { signOut } = useBootstrap();

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Accessibility preferences and account settings are coming soon.
        </Text>
        <View style={styles.buttonWrap}>
          <PrimaryButton title="Sign out" onPress={() => void signOut()} />
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: Spacing.five,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  buttonWrap: {
    width: '100%',
    maxWidth: 280,
    marginTop: 32,
  },
});
