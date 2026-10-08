import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { PROFILE_IDS, PROFILE_LABELS, type AccessibilityProfile } from '@/constants/profiles';
import { Spacing } from '@/constants/theme';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import { announce } from '@/utils/a11y';

/**
 * Picking a profile applies its suggested settings (text size, colors,
 * reading aloud, captions, SOS shake…). It never hides anything: every
 * feature stays available, and every setting can still be changed after.
 */
export default function NeedsScreen() {
  const { prefs, applyProfile } = usePreferences();
  const styles = useThemedStyles(makeStyles);

  const choose = (profile: AccessibilityProfile) => {
    if (profile === prefs.profile) {
      return;
    }
    const { title } = PROFILE_LABELS[profile];
    Alert.alert(
      'Apply suggested settings?',
      `This sets text size, colors and conversation settings for "${title}". Quick replies you've edited are kept. You can change anything afterwards.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: () => {
            applyProfile(profile);
            announce(`Settings for ${title} applied`);
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Tell AccessAI what you need and it will suggest settings for you. Every feature stays
        available to you whatever you pick.
      </Text>
      <RadioGroup
        label="My preferences"
        value={prefs.profile}
        onChange={choose}
        options={PROFILE_IDS.map((id) => ({
          value: id,
          label: PROFILE_LABELS[id].title,
          description: PROFILE_LABELS[id].description,
        }))}
      />
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    content: {
      padding: Spacing.four,
      paddingBottom: Spacing.six,
    },
    intro: {
      marginBottom: Spacing.three,
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
    },
  });
