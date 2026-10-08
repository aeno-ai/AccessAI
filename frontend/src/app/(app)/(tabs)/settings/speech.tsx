import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { SectionHeader } from '@/components/ui/SettingRow';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { Spacing } from '@/constants/theme';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type OfflineSpeechLanguage, type SpeechRate, type VoiceChoice } from '@/hooks/use-preferences';
import { speechToTextSupported } from '@/hooks/use-speech-to-text';
import { speakMixed } from '@/utils/speechHelper';
import { describeVoices, pickVoices } from '@/utils/voices';

const VOICE_OPTIONS: { value: VoiceChoice; label: string; description?: string }[] = [
  { value: 'auto', label: 'Automatic', description: "The phone's normal voice." },
  { value: 'man', label: "A man's voice" },
  { value: 'woman', label: "A woman's voice" },
];

const SPEED_OPTIONS: { value: SpeechRate; label: string }[] = [
  { value: 0.75, label: 'Slow' },
  { value: 1, label: 'Normal' },
  { value: 1.25, label: 'Fast' },
  { value: 1.5, label: 'Fastest' },
];

const OFFLINE_LANGUAGE_OPTIONS: { value: OfflineSpeechLanguage; label: string; description: string }[] = [
  { value: 'auto', label: 'Automatic', description: 'Filipino if it’s downloaded, otherwise English.' },
  { value: 'fil', label: 'Filipino', description: 'Prefer the Filipino model when offline.' },
  { value: 'en', label: 'English', description: 'Prefer the English model when offline.' },
];

export default function SpeechSettingsScreen() {
  const { prefs, setPref } = usePreferences();
  const styles = useThemedStyles(makeStyles);

  const [voiceList, setVoiceList] = useState<{ id: string; label: string }[] | null>(null);
  const [voiceNotes, setVoiceNotes] = useState<string[]>([]);

  const chooseSpeed = (rate: SpeechRate) => {
    setPref('speechRate', rate);
    void speakMixed('This is how fast I will speak.', { rate });
  };

  // Hear the choice straight away (in both languages).
  const chooseVoice = async (choice: VoiceChoice) => {
    setPref('appVoice', choice);
    const picked = await pickVoices(choice);
    setVoiceNotes(picked.notes);
    void speakMixed('This is the voice I will use. Ito ang boses na gagamitin ko.', {
      rate: prefs.speechRate,
      voices: { en: picked.en, fil: picked.fil },
    });
  };

  const toggleVoiceList = async () => setVoiceList(voiceList ? null : await describeVoices());

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionHeader title="Taking turns" />
      <View style={styles.card}>
        <ToggleRow
          label="Switch speaker after each message"
          description="After you send as Me, it switches to Them, and back again."
          value={prefs.autoSwitchSpeaker}
          onValueChange={(value) => setPref('autoSwitchSpeaker', value)}
        />
        <ToggleRow
          divided
          label="Listen automatically on Them's turn"
          description={
            speechToTextSupported
              ? 'Live captions: the mic opens by itself when it switches to Them.'
              : 'Needs the AccessAI app build with speech-to-text (not Expo Go).'
          }
          value={prefs.autoListenForThem}
          onValueChange={(value) => setPref('autoListenForThem', value)}
          disabled={!speechToTextSupported}
        />
      </View>

      <SectionHeader title="Reading aloud" />
      <View style={styles.card}>
        <ToggleRow
          label="Speak my messages when I send"
          description="The phone says your message out loud for the other person."
          value={prefs.speakMyMessages}
          onValueChange={(value) => setPref('speakMyMessages', value)}
        />
        <ToggleRow
          divided
          label="Read new messages aloud"
          description="Reads what Them and your friends say. With TalkBack or VoiceOver on, they read it instead."
          value={prefs.readIncomingAloud}
          onValueChange={(value) => setPref('readIncomingAloud', value)}
        />
      </View>

      <SectionHeader title="Voice" />
      <RadioGroup label="Voice" value={prefs.appVoice} onChange={chooseVoice} options={VOICE_OPTIONS} />
      {voiceNotes.map((line) => (
        <Text key={line} style={styles.note}>
          {line}
        </Text>
      ))}
      <Pressable onPress={() => void toggleVoiceList()} accessibilityRole="button" style={styles.link}>
        <Text style={styles.linkText}>{voiceList ? 'Hide the voices on this phone' : 'Voices on this phone'}</Text>
      </Pressable>
      {voiceList?.map((voice) => (
        <Text key={voice.id} style={styles.note} selectable>
          {voice.label}
        </Text>
      ))}

      <SectionHeader title="Voice speed" />
      <RadioGroup label="Voice speed" value={prefs.speechRate} onChange={chooseSpeed} options={SPEED_OPTIONS} />

      <SectionHeader title="Offline listening language" />
      <RadioGroup
        label="Offline listening language"
        value={prefs.offlineSpeechLanguage}
        onChange={(value) => setPref('offlineSpeechLanguage', value)}
        options={OFFLINE_LANGUAGE_OPTIONS}
      />
      <Text style={styles.note}>
        Online, the mic understands English, Filipino and Taglish together. Offline, the phone can only
        listen in one language at a time.
      </Text>
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
    },
    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    note: {
      marginTop: 8,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textMuted,
    },
    link: {
      minHeight: 44,
      justifyContent: 'center',
    },
    linkText: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
  });
