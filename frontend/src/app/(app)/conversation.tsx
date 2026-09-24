import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MessageBubble } from '@/components/conversation/MessageBubble';
import { RenameConversationModal } from '@/components/conversation/RenameConversationModal';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  addMessage,
  createConversation,
  getConversation,
  getMessages,
  renameConversation,
  type Message,
} from '@/db/conversations';
import { syncConversations } from '@/db/sync';
import { unnamedConversationTitle } from '@/utils/conversationTitle';
import { stopMixed } from '@/utils/speechHelper';

type Speaker = Message['sender'];

// Header text while a new conversation is still being named. Never saved as
// a title — unnamed conversations get unnamedConversationTitle() instead.
const NEW_CONVERSATION_HEADER = 'New Conversation';

/**
 * The one real conversation screen every dashboard entry point leads to —
 * the greeting card and the AI banner (feature tiles are informational
 * only, see FeatureTile.tsx). It's a single-device, pass-the-phone
 * conversation (like Google Translate's conversation mode): whoever's
 * holding the phone toggles "Me"/"Them" before typing or "speaking" their
 * side, every message can be read aloud, and sign-language mode is a
 * visible toggle rather than a separate screen.
 *
 * Opened with no params (the greeting card / AI banner), this resumes
 * whatever conversation was last on screen — this is a drawer screen, so it
 * stays mounted between visits — or, the first time, starts a brand new one
 * and asks the user to name it ("which conversation is this?"). Opened with
 * an `id` param (from History), it loads and continues that conversation,
 * skipping the naming step. The chat-bubble "+" in the header starts a new
 * conversation from inside this one.
 *
 * STT and sign-language recognition are simulated for now (see the plan);
 * TTS is real, via expo-speech.
 */
