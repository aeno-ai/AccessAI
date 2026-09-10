import { StyleSheet, Text, View } from 'react-native';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { colors, MaxContentWidth } from '@/constants/theme';
import { useBootstrap } from '@/hooks/use-bootstrap';

export default function HomeScreen() {
  const { signOut } = useBootstrap();

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <View style={styles.container}>
        <AppLogo size={88} />
        <Text style={styles.title}>You're in</Text>
        <Text style={styles.subtitle}>
          Your accessibility tools will live here. Speech, sign language, and the AI assistant are
          coming next.
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    marginTop: 20,
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 360,
  },
  buttonWrap: {
    width: '100%',
    maxWidth: 280,
    marginTop: 32,
  },
});
