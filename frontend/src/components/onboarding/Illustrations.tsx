import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

const logoSource = require('@/assets/images/AccessAI-logo.png');
const markSource = require('@/assets/images/AccessAI-mark.png');

type AppLogoProps = {
  size?: number;
  /** Hide from screen readers — for when "AccessAI" is written right next to it. */
  decorative?: boolean;
  /** The mark without the "AccessAI" lettering — for when it's written right next to it. */
  markOnly?: boolean;
};

/**
 * The AccessAI logo, a rounded tile with its own gradient. Smaller than
 * 100 px its lettering would be too small to read, so the mark alone shows.
 */
export function AppLogo({ size = 96, decorative, markOnly = size < 100 }: AppLogoProps) {
  return (
    <Image
      source={markOnly ? markSource : logoSource}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
      resizeMode="cover"
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : 'AccessAI logo'}
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
    // The logo has its own gradient tile; the colour here only gives the shadow a shape.
    logoWrap: {
      zIndex: 1,
      backgroundColor: '#5362C8',
      borderRadius: 33,
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
