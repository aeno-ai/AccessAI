import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { announce } from '@/utils/a11y';
import { stopMixed } from '@/utils/speechHelper';
import { mapsLink, type FriendSos, type SosAnswer } from '@/utils/sos';

// Long buzz, pause — repeated until the alert is answered.
const ALERT_PATTERN = [0, 800, 500];

export function timeAgo(at: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - at) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}

type SosAlertModalProps = {
  sos: FriendSos;
  /** Set when the SOS ended while this was open ('safe' / 'expired'). */
  ended: 'safe' | 'expired' | null;
  onRespond: (kind: SosAnswer) => Promise<void>;
  onClose: () => void;
};

/**
 * Full-screen alert on a friend's phone when someone whose SOS circle they're
 * in sends an SOS — live while AccessAI is open, or the moment they open it
 * after missing it. Shows who, their message, when, and where (the map
 * follows their newest position), and keeps vibrating until answered.
 * "I'm on my way" and "I've seen it" are sent to the person in trouble,
 * who hears them read aloud.
 */
export function SosAlertModal({ sos, ended, onRespond, onClose }: SosAlertModalProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState<SosAnswer | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!sos.isTest && !ended) {
      Vibration.vibrate(ALERT_PATTERN, true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [sos.eventId, sos.isTest, ended]);

  const dismiss = () => {
    Vibration.cancel();
    stopMixed();
    onClose();
  };

  const answer = async (kind: SosAnswer) => {
    setBusy(kind);
    setNote('');
    Vibration.cancel();
    try {
      await onRespond(kind);
      if (kind === 'on_my_way') {
        announce(`${sos.name} has been told you're on your way.`);
        setNote(`${sos.name} has been told you're on your way.`);
      } else {
        dismiss();
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Couldn't send that. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const time = new Date(sos.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const where = sos.location;

  return (
    <Modal visible animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <View style={[styles.screen, ended && styles.screenEnded]} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={styles.content}>
          <Ionicons name={ended ? 'shield-checkmark' : 'warning'} size={56} color={colors.onDanger} />
          <Text style={styles.label}>{ended ? 'SOS ENDED' : sos.isTest ? 'TEST SOS' : 'EMERGENCY SOS'}</Text>
          <Text style={styles.name} accessibilityRole="header">
            {ended === 'safe' ? `${sos.name} is safe now` : ended ? `${sos.name}'s SOS has ended` : `${sos.name} needs help`}
          </Text>
          <Text style={styles.message}>“{sos.message}”</Text>
          <Text style={styles.meta}>
            Sent at {time} ({timeAgo(sos.createdAt)})
          </Text>
          <Text style={styles.meta}>
            {where
              ? `${sos.place ? `Near ${sos.place}. ` : ''}Location updated ${timeAgo(where.at)}.`
              : 'No location was shared.'}
          </Text>
          {sos.isTest ? <Text style={styles.meta}>This is only a test — nothing is wrong.</Text> : null}
          {sos.myResponse === 'on_my_way' && !ended ? (
            <Text style={styles.meta}>You said you&apos;re on your way.</Text>
          ) : null}
          {note ? (
            <Text style={styles.meta} accessibilityLiveRegion="polite">
              {note}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          {where ? (
            <Pressable
              style={styles.primary}
              onPress={() => void Linking.openURL(mapsLink(where))}
              accessibilityRole="button"
              accessibilityLabel={`Open ${sos.name}'s location in maps`}
            >
              <Ionicons name="map-outline" size={22} color={colors.dangerText} />
              <Text style={styles.primaryText}>Open map</Text>
            </Pressable>
          ) : null}
          {!ended && sos.myResponse !== 'on_my_way' ? (
            <Pressable
              style={styles.primary}
              onPress={() => void answer('on_my_way')}
              disabled={busy !== null}
              accessibilityRole="button"
              accessibilityHint={`Tells ${sos.name} that you are coming`}
            >
              {busy === 'on_my_way' ? (
                <ActivityIndicator color={colors.dangerText} />
              ) : (
                <Ionicons name="walk-outline" size={22} color={colors.dangerText} />
              )}
              <Text style={styles.primaryText}>I&apos;m on my way</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.primary}
            onPress={() => {
              dismiss();
              router.push({ pathname: '/chat/[friendId]', params: { friendId: sos.friendId } });
            }}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.dangerText} />
            <Text style={styles.primaryText}>Message {sos.name}</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => (ended || sos.myResponse ? dismiss() : void answer('seen'))}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityHint={ended || sos.myResponse ? undefined : `Tells ${sos.name} that you saw it`}
          >
            <Text style={styles.secondaryText}>{ended || sos.myResponse ? 'Close' : 'I’ve seen it'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.danger,
      paddingTop: 48,
    },
    screenEnded: {
      backgroundColor: t.colors.primary,
    },
    content: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 8,
    },
    label: {
      fontSize: t.font(14),
      fontWeight: t.weight('900'),
      letterSpacing: 2,
      color: t.colors.onDanger,
    },
    name: {
      fontSize: t.font(30),
      fontWeight: t.weight('900'),
      color: t.colors.onDanger,
      textAlign: 'center',
    },
    message: {
      fontSize: t.font(20),
      lineHeight: t.lineHeight(28),
      color: t.colors.onDanger,
      textAlign: 'center',
    },
    meta: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      color: t.colors.onDanger,
      textAlign: 'center',
    },
    actions: {
      padding: 16,
      paddingBottom: 36,
      gap: 10,
    },
    primary: {
      flexDirection: 'row',
      gap: 8,
      minHeight: 56,
      borderRadius: 28,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.dangerText,
    },
    secondary: {
      minHeight: 52,
      borderRadius: 26,
      borderWidth: 2,
      borderColor: t.colors.onDanger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.onDanger,
    },
  });
