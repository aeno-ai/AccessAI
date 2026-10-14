import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useFriends } from '@/realtime/FriendsProvider';
import { sameData } from '@/utils/cache';
import { formatClock, whenText } from '@/utils/dates';
import {
  fetchRecentSos,
  joinNames,
  loadRecentSos,
  mapsLink,
  RECENT_SOS_MS,
  saveRecentSos,
  type FriendRecentSos,
  type RecentSos,
  type SavedRecentSos,
} from '@/utils/sos';

const clock = (ms: number) => formatClock(new Date(ms));

/** "Ended yesterday, 3:40 PM: Paul said they're safe." */
function endedText(sos: RecentSos, who: string): string {
  if (sos.active || sos.endedAt === null) return '';
  const when = whenText(sos.endedAt);
  if (sos.endedReason === 'safe') return `Ended ${when}: ${who} said ${who === 'you' ? 'you were' : "they're"} safe.`;
  if (sos.endedReason === 'replaced') return `Replaced by a newer SOS ${when}.`;
  return `Ended by itself ${when}.`;
}

/** "On the way: Ben. Saw it: Cara." */
function answersText(responses: RecentSos['responses'], leaveOut: string | null): string {
  const others = responses.filter((response) => response.friendId !== leaveOut);
  const coming = others.filter((response) => response.kind === 'on_my_way').map((response) => response.name);
  const saw = others.filter((response) => response.kind === 'seen').map((response) => response.name);
  return [coming.length ? `On the way: ${joinNames(coming)}.` : '', saw.length ? `Saw it: ${joinNames(saw)}.` : '']
    .filter(Boolean)
    .join(' ');
}

const happenedAt = (sos: RecentSos) => sos.occurredAt ?? sos.createdAt;
const near = (sos: RecentSos) => (sos.place ? `, near ${sos.place}` : '');

/** A friend's row, as one sentence (also what a screen reader says). */
export function friendRecentText(sos: FriendRecentSos, myId: string | null): string {
  const mine = sos.myResponse === 'on_my_way' ? 'You answered: On my way.' : sos.myResponse === 'seen' ? 'You saw it.' : '';
  return [
    `${sos.isTest ? 'Test SOS' : 'SOS'} ${whenText(happenedAt(sos))}${near(sos)}.`,
    endedText(sos, sos.name),
    mine,
    answersText(sos.responses, myId),
  ]
    .filter(Boolean)
    .join(' ');
}

/** The rows worth showing: the last 7 days, and not the ones still going (the big SOS cards show those). */
export function recentToShow(saved: SavedRecentSos | null, now = Date.now()) {
  const recent = (sos: RecentSos) => !sos.active && happenedAt(sos) >= now - RECENT_SOS_MS;
  return {
    friends: (saved?.friends ?? []).filter(recent),
    mine: saved?.mine && recent(saved.mine) ? saved.mine : null,
  };
}

/**
 * Home's "Recent SOS": each friend's latest SOS from the past week — when,
 * the last place they sent, how it ended, who answered — even after it
 * ended, and the user's own last one (PWD accounts). Offline first: the last
 * list is saved on the phone and shown with its time; it refreshes when
 * Home opens and whenever an SOS starts or ends.
 */
export function RecentSosCard() {
  const { userId } = useBootstrap();
  const { friendSos, mySos } = useFriends();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const [saved, setSaved] = useState<SavedRecentSos | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void loadRecentSos(userId).then((list) => !cancelled && list && setSaved((current) => current ?? list));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const list = await fetchRecentSos();
      const next: SavedRecentSos = { ...list, fetchedAt: Date.now() };
      // Unchanged: only "Updated" moves, the rows aren't drawn again.
      setSaved((current) =>
        current && sameData({ friends: current.friends, mine: current.mine }, list) ? { ...current, fetchedAt: next.fetchedAt } : next,
      );
      await saveRecentSos(userId, next);
    } catch {
      // Offline: the saved list stays, with its time.
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // An SOS starting or ending (the live events FriendsProvider receives).
  const activeKey = `${friendSos.map((sos) => sos.eventId).join(',')}|${mySos?.eventId ?? ''}`;
  const lastKey = useRef(activeKey);
  useEffect(() => {
    if (lastKey.current === activeKey) return;
    lastKey.current = activeKey;
    void refresh();
  }, [activeKey, refresh]);

  const { friends, mine } = recentToShow(saved);
  if (!saved || (!friends.length && !mine)) return null;

  const mineText = mine
    ? [
        `${mine.isTest ? 'Test SOS' : 'SOS'} sent ${whenText(happenedAt(mine))}${near(mine)} to ${mine.friendsAlerted} ${mine.friendsAlerted === 1 ? 'friend' : 'friends'}.`,
        endedText(mine, 'you'),
        answersText(mine.responses, null) || 'No one answered.',
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, styles.flex]} accessibilityRole="header">
          Recent SOS
        </Text>
        <Text style={styles.updated}>Updated {clock(saved.fetchedAt)}</Text>
      </View>
      <View style={styles.card}>
        {friends.map((sos, index) => {
          const text = friendRecentText(sos, userId);
          return (
            <View key={sos.eventId} style={[styles.row, index > 0 && styles.divider]}>
              <View accessible accessibilityLabel={`${sos.name}. ${text}`}>
                <View style={styles.nameRow}>
                  <Ionicons name="warning-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.name}>{sos.name}</Text>
                  {sos.isTest ? <Text style={styles.testBadge}>Test</Text> : null}
                </View>
                <Text style={styles.line}>{text}</Text>
              </View>
              <View style={styles.buttonRow}>
                {sos.location ? (
                  <Pressable
                    style={styles.button}
                    onPress={() => sos.location && void Linking.openURL(mapsLink(sos.location))}
                    accessibilityRole="button"
                    accessibilityLabel={`Show on map where ${sos.name} last was`}
                  >
                    <Ionicons name="map-outline" size={18} color={colors.primary} />
                    <Text style={styles.buttonText}>Show on map</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.button}
                  onPress={() => router.push({ pathname: '/chat/[friendId]', params: { friendId: sos.friendId } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open chat with ${sos.name}`}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                  <Text style={styles.buttonText}>Open chat</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {mine ? (
          <View style={[styles.row, friends.length > 0 && styles.divider]}>
            <View accessible accessibilityLabel={`Your last SOS. ${mineText}`}>
              <View style={styles.nameRow}>
                <Ionicons name="person-outline" size={18} color={colors.textPrimary} />
                <Text style={styles.name}>Your last SOS</Text>
                {mine.isTest ? <Text style={styles.testBadge}>Test</Text> : null}
              </View>
              <Text style={styles.line}>{mineText}</Text>
            </View>
            {mine.location ? (
              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.button}
                  onPress={() => mine.location && void Linking.openURL(mapsLink(mine.location))}
                  accessibilityRole="button"
                  accessibilityLabel="Show on map where you were"
                >
                  <Ionicons name="map-outline" size={18} color={colors.primary} />
                  <Text style={styles.buttonText}>Show on map</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 10,
      gap: 8,
    },
    flex: {
      flex: 1,
    },
    sectionTitle: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    updated: {
      fontSize: t.font(13),
      color: t.colors.textSecondary,
    },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      paddingHorizontal: 14,
    },
    row: {
      paddingVertical: 14,
      gap: 10,
    },
    divider: {
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    name: {
      flexShrink: 1,
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    testBadge: {
      fontSize: t.font(12),
      fontWeight: t.weight('700'),
      color: t.colors.textSecondary,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 1,
    },
    line: {
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
    },
    buttonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
    },
    buttonText: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
  });
