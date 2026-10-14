import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { useSignRecognition, type SignEvent } from '@/hooks/use-sign-recognition';
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
  /** Camera practice can't work here (camera refused, or the sign reader can't be reached). */
  onUnavailable?: () => void;
  /** Words for the skip button ("Skip" in a lesson, "Back" in practice). */
  skipLabel?: string;
};

/**
 * "Do the sign": the front camera, and the same sign reader as sign mode.
 * The learner signs; the reader's best guesses decide (signMatch.ts). Camera
 * mistakes never cost a heart — try as often as you like, or skip.
 */
export function SignCheck({ course, sign, onPass, onSkip, onUnavailable, skipLabel = 'Skip' }: Props) {
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const say = useFeedback();
  const screenReader = useScreenReader();
  const focused = useIsFocused();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [hint, setHint] = useState('');

  const displayOf = (label: string) =>
    allSigns(course).find((s) => normalizeLabel(s.label) === normalizeLabel(label))?.display ?? label;

  const onEvent = (event: SignEvent) => {
    if (result) return;
    if (event.type === 'hint') {
      setHint(event.message);
      say(event.message);
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

  const { phase, message } = useSignRecognition({
    cameraRef,
    cameraReady,
    // Only while this screen is in front, and until there's a result.
    active: Boolean(permission?.granted) && focused && !result,
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

  // The sign reader can't be reached: tell the lesson to skip camera practice.
  const reported = useRef(false);
  useEffect(() => {
    if (message && phase === 'off' && !reported.current) {
      reported.current = true;
      onUnavailable?.();
    }
  }, [message, phase, onUnavailable]);

  useEffect(() => {
    if (permission && !permission.granted && !permission.canAskAgain) onUnavailable?.();
  }, [permission, onUnavailable]);

  if (!permission) return null;
  if (!permission.granted) {
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
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          mode="video"
          mute
          mirror={false}
          videoQuality="480p"
          facing="front"
          onCameraReady={() => setCameraReady(true)}
          accessible={false}
        />
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
          {phase === 'off' && message ? 'Camera practice needs the internet.' : message || hint}
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
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      gap: 10,
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
