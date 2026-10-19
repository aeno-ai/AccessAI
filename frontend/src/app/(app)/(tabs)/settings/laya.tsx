import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { SectionHeader, SettingRow } from '@/components/ui/SettingRow';
import { ToggleRow } from '@/components/ui/ToggleRow';
import {
  downloadEnglishForWakeWord,
  recheckWakeWord,
  useWakeEngine,
  useWakeHeard,
  useWakeOfflineMissing,
  useWakeStatus,
  useWakeUnsupportedReason,
  wakeWordSupported,
  type WakeEngine,
  type WakeStatus,
  type WakeUnsupportedReason,
} from '@/laya/wakeWord';
import { useLaya } from '@/laya/LayaProvider';
import { Spacing } from '@/constants/theme';
import { usePickedVoices } from '@/hooks/use-app-voice';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type LayaVoice } from '@/hooks/use-preferences';
import { speechToTextSupported } from '@/hooks/use-speech-to-text';
import { speechModule } from '@/audio/recognizer';
import { announce } from '@/utils/a11y';
import { speakMixed } from '@/utils/speechHelper';

const VOICE_OPTIONS: { value: LayaVoice; label: string; description?: string }[] = [
  { value: 'man', label: "A man's voice" },
  { value: 'woman', label: "A woman's voice" },
  { value: 'app', label: 'Same as the app', description: 'Settings → Conversation & speech → Voice' },
];

const WAKE_TEXT: Record<Exclude<WakeStatus, 'listening' | 'unsupported'>, string> = {
  off: 'Off.',
  starting: 'Getting ready…',
  paused: 'Waiting while Laya or another microphone is in use.',
  'needs-download': 'English needs to be downloaded once. Tap "Get offline English".',
  'needs-permission': 'AccessAI needs the microphone. Tap "Allow the microphone".',
  'needs-internet': 'Waiting for the internet. Connect to Wi-Fi or mobile data.',
};

const UNSUPPORTED_TEXT: Record<WakeUnsupportedReason, string> = {
  'no-app': '"Hey Laya" needs the full AccessAI app. Use the Laya button instead.',
  'no-recognizer': 'This phone has no voice typing. Install or update the Google app.',
};

/** What "Hey Laya" is doing, in plain words. */
function wakeText(status: WakeStatus, engine: WakeEngine | null, reason: WakeUnsupportedReason | null): string {
  if (status === 'listening') {
    return engine === 'online'
      ? 'Listening. Say "Hey Laya" any time. Uses the internet on this phone.'
      : 'Listening. Say "Hey Laya" any time.';
  }
  if (status === 'unsupported') return UNSUPPORTED_TEXT[reason ?? 'no-app'];
  return WAKE_TEXT[status];
}

/** Laya, the voice assistant: on/off, "Hey Laya", understanding, and voice. */
export default function LayaSettingsScreen() {
  const { prefs, setPref } = usePreferences();
  const { listen } = useLaya();
  const wake = useWakeStatus();
  const engine = useWakeEngine();
  const reason = useWakeUnsupportedReason();
  const lastHeard = useWakeHeard();
  const offlineMissing = useWakeOfflineMissing();
  const voices = usePickedVoices(prefs.layaVoice === 'app' ? prefs.appVoice : prefs.layaVoice);
  const styles = useThemedStyles(makeStyles);
  const [note, setNote] = useState('');

  const preview = () =>
    void speakMixed("Hi, I'm Laya. Tell me where to go or what to do.", {
      rate: prefs.speechRate,
      voices: voices ? { en: voices.en, fil: voices.fil } : undefined,
    });

  const allowMic = async () => {
    const result = await speechModule?.requestPermissionsAsync();
    if (result?.granted) {
      setNote('Thanks. The microphone is allowed.');
      recheckWakeWord();
    } else {
      // Refused before: only the phone's Settings can allow it now.
      setNote('Allow the microphone for AccessAI in your phone settings, then come back.');
      void Linking.openSettings();
    }
  };

  const download = async () => {
    const message = await downloadEnglishForWakeWord();
    setNote(message);
    announce(message);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.note}>
        Laya is designed for people who are blind or have low vision. It lets you move around AccessAI by voice, without
        seeing the screen. Say where to go or what to do; Laya checks with you (yes or no) before doing it.
        {prefs.profile === 'blind-low-vision' ? ' It was turned on because you chose Blind / low vision.' : ''}
      </Text>

      <View style={styles.card}>
        <ToggleRow
          label="Laya"
          description="Made for blind and low-vision users. Anyone can turn it on. Adds the Laya button to every screen, and Magic Tap on iPhone (two-finger double-tap with VoiceOver)."
          value={prefs.layaEnabled}
          onValueChange={(value) => {
            setPref('layaEnabled', value);
            announce(value ? 'Laya is on.' : 'Laya is off.');
          }}
        />
        <ToggleRow
          divided
          label='Always listening (say "Hey Laya")'
          description="Listens any time AccessAI is open, even while it's talking. Uses more battery. Nothing you say is saved."
          value={prefs.layaWakeWord}
          disabled={!prefs.layaEnabled || !wakeWordSupported}
          onValueChange={(value) => setPref('layaWakeWord', value)}
        />
        <ToggleRow
          divided
          label="Smarter understanding"
          description="When you're online, Laya understands more ways of saying things. Nothing you say is saved."
          value={prefs.layaSmart}
          disabled={!prefs.layaEnabled}
          onValueChange={(value) => setPref('layaSmart', value)}
        />
      </View>
      {prefs.layaEnabled && prefs.layaWakeWord ? (
        <>
          <Text style={styles.note} accessibilityLiveRegion="polite">
            &quot;Hey Laya&quot;: {wakeWordSupported ? wakeText(wake, engine, reason) : UNSUPPORTED_TEXT['no-app']}
          </Text>
          {lastHeard && wake === 'listening' ? <Text style={styles.note}>Last heard: “{lastHeard}”</Text> : null}
          {wake === 'needs-download' || wake === 'needs-internet' || offlineMissing ? (
            <>
              <Text style={styles.note}>Download offline English so &quot;Hey Laya&quot; also works without internet.</Text>
              <PrimaryButton title="Get offline English" onPress={() => void download()} />
            </>
          ) : null}
        </>
      ) : null}
      {wake === 'needs-permission' ? <PrimaryButton title="Allow the microphone" onPress={() => void allowMic()} /> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}

      <SectionHeader title="Laya's voice" />
      <RadioGroup
        label="Laya's voice"
        value={prefs.layaVoice}
        onChange={(value) => setPref('layaVoice', value)}
        options={VOICE_OPTIONS}
      />
      {voices?.notes.map((line) => (
        <Text key={line} style={styles.note}>
          {line}
        </Text>
      ))}
      <PrimaryButton title="Hear Laya" onPress={preview} />

      <SectionHeader title="Learn" />
      <View style={styles.card}>
        <SettingRow
          icon="list-outline"
          title="What Laya can do"
          description="Every command, with examples to try."
          onPress={() => router.push('/laya-guide' as Href)}
        />
        <SettingRow
          divided
          icon="mic-outline"
          title="Try Laya now"
          description={speechToTextSupported ? 'Opens Laya and listens.' : 'Opens Laya. Type what you want it to do.'}
          onPress={listen}
        />
        <SettingRow
          divided
          icon="volume-high-outline"
          title="Hear the introduction again"
          onPress={() => setPref('layaIntroDone', false)}
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
