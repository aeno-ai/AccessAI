import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { announce } from '@/utils/a11y';
import { speakMixed, stopMixed } from '@/utils/speechHelper';
import {
  callEmergencyNumber,
  defaultSosMessage,
  describePlace,
  EMERGENCY_NUMBER,
  joinNames,
  locate,
  textEmergencyContacts,
  triggerSos,
  type Coordinates,
  type SosMethod,
  type SosResult,
} from '@/utils/sos';

/**
 * - countdown: shake trigger — sends by itself unless cancelled
 * - review: hold trigger — check and edit the message, then send
 * - test: like countdown, but marked as a test and never texts anyone
 */
export type SosFlowKind = 'countdown' | 'review' | 'test';

type Step = 'countdown' | 'review' | 'sending' | 'result';

type SosFlowProps = {
  kind: SosFlowKind;
  method: SosMethod;
  /** The SOS reached AccessAI (starts live location sharing). */
  onSent: (result: SosResult & { sent: true }) => void;
  /** "I'm safe" — throws a readable error if it can't be sent. */
  onMarkSafe: () => Promise<void>;
  onClose: () => void;
};

/**
 * Every way of sending an SOS ends up here, in one dialog that walks through
 * the steps. Location comes from the phone's own GPS (no internet needed).
 * A real SOS goes two ways at once: through AccessAI to the friends in the
 * SOS circle (live alert + push notification + chat message), and as a text
 * message to the emergency contacts, which goes over the mobile network and
 * works without internet. The text opens by itself; the person presses Send
 * (phones never let apps text silently).
 */
