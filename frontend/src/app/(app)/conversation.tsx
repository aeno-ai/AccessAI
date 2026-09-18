import { useRef, useState } from 'react';
import {
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
import { DASHBOARD_FEATURES, type ConversationMode } from '@/constants/dashboard';
import { addMessage, createConversation, getMessages, type Message } from '@/db/conversations';

type Speaker = Message['sender'];

function modeTitle(mode: string | undefined): string {
  if (!mode) {
    return 'Conversation';
  }
  const feature = DASHBOARD_FEATURES.find((item) => item.id === (mode as ConversationMode));
  return feature ? feature.title : 'Conversation';
}

/**
 * The one real conversation screen every dashboard entry point leads to —
 * the greeting card, all 4 feature tiles, and the AI banner. It's a
 * single-device, pass-the-phone conversation (like Google Translate's
 * conversation mode): whoever's holding the phone toggles "Me"/"Them"
 * before typing or "speaking" their side, every message can be read aloud,
 * and sign-language mode is a visible toggle rather than a separate screen.
 * STT and sign-language recognition are simulated for now (see the plan);
 * TTS is real, via expo-speech.
 */
export default function ConversationScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const listRef = useRef<FlatList<Message>>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composeText, setComposeText] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker>('me');
  const [listening, setListening] = useState(false);
  const [signMode, setSignMode] = useState(false);

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
      const conversation = await createConversation(modeTitle(mode), mode ?? 'combined');
      id = conversation.id;
      setConversationId(id);
    }

    await addMessage(id, activeSpeaker, body);
    const updated = await getMessages(id);
    setMessages(updated);
    setComposeText('');
    setListening(false);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

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
          <Text style={styles.headerTitle}>{modeTitle(mode)}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.primary} />
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptySubtitle}>
              Pick who&apos;s about to talk below, then type, use the mic, or switch to sign
              language mode. Hand the phone back and forth as needed — everything stays on this
              one screen and works offline.
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
              Sign language mode — camera recognition is coming soon. Type the translated message
              below for now.
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
            <Text style={[styles.speakerText, activeSpeaker === 'them' && styles.speakerTextActive]}>
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
            accessibilityLabel={signMode ? 'Turn off sign language mode' : 'Turn on sign language mode'}
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
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
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
