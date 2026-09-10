import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';

const logoSource = require('@/assets/images/PDAccessAI-logo.png');

export function AppLogo({ size = 96 }: { size?: number }) {
  return (
    <Image
      source={logoSource}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="PDAccessAI logo"
    />
  );
}

export function WelcomeIllustration() {
  return (
    <View style={styles.hero}>
      <View style={styles.blobOne} />
      <View style={styles.blobTwo} />
      <View style={styles.logoWrap}>
        <AppLogo size={148} />
      </View>
    </View>
  );
}

export function RocketIllustration() {
  return (
    <View style={styles.rocketWrap}>
      <View style={styles.rocketGlow} />
      <View style={styles.rocketCircle}>
        <Ionicons name="rocket-outline" size={56} color={colors.white} />
      </View>
    </View>
  );
}

export function MascotIcon() {
  return (
    <View style={styles.mascotCircle}>
      <Ionicons name="sparkles-outline" size={28} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.primaryLight,
    opacity: 0.9,
  },
  blobTwo: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#DDD7FF',
    top: 18,
    right: 48,
    opacity: 0.7,
  },
  logoWrap: {
    zIndex: 1,
    backgroundColor: colors.white,
    borderRadius: 32,
    padding: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
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
    backgroundColor: colors.primaryLight,
  },
  rocketCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
