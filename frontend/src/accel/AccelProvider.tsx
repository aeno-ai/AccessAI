import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { abortSession, block, interceptResults, unblock } from '@/audio/recognizer';
import { planFor, type Outcome, type Plan } from '@/accel/actions';
import { afterWakeWord, matchFriend, parseYesNo, stripFillers } from '@/accel/language';
import { currentScreen, screenOffers } from '@/accel/screenContext';
import { describeScreen } from '@/accel/screens';
import { understand } from '@/accel/understand';
import { OFFLINE_ENGLISH_STEPS, useWakeWord } from '@/accel/wakeWord';
import { useSos } from '@/components/sos/SosProvider';
import { usePickedVoices } from '@/hooks/use-app-voice';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useAfterFirstScreen } from '@/hooks/use-after-first-screen';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { speechToTextSupported, useSpeechToText, type SpeechMessage } from '@/hooks/use-speech-to-text';
import { useLearn } from '@/learn/LearnProvider';
import { useFriends } from '@/realtime/FriendsProvider';
import { speakMixed, stopMixed } from '@/utils/speechHelper';

/**
 * Accel — AccessAI's voice assistant, designed for people who are blind or
 * have low vision (and anyone who'd rather not use TalkBack / VoiceOver).
 *
 *   1. Start it: the Accel button (same place on every screen), iPhone's
 *      Magic Tap (two-finger double-tap with VoiceOver), or "Hey Accel" —
 *      always listening while AccessAI is open, even while it talks.
 *   2. Say what you want ("take me to conversation mode", "tell Ana I'm on
 *      my way", "SOS"…). The phone understands common commands itself; the
 *      AI on the AccessAI server helps with the rest when online.
 *   3. Accel says back what it understood — "You want me to take you to
 *      Conversation mode?" — and waits for yes or no (spoken or tapped).
 *   4. Only "yes" does it.
 *
 * Accel always speaks in its own voice (a man's by default), even when
 * TalkBack or VoiceOver is on, so it's clear who's talking.
 */
type Stage = 'idle' | 'listening' | 'thinking' | 'confirming' | 'choosing' | 'asking' | 'speaking';

type AccelContextValue = {
  /** Accel is switched on (Settings → Accel). */
  enabled: boolean;
  /** Opens Accel and starts listening for a command. */
  listen: () => void;
  /** Runs a typed or example command (the guide's "Try" buttons). */
  runText: (text: string) => void;
};

const AccelContext = createContext<AccelContextValue | null>(null);

const INTRO_LISTENING =
  "Hi, I'm Accel, a voice assistant designed for people who are blind or have low vision. I'm always listening while AccessAI is open: just say Hey Accel, then tell me where to go or what to do — like read my messages, or send a message to a friend. I'll check with you before I do anything. Say: what can I say, to learn more.";
const INTRO_BUTTON =
  "Hi, I'm Accel, a voice assistant designed for people who are blind or have low vision. To talk to me, tap the Accel button on the right side of the screen, then tell me where to go or what to do — like read my messages, or send a message to a friend. I'll check with you before I do anything. Say: what can I say, to learn more.";

// Accel's own speech, so closing stops only that (speechHelper's `owner`).
const ACCEL_VOICE = 'accel';

