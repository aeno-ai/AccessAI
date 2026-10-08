import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { Pressable, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { apiFetch } from '@/api/apiClient';
import { ListeningPanel } from '@/components/conversation/ListeningPanel';
import { QuickReplies } from '@/components/conversation/QuickReplies';
import { SignPanel } from '@/components/conversation/SignPanel';
import { IconButton } from '@/components/ui/IconButton';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type SignLanguage } from '@/hooks/use-preferences';
import { speechToTextSupported, useSpeechToText } from '@/hooks/use-speech-to-text';
import { announce } from '@/utils/a11y';
import { stopMixed } from '@/utils/speechHelper';

/** What a screen can ask the composer to do. */
export type ComposerHandle = {
  /** Opens the mic (development build only; does nothing in Expo Go). */
  startListening: () => void;
  /** Mic off, box cleared, sign mode off — for switching conversations. */
  reset: () => void;
  setSignMode: (on: boolean) => void;
  /** Puts the cursor in the message box (opens the keyboard). */
  focusInput: () => void;
};

type ComposerProps = {
  /** Sends a message. Resolve true once it's saved, so the box can clear. */
  onSend: (text: string) => Promise<boolean>;
  /** Whose words the mic is capturing, shown while listening ("Them"). */
  listeningTo?: string;
  /** Drawn just above the quick replies, e.g. the Me / Them switch. */
  aboveInput?: ReactNode;
  controlRef?: Ref<ComposerHandle>;
};

// Adds newly heard (or picked) words after whatever's already in the box.
export const joinText = (existing: string, addition: string) => {
  if (!addition) {
    return existing;
  }
  return existing.trim() ? `${existing.trimEnd()} ${addition}` : addition;
};

const MIC_OPEN_VIBRATION = 40;
const MIC_CLOSED_VIBRATION = [0, 30, 70, 30];

/**
 * Sign words ("ME GO STORE TOMORROW") → a sentence, by the AI on the
 * AccessAI server. Null if it can't (offline): the words stay as they are.
 */
