import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSos } from '@/components/sos/SosProvider';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';

const HOLD_DURATION_MS = 600;

/**
 * The red Emergency SOS banner on Home. "Send" needs a hold rather than a
 * single tap, so a stray touch can't fire an emergency alert by accident —
 * holding it opens the SOS dialog, where the message is checked and sent.
 * TalkBack / VoiceOver: double-tap and hold, or the "Send SOS" action.
 */
export function SosBanner() {
  const { openReview } = useSos();
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.banner}>
      <View style={styles.iconBox}>
        <Ionicons name="warning-outline" size={20} color={colors.onDanger} />
      </View>
      <View style={styles.textColumn}>
        <Text style={styles.title} accessibilityRole="header">
          Emergency SOS
        </Text>
        <Text style={styles.subtitle}>
          {prefs.shakeToSos
            ? 'Hold the button, or shake your phone 3 times, to send your location.'
            : 'Send your location to your SOS circle and emergency contacts.'}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
        onLongPress={openReview}
        delayLongPress={HOLD_DURATION_MS}
        accessibilityRole="button"
        accessibilityLabel="Hold to send SOS"
        accessibilityHint="Double-tap and hold to open the SOS message"
        accessibilityActions={[{ name: 'longpress', label: 'Send SOS' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'longpress') openReview();
        }}
      >
        <Text style={styles.sendButtonText}>Hold to Send</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.danger,
      borderRadius: 16,
      padding: 14,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.onDanger,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    textColumn: {
      flex: 1,
      marginRight: 10,
    },
    title: {
      fontSize: t.font(15),
      fontWeight: t.weight('800'),
      color: t.colors.onDanger,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: t.font(12),
      color: t.colors.onDanger,
      lineHeight: t.lineHeight(16),
    },
    sendButton: {
      minHeight: 48,
      justifyContent: 'center',
      backgroundColor: t.colors.surface,
      borderRadius: 24,
      paddingHorizontal: 14,
    },
    sendButtonText: {
      color: t.colors.dangerText,
      fontWeight: t.weight('800'),
      fontSize: t.font(13),
    },
    pressed: {
      opacity: 0.8,
    },
  });
