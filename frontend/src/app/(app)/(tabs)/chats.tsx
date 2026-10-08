import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RenameConversationModal } from '@/components/conversation/RenameConversationModal';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  deleteConversation,
  listConversations,
  renameConversation,
  seedDummyDataIfEmpty,
  type Conversation,
} from '@/db/conversations';
import { syncConversations } from '@/db/sync';
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

  // Reload every time this tab gains focus, so a conversation created
  // elsewhere shows up without needing a manual refresh.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await seedDummyDataIfEmpty();
        // Best-effort — if this fails (offline, server unreachable), the
        // conversations already saved on-device are still shown below.
        await syncConversations();
        const rows = await listConversations();
        if (!cancelled) {
          setConversations(rows);
        }
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

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Chats
        </Text>
        <Text style={styles.subtitle}>
          Saved on this device and syncs to the cloud automatically once you are online.
        </Text>
      </View>

      {conversations === null ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="time-outline" size={32} color={colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.emptyText}>No conversations yet.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const open = () =>
              // `opened` differs on every tap, so the conversation screen
              // reloads this conversation even if it was the last one open.
              router.push({ pathname: '/conversation', params: { id: item.id, opened: String(Date.now()) } });
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
                  accessibilityLabel={`${item.title}. ${formatTimestamp(item.updatedAt)}${unsynced ? '. Saved on this phone only, not synced yet' : ''}`}
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
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.two,
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
      color: t.colors.textMuted,
      fontSize: t.font(14),
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