// Said at any question, these end the whole dialog.
const STOP_WORDS = /^(stop|cancel|that'?s all|that is all|tama na|tapos na|wala na|never ?mind|enough)$/;

/** What Accel says when the mic closed with a problem instead of words. */
function heardNothing(message: SpeechMessage | null, wakeWordOn: boolean): string {
  if (message?.needsOfflineEnglish) {
    return `I can't hear you without internet yet. To fix it once, download offline English. ${OFFLINE_ENGLISH_STEPS}`;
  }
  // A real problem (the mic isn't allowed, no voice typing…) — not just silence.
  if (message?.kind === 'error' && !/^Didn't catch that/.test(message.text)) return message.text;
  return wakeWordOn
    ? "I didn't hear anything. Say Hey Accel, or tap the Accel button, to try again."
    : "I didn't hear anything. Tap the Accel button and try again.";
}

export function AccelProvider({ children }: { children: ReactNode }) {
  const { prefs, setPref, ready: prefsReady } = usePreferences();
  const pathname = usePathname();
  const friendsContext = useFriends();
  const sos = useSos();
  const { userId } = useBootstrap();
  const { completions, hearts } = useLearn();
  const screenReader = useScreenReader();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { height } = useWindowDimensions();

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [heard, setHeard] = useState('');
  const [said, setSaid] = useState('');
  const [typed, setTyped] = useState('');
  const [keyboardUp, setKeyboardUp] = useState(false);
  // "Which Ana?" — the names to pick from, shown as buttons.
  const [choices, setChoices] = useState<Extract<Plan, { kind: 'choose' }>['options'] | null>(null);
  const pending = useRef<Plan | null>(null);
  const retries = useRef(0);
  const gotResult = useRef(false);
  const lastSpoken = useRef<string | null>(null);
  const yesRef = useRef<View>(null);
  const stageRef = useRef<Stage>('idle');
  const openRef = useRef(false);
  // How far back each chat has been read aloud ("older messages" goes on from there).
  const readPositions = useRef(new Map<string, number>());
  // Set once the speech hook exists (below); close() uses it.
  const cancelListeningRef = useRef<() => void>(() => {});
  const enabled = prefs.accelEnabled;

  const voices = usePickedVoices(prefs.accelVoice === 'app' ? prefs.appVoice : prefs.accelVoice);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // False when other speech cut Accel off (the newest speech always wins):
  // a question cut off that way isn't waited on, Accel just closes.
  const speak = useCallback(
    async (text: string): Promise<boolean> => {
      if (!text) return true;
      setSaid(text);
      lastSpoken.current = text;
      setStage('speaking');
      return speakMixed(text, {
        rate: prefs.speechRate,
        voices: voices ? { en: voices.en, fil: voices.fil } : undefined,
        owner: ACCEL_VOICE,
      });
    },
    [prefs.speechRate, voices],
  );

  const close = useCallback(() => {
    // Only Accel's own voice: whatever cut it off keeps talking.
    stopMixed({ owner: ACCEL_VOICE });
    // The mic too: left on, it kept "Hey Accel" paused, and a late result
    // could open Accel again.
    cancelListeningRef.current();
    pending.current = null;
    retries.current = 0;
    setOpen(false);
    setStage('idle');
    setHeard('');
    setTyped('');
    setChoices(null);
    unblock('accel');
  }, []);

  // ---------------------------------------------------------- listening
  const handleHeardRef = useRef<(text: string) => void>(() => {});
  const speech = useSpeechToText({
    onFinal: (text) => {
      gotResult.current = true;
      handleHeardRef.current(text);
    },
    offlineLanguage: prefs.offlineSpeechLanguage,
    mode: 'command',
    contextualStrings: ['Accel', 'SOS', ...friendsContext.friends.map((friend) => friend.firstName).filter(Boolean)],
  });
  useEffect(() => {
    cancelListeningRef.current = speech.cancel;
  });

  const startListening = useCallback(() => {
    gotResult.current = false;
    if (speechToTextSupported) {
      stopMixed();
      void speech.start();
    }
  }, [speech]);

  // Stops the mic on purpose (a button was tapped, typing started) — not
  // "heard nothing", so Accel doesn't say so and close.
  const stopListeningQuietly = useCallback(() => {
    gotResult.current = true;
    speech.cancel();
  }, [speech]);

  // The mic closed without hearing anything.
  const previousPhase = useRef(speech.phase);
  useEffect(() => {
    const before = previousPhase.current;
    previousPhase.current = speech.phase;
    if (before === 'idle' || speech.phase !== 'idle' || gotResult.current || !open) return;
    const current = stageRef.current;
    if (current === 'listening' || speech.message?.needsOfflineEnglish) {
      void speak(heardNothing(speech.message, prefs.accelWakeWord)).then(close);
    } else if (current === 'confirming' || current === 'choosing' || current === 'asking') {
      if (retries.current < 1) {
        retries.current += 1;
        const again = current === 'confirming' ? 'Please say yes or no.' : current === 'choosing' ? 'Please say the name.' : 'Please say it again.';
        void speak(again).then((spoke) => {
          if (!spoke) return close();
          setStage(current);
          startListening();
        });
      } else {
        void speak('Okay, I cancelled that.').then(close);
      }
    }
  }, [speech.phase, speech.message, open, speak, close, startListening, prefs.accelWakeWord]);

  // ---------------------------------------------------------- acting
  const context = useCallback(
    () => ({
      pathname,
      friends: friendsContext.friends,
      connected: friendsContext.connected,
      incomingRequests: friendsContext.requests.incoming,
      friendCode: friendsContext.friendCode,
      refreshFriends: friendsContext.refresh,
      sosAvailable: sos.available,
      mySos: friendsContext.mySos,
      sosPending: sos.sosPending,
      startSos: sos.startCountdown,
      markSafe: sos.markSafe,
      prefs,
      setPref,
      lastSpoken: lastSpoken.current,
      readPositions: readPositions.current,
      markRead: friendsContext.markRead,
      friendSos: friendsContext.friendSos,
      userId,
      learn: { completions, hearts },
    }),
    [pathname, friendsContext, sos, prefs, setPref, userId, completions, hearts],
  );

  // finish → the next step → finish…: the steps of a dialog call each other.
  const handlePlanRef = useRef<(plan: Plan) => Promise<void>>(async () => {});

  const finish = useCallback(
    async (outcome: Outcome) => {
      setStage('thinking');
      const spoke = outcome.say ? await speak(outcome.say) : true;
      // Cut off: what was said yes to still happens, but the dialog ends.
      if (outcome.next && spoke) {
        if (!openRef.current) return; // closed while it spoke
        outcome.after?.();
        await handlePlanRef.current(outcome.next);
        return;
      }
      close();
      outcome.after?.();
    },
    [speak, close],
  );

  const handlePlan = useCallback(
    async (plan: Plan) => {
      pending.current = plan;
      retries.current = 0;
      setChoices(plan.kind === 'choose' ? plan.options : null);
      if (plan.kind === 'say') {
        await speak(plan.text);
        close();
      } else if (plan.kind === 'do') {
        setStage('thinking');
        await finish(await plan.run());
      } else if (plan.kind === 'ask') {
        const spoke = await speak(plan.question);
        if (!openRef.current) return;
        if (!spoke) return close();
        setStage('asking');
        startListening();
      } else if (plan.kind === 'confirm' || plan.kind === 'choose') {
        const spoke = await speak(plan.question);
        if (!openRef.current) return;
        if (!spoke) return close();
        setStage(plan.kind === 'confirm' ? 'confirming' : 'choosing');
        // Focus the Yes button for TalkBack / VoiceOver.
        setTimeout(() => {
          const node = yesRef.current && findNodeHandle(yesRef.current);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        }, 300);
        startListening();
      }
    },
    [speak, close, finish, startListening],
  );
  useEffect(() => {
    handlePlanRef.current = handlePlan;
  }, [handlePlan]);

  const answer = useCallback(
    async (yes: boolean) => {
      stopListeningQuietly();
      const plan = pending.current;
      if (!plan || plan.kind !== 'confirm') return;
      pending.current = null;
      if (!yes) {
        if (plan.no) {
          // "No" moves the dialog on (e.g. to the next friend's messages).
          setStage('thinking');
          await handlePlan(await plan.no());
          return;
        }
        await speak('Okay, I cancelled that.');
        close();
        return;
      }
      setStage('thinking');
      await finish(await plan.run());
    },
    [stopListeningQuietly, speak, close, finish, handlePlan],
  );

  const runText = useCallback(
    async (text: string) => {
      setOpen(true);
      block('accel');
      setHeard(text);
      setStage('thinking');
      // The screen in focus goes first: its own commands ("my turn", "skip").
      const understood = await understand(text, {
        smart: prefs.accelSmart,
        screen: currentScreen()?.name ?? describeScreen(pathname).name,
        offers: screenOffers,
      });
      await handlePlan(await planFor(understood.intent, understood.slots, context()));
    },
    [prefs.accelSmart, pathname, handlePlan, context],
  );

  const handleHeard = (text: string) => {
    const current = stageRef.current;
    const plan = pending.current;
    if ((current === 'confirming' || current === 'choosing' || current === 'asking') && STOP_WORDS.test(stripFillers(text))) {
      void speak('Okay.').then(close);
      return;
    }
    if (current === 'asking' && plan?.kind === 'ask') {
      // The words themselves ("I'm outside"), not a command.
      setHeard(text);
      setStage('thinking');
      void plan.answer(text).then(handlePlan);
      return;
    }
    if (current === 'confirming') {
      const yesNo = parseYesNo(text);
      if (yesNo) {
        void answer(yesNo === 'yes');
      } else if (retries.current < 1) {
        retries.current += 1;
        void speak('Please say yes or no.').then((spoke) => {
          if (!spoke) return close();
          setStage('confirming');
          startListening();
        });
      } else {
        void speak('Okay, I cancelled that.').then(close);
      }
      return;
    }
    if (current === 'choosing' && plan?.kind === 'choose') {
      const spoken = stripFillers(text);
      const ordinal = /\b(first|una|1)\b/.test(spoken) ? 0 : /\b(second|pangalawa|ikalawa|2)\b/.test(spoken) ? 1 : -1;
      const match = matchFriend(text, plan.options.map((option) => option.friend));
      const option =
        ordinal >= 0 ? plan.options[ordinal] : match && 'friend' in match ? plan.options.find((o) => o.friend === match.friend) : undefined;
      if (option) {
        void option.plan().then(handlePlan);
      } else {
        void speak("I didn't catch which one. Okay, I cancelled that.").then(close);
      }
      return;
    }
    setHeard(text);
    void runText(text);
  };
  // The speech hook calls the newest version.
  useEffect(() => {
    handleHeardRef.current = handleHeard;
  });

  // ---------------------------------------------------------- opening
  // `greet`: woken by "Hey Accel", so Accel answers "Yes?" first — without
  // it, a person who can't see the screen can't tell it heard them.
  const openAndListen = useCallback(
    async (greet: boolean) => {
      if (!enabled) return;
      stopMixed();
      block('accel'); // "Hey Accel" steps aside
      pending.current = null;
      setHeard('');
      setSaid('');
      setOpen(true);
      openRef.current = true;
      if (greet) {
        const spoke = await speak('Yes?');
        if (!openRef.current) return; // closed while it spoke
        if (!spoke) return close();
      }
      // No speech-to-text on this phone: typing it is.
      setStage(speechToTextSupported ? 'listening' : 'idle');
      startListening();
    },
    [enabled, speak, startListening, close],
  );
  const listen = useCallback(() => void openAndListen(false), [openAndListen]);

  const onWake = useCallback(
    (remainder: string) => {
      if (prefs.vibrateAlerts) Vibration.vibrate(40);
      // Interrupts whatever the app was saying.
      stopMixed();
      if (remainder) {
        void runText(remainder);
      } else {
        void openAndListen(true);
      }
    },
    [prefs.vibrateAlerts, runText, openAndListen],
  );
  const onWakeRef = useRef(onWake);
  const sosOpenRef = useRef(sos.flowOpen);
  useEffect(() => {
    onWakeRef.current = onWake;
    sosOpenRef.current = sos.flowOpen;
  });

  // Paused (not stopped) while Accel is open or during an SOS — see the
  // 'accel' and 'sos' blockers. With TalkBack / VoiceOver on, only "hey /
  // okay … Accel" counts: they read the "Accel" button aloud.
  const wakeWordOn = enabled && prefs.accelWakeWord;
  // Starts a moment after the first screen, not together with everything else.
  const settled = useAfterFirstScreen(true);
  useWakeWord(wakeWordOn && settled, onWake, { strict: screenReader });

  // There's one recognizer: while the Conversation or a chat mic is on,
  // "Hey Accel, open friends" said into it opens Accel — and those words
  // never land in the message box.
  useEffect(() => {
    if (!wakeWordOn) return;
    return interceptResults((owner, event) => {
      if (owner === 'wake-word' || openRef.current || sosOpenRef.current) return false;
      for (const result of event.results) {
        const rest = afterWakeWord(result.transcript ?? '', { strict: true });
        if (rest !== null) {
          abortSession(owner);
          setTimeout(() => onWakeRef.current(rest), 0);
          return true;
        }
      }
      return false;
    });
  }, [wakeWordOn]);

  // The SOS dialog: Accel and "Hey Accel" stay quiet.
  useEffect(() => {
    if (sos.flowOpen) block('sos');
    else unblock('sos');
  }, [sos.flowOpen]);

  // One-time introduction, so the person knows Accel is there.
  useEffect(() => {
    if (!prefsReady || !enabled || prefs.accelIntroDone) return;
    const timer = setTimeout(() => {
      setPref('accelIntroDone', true);
      void speakMixed(prefs.accelWakeWord ? INTRO_LISTENING : INTRO_BUTTON, {
        owner: ACCEL_VOICE,
        rate: prefs.speechRate,
        voices: voices ? { en: voices.en, fil: voices.fil } : undefined,
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [prefsReady, enabled, prefs.accelIntroDone, prefs.accelWakeWord, prefs.speechRate, setPref, voices]);

  // Typed into the box: an answer while Accel is asking, otherwise a command.
  const submitTyped = () => {
    const text = typed.trim();
    if (!text) return;
    setTyped('');
    if (stageRef.current === 'asking') {
      stopListeningQuietly();
      handleHeardRef.current(text);
    } else {
      void runText(text);
    }
  };

  const value = useMemo(() => ({ enabled, listen, runText: (text: string) => void runText(text) }), [enabled, listen, runText]);

  const statusLine =
    stage === 'listening'
      ? speech.interimText || 'Listening… say what you want to do.'
      : stage === 'thinking'
        ? 'Thinking…'
        : stage === 'idle'
          ? 'Type what you want me to do.'
          : said;

  return (
    <AccelContext.Provider value={value}>
      {/* Magic Tap (iPhone, VoiceOver) opens Accel. */}
      <View style={styles.flex} onMagicTap={enabled ? listen : undefined}>
        {children}
        {enabled && !open && !keyboardUp && !sos.flowOpen ? (
          <Pressable
            style={[styles.fab, { bottom: Math.round(height * 0.3) }]}
            onPress={listen}
            accessibilityRole="button"
            accessibilityLabel="Accel, voice assistant"
            accessibilityHint="Listens for what you want to do"
          >
            <Ionicons name="mic" size={28} color={colors.onPrimary} />
            <Text style={styles.fabText} importantForAccessibility="no">
              Accel
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.header}>
              <Ionicons name="mic-circle" size={32} color={colors.primary} />
              <Text style={styles.title} accessibilityRole="header">
                Accel
              </Text>
              <Pressable onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close Accel">
                <Ionicons name="close" size={26} color={colors.textSecondary} />
              </Pressable>
            </View>

            {heard ? <Text style={styles.heard}>You said: “{heard}”</Text> : null}
            <View style={styles.statusRow}>
              {stage === 'thinking' ? <ActivityIndicator color={colors.primary} /> : null}
              <Text style={styles.status}>{statusLine}</Text>
            </View>

            {stage === 'confirming' ? (
              <View style={styles.row}>
                <Pressable
                  ref={yesRef}
                  style={[styles.bigButton, styles.yes]}
                  onPress={() => void answer(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Yes"
                >
                  <Text style={styles.yesText}>Yes</Text>
                </Pressable>
                <Pressable style={[styles.bigButton, styles.no]} onPress={() => void answer(false)} accessibilityRole="button" accessibilityLabel="No">
                  <Text style={styles.noText}>No</Text>
                </Pressable>
              </View>
            ) : null}

            {stage === 'choosing' && choices ? (
              <View style={styles.options}>
                {choices.map((option, index) => (
                  <Pressable
                    key={option.label + index}
                    ref={index === 0 ? yesRef : undefined}
                    style={[styles.bigButton, styles.no]}
                    onPress={() => {
                      stopListeningQuietly();
                      void option.plan().then(handlePlan);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.noText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {stage === 'listening' && speech.listening ? (
              <Pressable style={[styles.bigButton, styles.no]} onPress={() => speech.stop()} accessibilityRole="button">
                <Text style={styles.noText}>Done talking</Text>
              </Pressable>
            ) : null}

            {/* Typing works everywhere — and is the only way in Expo Go. */}
            {stage === 'listening' || stage === 'idle' || stage === 'asking' ? (
              <View style={styles.typeRow}>
                <TextInput
                  style={styles.input}
                  value={typed}
                  onChangeText={setTyped}
                  placeholder={stage === 'asking' ? 'Or type your answer' : 'Or type a command'}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={stage === 'asking' ? 'Type your answer for Accel' : 'Type a command for Accel'}
                  returnKeyType="send"
                  onFocus={stopListeningQuietly}
                  onSubmitEditing={submitTyped}
                />
                <Pressable
                  style={styles.sendButton}
                  onPress={submitTyped}
                  accessibilityRole="button"
                  accessibilityLabel="Send command"
                >
                  <Ionicons name="arrow-forward" size={22} color={colors.onPrimary} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </AccelContext.Provider>
  );
}

export function useAccel() {
  const context = useContext(AccelContext);
  if (!context) {
    throw new Error('useAccel must be used inside AccelProvider');
  }
  return context;
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    fab: {
      position: 'absolute',
      right: 12,
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    fabText: {
      fontSize: 11,
      fontWeight: '800',
      color: t.colors.onPrimary,
      marginTop: -2,
    },
    backdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 36,
      gap: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: t.font(22),
      fontWeight: t.weight('900'),
      color: t.colors.textPrimary,
    },
    closeButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heard: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      color: t.colors.textSecondary,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
    },
    status: {
      flex: 1,
      fontSize: t.font(20),
      lineHeight: t.lineHeight(28),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    options: {
      gap: 10,
    },
    bigButton: {
      flex: 1,
      minHeight: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    yes: {
      backgroundColor: t.colors.primary,
    },
    yesText: {
      fontSize: t.font(22),
      fontWeight: t.weight('900'),
      color: t.colors.onPrimary,
    },
    no: {
      borderWidth: 2,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.surface,
    },
    noText: {
      fontSize: t.font(20),
      fontWeight: t.weight('800'),
      color: t.colors.primary,
    },
    typeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    input: {
      flex: 1,
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 24,
      paddingHorizontal: 16,
      fontSize: t.font(16),
      color: t.colors.textPrimary,
    },
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
