import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type OnboardingFooterProps = {
  currentStep: number;
  totalSteps: number;
  pageWidth: number;
  scrollX: SharedValue<number>;
  onSkip: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
};

function Dot({
  index,
  pageWidth,
  scrollX,
}: {
  index: number;
  pageWidth: number;
  scrollX: SharedValue<number>;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const animatedStyle = useAnimatedStyle(() => {
    const width = pageWidth || 1;
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, input, [8, 22, 8], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(scrollX.value, input, [
        colors.border,
        colors.primary,
        colors.border,
      ]),
    };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

export default function OnboardingFooter({
  currentStep,
  totalSteps,
  pageWidth,
  scrollX,
  onSkip,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
}: OnboardingFooterProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.footer}>
      <TouchableOpacity onPress={onSkip} hitSlop={8} accessibilityRole="button">
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.dotsRow}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <Dot key={index} index={index} pageWidth={pageWidth} scrollX={scrollX} />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.nextButton, nextDisabled && styles.nextButtonDisabled]}
        onPress={onNext}
        disabled={nextDisabled}
        accessibilityRole="button"
      >
        <Text style={styles.nextText}>{nextLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingBottom: 16,
      paddingTop: 8,
    },
    skipText: {
      color: t.colors.textSecondary,
      fontSize: t.font(15),
      fontWeight: t.weight('600'),
      minWidth: 40,
    },
    dotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.border,
    },
    nextButton: {
      backgroundColor: t.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: 24,
      minWidth: 108,
      alignItems: 'center',
    },
    nextButtonDisabled: {
      backgroundColor: t.colors.border,
    },
    nextText: {
      color: t.colors.onPrimary,
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
    },
  });