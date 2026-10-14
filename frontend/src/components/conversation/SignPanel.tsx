import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { SignOptionsSheet } from '@/components/conversation/SignOptionsSheet';
import { SIGN_LANGUAGE_NAMES, signChoiceLabel } from '@/components/sign/SignChoices';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type SignLanguage, type SignUnit } from '@/hooks/use-preferences';
import { signReady, useSignModels, useSignRecognition, type SignEvent } from '@/hooks/use-sign-recognition';
import { announce } from '@/utils/a11y';

// After signing stops for this long, the words become a sentence.
const SENTENCE_PAUSE_MS = 2500;

type SignPanelProps = {
  /** A recognized word (or letter, when reading letters), for the message box. */
  onWord: (sign: string, unit: SignUnit) => void;
  /** Take the last word (or letter) back out. */
  onUndoWord: () => void;
  /** Signing paused: words become a sentence; spelled letters end a word. */
  onPause: (language: SignLanguage, unit: SignUnit) => void;
  /** Signs recognized since the last pause (for the Undo button). */
  pendingWords: number;
};

// The camera's height: a share of the screen, within limits — Normal fits
// above the message box; Large (the button on the camera) shows the signer
// at about half the screen. Only the preview changes: the video sent for
// reading is the same size either way.
const cameraHeight = (screenHeight: number, large: boolean) =>
  large
    ? Math.round(Math.min(620, Math.max(360, screenHeight * 0.55)))
    : Math.round(Math.min(340, Math.max(240, screenHeight * 0.34)));

const PHASE_TEXT = {
  off: 'Starting the camera…',
  starting: 'Getting ready…',
  WAIT: 'Watching — sign whenever you’re ready',
  SIGN: 'Signing…',
  TAIL: 'Reading the sign…',
  paused: 'Paused',
} as const;

/**
 * Sign language mode, inside the message box: the camera, one button for
 * the language and words/letters (opens SignOptionsSheet), and what's
 * being recognized. Each recognized word goes into
 * the message box; when signing pauses, the AI turns the words into a
 * sentence there. The signer checks it and taps Send — the app never sends
 * by itself.
 */
export function SignPanel({ onWord, onUndoWord, onPause, pendingWords }: SignPanelProps) {
  const { prefs, setPref } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { height: screenHeight } = useWindowDimensions();
  const large = prefs.signCameraLarge;
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const models = useSignModels();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [hint, setHint] = useState('');
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const lettersReady = signReady(models, prefs.signLanguage, 'letters');
  const unit: SignUnit = prefs.signUnit === 'letters' && !lettersReady ? 'words' : prefs.signUnit;

  const scheduleSentence = () => {
    clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => onPause(prefs.signLanguage, unit), SENTENCE_PAUSE_MS);
  };

  const handle = (event: SignEvent) => {
    if (event.type === 'word') {
      setChoices([]);
      setHint('');
      onWord(event.label, unit);
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

  return (
    <View style={styles.panel}>
      <View style={[styles.cameraWrap, { height: cameraHeight(screenHeight, large) }]}>
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
        <Pressable
          style={styles.optionsButton}
          onPress={() => setOptionsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sign language: ${SIGN_LANGUAGE_NAMES[prefs.signLanguage]}, ${unit}. Change`}
        >
          <Text style={styles.optionsText}>{signChoiceLabel(prefs.signLanguage, unit)}</Text>
          <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={styles.sizeButton}
          onPress={() => setPref('signCameraLarge', !large)}
          accessibilityRole="button"
          accessibilityLabel={large ? 'Make the camera smaller' : 'Make the camera bigger'}
        >
          <Ionicons name={large ? 'contract-outline' : 'expand-outline'} size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <SignOptionsSheet visible={optionsOpen} models={models} onClose={() => setOptionsOpen(false)} />

      {choices.length ? (
        <View style={styles.choices}>
          <Text style={styles.text}>Did you mean:</Text>
          {choices.map((label) => (
            <Pressable
              key={label}
              style={styles.choice}
              onPress={() => {
                onWord(label, unit);
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
            <Text style={styles.secondaryText}>{unit === 'letters' ? 'Undo last letter' : 'Undo last word'}</Text>
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
    optionsButton: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sizeButton: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionsText: {
      color: '#FFFFFF',
      fontSize: t.font(15),
      fontWeight: '800',
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
