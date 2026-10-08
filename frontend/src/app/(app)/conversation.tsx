import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BigTextCard } from '@/components/conversation/BigTextCard';
import { Composer, type ComposerHandle } from '@/components/conversation/Composer';
import { MessageBubble } from '@/components/conversation/MessageBubble';
import { RenameConversationModal } from '@/components/conversation/RenameConversationModal';
import { IconButton } from '@/components/ui/IconButton';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import type { ConversationAction } from '@/constants/profiles';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  addMessage,
  createConversation,
  getConversation,
  getMessages,
  renameConversation,
  type Message,
} from '@/db/conversations';
import { syncConversations } from '@/db/sync';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { announce } from '@/utils/a11y';
import { unnamedConversationTitle } from '@/utils/conversationTitle';
import { speakMixed, stopMixed } from '@/utils/speechHelper';

type Speaker = Message['sender'];

const SPEAKER_NAMES: Record<Speaker, string> = { me: 'Me', them: 'Them' };

// Header text while a new conversation is still being named. Never saved as
// a title — unnamed conversations get unnamedConversationTitle() instead.
const NEW_CONVERSATION_HEADER = 'New Conversation';

/**
 * The one real conversation screen every dashboard entry point leads to —
 * the greeting card and the AI banner (feature tiles are informational
 * only, see FeatureTile.tsx). It's a single-device, pass-the-phone
 * conversation (like Google Translate's conversation mode): whoever's
 * holding the phone picks "Me"/"Them" before typing or speaking their side,
 * every message can be read aloud, and sign-language mode is a visible
 * toggle rather than a separate screen.
 *
 * Opened with no params (the greeting card / AI banner), this resumes
 * whatever conversation was last on screen — this is a drawer screen, so it
 * stays mounted between visits — or, the first time, starts a brand new one
 * and asks the user to name it ("which conversation is this?"). Opened with
 * an `id` param (from Chats), it loads and continues that conversation,
 * skipping the naming step. The chat-bubble "+" in the header starts a new
 * conversation from inside this one.
 *
 * Settings that change how it behaves (Settings → Conversation & speech):
 * switching speaker after each message, listening automatically on Them's
 * turn, speaking "Me" messages aloud and reading "Them" messages aloud.
 */
