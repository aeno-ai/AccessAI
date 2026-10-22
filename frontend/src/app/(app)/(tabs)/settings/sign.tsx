import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SIGN_LANGUAGE_NAMES, SignChoices } from '@/components/sign/SignChoices';
import { SignHelpSheet } from '@/components/sign/SignHelpSheet';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { SectionHeader, SettingRow } from '@/components/ui/SettingRow';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { Spacing } from '@/constants/theme';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type SignConfidence } from '@/hooks/use-preferences';
import { signReady, useSignModels } from '@/hooks/use-sign-recognition';

const SURENESS_OPTIONS: { value: SignConfidence; label: string; description: string }[] = [
  { value: 0.35, label: 'Loose', description: 'Adds more signs, but makes more mistakes.' },
  { value: 0.5, label: 'Normal', description: 'A good balance for most people.' },
  { value: 0.7, label: 'Strict', description: 'Adds a sign only when very sure.' },
];

/**
 * Settings → Sign language: the same choices as the button on the camera,
 * plus how sure it must be, making sentences, the flip fix — and which of
 * the four sign options (FSL/ASL × words/letters) are ready.
 */
export default function SignSettingsScreen() {
  const { prefs, setPref } = usePreferences();
  const styles = useThemedStyles(makeStyles);
  const models = useSignModels();
  const [helpOpen, setHelpOpen] = useState(false);
  const helpUnit = prefs.signUnit === 'letters' && signReady(models, prefs.signLanguage, 'letters') ? 'letters' : 'words';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.note}>
        Point the camera at someone signing, or sign yourself. Each sign becomes text in the message box.
      </Text>

      <View style={styles.card}>
        <SettingRow
          icon="help-circle-outline"
          title="How to sign for the camera"
          description="Short steps for signing words and spelling letters."
          onPress={() => setHelpOpen(true)}
        />
      </View>
      <SignHelpSheet visible={helpOpen} unit={helpUnit} onClose={() => setHelpOpen(false)} />

      <SignChoices models={models} />

      <SectionHeader title="How sure before adding a sign" />
      <RadioGroup
        label="How sure before adding a sign"
        value={prefs.signConfidence}
        onChange={(value) => setPref('signConfidence', value)}
        options={SURENESS_OPTIONS}
      />

      <SectionHeader title="More" />
      <View style={styles.card}>
        <ToggleRow
          label="Make signed words into a sentence"
          description="When you pause, the words become a proper sentence (needs internet). You can undo it."
          value={prefs.signAutoSentence}
          onValueChange={(value) => setPref('signAutoSentence', value)}
        />
        <ToggleRow
          divided
          label="Large camera"
          description="Shows the signer bigger. You can also tap the button on the camera."
          value={prefs.signCameraLarge}
          onValueChange={(value) => setPref('signCameraLarge', value)}
        />
        <ToggleRow
          divided
          label="Signs read wrong? Flip the video"
          description="Only if most signs come out wrong."
          value={prefs.signFlip}
          onValueChange={(value) => setPref('signFlip', value)}
        />
        {/* Testing only: never in a store or preview build. */}
        {__DEV__ ? (
          <ToggleRow
            divided
            label="Show landmarks (testing)"
            description="Draws the points the camera finds and the signing line."
            value={prefs.signShowLandmarks}
            onValueChange={(value) => setPref('signShowLandmarks', value)}
          />
        ) : null}
      </View>

      <SectionHeader title="What's ready" />
      <View style={styles.card}>
        {models === null ? (
          <Text style={styles.status}>Checking…</Text>
        ) : models.length === 0 ? (
          <Text style={styles.status}>Can&apos;t check right now. Connect to the internet and try again.</Text>
        ) : (
          (['fsl', 'asl'] as const).flatMap((language) =>
            (['words', 'letters'] as const).map((unit) => {
              const ready = signReady(models, language, unit);
              return (
                <View
                  key={`${language}-${unit}`}
                  style={styles.statusRow}
                  accessible
                  accessibilityLabel={`${SIGN_LANGUAGE_NAMES[language]}, ${unit}: ${ready ? 'ready' : 'coming soon'}`}
                >
                  <Text style={[styles.status, styles.flex]}>
                    {language.toUpperCase()} {unit === 'words' ? 'words' : 'letters'}
                  </Text>
                  <Text style={[styles.badge, ready ? styles.badgeReady : styles.badgeSoon]}>{ready ? 'Ready' : 'Coming soon'}</Text>
                </View>
              );
            }),
          )
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      padding: Spacing.four,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.six,
      gap: Spacing.two,
    },
    flex: {
      flex: 1,
    },
    note: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      color: t.colors.textSecondary,
    },
    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    status: {
      fontSize: t.font(15),
      color: t.colors.textPrimary,
      padding: 4,
    },
    badge: {
      fontSize: t.font(13),
      fontWeight: t.weight('800'),
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    badgeReady: {
      color: t.colors.onPrimary,
      backgroundColor: t.colors.success,
    },
    badgeSoon: {
      color: t.colors.textSecondary,
      backgroundColor: t.colors.surfaceAlt,
    },
  });
