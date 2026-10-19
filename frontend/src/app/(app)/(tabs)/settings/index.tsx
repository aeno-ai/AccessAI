import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSos } from '@/components/sos/SosProvider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SectionHeader, SettingRow } from '@/components/ui/SettingRow';
import { TabHeader } from '@/components/ui/TabHeader';
import { PALETTE_OPTIONS } from '@/constants/palettes';
import { PROFILE_LABELS } from '@/constants/profiles';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import { useTour } from '@/tutorial/TutorialProvider';
import { useTourTarget } from '@/tutorial/targets';
import { announce } from '@/utils/a11y';

const TEXT_SIZE_NAMES: Record<number, string> = { 1: 'Default', 1.15: 'Large', 1.3: 'Larger', 1.5: 'Largest' };
const THEME_NAMES = { system: 'Follows your phone', light: 'Light', dark: 'Dark' } as const;

/**
 * Accessibility preferences only — account actions (sign out, terms, delete
 * account) live in the hamburger menu. Everything here is saved on this
 * phone and works offline.
 */
export default function SettingsScreen() {
  const { prefs, setPref } = usePreferences();
  const { available: sosAvailable } = useSos();
  const styles = useThemedStyles(makeStyles);
  const needsTarget = useTourTarget('settings.needs');
  const layaTarget = useTourTarget('settings.laya');
  const displayTarget = useTourTarget('settings.display');
  const speechTarget = useTourTarget('settings.speech');
  const signTarget = useTourTarget('settings.sign');
  const repliesTarget = useTourTarget('settings.replies');
  useTour('settings');

  const paletteName = PALETTE_OPTIONS.find((option) => option.id === prefs.palette)?.label ?? 'Standard';
  const displaySummary = `${paletteName} colors · ${THEME_NAMES[prefs.theme]} · ${TEXT_SIZE_NAMES[prefs.textScale]} text`;
  const speechSummary =
    [
      prefs.autoSwitchSpeaker && 'Switches speaker',
      prefs.speakMyMessages && 'Speaks my messages',
      prefs.readIncomingAloud && 'Reads new messages',
      prefs.autoListenForThem && 'Live captions',
    ]
      .filter(Boolean)
      .join(' · ') || 'Turn-taking, reading aloud, voice speed';

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScrollView contentContainerStyle={styles.content}>
        <TabHeader title="Settings" />
        <Text style={styles.subtitle}>Make AccessAI work the way you need.</Text>

        <SectionHeader title="You" />
        <View style={styles.card}>
          <View ref={needsTarget} collapsable={false}>
            <SettingRow
              icon="accessibility-outline"
              title="My needs"
              description={PROFILE_LABELS[prefs.profile].title}
              onPress={() => router.push('/settings/needs')}
            />
          </View>
          <View ref={layaTarget} collapsable={false}>
            <SettingRow
              divided
              icon="mic-circle-outline"
              title="Laya, voice assistant"
              description={
                prefs.layaEnabled
                  ? `On${prefs.layaWakeWord ? ' · Always listening' : ''} · ${prefs.layaVoice === 'woman' ? "Woman's" : prefs.layaVoice === 'man' ? "Man's" : 'App'} voice`
                  : 'Off'
              }
              onPress={() => router.push('/settings/laya' as Href)}
            />
          </View>
        </View>

        <SectionHeader title="Display" />
        <View style={styles.card} ref={displayTarget} collapsable={false}>
          <SettingRow
            icon="contrast-outline"
            title="Display & text"
            description={displaySummary}
            onPress={() => router.push('/settings/display')}
          />
        </View>

        <SectionHeader title="Conversations" />
        <View style={styles.card}>
          <View ref={speechTarget} collapsable={false}>
            <SettingRow
              icon="chatbubbles-outline"
              title="Conversation & speech"
              description={speechSummary}
              onPress={() => router.push('/settings/speech')}
            />
          </View>
          <View ref={signTarget} collapsable={false}>
            <SettingRow
              divided
              icon="hand-left-outline"
              title="Sign language"
              description={`${prefs.signLanguage.toUpperCase()} · ${prefs.signUnit === 'letters' ? 'Letters' : 'Words'}`}
              onPress={() => router.push('/settings/sign' as Href)}
            />
          </View>
          <View ref={repliesTarget} collapsable={false}>
            <SettingRow
              divided
              icon="flash-outline"
              title="Quick replies"
              description={prefs.showQuickReplies ? `${prefs.quickReplies.length} saved` : 'Hidden'}
              onPress={() => router.push('/settings/quick-replies')}
            />
          </View>
        </View>

        <SectionHeader title="Alerts" />
        <View style={styles.card}>
          <SettingRow
            icon="notifications-outline"
            title="Alerts"
            description={
              [prefs.vibrateAlerts && 'Vibrate', prefs.flashAlerts && 'Flash the screen'].filter(Boolean).join(' · ') ||
              'Off'
            }
            onPress={() => router.push('/settings/alerts')}
          />
        </View>

        {sosAvailable ? (
          <>
            <SectionHeader title="Safety" />
            <View style={styles.card}>
              <SettingRow
                icon="warning-outline"
                title="Emergency SOS"
                description={`Hold button${prefs.shakeToSos ? ' · Shake' : ''} · ${prefs.sosCountdown}s countdown`}
                onPress={() => router.push('/settings/sos')}
              />
            </View>
          </>
        ) : null}

        <SectionHeader title="Help" />
        <View style={styles.card}>
          <SettingRow
            icon="school-outline"
            title="Show the tutorial again"
            description="Each page explains itself again the next time you open it."
            onPress={() => {
              setPref('tutorialSeen', []);
              announce('The tutorial will show again on each page.');
            }}
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.six,
    },
    subtitle: {
      marginTop: 2,
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
    },
    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
  });
