import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { Spacing } from '@/constants/theme';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useAlerts } from '@/hooks/use-alerts';
import { usePreferences } from '@/hooks/use-preferences';

/**
 * How AccessAI gets the user's attention when a friend's message or an SOS
 * arrives, and when the mic opens and closes.
 */
export default function AlertsSettingsScreen() {
  const { prefs, setPref } = usePreferences();
  const { notify } = useAlerts();
  const styles = useThemedStyles(makeStyles);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <ToggleRow
          label="Vibrate"
          description="For new messages, SOS alerts, and when the mic starts or stops."
          value={prefs.vibrateAlerts}
          onValueChange={(value) => setPref('vibrateAlerts', value)}
        />
        <ToggleRow
          divided
          label="Flash the screen"
          description="A brief color flash for new messages and SOS alerts. With Reduce motion on, a colored border instead."
          value={prefs.flashAlerts}
          onValueChange={(value) => setPref('flashAlerts', value)}
        />
      </View>
      <Text style={styles.note}>
        Messages are also read aloud if “Read new messages aloud” is on in Conversation & speech.
      </Text>
      <View style={styles.buttonWrap}>
        <PrimaryButton
          title="Try an alert"
          onPress={() => notify({ kind: 'message', text: 'This is how a new message alert feels.' })}
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
      marginTop: 10,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textMuted,
    },
    buttonWrap: {
      marginTop: Spacing.four,
    },
  });
