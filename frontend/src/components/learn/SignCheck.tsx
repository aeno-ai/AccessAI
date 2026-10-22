import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';
import { useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SignCamera } from '@/components/sign/SignCamera';
import { SignHelpSheet } from '@/components/sign/SignHelpSheet';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { signReadingAvailable, useSignRecognition, type SignEvent } from '@/hooks/use-sign-recognition';
import { allSigns } from '@/learn/lessons';
import { normalizeLabel, signMatches } from '@/learn/signMatch';
import type { Course, Sign } from '@/learn/types';
import { useFeedback } from '@/learn/useFeedback';
import { announce } from '@/utils/a11y';

type Result = { passed: boolean; saw: string | null };

type Props = {
  course: Course;
  sign: Sign;
  /** Done right: the parent moves on. */
  onPass: () => void;
  onSkip: () => void;
  /** Camera practice can't work here (camera refused, or this phone can't read signs). */
  onUnavailable?: () => void;
  /** Words for the skip button ("Skip" in a lesson, "Back" in practice). */
  skipLabel?: string;
};

/**
 * "Do the sign": the front camera, and the same sign reader as sign mode.
 * The learner signs; the reader's best guesses decide (signMatch.ts). Camera
 * mistakes never cost anything — try as often as you like, or skip. It all
 * runs on the phone, so it works offline.
 */
export function SignCheck({ course, sign, onPass, onSkip, onUnavailable, skipLabel = 'Skip' }: Props) {
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const say = useFeedback();
  const screenReader = useScreenReader();
  const focused = useIsFocused();
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const [result, setResult] = useState<Result | null>(null);
  const [hint, setHint] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const displayOf = (label: string) =>
    allSigns(course).find((s) => normalizeLabel(s.label) === normalizeLabel(label))?.display ?? label;

  const onEvent = (event: SignEvent) => {
    if (result) return;
    if (event.type === 'hint') {
      setHint(event.message);
      if (event.message) say(event.message);
      return;
    }
    const passed = signMatches(course, sign.label, event.top5);
    const saw = event.top5[0] ? displayOf(event.top5[0].label) : null;
    setResult({ passed, saw });
    if (passed) {
      Vibration.vibrate(60);
      say(`That's it! You signed ${sign.display}.`);
    } else {
      say(saw ? `Not quite. We saw ${saw}. Try again.` : 'Not quite. Try again.');
    }
  };

  const { phase, message, output } = useSignRecognition({
    // Only while this screen is in front, and until there's a result.
    active: hasPermission && focused && !result,
    language: course,
    unit: 'words',
    minConfidence: 0.35,
    flip: prefs.signFlip,
    onEvent,
  });

  // "Get ready" out loud for screen reader users, once per try (live regions
  // don't speak on iPhones). Without a screen reader the steps already said
  // "Your turn. Sign …", so this doesn't talk over them.
  const prompted = useRef(false);
  useEffect(() => {
    if (phase !== 'WAIT' || result || prompted.current) return;
    prompted.current = true;
    if (screenReader) announce(`Get ready. Sign ${sign.display}.`);
  }, [phase, result, screenReader, sign.display]);

  // This phone can't read signs, or the camera was refused for good: tell
  // the lesson to skip camera practice.
  const reported = useRef(false);
  useEffect(() => {
    const unavailable = !signReadingAvailable || (message && phase === 'off') || (!hasPermission && !canRequestPermission);
    if (unavailable && !reported.current) {
      reported.current = true;
      onUnavailable?.();
    }
  }, [message, phase, hasPermission, canRequestPermission, onUnavailable]);

  if (!hasPermission) {
    return (
      <View style={styles.card}>
        <Text style={styles.text}>To check your signing, AccessAI needs the camera.</Text>
        <Pressable style={styles.primary} onPress={() => void requestPermission()} accessibilityRole="button">
          <Text style={styles.primaryText}>Allow the camera</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onSkip} accessibilityRole="button">
          <Text style={styles.secondaryText}>{skipLabel}</Text>
        </Pressable>
      </View>
    );
  }

  const status = result
    ? result.passed
      ? `That's it! You signed ${sign.display}.`
      : result.saw
        ? `Not quite. We saw: ${result.saw}.`
        : 'Not quite. Try again.'
    : phase === 'SIGN'
      ? 'Signing…'
      : phase === 'TAIL'
        ? 'Reading…'
        : phase === 'WAIT'
          ? `Get ready — sign ${sign.display}`
          : 'Starting the camera…';

  return (
    <View style={styles.card}>
      <View style={styles.cameraWrap}>
        <SignCamera output={output} facing="front" isActive={hasPermission && focused && !result} />
        {result ? (
          <View style={[styles.verdict, result.passed ? styles.pass : styles.fail]}>
            <Ionicons
              name={result.passed ? 'checkmark-circle' : 'close-circle'}
              size={48}
              color={result.passed ? colors.onPrimary : colors.onDanger}
            />
          </View>
        ) : null}
      </View>
      <Text style={styles.status} accessibilityLiveRegion="polite">
        {status}
      </Text>
      {!result && (message || hint) ? (
        <Text style={styles.text} accessibilityLiveRegion="polite">
          {message || hint}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {result?.passed ? (
          <Pressable style={styles.primary} onPress={onPass} accessibilityRole="button">
            <Text style={styles.primaryText}>Continue</Text>
          </Pressable>
        ) : null}
        {result && !result.passed ? (
          <Pressable
            style={styles.primary}
            onPress={() => {
              prompted.current = false;
              setResult(null);
              setHint('');
            }}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={18} color={colors.onPrimary} />
            <Text style={styles.primaryText}>Try again</Text>
          </Pressable>
        ) : null}
        {!result?.passed ? (
          <Pressable style={styles.secondary} onPress={onSkip} accessibilityRole="button">
            <Text style={styles.secondaryText}>{skipLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {!result ? (
        <Pressable style={styles.helpLink} onPress={() => setHelpOpen(true)} accessibilityRole="button">
          <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.helpLinkText}>How to sign for the camera</Text>
        </Pressable>
      ) : null}
      <SignHelpSheet visible={helpOpen} unit="words" onClose={() => setHelpOpen(false)} />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      gap: 10,
    },
    helpLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 44,
    },
    helpLinkText: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
      textDecorationLine: 'underline',
    },
    cameraWrap: {
      width: '100%',
      aspectRatio: 3 / 4,
      maxHeight: 420,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: '#000000',
    },
    camera: {
      flex: 1,
    },
    verdict: {
      position: 'absolute',
      top: 12,
      right: 12,
      borderRadius: 32,
      padding: 4,
    },
    pass: {
      backgroundColor: t.colors.primary,
    },
    fail: {
      backgroundColor: t.colors.danger,
    },
    status: {
      fontSize: t.font(18),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
      textAlign: 'center',
    },
    text: {
      fontSize: t.font(15),
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
    actions: {
      gap: 8,
    },
    primary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: t.colors.primary,
    },
    primaryText: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimary,
    },
    secondary: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
    },
    secondaryText: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
  });
