import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { Friend } from '@/db/friends';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useIsOnline } from '@/hooks/use-is-online';
import { useFriends } from '@/realtime/FriendsProvider';

function preview(friend: Friend): string {
  if (friend.lastMessage) {
    const { body, kind, fromMe } = friend.lastMessage;
    if (kind === 'sos') return fromMe ? 'You sent an SOS' : 'Sent an SOS';
    return fromMe ? `You: ${body}` : body;
  }
  return friend.note || 'Say hello!';
}

function spokenLabel(friend: Friend): string {
  return [
    friend.name,
    friend.online ? 'online' : 'offline',
    friend.unread > 0 ? `${friend.unread} new message${friend.unread === 1 ? '' : 's'}` : null,
    friend.inMySosCircle ? 'in your SOS circle' : null,
    friend.note ? `Note: ${friend.note}` : null,
    friend.lastMessage ? `Last message: ${preview(friend)}` : null,
  ]
    .filter(Boolean)
    .join('. ');
}

/**
 * Everyone you've connected with by friend code — PWD and non-PWD alike.
 * Tapping a friend opens your online chat, with the same tools as an
 * in-person conversation. The list is saved on the phone, so it shows
 * offline too.
 */
export default function FriendsScreen() {
  const { friends, requests, refresh, connected } = useFriends();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const online = useIsOnline();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const pullToRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const incoming = requests.incoming.length;

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            Friends
          </Text>
          <Text style={styles.subtitle}>Chat online with the same tools as Conversation.</Text>
        </View>
        <IconButton icon="person-add-outline" label="Add a friend" variant="tinted" onPress={() => router.push('/friends/add')} />
      </View>

      {!online ? (
        <View style={styles.offline} accessible accessibilityLiveRegion="polite">
          <Ionicons name="cloud-offline-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.offlineText}>Offline — showing saved friends. Messages send when you&apos;re back online.</Text>
        </View>
      ) : !connected ? (
        <View style={styles.offline}>
          <Ionicons name="sync-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.offlineText}>Connecting…</Text>
        </View>
      ) : null}

      {incoming > 0 || requests.outgoing.length > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.requestsRow, pressed && styles.pressed]}
          onPress={() => router.push('/friends/requests')}
          accessibilityRole="button"
          accessibilityLabel={
            incoming > 0 ? `Friend requests: ${incoming} waiting for you` : `Friend requests: ${requests.outgoing.length} sent`
          }
        >
          <Ionicons name="mail-unread-outline" size={22} color={colors.primary} />
          <Text style={styles.requestsText}>
            {incoming > 0 ? `Friend requests (${incoming})` : `Requests you sent (${requests.outgoing.length})`}
          </Text>
          {incoming > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{incoming}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <FlatList
        data={friends}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={friends.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pullToRefresh()} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={44} color={colors.primary} />
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyText}>
              Share your friend code or scan a friend&apos;s QR code to connect. PWD and non-PWD accounts can
              all be friends.
            </Text>
            <View style={styles.emptyButton}>
              <PrimaryButton title="Add a friend" onPress={() => router.push('/friends/add')} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/chat/[friendId]', params: { friendId: item.userId } })}
            accessibilityRole="button"
            accessibilityLabel={spokenLabel(item)}
            accessibilityHint="Opens your chat"
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.firstName.charAt(0).toUpperCase() || '?'}</Text>
              <View style={[styles.presenceDot, item.online ? styles.presenceOn : styles.presenceOff]} />
            </View>
            <View style={styles.rowText}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, item.unread > 0 && styles.nameUnread]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.inMySosCircle ? (
                  <View style={styles.sosBadge}>
                    <Ionicons name="shield-checkmark" size={12} color={colors.dangerText} />
                    <Text style={styles.sosBadgeText}>SOS</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.status}>{item.online ? 'Online' : 'Offline'}</Text>
              <Text style={[styles.preview, item.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                {preview(item)}
              </Text>
            </View>
            {item.unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unread}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.two,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: t.font(22),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    subtitle: {
      marginTop: 4,
      fontSize: t.font(13),
      color: t.colors.textSecondary,
    },
    offline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: Spacing.four,
      marginBottom: Spacing.two,
      padding: 10,
      borderRadius: 12,
      backgroundColor: t.colors.surfaceAlt,
    },
    offlineText: {
      flex: 1,
      fontSize: t.font(13),
      color: t.colors.textSecondary,
    },
    requestsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 56,
      marginHorizontal: Spacing.four,
      marginBottom: Spacing.two,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primaryLight,
    },
    requestsText: {
      flex: 1,
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.onPrimaryLight,
    },
    list: {
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.six,
      gap: 10,
    },
    emptyContainer: {
      flexGrow: 1,
      paddingHorizontal: Spacing.four,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: Spacing.five,
    },
    emptyTitle: {
      fontSize: t.font(18),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    emptyText: {
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
    emptyButton: {
      alignSelf: 'stretch',
      marginTop: Spacing.three,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 72,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    pressed: {
      opacity: 0.75,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: t.font(18),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimaryLight,
    },
    presenceDot: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: t.colors.surface,
    },
    presenceOn: {
      backgroundColor: t.colors.success,
    },
    presenceOff: {
      backgroundColor: t.colors.textMuted,
    },
    rowText: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      flexShrink: 1,
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    nameUnread: {
      fontWeight: t.weight('900'),
    },
    sosBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.colors.danger,
    },
    sosBadgeText: {
      fontSize: t.font(11),
      fontWeight: t.weight('800'),
      color: t.colors.dangerText,
    },
    status: {
      marginTop: 1,
      fontSize: t.font(12),
      color: t.colors.textSecondary,
    },
    preview: {
      marginTop: 2,
      fontSize: t.font(14),
      color: t.colors.textSecondary,
    },
    previewUnread: {
      color: t.colors.textPrimary,
      fontWeight: t.weight('600'),
    },
    badge: {
      minWidth: 24,
      height: 24,
      paddingHorizontal: 6,
      borderRadius: 12,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: t.colors.onPrimary,
    },
  });
