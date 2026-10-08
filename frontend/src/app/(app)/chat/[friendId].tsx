import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/api/apiClient';
import { Composer, type ComposerHandle } from '@/components/conversation/Composer';
import { MessageBubble } from '@/components/conversation/MessageBubble';
import { IconButton } from '@/components/ui/IconButton';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  addPendingMessage,
  backfill,
  deleteChat,
  flushOutbox,
  getDirectMessages,
  markChatRead,
  type DirectMessage,
} from '@/db/directMessages';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useFriends } from '@/realtime/FriendsProvider';
import { announce } from '@/utils/a11y';
import { mapsLink } from '@/utils/sos';
import { setSosCircle } from '@/utils/sosCircle';

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** An SOS posted into the chat — drawn as an alert, not a normal bubble. */
function SosMessage({ message, name }: { message: DirectMessage; name: string }) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const coords =
    message.sos?.latitude != null && message.sos?.longitude != null
      ? { latitude: message.sos.latitude, longitude: message.sos.longitude }
      : null;
  const who = message.fromMe ? 'You sent an SOS' : `SOS from ${name}`;
  const label = `${message.sos?.isTest ? 'Test. ' : ''}${who}: ${message.body}. ${formatTime(message.serverAt ?? message.createdAt)}`;

  return (
    <View style={styles.sosCard}>
      <View style={styles.sosHeader} accessible accessibilityLabel={label}>
        <Ionicons name="warning" size={18} color={colors.dangerText} />
        <Text style={styles.sosTitle}>
          {message.sos?.isTest ? 'TEST · ' : ''}
          {who}
        </Text>
      </View>
      <Text style={styles.sosBody} importantForAccessibility="no" accessibilityElementsHidden>
        {message.body}
      </Text>
      <Text style={styles.sosTime} importantForAccessibility="no" accessibilityElementsHidden>
        {formatTime(message.serverAt ?? message.createdAt)}
      </Text>
      {coords ? (
        <Pressable
          style={styles.sosMap}
          onPress={() => void Linking.openURL(mapsLink(coords))}
          accessibilityRole="button"
          accessibilityLabel={message.fromMe ? 'Open your SOS location in maps' : `Open ${name}'s location in maps`}
        >
          <Ionicons name="map-outline" size={18} color={colors.onDanger} />
          <Text style={styles.sosMapText}>Open map</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * An online chat with one friend, with the same tools as an in-person
 * conversation (speech-to-text, quick replies, sign mode, read aloud).
 * Offline first: messages are saved on the phone straight away and sent as
 * soon as there's a connection; the chat history is readable offline.
 */
export default function FriendChatScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const { role } = useBootstrap();
  const { friends, onLive, setActiveChat, refresh } = useFriends();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const focused = useRef(false);

  const friend = friends.find((f) => f.userId === friendId);
  const name = friend?.firstName || friend?.name || 'Friend';
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  // When the friend last read the chat; newer messages aren't "Seen" yet.
  const [seenAt, setSeenAt] = useState<number | null>(null);
  const theirReadAt = friend?.theirReadAt ?? null;
  const effectiveSeenAt = Math.max(seenAt ?? 0, theirReadAt ?? 0) || null;

  const reload = useCallback(async () => {
    if (!friendId) return;
    setMessages(await getDirectMessages(friendId));
  }, [friendId]);

  // Fetch anything new, then tell the friend it's been read. Both quietly
  // do nothing offline.
  const catchUp = useCallback(async () => {
    if (!friendId) return;
    try {
      await backfill(friendId);
      await reload();
      await markChatRead(friendId);
    } catch {
      // Offline — the saved chat is shown.
    }
  }, [friendId, reload]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setActiveChat(friendId ?? null);
      void reload().then(catchUp);
      return () => {
        focused.current = false;
        setActiveChat(null);
      };
    }, [friendId, reload, catchUp, setActiveChat]),
  );

  // Live: a new message from this friend, or them reading the chat.
  useEffect(() => {
    const offNew = onLive('dm:new', (payload) => {
      if (payload.friendId !== friendId) return;
      void reload().then(() => {
        if (focused.current) void markChatRead(friendId).catch(() => undefined);
      });
    });
    const offRead = onLive('dm:read', (payload) => {
      if (payload.friendId === friendId) setSeenAt(payload.readAt);
    });
    return () => {
      offNew();
      offRead();
    };
  }, [friendId, onLive, reload]);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => listRef.current?.scrollToEnd({ animated: true }));
    return () => subscription.remove();
  }, []);

  const handleSend = async (body: string): Promise<boolean> => {
    if (!friendId) return false;
    await addPendingMessage(friendId, body);
    await reload();
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    // Sends now if online; otherwise it waits and goes on reconnect.
    void flushOutbox().then(reload);
    return true;
  };

  const toggleSosCircle = async () => {
    if (!friend) return;
    const next = !friend.inMySosCircle;
    try {
      await setSosCircle(friend.userId, next);
      await refresh();
      announce(next ? `${name} is now in your SOS circle` : `${name} was removed from your SOS circle`);
    } catch (e: unknown) {
      Alert.alert('Could not change your SOS circle', e instanceof Error ? e.message : 'Check your connection and try again.');
    }
  };

  const confirmRemove = () => {
    if (!friend) return;
    Alert.alert('Remove friend?', `You and ${friend.name} will no longer be friends, and this chat will be deleted for both of you.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await apiFetch(`/friends/${friend.userId}`, { method: 'DELETE' });
              await deleteChat(friend.userId);
              await refresh();
              announce(`${friend.name} removed`);
              router.back();
            } catch (e: unknown) {
              Alert.alert('Could not remove friend', e instanceof Error ? e.message : 'Check your connection and try again.');
            }
          })();
        },
      },
    ]);
  };

  // "Seen" goes under the newest of your messages the friend has read.
  const lastSeenId = (() => {
    if (!effectiveSeenAt) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.fromMe && m.serverAt !== null && m.serverAt <= effectiveSeenAt) return m.localId;
    }
    return null;
  })();

  const statusOf = (message: DirectMessage): string | undefined => {
    if (message.status === 'pending') return 'Waiting for internet';
    if (message.status === 'failed') return 'Not sent';
    if (message.localId === lastSeenId) return 'Seen';
    return undefined;
  };

  const canUseSos = role !== 'non_pwd';

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <KeyboardAvoider>
        <View style={styles.header}>
          <IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} />
          <View
            style={styles.headerText}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`Chat with ${friend?.name ?? name}. ${friend?.online ? 'Online' : 'Offline'}${friend?.note ? `. Note: ${friend.note}` : ''}`}
          >
            <Text style={styles.headerName} numberOfLines={1}>
              {friend?.name ?? name}
            </Text>
            <Text style={styles.headerMeta} numberOfLines={2}>
              {friend?.online ? '● Online' : 'Offline'}
              {friend?.note ? ` · ${friend.note}` : ''}
            </Text>
          </View>
          {friend && canUseSos ? (
            <IconButton
              icon={friend.inMySosCircle ? 'shield-checkmark' : 'shield-outline'}
              label={friend.inMySosCircle ? `${name} is in your SOS circle. Tap to remove.` : `Add ${name} to your SOS circle`}
              hint="Friends in your SOS circle are alerted when you send an SOS"
              selected={friend.inMySosCircle}
              color={friend.inMySosCircle ? colors.dangerText : colors.textSecondary}
              onPress={() => void toggleSosCircle()}
            />
          ) : null}
          {friend ? (
            <IconButton icon="person-remove-outline" label={`Remove ${friend.name} as a friend`} color={colors.textSecondary} onPress={confirmRemove} />
          ) : null}
        </View>

        {friend?.inTheirSosCircle ? (
          <Text style={styles.circleNote}>You&apos;re in {name}&apos;s SOS circle — you&apos;ll be alerted if they send an SOS.</Text>
        ) : null}

        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={36} color={colors.primary} />
            <Text style={styles.emptyTitle}>Say hello to {name}</Text>
            <Text style={styles.emptyText}>Type, use the mic, or tap a quick reply. Messages you write offline are sent once you&apos;re back online.</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.localId}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) =>
              item.kind === 'sos' ? (
                <SosMessage message={item} name={name} />
              ) : (
                <MessageBubble
                  body={item.body}
                  sender={item.fromMe ? 'me' : 'them'}
                  createdAt={item.serverAt ?? item.createdAt}
                  senderName={item.fromMe ? 'You' : name}
                  status={statusOf(item)}
                />
              )
            }
          />
        )}

        <Composer controlRef={composerRef} onSend={handleSend} listeningTo="you" />
      </KeyboardAvoider>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.two,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.one,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    headerText: {
      flex: 1,
      marginHorizontal: 4,
    },
    headerName: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    headerMeta: {
      fontSize: t.font(12),
      color: t.colors.textSecondary,
    },
    circleNote: {
      marginHorizontal: Spacing.three,
      marginTop: Spacing.two,
      padding: 8,
      borderRadius: 10,
      fontSize: t.font(12),
      color: t.colors.textSecondary,
      backgroundColor: t.colors.surfaceAlt,
      overflow: 'hidden',
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 8,
    },
    emptyTitle: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    emptyText: {
      fontSize: t.font(13),
      lineHeight: t.lineHeight(19),
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
    messageList: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.two,
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    sosCard: {
      marginVertical: 8,
      padding: 12,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: t.colors.danger,
      backgroundColor: t.colors.surface,
      gap: 4,
    },
    sosHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sosTitle: {
      fontSize: t.font(15),
      fontWeight: t.weight('800'),
      color: t.colors.dangerText,
    },
    sosBody: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      color: t.colors.textPrimary,
    },
    sosTime: {
      fontSize: t.font(12),
      color: t.colors.textSecondary,
    },
    sosMap: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      marginTop: 4,
      paddingHorizontal: 14,
      borderRadius: 22,
      backgroundColor: t.colors.danger,
    },
    sosMapText: {
      fontSize: t.font(14),
      fontWeight: t.weight('800'),
      color: t.colors.onDanger,
    },
  });
