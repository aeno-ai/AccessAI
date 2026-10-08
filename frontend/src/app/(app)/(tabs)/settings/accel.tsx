import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { SectionHeader, SettingRow } from '@/components/ui/SettingRow';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { downloadEnglishForWakeWord, useWakeStatus, wakeWordSupported, type WakeStatus } from '@/accel/wakeWord';
import { useAccel } from '@/accel/AccelProvider';
import { Spacing } from '@/constants/theme';
import { usePickedVoices } from '@/hooks/use-app-voice';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type AccelVoice } from '@/hooks/use-preferences';
import { speechToTextSupported } from '@/hooks/use-speech-to-text';
import { speechModule } from '@/audio/recognizer';
import { announce } from '@/utils/a11y';
import { speakMixed } from '@/utils/speechHelper';

const VOICE_OPTIONS: { value: AccelVoice; label: string; description?: string }[] = [
  { value: 'man', label: "A man's voice" },
  { value: 'woman', label: "A woman's voice" },
  { value: 'app', label: 'Same as the app', description: 'Settings → Conversation & speech → Voice' },
];

const WAKE_TEXT: Record<WakeStatus, string> = {
  off: 'Off.',
  listening: 'Listening for "Hey Accel" now.',
  paused: 'Paused — it waits while something else uses the mic, while AccessAI is talking, or after 10 minutes without a touch.',
  unsupported: '"Hey Accel" needs the AccessAI app build (not Expo Go) and Android 13 or newer, or an iPhone.',
  'needs-download': 'English speech must be on this phone so "Hey Accel" can listen offline. Download it below (once).',
  'needs-permission': 'AccessAI needs the microphone. Tap "Allow the microphone" below.',
};

/** Accel, the voice assistant: on/off, "Hey Accel", understanding, and voice. */
export default function AccelSettingsScreen() {
  const { prefs, setPref } = usePreferences();
  const { listen } = useAccel();
  const wake = useWakeStatus();
  const voices = usePickedVoices(prefs.accelVoice === 'app' ? prefs.appVoice : prefs.accelVoice);
  const styles = useThemedStyles(makeStyles);
  const [note, setNote] = useState('');

  const preview = () =>
    void speakMixed("Hi, I'm Accel. Tell me where to go or what to do.", {
      rate: prefs.speechRate,
      voices: voices ? { en: voices.en, fil: voices.fil } : undefined,
    });

  const allowMic = async () => {
    const result = await speechModule?.requestPermissionsAsync();
    setNote(result?.granted ? 'Thanks — the microphone is allowed.' : 'Allow the microphone for AccessAI in your phone settings.');
    // Turning it off and on makes "Hey Accel" check again.
    setPref('accelWakeWord', false);
    setTimeout(() => setPref('accelWakeWord', true), 300);
  };

  const download = async () => {
    const message = await downloadEnglishForWakeWord();
    setNote(message);
    announce(message);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.note}>
        Accel is a voice assistant for moving around AccessAI without seeing the screen. Say where to go or what to do;
        Accel checks with you (yes or no) before doing it.
        {prefs.profile === 'blind-low-vision' ? ' It was turned on because you chose Blind / low vision.' : ''}
      </Text>

      <View style={styles.card}>
        <ToggleRow
          label="Accel"
          description="The Accel button on every screen, and Magic Tap on iPhone (two-finger double-tap with VoiceOver)."
          value={prefs.accelEnabled}
          onValueChange={(value) => {
            setPref('accelEnabled', value);
            announce(value ? 'Accel is on.' : 'Accel is off.');
          }}
        />
        <ToggleRow
          divided
          label='Listen for "Hey Accel"'
          description="While AccessAI is open. Listens on the phone itself — no recording leaves it."
          value={prefs.accelWakeWord}
          disabled={!prefs.accelEnabled || !wakeWordSupported}
          onValueChange={(value) => setPref('accelWakeWord', value)}
        />
        <ToggleRow
          divided
          label="Smarter understanding"
          description="When online, AccessAI's AI helps understand commands the phone can't. Nothing you say is saved."
          value={prefs.accelSmart}
          disabled={!prefs.accelEnabled}
          onValueChange={(value) => setPref('accelSmart', value)}
        />
      </View>
      {prefs.accelEnabled && prefs.accelWakeWord ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          &quot;Hey Accel&quot;: {wakeWordSupported ? WAKE_TEXT[wake] : WAKE_TEXT.unsupported}
        </Text>
      ) : null}
      {wake === 'needs-download' ? <PrimaryButton title="Download English speech" onPress={() => void download()} /> : null}
      {wake === 'needs-permission' ? <PrimaryButton title="Allow the microphone" onPress={() => void allowMic()} /> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}

      <SectionHeader title="Accel's voice" />
      <RadioGroup
        label="Accel's voice"
        value={prefs.accelVoice}
        onChange={(value) => setPref('accelVoice', value)}
        options={VOICE_OPTIONS}
      />
      {voices?.notes.map((line) => (
        <Text key={line} style={styles.note}>
          {line}
        </Text>
      ))}
      <PrimaryButton title="Hear Accel" onPress={preview} />

      <SectionHeader title="Learn" />
      <View style={styles.card}>
        <SettingRow
          icon="list-outline"
          title="What Accel can do"
          description="Every command, with examples to try."
          onPress={() => router.push('/accel-guide' as Href)}
        />
        <SettingRow
          divided
          icon="mic-outline"
          title="Try Accel now"
          description={speechToTextSupported ? 'Opens Accel and listens.' : 'Opens Accel — type a command (Expo Go has no speech-to-text).'}
          onPress={listen}
        />
        <SettingRow
          divided
          icon="volume-high-outline"
          title="Hear the introduction again"
          onPress={() => setPref('accelIntroDone', false)}
        />
      </View>
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
      paddingTop: Spacing.two,
      paddingBottom: Spacing.six,
      gap: Spacing.two,
    },
    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    note: {
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
    },
  });
