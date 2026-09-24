import { Text, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { ACCESSIBILITY_OPTIONS, FEATURES } from '@/constants/onboarding';
import FeatureCard from '@/components/onboarding/FeatureCard';
import SelectableOptionCard from '@/components/onboarding/SelectableOptionCard';
import { MascotIcon, RocketIllustration, WelcomeIllustration } from '@/components/onboarding/Illustrations';

type PageProps = {
  width: number;
};

export function WelcomePage({ width }: PageProps) {
  return (
    <View style={[styles.page, { width }]}>
      <Text style={styles.title}>Welcome to{'\n'}PDAccessAI</Text>
      <Text style={styles.subtitle}>
        Breaking communication barriers with AI-powered accessibility tools.
      </Text>
      <WelcomeIllustration />
    </View>
  );
}

export function FeaturesPage({ width }: PageProps) {
  return (
    <View style={[styles.page, { width }]}>
      <Text style={styles.title}>Powerful{'\n'}AI Features</Text>
      <Text style={styles.subtitle}>Everything you need to communicate with confidence.</Text>
      <View style={styles.list}>
        {FEATURES.map((feature) => (
          <FeatureCard
            key={feature.id}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </View>
    </View>
  );
}

type PersonalizePageProps = PageProps & {
  selectedOption: string | null;
  onSelectOption: (id: string) => void;
};

export function PersonalizePage({ width, selectedOption, onSelectOption }: PersonalizePageProps) {
  return (
    <View style={[styles.page, styles.centeredPage, { width }]}>
      <MascotIcon />
      <Text style={[styles.title, styles.centerText]}>Tell us about yourself</Text>
      <Text style={[styles.subtitle, styles.centerText]}>
        Optional — this helps us set up the right tools for you. You can skip it for now.
      </Text>
      <View style={styles.list}>
        {ACCESSIBILITY_OPTIONS.map((option) => (
          <SelectableOptionCard
            key={option.id}
            icon={option.icon}
            title={option.title}
            description={option.description}
            selected={selectedOption === option.id}
            onPress={() => onSelectOption(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

export function GetStartedPage({ width }: PageProps) {
  return (
    <View style={[styles.page, styles.getStartedPage, { width }]}>
      <RocketIllustration />
      <Text style={[styles.title, styles.centerText]}>You&apos;re{'\n'}All Set!</Text>
      <Text style={[styles.subtitle, styles.centerText]}>
        Your account is ready. Start using AI-powered accessibility tools.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 12,
    lineHeight: 22,
  },
  list: {
    marginTop: 20,
    width: '100%',
  },
  centeredPage: {
    alignItems: 'center',
  },
  getStartedPage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  centerText: {
    textAlign: 'center',
  },
});
