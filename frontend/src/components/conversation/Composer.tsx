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
import { ListeningPanel } from '@/components/conversation/ListeningPanel';
import { QuickReplies } from '@/components/conversation/QuickReplies';
import { SignPanel } from '@/components/conversation/SignPanel';
import { IconButton } from '@/components/ui/IconButton';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type SignLanguage, type SignUnit } from '@/hooks/use-preferences';
import { speechToTextSupported, useSpeechToText } from '@/hooks/use-speech-to-text';
import { useTourTarget } from '@/tutorial/targets';
import { announce } from '@/utils/a11y';
import { polishSigned } from '@/utils/signedText';
import { stopMixed } from '@/utils/speechHelper';

/** What a screen can ask the composer to do. */
export type ComposerHandle = {
  /** Opens the mic (where the phone has speech-to-text). */
  startListening: () => void;
  /** Mic off, box cleared, sign mode off — for switching conversations. */
  reset: () => void;
  setSignMode: (on: boolean) => void;
  /** Shows the quick replies. */
  showReplies: () => void;
  /** Puts the cursor in the message box (opens the keyboard). */
  focusInput: () => void;
};

type ComposerProps = {
  /** Sends a message. Resolve true once it's saved, so the box can clear. */
  onSend: (text: string) => Promise<boolean>;
  /** Whose words the mic is capturing, shown while listening ("Them"). */
  listeningTo?: string;
  /** Drawn at the start of the tools row, e.g. the Me / Them switch. */
  aboveInput?: ReactNode;
  controlRef?: Ref<ComposerHandle>;
  /** The Sign, Replies and mic buttons can be lit up by the tutorial (Conversation mode only). */
  tourTargets?: boolean;
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
 * What was signed since the last pause: the box's text before it, and the
 * words. When reading letters, `spelling` means the last word is still
 * being spelled, so the next letter joins it ("H","E","Y" → "hey").
 */
type Signed = { before: string; words: string[]; spelling: boolean };

/** A tidy-up of signed text that can be undone (a sentence, or a spelling fix). */
type Polish = { label: string; text: string; restoreText: string; restoreSigned: Signed | null };

/**
 * The bottom of every chat screen, shared by the in-person Conversation
 * screen and online chats with friends:
 *
 *   sign language camera (when on)
 *   one notice at a time (listening, a tip, "Undo")
 *   tools: [Me | Them] (Conversation only) · Sign · Replies
 *   quick replies (when Replies is on)
 *   [mic] [message box] [send]
 *
 * What's heard or signed lands in the box to be checked before sending.
 */
export function Composer({ onSend, listeningTo, aboveInput, controlRef, tourTargets = false }: ComposerProps) {
  const { prefs } = usePreferences();
  const signTarget = useTourTarget('conv.sign');
  const repliesTarget = useTourTarget('conv.replies');
  const micTarget = useTourTarget('conv.mic');
  const { colors, reduceMotion } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [signMode, setSignMode] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(prefs.showQuickReplies);
  const signed = useRef<Signed | null>(null);
  const [signCount, setSignCount] = useState(0);
  const [lastPolish, setLastPolish] = useState<Polish | null>(null);
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  // Shown after tapping the mic on a phone without speech-to-text, pointing
  // to the keyboard's own microphone key.
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

  const clearSigned = () => {
    signed.current = null;
    setSignCount(0);
    setLastPolish(null);
  };

  useImperativeHandle(
    controlRef,
    () => ({
      startListening,
      reset: () => {
        cancel();
        setText('');
        setSignMode(false);
        signed.current = null;
        setSignCount(0);
        setLastPolish(null);
        setShowDictationHint(false);
        clearMessage();
      },
      setSignMode,
      showReplies: () => setRepliesOpen(true),
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
        clearSigned();
      }
    } finally {
      setSending(false);
    }
  };

  const handleMicPress = () => {
    if (!speechToTextSupported) {
      // No recognizer of our own on this phone, so open the keyboard — its
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
  const showSigned = (entry: Signed) => setText(joinText(entry.before, entry.words.join(' ')));

  // A word goes in after the others; a letter joins the word being spelled.
  const addSigned = (sign: string, unit: SignUnit) => {
    const entry = (signed.current ??= { before: textRef.current, words: [], spelling: false });
    const piece = sign.toLowerCase();
    if (unit === 'letters' && entry.spelling && entry.words.length) {
      entry.words[entry.words.length - 1] += piece;
    } else {
      entry.words.push(piece);
    }
    entry.spelling = unit === 'letters';
    setSignCount((count) => count + 1);
    setLastPolish(null);
    showSigned(entry);
  };

  const undoSigned = () => {
    const entry = signed.current;
    if (!entry?.words.length) return;
    const last = entry.words[entry.words.length - 1];
    if (entry.spelling && last.length > 1) {
      entry.words[entry.words.length - 1] = last.slice(0, -1);
    } else {
      entry.words.pop();
    }
    setSignCount((count) => Math.max(0, count - 1));
    showSigned(entry);
  };

  // Signing paused. Words: they become a sentence (online, if turned on).
  // Letters: the word being spelled ends there, and its spelling is checked.
  const finishSigned = async (language: SignLanguage, unit: SignUnit) => {
    const entry = signed.current;
    if (!entry?.words.length) return;
    const shown = joinText(entry.before, entry.words.join(' '));

    if (unit === 'letters') {
      entry.spelling = false;
      const index = entry.words.length - 1;
      const spelled = entry.words[index];
      if (!prefs.signAutoSentence || spelled.length < 2) return;
      const restoreSigned = { ...entry, words: [...entry.words] };
      const fixed = (await polishSigned(spelled, 'spell', language))?.toLowerCase();
      // Only if nothing changed meanwhile.
      if (!fixed || fixed === spelled || signed.current !== entry || textRef.current !== shown) return;
      entry.words[index] = fixed;
      const next = joinText(entry.before, entry.words.join(' '));
      setText(next);
      setLastPolish({ label: `Spelling fixed: “${spelled}” → “${fixed}”.`, text: next, restoreText: shown, restoreSigned });
      announce(`Spelling fixed: ${fixed}`);
      return;
    }

    signed.current = null;
    setSignCount(0);
    if (!prefs.signAutoSentence) return;
    const written = await polishSigned(entry.words.join(' '), 'gloss', language);
    // Only if nothing was typed meanwhile.
    if (!written || textRef.current !== shown) return;
    const next = joinText(entry.before, written);
    setText(next);
    setLastPolish({ label: 'The signed words were made into a sentence.', text: next, restoreText: shown, restoreSigned: null });
    announce(`In the message box: ${written}`);
  };

  const undoPolish = () => {
    if (!lastPolish) return;
    if (textRef.current === lastPolish.text) {
      setText(lastPolish.restoreText);
      signed.current = lastPolish.restoreSigned;
    }
    setLastPolish(null);
  };

  const editQuickReply = (phrase: string) => {
    setText((previous) => joinText(previous, phrase));
    inputRef.current?.focus();
    announce(`${phrase}. In the message box, ready to edit.`);
  };

  const canSend = Boolean(text.trim()) && !listening && !sending;
  const speechMessage = speech.message;
  const hasReplies = prefs.quickReplies.length > 0;

  // One notice at a time, the most important first.
  let notice: ReactNode = null;
  if (phase !== 'idle') {
    notice = (
      <ListeningPanel
        phase={phase}
        level={speech.level}
        interimText={speech.interimText}
        startedAt={speech.startedAt}
        offlineLanguageName={speech.offlineLanguageName}
        listeningTo={listeningTo}
        onStop={stop}
      />
    );
  } else if (speechMessage) {
    notice = (
      <View style={styles.banner}>
        <Ionicons
          name={speechMessage.kind === 'error' ? 'alert-circle-outline' : 'information-circle-outline'}
          size={18}
          color={speechMessage.kind === 'error' ? colors.dangerText : colors.primary}
        />
        <View style={styles.flex}>
          <Text style={styles.bannerText} accessibilityLiveRegion="polite">
            {speechMessage.text}
          </Text>
          {speechMessage.canDownload ? (
            <Pressable onPress={() => void speech.downloadOfflineModel()} style={styles.noticeAction} accessibilityRole="button">
              <Text style={styles.noticeActionText}>Download so it works without internet</Text>
            </Pressable>
          ) : null}
        </View>
        <IconButton icon="close" label="Dismiss" iconSize={16} color={colors.textSecondary} onPress={clearMessage} />
      </View>
    );
  } else if (lastPolish) {
    notice = (
      <View style={styles.banner}>
        <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
        <Text style={styles.bannerText}>{lastPolish.label}</Text>
        <Pressable onPress={undoPolish} style={styles.undoButton} accessibilityRole="button" accessibilityLabel="Undo the change">
          <Text style={styles.noticeActionText}>Undo</Text>
        </Pressable>
      </View>
    );
  } else if (showDictationHint) {
    notice = (
      <View style={styles.banner}>
        <Ionicons name="mic-outline" size={18} color={colors.primary} />
        <Text style={styles.bannerText} accessibilityLiveRegion="polite">
          Tap the microphone key on your keyboard to speak your message.
        </Text>
        <IconButton icon="close" label="Dismiss" iconSize={16} color={colors.textSecondary} onPress={() => setShowDictationHint(false)} />
      </View>
    );
  }

  const toolToggle = (icon: keyof typeof Ionicons.glyphMap, label: string, a11yLabel: string, on: boolean, onPress: () => void) => (
    <Pressable
      style={[styles.tool, on && styles.toolOn]}
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ checked: on }}
    >
      <Ionicons name={icon} size={18} color={on ? colors.onPrimary : colors.primary} />
      <Text style={[styles.toolText, on && styles.toolTextOn]}>{label}</Text>
    </Pressable>
  );

  return (
    <View>
      {signMode ? (
        <SignPanel
          onWord={addSigned}
          onUndoWord={undoSigned}
          onPause={(language, unit) => void finishSigned(language, unit)}
          pendingWords={signCount}
        />
      ) : null}

      {notice}

      <View style={styles.toolRow}>
        <View style={styles.flex}>{aboveInput}</View>
        <View ref={tourTargets ? signTarget : undefined} collapsable={false}>
          {toolToggle('hand-left-outline', 'Sign', 'Sign language', signMode, () => setSignMode((on) => !on))}
        </View>
        {hasReplies ? (
          <View ref={tourTargets ? repliesTarget : undefined} collapsable={false}>
            {toolToggle('flash-outline', 'Replies', 'Quick replies', repliesOpen, () => setRepliesOpen((on) => !on))}
          </View>
        ) : null}
      </View>

      {repliesOpen && hasReplies && !listening ? (
        <QuickReplies phrases={prefs.quickReplies} onSend={(phrase) => void send(phrase, false)} onEdit={editQuickReply} />
      ) : null}

      <View style={styles.composeRow}>
        <View style={styles.micWrap} ref={tourTargets ? micTarget : undefined} collapsable={false}>
          {listening ? <Animated.View pointerEvents="none" style={[styles.micRing, ringStyle]} /> : null}
          <Pressable
            style={[styles.roundButton, listening ? styles.micActive : styles.micIdle]}
            onPress={handleMicPress}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop listening' : 'Speak your message'}
            accessibilityHint={listening ? undefined : 'Turns what is said into text in the message box'}
            accessibilityState={{ busy: listening }}
          >
            <Ionicons name={listening ? 'mic' : 'mic-outline'} size={22} color={listening ? colors.onListening : colors.onPrimaryLight} />
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
      marginHorizontal: 12,
      marginBottom: 8,
      paddingLeft: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    bannerText: {
      flex: 1,
      paddingVertical: 6,
      fontSize: t.font(14),
      color: t.colors.textPrimary,
      lineHeight: t.lineHeight(19),
    },
    noticeAction: {
      alignSelf: 'flex-start',
      minHeight: 44,
      justifyContent: 'center',
    },
    noticeActionText: {
      fontSize: t.font(14),
      fontWeight: t.weight('800'),
      color: t.colors.primary,
    },
    undoButton: {
      minHeight: 44,
      minWidth: 56,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    tool: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.surface,
    },
    toolOn: {
      backgroundColor: t.colors.primary,
    },
    toolText: {
      fontSize: t.font(14),
      fontWeight: t.weight('800'),
      color: t.colors.primary,
    },
    toolTextOn: {
      color: t.colors.onPrimary,
    },
    composeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
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
