import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { normalize } from '@/accel/language';
import { useAccelScreen } from '@/accel/screenContext';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { RenameConversationModal } from '@/components/conversation/RenameConversationModal';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  deleteConversation,
  getMessages,
  listConversations,
  renameConversation,
  type Conversation,
} from '@/db/conversations';
import { syncConversations } from '@/db/sync';
import { keepIfSame } from '@/utils/cache';
import { openSavedConversation, startNewConversation } from '@/utils/conversationNav';
import { whenText } from '@/utils/dates';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HistoryScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [renaming, setRenaming] = useState<Conversation | null>(null);

  // Every time this tab opens: the conversations saved on the phone appear
  // at once, then any not yet backed up are synced in the background
  // (best-effort, silent offline) and the list updates only if that changed
  // something.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const show = async () => {
        const rows = await listConversations();
        if (!cancelled) {
          setConversations((current) => (current ? keepIfSame(current, rows) : rows));
        }
      };
      void (async () => {
        await show();
        await syncConversations();
        await show();
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleDelete = (conversation: Conversation) => {
    Alert.alert(
      'Delete conversation?',
      `"${conversation.title}" and everything in it will be deleted. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteConversation(conversation.id);
              setConversations(await listConversations());
              // Deletes the cloud copy right away if online; otherwise the
              // deletion stays queued for the next sync.
              void syncConversations();
            })();
          },
        },
      ],
    );
  };

  const handleRename = async (conversation: Conversation, title: string) => {
    setRenaming(null);
    await renameConversation(conversation.id, title);
    setConversations(await listConversations());
    // Uploads the new title right away if online; otherwise on the next sync.
    void syncConversations();
  };

  // ---- Accel: "open Ate Lyka", "read the newest one".
  const findByName = (name: string | undefined): Conversation | null => {
    const said = name ? normalize(name) : '';
    if (!said || !conversations) return null;
    return (
      conversations.find((c) => normalize(c.title) === said) ??
      (said.length >= 3 ? conversations.find((c) => normalize(c.title).includes(said)) : undefined) ??
      null
    );
  };
  useAccelScreen({
    name: 'Chats',
    describe: () => {
      if (!conversations) return 'Your conversations are loading.';
      if (!conversations.length) return 'You have no saved conversations yet. Say "start a conversation" to begin one.';
      const newest = conversations
        .slice(0, 3)
        .map((c) => `${c.title}, ${whenText(c.updatedAt)}`)
        .join('; ');
      return `${conversations.length === 1 ? '1 saved conversation' : `${conversations.length} saved conversations`}. The newest: ${newest}.`;
    },
    examples: [`open ${conversations?.[0]?.title ?? 'Ate Lyka'}`, 'read the newest one', 'start a conversation'],
    accepts: (intent, slots) => intent !== 'chats.open' || findByName(slots.friendName) !== null,
    commands: {
      'chats.open': (slots) => {
        const found = findByName(slots.friendName);
        if (!found) return { kind: 'say', text: `I couldn't find a conversation called ${slots.friendName ?? 'that'}.` };
        return {
          kind: 'confirm',
          question: `Open ${found.title}?`,
          run: async () => ({ say: `Opening ${found.title}.`, after: () => openSavedConversation(found.id) }),
        };
      },
      'chats.read_newest': () => ({
        kind: 'do',
        run: async () => {
          const newest = conversations?.[0];
          if (!newest) return { say: 'You have no saved conversations yet.' };
          const lines = (await getMessages(newest.id))
            .slice(-3)
            .map((m) => `${m.sender === 'me' ? 'You' : 'They'} said: ${m.body}`)
            .join('. ');
          return { say: `${newest.title}, ${whenText(newest.updatedAt)}. ${lines || 'No messages.'}` };
        },
      }),
    },
  });

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            Chats
          </Text>
          <Text style={styles.subtitle}>Your past conversations.</Text>
        </View>
        <Pressable
          style={styles.newButton}
          onPress={startNewConversation}
          accessibilityRole="button"
          accessibilityLabel="New conversation"
        >
          <Ionicons name="add" size={20} color={colors.onPrimary} />
          <Text style={styles.newButtonText}>New</Text>
        </Pressable>
      </View>

      {conversations === null ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubbles-outline" size={36} color={colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.emptyText}>No conversations yet.</Text>
          <View style={styles.emptyButton}>
            <PrimaryButton title="Start a conversation" onPress={startNewConversation} />
          </View>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const open = () => openSavedConversation(item.id);
            const unsynced = item.syncedAt === null;
            return (
              <View style={styles.row}>
                {/* One screen-reader stop for the conversation itself, with
                    rename/delete also offered as its actions (TalkBack:
                    swipe up/down or the actions menu; VoiceOver: rotor). The
                    separate buttons stay for everyone else. */}
                <Pressable
                  style={styles.rowMain}
                  onPress={open}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${formatTimestamp(item.updatedAt)}${unsynced ? '. Saved on this phone only for now' : ''}`}
                  accessibilityHint="Opens the conversation"
                  accessibilityActions={[
                    { name: 'rename', label: 'Rename' },
                    { name: 'delete', label: 'Delete' },
                  ]}
                  onAccessibilityAction={(event) => {
                    if (event.nativeEvent.actionName === 'rename') setRenaming(item);
                    if (event.nativeEvent.actionName === 'delete') handleDelete(item);
                  }}
                >
                  <View style={styles.rowIcon}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.onPrimaryLight} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowTimestamp}>{formatTimestamp(item.updatedAt)}</Text>
                  </View>
                  {unsynced ? (
                    <View style={styles.offlineBadge}>
                      <Text style={styles.offlineBadgeText}>Offline</Text>
                    </View>
                  ) : null}
                </Pressable>
                <IconButton
                  icon="create-outline"
                  label={`Rename conversation: ${item.title}`}
                  color={colors.textMuted}
                  iconSize={20}
                  onPress={() => setRenaming(item)}
                />
                <IconButton
                  icon="trash-outline"
                  label={`Delete conversation: ${item.title}`}
                  color={colors.textMuted}
                  iconSize={20}
                  onPress={() => handleDelete(item)}
                />
              </View>
            );
          }}
        />
      )}

      <RenameConversationModal
        visible={renaming !== null}
        initialTitle={renaming?.title ?? ''}
        onCancel={() => setRenaming(null)}
        onSave={(title) => {
          if (renaming) {
            void handleRename(renaming, title);
          }
        }}
      />
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.two,
    },
    headerText: {
      flex: 1,
    },
    newButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 24,
      backgroundColor: t.colors.primary,
    },
    newButtonText: {
      fontSize: t.font(15),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimary,
    },
    emptyButton: {
      marginTop: Spacing.three,
      alignSelf: 'stretch',
      paddingHorizontal: Spacing.five,
    },
    title: {
      fontSize: t.font(22),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    subtitle: {
      marginTop: 6,
      fontSize: t.font(13),
      color: t.colors.textSecondary,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    emptyText: {
      color: t.colors.textSecondary,
      fontSize: t.font(15),
    },
    listContent: {
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.six,
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      paddingLeft: 12,
      paddingRight: 4,
    },
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 60,
      paddingVertical: 10,
      marginRight: 4,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: t.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    rowTimestamp: {
      fontSize: t.font(12),
      color: t.colors.textMuted,
      marginTop: 2,
    },
    offlineBadge: {
      marginLeft: 8,
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    offlineBadgeText: {
      fontSize: t.font(10),
      fontWeight: t.weight('700'),
      color: t.colors.textMuted,
    },
  });
