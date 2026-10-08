import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

const logoSource = require('@/assets/images/PDAccessAI-logo.png');

type AppLogoProps = {
  size?: number;
  /** Hide from screen readers — for when "PDAccessAI" is written right next to it. */
  decorative?: boolean;
};

export function AppLogo({ size = 96, decorative }: AppLogoProps) {
  return (
    <Image
      source={logoSource}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : 'PDAccessAI logo'}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no' : 'auto'}
    />
  );
}

// The illustrations below are pure decoration — hidden from screen readers.

export function WelcomeIllustration() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.hero} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.blobOne} />
      <View style={styles.blobTwo} />
      <View style={styles.logoWrap}>
        <AppLogo size={148} decorative />
      </View>
    </View>
  );
}

export function RocketIllustration() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.rocketWrap} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.rocketGlow} />
      <View style={styles.rocketCircle}>
        <Ionicons name="rocket-outline" size={56} color={colors.onPrimary} />
      </View>
    </View>
  );
}

export function MascotIcon() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.mascotCircle} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Ionicons name="sparkles-outline" size={28} color={colors.onPrimaryLight} />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    hero: {
      height: 240,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },
    blobOne: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: t.colors.primaryLight,
      opacity: 0.9,
    },
    blobTwo: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: t.colors.primary,
      top: 18,
      right: 48,
      opacity: 0.18,
    },
    // The logo artwork is drawn for a white background, whatever the theme.
    logoWrap: {
      zIndex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 32,
      padding: 12,
      shadowColor: t.colors.primary,
      shadowOpacity: t.isDark ? 0 : 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: t.isDark ? 0 : 6,
    },
    rocketWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    rocketGlow: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: t.colors.primaryLight,
    },
    rocketCircle: {
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mascotCircle: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: t.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
