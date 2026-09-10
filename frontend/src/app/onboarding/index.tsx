import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { colors } from '@/constants/theme';

export default function OnboardingSplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/onboarding/welcome');
    }, 1800);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.logoCard}>
        <AppLogo size={112} />
      </View>
      <Text style={styles.appName}>PDAccessAI</Text>
      <Text style={styles.tagline}>AI-powered accessibility{'\n'}for everyone.</Text>
      <ActivityIndicator color={colors.white} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoCard: {
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    marginTop: 24,
    letterSpacing: -0.4,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  loader: {
    marginTop: 32,
  },
});
