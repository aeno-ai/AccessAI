import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '@/api/apiClient';
import { IconButton } from '@/components/ui/IconButton';
import { SectionHeader } from '@/components/ui/SettingRow';
import { Spacing } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useIsOnline } from '@/hooks/use-is-online';
import { useFriends, type FriendRequest } from '@/realtime/FriendsProvider';
import { announce } from '@/utils/a11y';

/** Requests waiting for you (accept / decline) and ones you sent (cancel). */
export default function FriendRequestsScreen() {
  const { requests, refresh } = useFriends();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const online = useIsOnline();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const act = async (request: FriendRequest, action: 'accept' | 'remove', spoken: string) => {
    setBusyId(request.id);
    setError('');
    try {
      await apiFetch(
        action === 'accept' ? `/friends/requests/${request.id}/accept` : `/friends/requests/${request.id}`,
        { method: action === 'accept' ? 'POST' : 'DELETE' },
      );
      announce(spoken);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const nobody = requests.incoming.length === 0 && requests.outgoing.length === 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!online ? <Text style={styles.note}>Connect to the internet to answer requests.</Text> : null}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {nobody ? <Text style={styles.note}>No friend requests right now.</Text> : null}

      {requests.incoming.length > 0 ? <SectionHeader title="Waiting for you" /> : null}
      {requests.incoming.map((request) => (
        <View key={request.id} style={styles.card}>
          <View style={styles.cardText} accessible accessibilityLabel={`${request.person.name} wants to be friends.${request.person.note ? ` Note: ${request.person.note}` : ''}`}>
            <Text style={styles.name}>{request.person.name}</Text>
            <Text style={styles.meta}>wants to be friends</Text>
            {request.person.note ? <Text style={styles.noteText}>“{request.person.note}”</Text> : null}
          </View>
          <IconButton
            icon="checkmark"
            label={`Accept ${request.person.name}`}
            variant="filled"
            disabled={!online || busyId === request.id}
            onPress={() => void act(request, 'accept', `You and ${request.person.firstName} are now friends`)}
          />
          <IconButton
            icon="close"
            label={`Decline ${request.person.name}`}
            color={colors.dangerText}
            disabled={!online || busyId === request.id}
            onPress={() => void act(request, 'remove', 'Request declined')}
          />
        </View>
      ))}

      {requests.outgoing.length > 0 ? <SectionHeader title="You sent" /> : null}
      {requests.outgoing.map((request) => (
        <View key={request.id} style={styles.card}>
          <View style={styles.cardText} accessible accessibilityLabel={`Request sent to ${request.person.name}, waiting for them to accept`}>
            <Text style={styles.name}>{request.person.name}</Text>
            <Text style={styles.meta}>waiting for them to accept</Text>
          </View>
          <IconButton
            icon="close"
            label={`Cancel request to ${request.person.name}`}
            color={colors.dangerText}
            disabled={!online || busyId === request.id}
            onPress={() => void act(request, 'remove', 'Request cancelled')}
          />
        </View>
      ))}
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
      paddingLeft: 14,
      paddingRight: 6,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    cardText: {
      flex: 1,
    },
    name: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    meta: {
      fontSize: t.font(13),
      color: t.colors.textSecondary,
    },
    noteText: {
      marginTop: 4,
      fontSize: t.font(13),
      fontStyle: 'italic',
      color: t.colors.textSecondary,
    },
    note: {
      marginBottom: 12,
      fontSize: t.font(14),
      color: t.colors.textSecondary,
    },
    error: {
      marginBottom: 12,
      fontSize: t.font(14),
      color: t.colors.dangerText,
    },
  });