export default function ConversationScreen() {
  // `opened` changes on every tap in Chats, so the same conversation is
  // reloaded even if it's the one already on screen.
  const {
    id: routeId,
    opened,
    action,
  } = useLocalSearchParams<{ id?: string; opened?: string; action?: ConversationAction }>();
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const screenReaderOn = useScreenReader();
  const listRef = useRef<FlatList<Message>>(null);
  const composerRef = useRef<ComposerHandle>(null);

  // The conversation on screen (null until its first message creates it).
  // A ref, so async callbacks never read a stale value (see the focus check
  // below).
  const conversationIdRef = useRef<string | null>(null);
  // Bumped whenever the screen switches conversations, so an in-flight send
  // can tell its results no longer belong on screen.
  const sessionRef = useRef(0);
  const [conversationTitle, setConversationTitle] = useState('');
  const [namingDone, setNamingDone] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker>('me');
  const [renaming, setRenaming] = useState(false);
  // A message shown full-screen for the other person to read.
  const [bigText, setBigText] = useState<string | null>(null);
  // The Home-shortcut action whose "skip naming" was undone by starting a
  // new conversation (see skipNaming below).
  const [dismissedActionKey, setDismissedActionKey] = useState<string | null>(null);

  // Keeps the newest messages in view above the message box when the
  // keyboard opens.
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () =>
      listRef.current?.scrollToEnd({ animated: true }),
    );
    return () => subscription.remove();
  }, []);

  // Read by startNewConversation without making it change on every render.
  const actionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    actionKeyRef.current = action && opened && !routeId ? `${action}:${opened}` : null;
  });

  // Which Chats tap has finished loading. Still loading = the current tap
  // hasn't been answered yet.
  const openKey = routeId ? `${routeId}:${opened ?? ''}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loadingExisting = openKey !== null && loadedKey !== openKey;

  // Puts the screen back to a fresh, unnamed conversation. Whatever was on
  // screen is already saved — every message is written when it's sent.
  const startNewConversation = useCallback(() => {
    setDismissedActionKey(actionKeyRef.current);
    stopMixed();
    composerRef.current?.reset();
    sessionRef.current += 1;
    conversationIdRef.current = null;
    setConversationTitle('');
    setNamingDone(false);
    setNameInput('');
    setMessages([]);
    setActiveSpeaker('me');
  }, []);

  // Opened from Chats: load that conversation's title and messages.
  useEffect(() => {
    if (!routeId) {
      return;
    }
    let cancelled = false;
    stopMixed();
    composerRef.current?.reset();
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
        setConversationTitle(conversation.title);
        setMessages(existingMessages);
        setNamingDone(true);
      }
      setLoadedKey(openKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId, openKey, startNewConversation]);

  // Resuming (greeting card / AI banner) must never bring back a
  // conversation that was deleted in Chats while this screen was hidden,
  // and should show the new name if it was renamed there. Only acts if that
  // same conversation is still the one on screen — a Chats tap may have
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

  // A Home shortcut opened this screen with something to do. A shortcut is
  // for getting going fast, so it skips the naming step (the conversation
  // can be renamed later). Each tap carries a fresh `opened`, so the same
  // shortcut works again next time; starting a new conversation from here
  // brings the naming step back.
  const actionKey = action && opened && !routeId ? `${action}:${opened}` : null;
  const skipNaming = actionKey !== null && actionKey !== dismissedActionKey;
  const handledAction = useRef<string | null>(null);
  useEffect(() => {
    if (!actionKey || handledAction.current === actionKey) {
      return;
    }
    // Next frame: the composer has to be on screen first.
    const frame = requestAnimationFrame(() => {
      const composer = composerRef.current;
      if (!composer) {
        return;
      }
      handledAction.current = actionKey;
      if (action === 'captions') {
        setActiveSpeaker('them');
        composer.startListening();
      } else if (action === 'listen') {
        setActiveSpeaker('me');
        composer.startListening();
      } else if (action === 'sign') {
        composer.setSignMode(true);
      } else if (action === 'type') {
        composer.focusInput();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [actionKey, action]);

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

  const chooseSpeaker = (speaker: Speaker) => {
    setActiveSpeaker(speaker);
    if (speaker === 'them' && prefs.autoListenForThem) {
      composerRef.current?.startListening();
    }
  };

  /**
   * What happens out loud after a message is saved, in order: speak it (a
   * "Me" message for someone who can't speak, or a "Them" message for
   * someone who can't see), then — if the turn passes to Them and live
   * captions are on — open the mic. The mic waits for the voice to finish
   * so it doesn't transcribe the app itself.
   */
  const afterSend = async (speaker: Speaker, body: string) => {
    const nextSpeaker: Speaker = speaker === 'me' ? 'them' : 'me';
    const switching = prefs.autoSwitchSpeaker;
    if (switching) {
      setActiveSpeaker(nextSpeaker);
    }

    if (speaker === 'me' && prefs.speakMyMessages) {
      // Spoken for the other person to hear, so it uses the phone's voice
      // even when a screen reader is on.
      await speakMixed(body, { rate: prefs.speechRate });
    } else if (speaker === 'them' && prefs.readIncomingAloud) {
      if (screenReaderOn) {
        announce(`Them said: ${body}`);
      } else {
        await speakMixed(body, { rate: prefs.speechRate });
      }
    }

    if (switching) {
      announce(`Now speaking: ${SPEAKER_NAMES[nextSpeaker]}`);
      if (nextSpeaker === 'them' && prefs.autoListenForThem) {
        composerRef.current?.startListening();
      }
    }
  };

  const handleSend = async (body: string): Promise<boolean> => {
    const session = sessionRef.current;
    const speaker = activeSpeaker;

    let id = conversationIdRef.current;
    if (!id) {
      // Only create the conversation record once there's an actual message
      // to save — avoids Chats filling up with empty entries from people
      // who just looked at the screen.
      const conversation = await createConversation(conversationTitle || unnamedConversationTitle(), 'combined');
      id = conversation.id;
      if (sessionRef.current === session) {
        conversationIdRef.current = id;
      }
    }

    await addMessage(id, speaker, body);
    // Best-effort, non-blocking — if offline this just fails silently and
    // the next sync trigger (reconnect, or opening Chats) picks it up.
    void syncConversations();

    if (sessionRef.current !== session) {
      return true; // the user switched conversations mid-send; the message is saved where it belongs
    }
    setMessages(await getMessages(id));
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    void afterSend(speaker, body);
    return true;
  };

  const showNamingPrompt = !namingDone && !skipNaming;
  const headerReady = (namingDone || skipNaming) && !loadingExisting;

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <KeyboardAvoider>
        <View style={styles.header}>
          <IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} />
          {headerReady ? (
            // Tap the title to rename the conversation.
            <Pressable
              style={styles.headerTitleButton}
              onPress={() => setRenaming(true)}
              accessibilityRole="button"
              accessibilityLabel={`${conversationTitle || NEW_CONVERSATION_HEADER}. Rename conversation`}
            >
              <Text style={styles.headerTitleText} numberOfLines={1} accessibilityRole="header">
                {conversationTitle || NEW_CONVERSATION_HEADER}
              </Text>
              <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
              {NEW_CONVERSATION_HEADER}
            </Text>
          )}
          {/* Hidden while naming/loading — there's no conversation to leave yet. */}
          {headerReady ? (
            <Pressable
              style={styles.headerAction}
              onPress={startNewConversation}
              accessibilityRole="button"
              accessibilityLabel="Start a new conversation"
            >
              <View style={styles.newConversationIcon}>
                <Ionicons name="chatbubble-outline" size={24} color={colors.textPrimary} />
                <Ionicons name="add" size={14} color={colors.textPrimary} style={styles.newConversationPlus} />
              </View>
            </Pressable>
          ) : (
            <View style={styles.headerAction} />
          )}
        </View>

        {loadingExisting ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : showNamingPrompt ? (
          <View style={styles.namingCard}>
            <Ionicons name="pricetag-outline" size={32} color={colors.primary} />
            <Text style={styles.namingTitle} accessibilityRole="header">
              Name this conversation
            </Text>
            <Text style={styles.namingSubtitle}>
              So you can find it again in Chats later — like &quot;Ate Lyka&quot; or &quot;Dagupan
              trip&quot;.
            </Text>
            <TextInput
              style={styles.namingInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g. Ate Lyka, Dagupan trip"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Conversation name"
              maxLength={100}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => confirmName(nameInput)}
            />
            <View style={styles.namingActions}>
              <Pressable style={styles.namingSkip} onPress={() => confirmName('')} accessibilityRole="button">
                <Text style={styles.namingSkipText}>Skip</Text>
              </Pressable>
              <Pressable style={styles.namingStart} onPress={() => confirmName(nameInput)} accessibilityRole="button">
                <Text style={styles.namingStartText}>Start</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.primary} />
                <Text style={styles.emptyTitle}>Start the conversation</Text>
                <Text style={styles.emptySubtitle}>
                  Pick who&apos;s about to talk below, then type, use the mic, a quick reply, or sign
                  language mode. Hand the phone back and forth as needed — everything stays on this one
                  screen and works offline.
                </Text>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <MessageBubble
                    body={item.body}
                    sender={item.sender}
                    createdAt={item.createdAt}
                    senderName={SPEAKER_NAMES[item.sender]}
                    onShowBig={() => setBigText(item.body)}
                  />
                )}
                contentContainerStyle={styles.messageList}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              />
            )}

            <Composer
              controlRef={composerRef}
              onSend={handleSend}
              listeningTo={SPEAKER_NAMES[activeSpeaker]}
              aboveInput={
                <View style={styles.speakerRow} accessibilityRole="radiogroup" accessibilityLabel="Who is speaking">
                  {(['me', 'them'] as const).map((speaker) => {
                    const selected = activeSpeaker === speaker;
                    return (
                      <Pressable
                        key={speaker}
                        style={[styles.speakerButton, selected && styles.speakerButtonActive]}
                        onPress={() => chooseSpeaker(speaker)}
                        accessibilityRole="radio"
                        accessibilityLabel={`Speaking as ${SPEAKER_NAMES[speaker]}`}
                        accessibilityState={{ checked: selected }}
                      >
                        <Text style={[styles.speakerText, selected && styles.speakerTextActive]}>
                          {SPEAKER_NAMES[speaker]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              }
            />
          </>
        )}
      </KeyboardAvoider>

      <BigTextCard visible={bigText !== null} text={bigText ?? undefined} onClose={() => setBigText(null)} />

      <RenameConversationModal
        visible={renaming}
        initialTitle={conversationTitle}
        onCancel={() => setRenaming(false)}
        onSave={(title) => void handleRename(title)}
      />
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.two,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.one,
    },
    headerTitle: {
      flex: 1,
      marginHorizontal: 8,
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
      textAlign: 'center',
    },
    headerTitleButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 48,
      marginHorizontal: 8,
    },
    headerTitleText: {
      flexShrink: 1,
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    // Same 48×48 on both sides, so the title stays centered whether or not
    // the new-conversation button is showing.
    headerAction: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
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
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    emptySubtitle: {
      marginTop: 8,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(19),
      color: t.colors.textSecondary,
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
      fontSize: t.font(18),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    namingSubtitle: {
      marginTop: 8,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(19),
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
    namingInput: {
      width: '100%',
      marginTop: 20,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: t.font(15),
      color: t.colors.textPrimary,
      backgroundColor: t.colors.surface,
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
      justifyContent: 'center',
      minHeight: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
    },
    namingSkipText: {
      color: t.colors.textSecondary,
      fontWeight: t.weight('700'),
      fontSize: t.font(14),
    },
    namingStart: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      borderRadius: 24,
      backgroundColor: t.colors.primary,
    },
    namingStartText: {
      color: t.colors.onPrimary,
      fontWeight: t.weight('700'),
      fontSize: t.font(14),
    },
    messageList: {
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.two,
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    speakerRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: Spacing.three,
      marginBottom: Spacing.two,
    },
    speakerButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: 44,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.surface,
    },
    speakerButtonActive: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },
    speakerText: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.textSecondary,
    },
    speakerTextActive: {
      color: t.colors.onPrimary,
    },
  });
