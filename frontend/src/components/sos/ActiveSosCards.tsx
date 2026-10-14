import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { timeAgo } from '@/components/sos/SosAlertModal';
import { useSos } from '@/components/sos/SosProvider';
import { offlineNote, useSosWhereabouts } from '@/components/sos/use-sos-whereabouts';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useFriends } from '@/realtime/FriendsProvider';
import { announce } from '@/utils/a11y';
import { directionsLink, joinNames, mapsLink, type FriendSos } from '@/utils/sos';

/**
 * SOS alerts that are still going, at the top of Home:
 * - a friend's SOS (so someone who missed the alert, or opened the app
 *   later, still sees who needs help and where they are now), and
 * - the user's own active SOS, with who answered and a big "I'm safe" —
 *   or, made offline, the SOS waiting to go out once back online.
 * Both stay until the SOS ends ("I'm safe", or after 24 hours).
 */
export function ActiveSosCards() {
  const { friendSos, mySos, respondSos, showSos } = useFriends();
  const { markSafe, sharingLocation, sosPending } = useSos();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  // Keeps "5 minutes ago" current.
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  if (!friendSos.length && !mySos && !sosPending) return null;

  const onMyWay = async (sos: FriendSos) => {
    setBusy(sos.eventId);
    setNote('');
    try {
      await respondSos(sos.eventId, 'on_my_way');
      announce(`${sos.name} has been told you're on your way.`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Couldn't send that. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const safe = async () => {
    setBusy('mine');
    setNote('');
    try {
      await markSafe();
      announce(mySos ? "Your SOS has ended. Your friends were told you're safe." : "Okay. Your SOS won't be sent.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Couldn't send that. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const coming = mySos?.responses.filter((r) => r.kind === 'on_my_way').map((r) => r.name) ?? [];
  const sawIt = mySos?.responses.filter((r) => r.kind === 'seen').map((r) => r.name) ?? [];

  return (
    <View style={styles.wrap}>
      {sosPending && !mySos ? (
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name="cloud-offline-outline" size={22} color={colors.onDanger} />
            <Text style={styles.title} accessibilityRole="header">
              Your SOS is waiting to send
            </Text>
          </View>
          <Text style={styles.line}>No internet. Your friends get it the moment you&apos;re back online.</Text>
          <Pressable
            style={styles.whiteButton}
            onPress={() => void safe()}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityHint="Your SOS will not be sent"
          >
            {busy === 'mine' ? <ActivityIndicator color={colors.dangerText} /> : null}
            <Text style={styles.whiteButtonText}>I’m safe now — don’t send it</Text>
          </Pressable>
        </View>
      ) : null}

      {mySos ? (
        <View style={styles.card} accessible={false}>
          <View style={styles.titleRow}>
            <Ionicons name="warning" size={22} color={colors.onDanger} />
            <Text style={styles.title} accessibilityRole="header">
              {mySos.isTest ? 'Your test SOS is active' : 'Your SOS is active'}
            </Text>
          </View>
          <Text style={styles.line}>
            Sent {timeAgo(mySos.createdAt)} to {mySos.friendsAlerted} {mySos.friendsAlerted === 1 ? 'friend' : 'friends'}.
          </Text>
          {coming.length ? <Text style={styles.line}>{joinNames(coming)} {coming.length === 1 ? 'is' : 'are'} on the way.</Text> : null}
          {sawIt.length ? <Text style={styles.line}>{joinNames(sawIt)} saw it.</Text> : null}
          {sharingLocation ? (
            <Text style={styles.line}>Sharing your location while AccessAI is open.</Text>
          ) : null}
          <Pressable
            style={styles.whiteButton}
            onPress={() => void safe()}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityHint="Ends your SOS and tells your friends you are safe"
          >
            {busy === 'mine' ? <ActivityIndicator color={colors.dangerText} /> : null}
            <Text style={styles.whiteButtonText}>I’m safe now</Text>
          </Pressable>
        </View>
      ) : null}

      {friendSos.map((sos) => (
        <FriendSosCard
          key={sos.eventId}
          sos={sos}
          busy={busy}
          onOpen={() => showSos(sos.eventId)}
          onMyWay={() => void onMyWay(sos)}
        />
      ))}

      {note ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

type FriendSosCardProps = {
  sos: FriendSos;
  busy: string | null;
  onOpen: () => void;
  onMyWay: () => void;
};

/** A friend's SOS: who, when, where in words (place, distance, accuracy), and what to do. */
function FriendSosCard({ sos, busy, onOpen, onMyWay }: FriendSosCardProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { place, distance, accuracy } = useSosWhereabouts(sos);
  const howFar = [distance, accuracy].filter(Boolean).join(' · ');
  const offline = offlineNote(sos, timeAgo);

  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityHint="Opens the full SOS alert">
        <View style={styles.titleRow}>
          <Ionicons name="warning" size={22} color={colors.onDanger} />
          <Text style={styles.title} accessibilityRole="header">
            {sos.isTest ? `TEST: ${sos.name} sent a test SOS` : `${sos.name} needs help`}
          </Text>
        </View>
        <Text style={styles.line}>
          SOS sent {timeAgo(sos.occurredAt ?? sos.createdAt)}.
          {sos.location ? ` Location updated ${timeAgo(sos.location.at)}.` : ' No location shared.'}
        </Text>
        {offline ? <Text style={styles.line}>{offline}</Text> : null}
        {place ? <Text style={styles.strong}>Near {place}</Text> : null}
        {howFar ? <Text style={styles.strong}>{howFar}</Text> : null}
        {sos.myResponse === 'on_my_way' ? <Text style={styles.line}>You said you’re on your way.</Text> : null}
      </Pressable>
      <View style={styles.buttonRow}>
        {sos.location ? (
          <>
            <Pressable
              style={styles.whiteButton}
              onPress={() => sos.location && void Linking.openURL(directionsLink(sos.location))}
              accessibilityRole="button"
              accessibilityLabel={`Walking directions to ${sos.name}`}
            >
              <Ionicons name="navigate-outline" size={18} color={colors.dangerText} />
              <Text style={styles.whiteButtonText}>Directions</Text>
            </Pressable>
            <Pressable
              style={styles.whiteButton}
              onPress={() => sos.location && void Linking.openURL(mapsLink(sos.location))}
              accessibilityRole="button"
              accessibilityLabel={`Open ${sos.name}'s location in maps`}
            >
              <Ionicons name="map-outline" size={18} color={colors.dangerText} />
              <Text style={styles.whiteButtonText}>Map</Text>
            </Pressable>
          </>
        ) : null}
        {sos.myResponse !== 'on_my_way' ? (
          <Pressable
            style={styles.whiteButton}
            onPress={onMyWay}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityHint={`Tells ${sos.name} that you are coming`}
          >
            {busy === sos.eventId ? <ActivityIndicator color={colors.dangerText} /> : null}
            <Text style={styles.whiteButtonText}>I’m on my way</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.whiteButton}
          onPress={() => router.push({ pathname: '/chat/[friendId]', params: { friendId: sos.friendId } })}
          accessibilityRole="button"
          accessibilityLabel={`Message ${sos.name}`}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.dangerText} />
          <Text style={styles.whiteButtonText}>Message</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      gap: 12,
      marginBottom: 16,
    },
    card: {
      backgroundColor: t.colors.danger,
      borderRadius: 20,
      padding: 16,
      gap: 6,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    title: {
      flex: 1,
      fontSize: t.font(18),
      fontWeight: t.weight('900'),
      color: t.colors.onDanger,
    },
    line: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      color: t.colors.onDanger,
    },
    strong: {
      fontSize: t.font(16),
      lineHeight: t.lineHeight(22),
      fontWeight: t.weight('800'),
      color: t.colors.onDanger,
    },
    buttonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    whiteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 24,
      backgroundColor: t.colors.surface,
      marginTop: 4,
    },
    whiteButtonText: {
      fontSize: t.font(15),
      fontWeight: t.weight('800'),
      color: t.colors.dangerText,
    },
    note: {
      fontSize: t.font(14),
      color: t.colors.dangerText,
      textAlign: 'center',
    },
  });
