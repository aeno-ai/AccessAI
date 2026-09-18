import { useEffect, useRef, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MessageBubble } from '@/components/conversation/MessageBubble';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  addMessage,
  createConversation,
  getConversation,
  getMessages,
  type Message,
} from '@/db/conversations';
import { syncConversations } from '@/db/sync';

type Speaker = Message['sender'];

const DEFAULT_TITLE = 'New Conversation';

/**
 * The one real conversation screen every dashboard entry point leads to —
 * the greeting card and the AI banner (feature tiles are informational
 * only, see FeatureTile.tsx). It's a single-device, pass-the-phone
 * conversation (like Google Translate's conversation mode): whoever's
 * holding the phone toggles "Me"/"Them" before typing or "speaking" their
 * side, every message can be read aloud, and sign-language mode is a
 * visible toggle rather than a separate screen.
 *
 * Opened with no params, this starts a brand new conversation and asks the
 * user to name it first ("which conversation is this?"). Opened with an
 * `id` param (from History), it loads and continues that existing
 * conversation instead, skipping the naming step.
 *
 * STT and sign-language recognition are simulated for now (see the plan);
 * TTS is real, via expo-speech.
 */
export default function ConversationScreen() {
  const { id: routeId } = useLocalSearchParams<{ id?: string }>();
  const listRef = useRef<FlatList<Message>>(null);

  const [conversationId, setConversationId] = useState<string | null>(routeId ?? null);
  const [conversationTitle, setConversationTitle] = useState('');
  const [namingDone, setNamingDone] = useState(!!routeId);
  const [nameInput, setNameInput] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(!!routeId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composeText, setComposeText] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker>('me');
  const [listening, setListening] = useState(false);
  const [signMode, setSignMode] = useState(false);

  // Continuing an existing conversation (opened from History): load its
  // saved title and messages once, on mount.
  useEffect(() => {
    if (!routeId) {
      return;
    }
    let cancelled = false;
    (async () => {
      const [conversation, existingMessages] = await Promise.all([
        getConversation(routeId),
        getMessages(routeId),
      ]);
      if (cancelled) {
        return;
      }
      setConversationTitle(conversation?.title ?? DEFAULT_TITLE);
      setMessages(existingMessages);
      setLoadingExisting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  const confirmName = (title: string) => {
    setConversationTitle(title.trim() || DEFAULT_TITLE);
    setNamingDone(true);
  };

  const handleSend = async () => {
    const body = composeText.trim();
    if (!body) {
      return;
    }

    let id = conversationId;
    if (!id) {
      // Only create the conversation record once there's an actual message
      // to save — avoids History filling up with empty entries from people
      // who just looked at the screen.
      const conversation = await createConversation(conversationTitle || DEFAULT_TITLE, 'combined');
      id = conversation.id;
      setConversationId(id);
    }

    await addMessage(id, activeSpeaker, body);
    const updated = await getMessages(id);
    setMessages(updated);
    setComposeText('');
    setListening(false);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    // Best-effort, non-blocking — if offline this just fails silently and
    // the next sync trigger (reconnect, or opening History) picks it up.
    void syncConversations();
  };

  const showNamingPrompt = !routeId && !namingDone;

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {namingDone || routeId ? conversationTitle || DEFAULT_TITLE : DEFAULT_TITLE}
          </Text>
          <View style={styles.headerSpacer} />
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
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => confirmName(nameInput)}
            />
            <View style={styles.namingActions}>
              <TouchableOpacity
                style={styles.namingSkip}
                onPress={() => confirmName(DEFAULT_TITLE)}
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
  headerSpacer: {
    width: 22,
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
