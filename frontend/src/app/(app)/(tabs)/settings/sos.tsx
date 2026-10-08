import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { useSos } from '@/components/sos/SosProvider';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { SectionHeader, SettingRow } from '@/components/ui/SettingRow';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { Spacing } from '@/constants/theme';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type ShakeSensitivity, type SosCountdown } from '@/hooks/use-preferences';
import { useFriends } from '@/realtime/FriendsProvider';
import { announce } from '@/utils/a11y';
import { setSosCircle } from '@/utils/sosCircle';

const SENSITIVITY_OPTIONS: { value: ShakeSensitivity; label: string; description: string }[] = [
  { value: 'light', label: 'Light', description: 'Easiest to set off. May trigger while running.' },
  { value: 'normal', label: 'Normal', description: 'Three hard shakes.' },
  { value: 'firm', label: 'Firm', description: 'Needs very hard shakes. Fewest accidents.' },
];

const COUNTDOWN_OPTIONS: { value: SosCountdown; label: string }[] = [
  { value: 3, label: '3 seconds' },
  { value: 5, label: '5 seconds' },
  { value: 10, label: '10 seconds' },
];

const BUILT_IN_SOS =
  Platform.OS === 'ios'
    ? 'iPhone: press and hold the side button and a volume button, then drag the Emergency SOS slider. Turn on "Call with 5 button presses" in Settings → Emergency SOS for a faster way.'
    : 'Android: press the power button 5 times quickly. Turn it on in Settings → Safety & emergency → Emergency SOS (the name varies by phone).';

/** How an SOS can be started, and a safe way to try it out. PWD accounts only. */
export default function SosSettingsScreen() {
  const { prefs, setPref } = usePreferences();
  const { available, startTest } = useSos();
  const { friends, connected, refresh } = useFriends();
  const styles = useThemedStyles(makeStyles);
  const [saving, setSaving] = useState<string | null>(null);
  const [circleNote, setCircleNote] = useState('');

  const toggleCircle = async (friendId: string, name: string, inCircle: boolean) => {
    setSaving(friendId);
    setCircleNote('');
    try {
      await setSosCircle(friendId, inCircle);
      await refresh();
      announce(inCircle ? `${name} will get your SOS.` : `${name} will no longer get your SOS.`);
    } catch (error) {
      setCircleNote(error instanceof Error ? error.message : "Couldn't change that. Try again.");
    } finally {
      setSaving(null);
    }
  };

  if (!available) {
    return (
      <View style={styles.screen}>
        <Text style={[styles.note, styles.padded]}>Emergency SOS is available for PWD accounts.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionHeader title="Ways to send an SOS" />
      <View style={styles.card}>
        <View style={styles.staticRow} accessible>
          <Text style={styles.rowTitle}>Hold the SOS button on Home</Text>
          <Text style={styles.rowDescription}>Always on. With TalkBack or VoiceOver: double-tap and hold.</Text>
        </View>
        <ToggleRow
          divided
          label="Shake the phone"
          description="Shake hard 3 times while AccessAI is open. A countdown lets you cancel."
          value={prefs.shakeToSos}
          onValueChange={(value) => setPref('shakeToSos', value)}
        />
      </View>
      <Text style={styles.note}>
        Shaking only works while AccessAI is open on screen — phones don&apos;t let apps watch for it in the
        background.
      </Text>

      {prefs.shakeToSos ? (
        <>
          <SectionHeader title="Shake strength" />
          <RadioGroup
            label="Shake strength"
            value={prefs.shakeSensitivity}
            onChange={(value) => setPref('shakeSensitivity', value)}
            options={SENSITIVITY_OPTIONS}
          />
        </>
      ) : null}

      <SectionHeader title="Countdown before sending" />
      <RadioGroup
        label="Countdown before sending"
        value={prefs.sosCountdown}
        onChange={(value) => setPref('sosCountdown', value)}
        options={COUNTDOWN_OPTIONS}
      />

      <SectionHeader title="Friends who get my SOS" />
      <Text style={styles.note}>
        Adding someone as a friend doesn&apos;t send them your SOS — switch them on here. They get a full-screen
        alert with your location, a phone notification if AccessAI is closed, and the SOS in your chat.
      </Text>
      {friends.length ? (
        <View style={styles.card}>
          {friends.map((friend, index) => (
            <ToggleRow
              key={friend.userId}
              divided={index > 0}
              label={friend.name}
              description={saving === friend.userId ? 'Saving…' : friend.inMySosCircle ? 'Gets your SOS' : undefined}
              value={friend.inMySosCircle}
              disabled={!connected || saving !== null}
              onValueChange={(value) => void toggleCircle(friend.userId, friend.firstName || friend.name, value)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <SettingRow
            icon="person-add-outline"
            title="Add a friend first"
            description="Friends are added with a friend code or QR."
            onPress={() => router.push('/friends/add')}
          />
        </View>
      )}
      {!connected && friends.length ? (
        <Text style={styles.note}>You&apos;re offline. Changes need the internet.</Text>
      ) : null}
      {circleNote ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {circleNote}
        </Text>
      ) : null}

      <SectionHeader title="Emergency contacts" />
      <View style={styles.card}>
        <SettingRow
          icon="call-outline"
          title="Emergency contacts"
          description="Their phones get a text with your message and location — it opens by itself after every SOS. Works without internet."
          onPress={() => router.push('/emergency-contacts')}
        />
      </View>

      <SectionHeader title="Try it safely" />
      <PrimaryButton
        title="Send a test SOS"
        onPress={startTest}
        accessibilityHint="Sends an SOS marked as a test. Friends in your SOS circle get a TEST alert. No texts are sent."
      />

      <SectionHeader title="When AccessAI is closed" />
      <Text style={styles.note}>Your phone has its own emergency SOS that works even when AccessAI is closed.</Text>
      <Text style={[styles.note, styles.guide]}>{BUILT_IN_SOS}</Text>
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
    padded: {
      padding: Spacing.four,
    },
    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    staticRow: {
      minHeight: 56,
      paddingHorizontal: 14,
      paddingVertical: 10,
      justifyContent: 'center',
    },
    rowTitle: {
      fontSize: t.font(15),
      fontWeight: t.weight('600'),
      color: t.colors.textPrimary,
    },
    rowDescription: {
      marginTop: 2,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textSecondary,
    },
    note: {
      marginTop: 8,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textSecondary,
    },
    guide: {
      color: t.colors.textPrimary,
    },
  });
