import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type SignLanguage, type SignUnit } from '@/hooks/use-preferences';
import { fetchSignModels, useSignRecognition, type SignEvent, type SignModelInfo } from '@/hooks/use-sign-recognition';
import { announce } from '@/utils/a11y';

// After signing stops for this long, the words become a sentence.
const SENTENCE_PAUSE_MS = 2500;

type SignPanelProps = {
  /** A recognized word, for the message box. */
  onWord: (word: string) => void;
  /** Take the last word back out. */
  onUndoWord: () => void;
  /** Signing paused after some words: time to turn them into a sentence. */
  onPause: (language: SignLanguage) => void;
  /** Words recognized since the last sentence (for the Undo button). */
  pendingWords: number;
};

const PHASE_TEXT = {
  off: 'Starting the camera…',
  starting: 'Connecting…',
  WAIT: 'Watching — sign whenever you’re ready',
  SIGN: 'Signing…',
  TAIL: 'Reading the sign…',
  paused: 'Paused',
} as const;

/**
 * Sign language mode, inside the message box: the camera, the language and
 * unit choice, and what's being recognized. Each recognized word goes into
 * the message box; when signing pauses, the AI turns the words into a
 * sentence there. The signer checks it and taps Send — the app never sends
 * by itself.
 */
export function SignPanel({ onWord, onUndoWord, onPause, pendingWords }: SignPanelProps) {
  const { prefs, setPref } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [models, setModels] = useState<SignModelInfo[] | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [hint, setHint] = useState('');
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    void fetchSignModels()
      .then(setModels)
      .catch(() => setModels([]));
  }, []);

  const lettersReady = models?.some((m) => m.language === prefs.signLanguage && m.unit === 'letters' && m.available) ?? false;
  const unit: SignUnit = prefs.signUnit === 'letters' && !lettersReady ? 'words' : prefs.signUnit;

  const scheduleSentence = () => {
    clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => onPause(prefs.signLanguage), SENTENCE_PAUSE_MS);
  };

  const handle = (event: SignEvent) => {
    if (event.type === 'word') {
      setChoices([]);
      setHint('');
      onWord(event.label);
      Vibration.vibrate(40);
      scheduleSentence();
    } else if (event.type === 'unsure') {
      // The model isn't sure: show its best guesses to pick from.
      setChoices(event.top5.slice(0, 5).map((guess) => guess.label));
      announce('Not sure which sign. Pick one of the suggestions, or sign it again.');
    } else if (event.type === 'hint') {
      setHint(event.message);
    }
  };

  const { phase, message, resume } = useSignRecognition({
    cameraRef,
    cameraReady,
    active: Boolean(permission?.granted),
    language: prefs.signLanguage,
    unit,
    minConfidence: prefs.signConfidence,
    flip: prefs.signFlip,
    onEvent: handle,
  });

  // Someone is signing again: not a pause yet.
  useEffect(() => {
    if (phase === 'SIGN' || phase === 'TAIL') clearTimeout(pauseTimer.current);
  }, [phase]);
  useEffect(() => () => clearTimeout(pauseTimer.current), []);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={styles.panel}>
        <Text style={styles.text}>Sign language uses the camera to see the signs.</Text>
        <Pressable style={styles.primary} onPress={() => void requestPermission()} accessibilityRole="button">
          <Text style={styles.primaryText}>Allow the camera</Text>
        </Pressable>
      </View>
    );
  }

  const chip = (label: string, selected: boolean, onPress: () => void, disabled = false, hintText?: string) => (
    <Pressable
      key={label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityHint={hintText}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.panel}>
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          mode="video"
          mute
          mirror={false}
          videoQuality="480p"
          facing={prefs.signCamera}
          onCameraReady={() => setCameraReady(true)}
          accessible={false}
        />
        <View style={styles.statusBadge}>
          <View style={[styles.dot, phase === 'SIGN' && styles.dotSigning]} />
          <Text style={styles.statusText} accessibilityLiveRegion="polite">
            {PHASE_TEXT[phase]}
          </Text>
        </View>
        <Pressable
          style={styles.flipCamera}
          onPress={() => setPref('signCamera', prefs.signCamera === 'front' ? 'back' : 'front')}
          accessibilityRole="button"
          accessibilityLabel={prefs.signCamera === 'front' ? 'Use the back camera' : 'Use the front camera'}
          accessibilityHint="The back camera lets you point the phone at someone signing"
        >
          <Ionicons name="camera-reverse-outline" size={22} color={colors.onPrimary} />
        </Pressable>
      </View>

      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Sign language">
        {chip('FSL', prefs.signLanguage === 'fsl', () => setPref('signLanguage', 'fsl' as SignLanguage), false, 'Filipino Sign Language')}
        {chip('ASL', prefs.signLanguage === 'asl', () => setPref('signLanguage', 'asl' as SignLanguage), false, 'American Sign Language')}
        <View style={styles.separator} />
        {chip('Words', unit === 'words', () => setPref('signUnit', 'words'))}
        {chip(lettersReady ? 'Letters' : 'Letters (soon)', unit === 'letters', () => setPref('signUnit', 'letters'), !lettersReady)}
        <View style={styles.separator} />
        {chip('Mirror', prefs.signFlip, () => setPref('signFlip', !prefs.signFlip), false, 'Only if signs keep being read wrong: flips the video left and right')}
      </View>

      {choices.length ? (
        <View style={styles.choices}>
          <Text style={styles.text}>Did you mean:</Text>
          {choices.map((label) => (
            <Pressable
              key={label}
              style={styles.choice}
              onPress={() => {
                onWord(label);
                setChoices([]);
                scheduleSentence();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.choiceText}>{label.toLowerCase()}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {hint || message ? (
        <Text style={styles.text} accessibilityLiveRegion="polite">
          {message || hint}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {phase === 'paused' ? (
          <Pressable style={styles.primary} onPress={resume} accessibilityRole="button">
            <Text style={styles.primaryText}>Resume</Text>
          </Pressable>
        ) : null}
        {pendingWords > 0 ? (
          <Pressable style={styles.secondary} onPress={onUndoWord} accessibilityRole="button">
            <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryText}>Undo last word</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    panel: {
      gap: 8,
      marginBottom: 8,
      padding: 10,
      borderRadius: 16,
      backgroundColor: t.colors.primaryLight,
    },
    cameraWrap: {
      height: 220,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    camera: {
      flex: 1,
    },
    statusBadge: {
      position: 'absolute',
      left: 8,
      top: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#9BE39B',
    },
    dotSigning: {
      backgroundColor: '#FF5A5A',
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: t.font(13),
      fontWeight: '700',
    },
    flipCamera: {
      position: 'absolute',
      right: 8,
      top: 8,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    chip: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.surface,
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: t.colors.primary,
    },
    chipDisabled: {
      opacity: 0.5,
    },
    chipText: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    chipTextSelected: {
      color: t.colors.onPrimary,
    },
    separator: {
      width: 1,
      height: 24,
      backgroundColor: t.colors.border,
    },
    choices: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    choice: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      justifyContent: 'center',
    },
    choiceText: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    text: {
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    primary: {
      minHeight: 44,
      paddingHorizontal: 18,
      borderRadius: 22,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      fontSize: t.font(15),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimary,
    },
    secondary: {
      flexDirection: 'row',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
  });