async function signWordsToSentence(words: string[], language: SignLanguage): Promise<string | null> {
  try {
    const result = await apiFetch<{ text: string }>('/assistant/polish', {
      method: 'POST',
      timeoutMs: 16000,
      body: JSON.stringify({ text: words.join(' ').toUpperCase(), kind: 'gloss', language }),
    });
    return result.text?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * The bottom of every chat screen: speech-to-text mic, message box, sign
 * language toggle, Send, and the quick-reply bubbles. Shared by the in-person
 * Conversation screen and online chats with friends, so both have exactly
 * the same tools.
 *
 * Speech-to-text is real in a development or store build (see
 * hooks/use-speech-to-text.ts) and falls back to the keyboard's own
 * dictation in Expo Go. What's heard lands in the box to be checked before
 * sending.
 */
export function Composer({ onSend, listeningTo, aboveInput, controlRef }: ComposerProps) {
  const { prefs } = usePreferences();
  const { colors, reduceMotion } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [signMode, setSignMode] = useState(false);
  // Sign language: the words signed since the last sentence, and what the
  // box held before them — so the words can be replaced by a sentence (and
  // the sentence undone back to the words).
  const signSentence = useRef<{ before: string; words: string[] } | null>(null);
  const [signWordCount, setSignWordCount] = useState(0);
  const [lastSentence, setLastSentence] = useState<{ before: string; words: string[] } | null>(null);
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  // Expo Go only: shown after tapping the mic, pointing to the keyboard's own.
  const [showDictationHint, setShowDictationHint] = useState(false);

  // Everything heard in the current listening session, announced once the
  // mic closes (announcing earlier would be picked up by the mic).
  const heardThisSession = useRef<string[]>([]);

  const appendHeard = useCallback((heard: string) => {
    heardThisSession.current.push(heard);
    setText((previous) => joinText(previous, heard));
  }, []);

  const speech = useSpeechToText({ onFinal: appendHeard, offlineLanguage: prefs.offlineSpeechLanguage });
  const { phase, listening, start, stop, cancel, clearMessage } = speech;

  // This screen may stay mounted between visits, so leaving it turns the
  // mic off.
  useFocusEffect(useCallback(() => () => cancel(), [cancel]));

  // A vibration when the mic really opens and a different one when it
  // closes, plus a spoken summary afterwards — so it's clear whether the app
  // is listening without looking.
  const previousPhase = useRef(phase);
  useEffect(() => {
    const before = previousPhase.current;
    previousPhase.current = phase;
    if (before === phase) {
      return;
    }
    if (before === 'starting' && phase === 'listening') {
      if (prefs.vibrateAlerts) Vibration.vibrate(MIC_OPEN_VIBRATION);
    } else if (before !== 'idle' && phase === 'idle') {
      if (prefs.vibrateAlerts) Vibration.vibrate(MIC_CLOSED_VIBRATION);
      const heard = heardThisSession.current.join(' ');
      heardThisSession.current = [];
      announce(heard ? `Heard: ${heard}. It's in the message box.` : 'Stopped listening');
    }
  }, [phase, prefs.vibrateAlerts]);

  // The pulsing ring around the mic while it's on. Still (just a ring) when
  // the user or their phone asks for reduced motion.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (listening && !reduceMotion) {
      pulse.value = 0;
      pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [listening, reduceMotion, pulse]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.45 }],
    opacity: reduceMotion ? 1 : 0.7 * (1 - pulse.value),
  }));

  const startListening = useCallback(() => {
    if (!speechToTextSupported || listening) {
      return;
    }
    stopMixed(); // so the app doesn't transcribe its own voice
    void start();
  }, [listening, start]);

  useImperativeHandle(
    controlRef,
    () => ({
      startListening,
      reset: () => {
        cancel();
        setText('');
        setSignMode(false);
        signSentence.current = null;
        setSignWordCount(0);
        setLastSentence(null);
        setShowDictationHint(false);
        clearMessage();
      },
      setSignMode,
      focusInput: () => inputRef.current?.focus(),
    }),
    [startListening, cancel, clearMessage],
  );

  const send = async (body: string, fromBox: boolean) => {
    const trimmed = body.trim();
    if (!trimmed || sending) {
      return;
    }
    setSending(true);
    try {
      const sent = await onSend(trimmed);
      if (sent && fromBox) {
        setText('');
        setShowDictationHint(false);
        signSentence.current = null;
        setSignWordCount(0);
        setLastSentence(null);
      }
    } finally {
      setSending(false);
    }
  };

  const handleMicPress = () => {
    if (!speechToTextSupported) {
      // Expo Go / web: no recognizer of our own, so open the keyboard — its
      // microphone key dictates into the message box.
      inputRef.current?.focus();
      setShowDictationHint(true);
      return;
    }
    if (listening) {
      stop();
      return;
    }
    startListening();
  };

  // ---- sign language
  const addSignedWord = (word: string) => {
    const sentence = (signSentence.current ??= { before: textRef.current, words: [] });
    sentence.words.push(word.toLowerCase());
    setSignWordCount(sentence.words.length);
    setLastSentence(null);
    setText(joinText(sentence.before, sentence.words.join(' ')));
  };

  const undoSignedWord = () => {
    const sentence = signSentence.current;
    if (!sentence?.words.length) return;
    sentence.words.pop();
    setSignWordCount(sentence.words.length);
    setText(joinText(sentence.before, sentence.words.join(' ')));
  };

  // Signing paused: the words become a sentence (online, if turned on).
  const finishSignedSentence = async (language: SignLanguage) => {
    const sentence = signSentence.current;
    if (!sentence?.words.length) return;
    signSentence.current = null;
    setSignWordCount(0);
    if (!prefs.signAutoSentence) return;
    const written = await signWordsToSentence(sentence.words, language);
    // Only if nothing was typed meanwhile.
    if (!written || textRef.current !== joinText(sentence.before, sentence.words.join(' '))) return;
    setText(joinText(sentence.before, written));
    setLastSentence(sentence);
    announce(`In the message box: ${written}`);
  };

  const undoSentence = () => {
    if (!lastSentence) return;
    setText(joinText(lastSentence.before, lastSentence.words.join(' ')));
    setLastSentence(null);
  };

  const editQuickReply = (phrase: string) => {
    setText((previous) => joinText(previous, phrase));
    inputRef.current?.focus();
    announce(`${phrase}. In the message box, ready to edit.`);
  };

  const canSend = Boolean(text.trim()) && !listening && !sending;
  const speechMessage = speech.message;

  return (
    <View>
      {signMode ? (
        <SignPanel
          onWord={addSignedWord}
          onUndoWord={undoSignedWord}
          onPause={(language) => void finishSignedSentence(language)}
          pendingWords={signWordCount}
        />
      ) : null}
      {lastSentence ? (
        <View style={styles.banner}>
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
          <Text style={[styles.bannerText, styles.flex]}>The signed words were made into a sentence.</Text>
          <Pressable onPress={undoSentence} style={styles.noticeAction} accessibilityRole="button">
            <Text style={styles.noticeActionText}>Undo sentence</Text>
          </Pressable>
        </View>
      ) : null}

      {speechMessage ? (
        <View style={styles.banner}>
          <Ionicons
            name={speechMessage.kind === 'error' ? 'alert-circle-outline' : 'information-circle-outline'}
            size={16}
            color={speechMessage.kind === 'error' ? colors.dangerText : colors.primary}
          />
          <View style={styles.flex}>
            <Text style={styles.bannerText} accessibilityLiveRegion="polite">
              {speechMessage.text}
            </Text>
            {speechMessage.canDownload ? (
              <Pressable
                onPress={() => void speech.downloadOfflineModel()}
                style={styles.noticeAction}
                accessibilityRole="button"
              >
                <Text style={styles.noticeActionText}>Download for offline use</Text>
              </Pressable>
            ) : null}
          </View>
          <IconButton icon="close" label="Dismiss" iconSize={16} color={colors.textSecondary} onPress={clearMessage} />
        </View>
      ) : showDictationHint ? (
        <View style={styles.banner}>
          <Ionicons name="mic-outline" size={16} color={colors.primary} />
          <Text style={[styles.bannerText, styles.flex]} accessibilityLiveRegion="polite">
            Tap the microphone key on your keyboard to speak your message.
          </Text>
          <IconButton
            icon="close"
            label="Dismiss"
            iconSize={16}
            color={colors.textSecondary}
            onPress={() => setShowDictationHint(false)}
          />
        </View>
      ) : null}

      {phase !== 'idle' ? (
        <ListeningPanel
          phase={phase}
          level={speech.level}
          interimText={speech.interimText}
          startedAt={speech.startedAt}
          offlineLanguageName={speech.offlineLanguageName}
          listeningTo={listeningTo}
          onStop={stop}
        />
      ) : null}

      {aboveInput}

      {!listening && prefs.showQuickReplies && prefs.quickReplies.length > 0 ? (
        <QuickReplies
          phrases={prefs.quickReplies}
          onSend={(phrase) => void send(phrase, false)}
          onEdit={editQuickReply}
        />
      ) : null}

      <View style={styles.composeRow}>
        <View style={styles.micWrap}>
          {listening ? <Animated.View pointerEvents="none" style={[styles.micRing, ringStyle]} /> : null}
          <Pressable
            style={[styles.roundButton, listening ? styles.micActive : styles.micIdle]}
            onPress={handleMicPress}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop listening' : 'Speak your message'}
            accessibilityHint={listening ? undefined : 'Turns what is said into text in the message box'}
            accessibilityState={{ busy: listening }}
          >
            <Ionicons
              name={listening ? 'mic' : 'mic-outline'}
              size={22}
              color={listening ? colors.onListening : colors.onPrimaryLight}
            />
          </Pressable>
        </View>
        <TextInput
          ref={inputRef}
          style={[styles.input, listening && styles.inputListening]}
          value={text}
          onChangeText={setText}
          editable={!listening}
          placeholder={listening ? 'Listening…' : 'Type a message'}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Message"
          accessibilityHint={listening ? 'Listening. Words appear here when you pause.' : undefined}
          multiline
        />
        <IconButton
          icon="hand-left-outline"
          label={signMode ? 'Turn off sign language mode' : 'Turn on sign language mode'}
          variant={signMode ? 'filled' : 'tinted'}
          selected={signMode}
          iconSize={20}
          onPress={() => setSignMode((previous) => !previous)}
        />
        {/* Not while listening: the last words are still on their way. */}
        <IconButton
          icon="send"
          label="Send message"
          variant="filled"
          color={canSend ? undefined : colors.border}
          iconSize={18}
          disabled={!canSend}
          busy={sending}
          onPress={() => void send(text, true)}
        />
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.colors.primaryLight,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingLeft: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    bannerText: {
      flex: 1,
      paddingVertical: 6,
      fontSize: t.font(13),
      color: t.colors.textPrimary,
      lineHeight: t.lineHeight(18),
    },
    noticeAction: {
      alignSelf: 'flex-start',
      minHeight: 44,
      justifyContent: 'center',
    },
    noticeActionText: {
      fontSize: t.font(13),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    composeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      paddingHorizontal: 12,
      paddingBottom: 16,
    },
    micWrap: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micRing: {
      position: 'absolute',
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 3,
      borderColor: t.colors.listening,
    },
    roundButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micIdle: {
      backgroundColor: t.colors.primaryLight,
    },
    micActive: {
      backgroundColor: t.colors.listening,
    },
    input: {
      flex: 1,
      minHeight: 48,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      fontSize: t.font(15),
      color: t.colors.textPrimary,
      backgroundColor: t.colors.surface,
    },
    inputListening: {
      borderWidth: 2,
      borderColor: t.colors.listening,
    },
  });