export default function ConversationScreen() {
  // `opened` changes on every tap in History, so the same conversation is
  // reloaded even if it's the one already on screen.
  const { id: routeId, opened } = useLocalSearchParams<{ id?: string; opened?: string }>();
  const listRef = useRef<FlatList<Message>>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  // Same value as conversationId, but readable from async callbacks without
  // going stale (see the focus check below).
  const conversationIdRef = useRef<string | null>(null);
  // Bumped whenever the screen switches conversations, so an in-flight send
  // can tell its results no longer belong on screen.
  const sessionRef = useRef(0);
  const [conversationTitle, setConversationTitle] = useState('');
  const [namingDone, setNamingDone] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [composeText, setComposeText] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker>('me');
  const [listening, setListening] = useState(false);
  const [signMode, setSignMode] = useState(false);
  const [renaming, setRenaming] = useState(false);

  // Which History tap has finished loading. Still loading = the current
  // tap hasn't been answered yet.
  const openKey = routeId ? `${routeId}:${opened ?? ''}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loadingExisting = openKey !== null && loadedKey !== openKey;

  // Puts the screen back to a fresh, unnamed conversation. Whatever was on
  // screen is already saved — every message is written when it's sent.
  const startNewConversation = useCallback(() => {
    stopMixed();
    sessionRef.current += 1;
    conversationIdRef.current = null;
    setConversationId(null);
    setConversationTitle('');
    setNamingDone(false);
    setNameInput('');
    setMessages([]);
    setComposeText('');
    setActiveSpeaker('me');
    setListening(false);
    setSignMode(false);
  }, []);

  // Opened from History: load that conversation's title and messages.
  useEffect(() => {
    if (!routeId) {
      return;
    }
    let cancelled = false;
    stopMixed();
    sessionRef.current += 1;
    // Claimed right away, so the focus check below can't mistake this
    // conversation for the one that was on screen before.
    conversationIdRef.current = routeId;
    (async () => {
      const [conversation, existingMessages] = await Promise.all([
        getConversation(routeId),
        getMessages(routeId),
      ]);
      if (cancelled) {
        return;
      }
      if (!conversation) {
        startNewConversation(); // deleted in the meantime
      } else {
        setConversationId(routeId);
        setConversationTitle(conversation.title);
        setMessages(existingMessages);
        setNamingDone(true);
        setComposeText('');
      }
      setLoadedKey(openKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId, openKey, startNewConversation]);

  // Resuming (greeting card / AI banner) must never bring back a
  // conversation that was deleted in History while this screen was hidden,
  // and should show the new name if it was renamed there. Only acts if that
  // same conversation is still the one on screen — a History tap may have
  // switched it in the meantime.
  useFocusEffect(
    useCallback(() => {
      const shownId = conversationIdRef.current;
      if (!shownId) {
        return;
      }
      let cancelled = false;
      void getConversation(shownId).then((conversation) => {
        if (cancelled || conversationIdRef.current !== shownId) {
          return;
        }
        if (!conversation) {
          startNewConversation();
        } else {
          setConversationTitle(conversation.title);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [startNewConversation]),
  );

  const confirmName = (title: string) => {
    setConversationTitle(title.trim() || unnamedConversationTitle());
    setNamingDone(true);
  };

  // A conversation with no messages yet isn't saved anywhere — the new name
  // is just used when the first message creates it.
  const handleRename = async (title: string) => {
    setRenaming(false);
    setConversationTitle(title);
    const id = conversationIdRef.current;
    if (id) {
      await renameConversation(id, title);
      void syncConversations();
    }
  };

  const handleSend = async () => {
    const body = composeText.trim();
    if (!body) {
      return;
    }
    const session = sessionRef.current;

    let id = conversationId;
    if (!id) {
      // Only create the conversation record once there's an actual message
      // to save — avoids History filling up with empty entries from people
      // who just looked at the screen.
      const conversation = await createConversation(
        conversationTitle || unnamedConversationTitle(),
        'combined',
      );
      id = conversation.id;
      if (sessionRef.current === session) {
        conversationIdRef.current = id;
        setConversationId(id);
      }
    }

    await addMessage(id, activeSpeaker, body);
    // Best-effort, non-blocking — if offline this just fails silently and
    // the next sync trigger (reconnect, or opening History) picks it up.
    void syncConversations();

    if (sessionRef.current !== session) {
      return; // the user switched conversations mid-send; the message is saved where it belongs
    }
    setMessages(await getMessages(id));
    setComposeText('');
    setListening(false);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  const showNamingPrompt = !namingDone;

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerSide}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          {namingDone && !loadingExisting ? (
            // Tap the title to rename the conversation.
            <TouchableOpacity
              style={styles.headerTitleButton}
              onPress={() => setRenaming(true)}
              accessibilityRole="button"
              accessibilityLabel={`Rename conversation: ${conversationTitle}`}
              hitSlop={8}
            >
              <Text style={styles.headerTitleText} numberOfLines={1}>
                {conversationTitle}
              </Text>
              <Ionicons name="create-outline" size={15} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.headerTitle} numberOfLines={1}>
              {NEW_CONVERSATION_HEADER}
            </Text>
          )}
          {/* Hidden while naming/loading — there's no conversation to leave yet. */}
          {namingDone && !loadingExisting ? (
            <TouchableOpacity
              style={[styles.headerSide, styles.headerSideRight]}
              onPress={startNewConversation}
              accessibilityRole="button"
              accessibilityLabel="Start a new conversation"
              hitSlop={8}
            >
              <View style={styles.newConversationIcon}>
                <Ionicons name="chatbubble-outline" size={24} color={colors.textPrimary} />
                <Ionicons
                  name="add"
                  size={14}
                  color={colors.textPrimary}
                  style={styles.newConversationPlus}
                />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSide} />
          )}
        </View>

        {loadingExisting ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : showNamingPrompt ? (
          <View style={styles.namingCard}>
            <Ionicons name="pricetag-outline" size={32} color={colors.primary} />
            <Text style={styles.namingTitle}>Name this conversation</Text>
            <Text style={styles.namingSubtitle}>
              So you can find it again in History later — like &quot;Ate Lyka&quot; or
              &quot;Dagupan trip&quot;.
            </Text>
            <TextInput
              style={styles.namingInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g. Ate Lyka, Dagupan trip"
              placeholderTextColor={colors.textMuted}
              maxLength={100}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => confirmName(nameInput)}
            />
            <View style={styles.namingActions}>
              <TouchableOpacity
                style={styles.namingSkip}
                onPress={() => confirmName('')}
                accessibilityRole="button"
              >
                <Text style={styles.namingSkipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.namingStart}
                onPress={() => confirmName(nameInput)}
                accessibilityRole="button"
              >
                <Text style={styles.namingStartText}>Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.primary} />
                <Text style={styles.emptyTitle}>Start the conversation</Text>
                <Text style={styles.emptySubtitle}>
                  Pick who&apos;s about to talk below, then type, use the mic, or switch to sign
                  language mode. Hand the phone back and forth as needed — everything stays on
                  this one screen and works offline.
                </Text>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <MessageBubble message={item} />}
                contentContainerStyle={styles.messageList}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              />
            )}

            {signMode ? (
              <View style={styles.signBanner}>
                <Ionicons name="camera-outline" size={16} color={colors.primary} />
                <Text style={styles.signBannerText}>
                  Sign language mode — camera recognition is coming soon. Type the translated
                  message below for now.
                </Text>
              </View>
            ) : null}

            <View style={styles.speakerRow}>
              <TouchableOpacity
                style={[styles.speakerButton, activeSpeaker === 'me' && styles.speakerButtonActive]}
                onPress={() => setActiveSpeaker('me')}
                accessibilityRole="button"
                accessibilityLabel="Speaking as Me"
              >
                <Text style={[styles.speakerText, activeSpeaker === 'me' && styles.speakerTextActive]}>
                  Me
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.speakerButton, activeSpeaker === 'them' && styles.speakerButtonActive]}
                onPress={() => setActiveSpeaker('them')}
                accessibilityRole="button"
                accessibilityLabel="Speaking as Them"
              >
                <Text
                  style={[styles.speakerText, activeSpeaker === 'them' && styles.speakerTextActive]}
                >
                  Them
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.composeRow}>
              <TouchableOpacity
                style={[styles.iconButton, listening && styles.iconButtonActive]}
                onPress={() => setListening((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={listening ? 'Stop listening' : 'Speak your message'}
              >
                <Ionicons
                  name={listening ? 'mic' : 'mic-outline'}
                  size={18}
                  color={listening ? colors.white : colors.primary}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={composeText}
                onChangeText={(text) => {
                  setComposeText(text);
                  if (listening && text) {
                    setListening(false);
                  }
                }}
                placeholder={listening ? 'Listening — type what’s being said…' : 'Type a message'}
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <TouchableOpacity
                style={[styles.iconButton, signMode && styles.iconButtonActive]}
                onPress={() => setSignMode((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={
                  signMode ? 'Turn off sign language mode' : 'Turn on sign language mode'
                }
              >
                <Ionicons
                  name="hand-left-outline"
                  size={18}
                  color={signMode ? colors.white : colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendButton, !composeText.trim() && styles.sendButtonDisabled]}
                onPress={() => void handleSend()}
                disabled={!composeText.trim()}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <Ionicons name="send" size={16} color={colors.white} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <RenameConversationModal
        visible={renaming}
        initialTitle={conversationTitle}
        onCancel={() => setRenaming(false)}
        onSave={(title) => void handleRename(title)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  headerTitleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 12,
  },
  headerTitleText: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  // Same width on both sides, so the title stays centered whether or not
  // the new-conversation button is showing.
  headerSide: {
    width: 32,
    justifyContent: 'center',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  newConversationIcon: {
    width: 24,
    height: 24,
  },
  newConversationPlus: {
    position: 'absolute',
    top: 4,
    left: 5,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  namingCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  namingTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  namingSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  namingInput: {
    width: '100%',
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  namingActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  namingSkip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  namingSkipText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  namingStart: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.primary,
  },
  namingStartText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  messageList: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  signBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    padding: 10,
    borderRadius: 12,
  },
  signBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  speakerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  speakerButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  speakerButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  speakerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  speakerTextActive: {
    color: colors.white,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: colors.primary,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
});