export function SosFlow({ kind, method, onSent, onMarkSafe, onClose }: SosFlowProps) {
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const screenReaderOn = useScreenReader();
  const isTest = kind === 'test';

  const [step, setStep] = useState<Step>(kind === 'review' ? 'review' : 'countdown');
  const [secondsLeft, setSecondsLeft] = useState<number>(prefs.sosCountdown);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [located, setLocated] = useState(false);
  const [message, setMessage] = useState(defaultSosMessage(null));
  const [result, setResult] = useState<SosResult | null>(null);
  const [textNote, setTextNote] = useState('');
  const [safe, setSafe] = useState<'idle' | 'sending' | 'done'>('idle');
  const cancelRef = useRef<View>(null);
  const locating = useRef<Promise<Coordinates | null> | null>(null);
  const autoTexted = useRef(false);

  // Start finding the location straight away, in parallel with the countdown.
  useEffect(() => {
    let cancelled = false;
    locating.current = locate();
    void locating.current.then((found) => {
      if (cancelled) return;
      setCoords(found);
      setLocated(true);
      setMessage((current) => (current === defaultSosMessage(null) ? defaultSosMessage(found) : current));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Started by voice (Accel): the person may not see the screen, so it's
  // always spoken.
  const speakOrAnnounce = (text: string) => {
    if (screenReaderOn) announce(text);
    else if (prefs.readIncomingAloud || method === 'voice') void speakMixed(text, { rate: prefs.speechRate });
  };

  const openText = async (body: string, where: Coordinates | null) => {
    const opened = await textEmergencyContacts(body, where);
    if (opened === 'no-contacts') setTextNote('You have no emergency contacts saved on this phone.');
    if (opened === 'unavailable') setTextNote("This phone can't send text messages.");
    return opened;
  };

  // `text` omitted (the countdown): the default message, with the location
  // (and a readable place, if the phone can look it up quickly).
  const send = async (text?: string) => {
    setStep('sending');
    const where = (await locating.current) ?? null;
    const place = await describePlace(where);
    const body = text ?? defaultSosMessage(where, place);
    const outcome = await triggerSos({ method, message: body, coords: where, place, isTest });
    setResult(outcome);
    setStep('result');

    if (outcome.sent) {
      onSent(outcome);
      const who = outcome.alertedNames.length ? joinNames(outcome.alertedNames) : null;
      if (isTest) {
        speakOrAnnounce(who ? `Test sent to ${who}. No text is sent.` : 'Test sent. Nobody is in your SOS circle yet.');
        return;
      }
      speakOrAnnounce(
        `${who ? `SOS sent to ${who}.` : 'SOS saved. Nobody is in your SOS circle yet.'} Opening a text to your emergency contacts.`,
      );
    } else if (outcome.offline) {
      speakOrAnnounce(
        isTest ? 'No internet, so the test could not be sent.' : 'No internet. Opening a text message to your emergency contacts.',
      );
      if (isTest) return;
    } else {
      speakOrAnnounce(`SOS not sent. ${outcome.error} Opening a text to your emergency contacts.`);
      if (isTest) return;
    }
    // A real SOS always tries a text too — once.
    if (!autoTexted.current) {
      autoTexted.current = true;
      const opened = await openText(body, where);
      if (opened === 'no-contacts') speakOrAnnounce('You have no emergency contacts saved on this phone.');
    }
  };

  const markSafe = async () => {
    setSafe('sending');
    try {
      await onMarkSafe();
      setSafe('done');
      speakOrAnnounce("Your SOS has ended. Your friends were told you're safe.");
    } catch (error) {
      setSafe('idle');
      speakOrAnnounce(error instanceof Error ? error.message : "Couldn't send that. Try again.");
    }
  };

  // The timer below always calls the latest version of send.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  // The countdown: a vibration and the number spoken each second, sending
  // at zero. Focus goes to Cancel, the one thing a screen-reader user may
  // need fast.
  useEffect(() => {
    if (step !== 'countdown') {
      return;
    }
    const focus = setTimeout(() => {
      if (cancelRef.current) AccessibilityInfo.sendAccessibilityEvent(cancelRef.current, 'focus');
    }, 400);
    speakOrAnnounce(`${isTest ? 'Test SOS' : 'Sending SOS'} in ${prefs.sosCountdown} seconds. Tap cancel to stop.`);
    let remaining = prefs.sosCountdown;
    const timer = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining > 0) {
        Vibration.vibrate(150);
        speakOrAnnounce(String(remaining));
        return;
      }
      clearInterval(timer);
      Vibration.vibrate(600);
      void sendRef.current();
    }, 1000);
    return () => {
      clearTimeout(focus);
      clearInterval(timer);
    };
    // Runs once per countdown; the speech helpers read the latest settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const close = () => {
    stopMixed();
    Vibration.cancel();
    onClose();
  };

  const cancelCountdown = () => {
    announce('SOS cancelled');
    close();
  };

  const textContacts = async () => {
    setTextNote('');
    await openText(message, coords);
  };

  const openContacts = () => {
    close();
    router.push('/emergency-contacts');
  };

  const openCircle = () => {
    close();
    router.push('/settings/sos');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={step === 'countdown' ? cancelCountdown : close}>
      {step === 'countdown' ? (
        <View style={styles.countdownScreen} accessibilityViewIsModal>
          <View style={styles.countdownTop}>
            <Ionicons name="warning" size={48} color={colors.onDanger} />
            <Text style={styles.countdownLabel} accessibilityRole="header">
              {isTest ? 'Test SOS' : method === 'shake' ? 'Shake detected' : 'Sending SOS'}
            </Text>
            <Text style={styles.countdownNumber} accessibilityLabel={`Sending in ${Math.max(secondsLeft, 0)} seconds`}>
              {Math.max(secondsLeft, 0)}
            </Text>
            <Text style={styles.countdownHint}>
              {isTest
                ? 'This is a test. Friends in your SOS circle get an alert marked TEST. No texts are sent.'
                : 'Your SOS and location will be sent when this reaches zero.'}
            </Text>
          </View>
          <Pressable
            ref={cancelRef}
            style={({ pressed }) => [styles.cancelHuge, pressed && styles.pressed]}
            onPress={cancelCountdown}
            accessibilityRole="button"
            accessibilityLabel="Cancel SOS"
          >
            <Ionicons name="close-circle" size={40} color={colors.dangerText} />
            <Text style={styles.cancelHugeText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.backdrop}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              {step === 'review' ? (
                <>
                  <Ionicons name="alert-circle-outline" size={36} color={colors.dangerText} />
                  <Text style={styles.title} accessibilityRole="header">
                    Send emergency SOS
                  </Text>
                  <Text style={styles.subtitle}>
                    {located ? 'Check the message below, then send.' : 'Getting your location…'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    maxLength={500}
                    accessibilityLabel="SOS message"
                  />
                  <View style={styles.row}>
                    <Pressable style={styles.secondaryButton} onPress={close} accessibilityRole="button">
                      <Text style={styles.secondaryText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.dangerButton, styles.flex]}
                      onPress={() => void send(message.trim() || defaultSosMessage(coords))}
                      accessibilityRole="button"
                    >
                      <Text style={styles.dangerText}>Send SOS</Text>
                    </Pressable>
                  </View>
                </>
              ) : step === 'sending' ? (
                <>
                  <ActivityIndicator size="large" color={colors.dangerText} />
                  <Text style={styles.title} accessibilityRole="header">
                    Sending SOS…
                  </Text>
                </>
              ) : result ? (
                <ResultView
                  result={result}
                  isTest={isTest}
                  hasLocation={coords !== null}
                  textNote={textNote}
                  safe={safe}
                  onText={() => void textContacts()}
                  onRetry={() => void send(message.trim() || defaultSosMessage(coords))}
                  onOpenContacts={openContacts}
                  onOpenCircle={openCircle}
                  onMarkSafe={() => void markSafe()}
                  onDone={close}
                />
              ) : null}
            </ScrollView>
          </View>
        </View>
      )}
    </Modal>
  );
}

type ResultViewProps = {
  result: SosResult;
  isTest: boolean;
  hasLocation: boolean;
  textNote: string;
  safe: 'idle' | 'sending' | 'done';
  onText: () => void;
  onRetry: () => void;
  onOpenContacts: () => void;
  onOpenCircle: () => void;
  onMarkSafe: () => void;
  onDone: () => void;
};

function ResultView({
  result,
  isTest,
  hasLocation,
  textNote,
  safe,
  onText,
  onRetry,
  onOpenContacts,
  onOpenCircle,
  onMarkSafe,
  onDone,
}: ResultViewProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const lines: string[] = [];
  if (result.sent) {
    const who = joinNames(result.alertedNames);
    if (isTest) {
      lines.push(
        who
          ? `Test sent. ${who} got an alert marked TEST. No text was sent.`
          : 'Test sent. Nobody is in your SOS circle yet.',
      );
    } else {
      lines.push(`Your SOS was sent ${hasLocation ? 'with' : 'without'} your location.`);
      lines.push(
        who
          ? `${who} got it — on screen if AccessAI is open, otherwise as a phone notification and in your chat.`
          : 'Nobody is in your SOS circle yet, so no friends were alerted.',
      );
      if (result.sharingUntil) {
        lines.push("While AccessAI stays open, your location keeps updating for them for 30 minutes, or until you say you're safe.");
      }
    }
  } else if (result.offline) {
    lines.push("No internet, so the SOS couldn't go through AccessAI.");
    if (!isTest) lines.push('Text your emergency contacts instead — texts work without internet.');
  } else {
    lines.push(`The SOS wasn't sent: ${result.error}`);
  }

  return (
    <>
      <Ionicons
        name={result.sent ? 'checkmark-circle-outline' : 'cloud-offline-outline'}
        size={40}
        color={result.sent ? colors.success : colors.dangerText}
      />
      <Text style={styles.title} accessibilityRole="header">
        {result.sent ? (isTest ? 'Test sent' : 'SOS sent') : 'SOS not sent'}
      </Text>
      {lines.map((line) => (
        <Text key={line} style={styles.subtitle}>
          {line}
        </Text>
      ))}

      {result.sent && !isTest && result.eventId ? (
        <Pressable
          style={[styles.safeButton, safe !== 'idle' && styles.pressed]}
          onPress={onMarkSafe}
          disabled={safe !== 'idle'}
          accessibilityRole="button"
          accessibilityHint="Ends your SOS and tells your friends you are safe"
        >
          {safe === 'sending' ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.onPrimary} />
          )}
          <Text style={styles.safeText}>{safe === 'done' ? 'Friends were told you’re safe' : 'I’m safe now'}</Text>
        </Pressable>
      ) : null}

      {!isTest ? (
        <View style={styles.actions}>
          <Pressable style={styles.dangerButton} onPress={onText} accessibilityRole="button">
            <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.onDanger} />
            <Text style={styles.dangerText}>Text my emergency contacts</Text>
          </Pressable>
          <Pressable style={styles.outlineDanger} onPress={callEmergencyNumber} accessibilityRole="button">
            <Ionicons name="call-outline" size={20} color={colors.dangerText} />
            <Text style={styles.outlineDangerText}>Call {EMERGENCY_NUMBER}</Text>
          </Pressable>
          {!result.sent ? (
            <Pressable style={styles.secondaryButton} onPress={onRetry} accessibilityRole="button">
              <Text style={styles.secondaryText}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {textNote ? (
        <View style={styles.noteBox}>
          <Text style={styles.subtitle} accessibilityLiveRegion="polite">
            {textNote}
          </Text>
          <Pressable onPress={onOpenContacts} style={styles.linkButton} accessibilityRole="link">
            <Text style={styles.linkText}>Add emergency contacts</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable onPress={onOpenCircle} style={styles.linkButton} accessibilityRole="link">
        <Text style={styles.linkText}>Choose which friends get my SOS</Text>
      </Pressable>

      <Pressable style={[styles.secondaryButton, styles.done]} onPress={onDone} accessibilityRole="button">
        <Text style={styles.secondaryText}>Done</Text>
      </Pressable>
    </>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    countdownScreen: {
      flex: 1,
      backgroundColor: t.colors.danger,
    },
    countdownTop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingTop: 40,
    },
    countdownLabel: {
      marginTop: 8,
      fontSize: t.font(24),
      fontWeight: t.weight('800'),
      color: t.colors.onDanger,
      textAlign: 'center',
    },
    countdownNumber: {
      fontSize: 120,
      lineHeight: 140,
      fontWeight: '900',
      color: t.colors.onDanger,
    },
    countdownHint: {
      fontSize: t.font(16),
      lineHeight: t.lineHeight(22),
      color: t.colors.onDanger,
      textAlign: 'center',
    },
    // Fills the bottom of the screen so it can be hit without aiming.
    cancelHuge: {
      flex: 1,
      margin: 16,
      marginBottom: 40,
      borderRadius: 28,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    cancelHugeText: {
      fontSize: t.font(32),
      fontWeight: t.weight('900'),
      color: t.colors.dangerText,
    },
    pressed: {
      opacity: 0.8,
    },
    backdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: 'center',
      padding: 16,
    },
    sheet: {
      maxHeight: '90%',
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
      backgroundColor: t.colors.surface,
      borderRadius: 20,
    },
    sheetContent: {
      padding: 24,
      alignItems: 'center',
      gap: 8,
    },
    title: {
      marginTop: 4,
      fontSize: t.font(20),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
    input: {
      width: '100%',
      minHeight: 96,
      marginTop: 8,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 12,
      padding: 12,
      fontSize: t.font(15),
      color: t.colors.textPrimary,
      textAlignVertical: 'top',
    },
    row: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
      marginTop: 8,
    },
    actions: {
      width: '100%',
      gap: 10,
      marginTop: 8,
    },
    dangerButton: {
      flexDirection: 'row',
      gap: 8,
      minHeight: 52,
      paddingHorizontal: 16,
      borderRadius: 26,
      backgroundColor: t.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerText: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.onDanger,
    },
    safeButton: {
      flexDirection: 'row',
      gap: 8,
      alignSelf: 'stretch',
      minHeight: 56,
      marginTop: 8,
      paddingHorizontal: 16,
      borderRadius: 28,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    safeText: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimary,
    },
    outlineDanger: {
      flexDirection: 'row',
      gap: 8,
      minHeight: 52,
      borderRadius: 26,
      borderWidth: 2,
      borderColor: t.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineDangerText: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.dangerText,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.textSecondary,
    },
    done: {
      flex: 0,
      alignSelf: 'stretch',
      marginTop: 8,
    },
    noteBox: {
      width: '100%',
      alignItems: 'center',
      marginTop: 4,
    },
    linkButton: {
      minHeight: 44,
      justifyContent: 'center',
    },
    linkText: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
  });
