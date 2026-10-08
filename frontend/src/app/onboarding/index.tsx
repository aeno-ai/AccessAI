import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

export default function OnboardingSplashScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
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
      <ActivityIndicator color={colors.onPrimary} style={styles.loader} />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    // The logo artwork is drawn for a white background, whatever the theme.
    logoCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 28,
      padding: 16,
    },
    appName: {
      fontSize: t.font(28),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimary,
      marginTop: 24,
      letterSpacing: -0.4,
    },
    tagline: {
      fontSize: t.font(15),
      color: t.colors.onPrimary,
      opacity: 0.9,
      textAlign: 'center',
      marginTop: 10,
      lineHeight: t.lineHeight(22),
    },
    loader: {
      marginTop: 32,
    },
  });
