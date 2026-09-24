import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RenameConversationModal } from '@/components/conversation/RenameConversationModal';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  deleteConversation,
  listConversations,
  renameConversation,
  seedDummyDataIfEmpty,
  type Conversation,
} from '@/db/conversations';
import { syncConversations } from '@/db/sync';

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HistoryScreen() {
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
        <Text style={styles.title}>History</Text>
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
          <Ionicons name="time-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyText}>No conversations yet.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                // `opened` differs on every tap, so the conversation screen
                // reloads this conversation even if it was the last one open.
                router.push({ pathname: '/conversation', params: { id: item.id, opened: String(Date.now()) } })
              }
              accessibilityRole="button"
              accessibilityLabel={`Continue conversation: ${item.title}`}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowTimestamp}>{formatTimestamp(item.updatedAt)}</Text>
              </View>
              {item.syncedAt === null ? (
                <View style={styles.offlineBadge}>
                  <Text style={styles.offlineBadgeText}>Offline</Text>
                </View>
              ) : null}
              <TouchableOpacity
                onPress={() => setRenaming(item)}
                hitSlop={8}
                style={styles.rowAction}
                accessibilityRole="button"
                accessibilityLabel={`Rename conversation: ${item.title}`}
              >
                <Ionicons name="create-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                hitSlop={8}
                style={styles.rowAction}
                accessibilityRole="button"
                accessibilityLabel={`Delete conversation: ${item.title}`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
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

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textSecondary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowTimestamp: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  offlineBadge: {
    backgroundColor: colors.canvas,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  offlineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  rowAction: {
    marginLeft: 10,
    padding: 4,
  },
});
