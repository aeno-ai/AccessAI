import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useBigText } from '@/components/conversation/BigTextHost';
import { SignPanel } from '@/components/conversation/SignPanel';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useIsOnline } from '@/hooks/use-is-online';
import { usePreferences, type SignLanguage, type SignUnit } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { announce } from '@/utils/a11y';
import { polishSigned } from '@/utils/signedText';
import { speakMixed, stopMixed } from '@/utils/speechHelper';

// This screen's own speech, so leaving stops only that.
const OWNER = 'sign-camera';

/**
 * The sign camera (Home's "Sign language" card, owner 2026-10-17,
 * HANDOFF.md §37): sign in front of the camera, one sign after another.
 * The words show big as they're read; when signing pauses, the AI makes
 * them a proper sentence (the same tidy-up as the message box's sign mode)
 * and it's said out loud — no Send button. If the AI can't help, the plain
 * words are said. Needs the internet (signs are read on the AccessAI
 * server); nothing is saved.
 */
export default function SignCameraScreen() {
  const online = useIsOnline();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScreenHeader title="Sign language" />
      {online ? (
        <SignCamera />
      ) : (
        <View style={styles.offline}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
          <Text style={styles.offlineText}>Sign reading needs the internet. Connect and try again.</Text>
        </View>
      )}
    </ScreenShell>
  );
}

function SignCamera() {
  useKeepAwake();
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const screenReader = useScreenReader();
  const bigText = useBigText();
  // The signs since the last pause; a letter joins the word being spelled.
  const words = useRef<string[]>([]);
  const spelling = useRef(false);
  const [live, setLive] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [making, setMaking] = useState(false);

  // Leaving the screen stops it talking.
  useFocusEffect(useCallback(() => () => stopMixed({ owner: OWNER }), []));

  const sayIt = useCallback(
    (text: string) => {
      setSaid(text);
      // Said out loud for the person in front of them, even with a screen reader on.
      void speakMixed(text, { rate: prefs.speechRate, owner: OWNER });
      if (screenReader) announce(text);
    },
    [prefs.speechRate, screenReader],
  );

  const onWord = (sign: string, unit: SignUnit) => {
    const piece = sign.toLowerCase();
    if (unit === 'letters' && spelling.current && words.current.length) {
      words.current[words.current.length - 1] += piece;
    } else {
      words.current.push(piece);
    }
    spelling.current = unit === 'letters';
    setLive(words.current.join(' '));
  };

  const onUndoWord = () => {
    const last = words.current[words.current.length - 1];
    if (last === undefined) return;
    if (spelling.current && last.length > 1) words.current[words.current.length - 1] = last.slice(0, -1);
    else words.current.pop();
    setLive(words.current.join(' '));
  };

  // Signing paused: the words become a sentence and are said out loud.
  const onPause = async (language: SignLanguage, unit: SignUnit) => {
    const raw = words.current.join(' ');
    if (!raw) return;
    words.current = [];
    spelling.current = false;
    setLive('');
    let text = raw;
    if (prefs.signAutoSentence) {
      setMaking(true);
      text = (await polishSigned(raw, unit === 'letters' ? 'spell' : 'gloss', language)) ?? raw;
      setMaking(false);
    }
    sayIt(text);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SignPanel
        size="full"
        onWord={onWord}
        onUndoWord={onUndoWord}
        onPause={(language, unit) => void onPause(language, unit)}
        pendingWords={live ? live.split(' ').length : 0}
      />

      <View style={styles.wordsCard} accessible accessibilityLiveRegion="polite" accessibilityLabel={live || 'Waiting for signs'}>
        <Text style={styles.label}>{making ? 'Making a sentence…' : 'Signing now'}</Text>
        <Text style={styles.live}>{live || '…'}</Text>
      </View>

      {said ? (
        <View style={styles.saidCard}>
          <Text style={styles.label}>Said out loud</Text>
          <Text style={styles.said}>{said}</Text>
          <View style={styles.row}>
            <Pressable style={styles.action} onPress={() => sayIt(said)} accessibilityRole="button" accessibilityLabel="Say it again">
              <Ionicons name="volume-high-outline" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Say it again</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => bigText.show(said)} accessibilityRole="button" accessibilityLabel="Show it in Big text">
              <Ionicons name="expand-outline" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Big text</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>Sign one word after another. When you pause, AccessAI says it out loud as a sentence.</Text>
      )}
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      gap: 12,
      padding: 12,
      paddingBottom: 40,
    },
    offline: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      padding: 24,
    },
    offlineText: {
      fontSize: t.font(17),
      lineHeight: t.lineHeight(24),
      color: t.colors.textPrimary,
      textAlign: 'center',
    },
    wordsCard: {
      gap: 4,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    label: {
      fontSize: t.font(13),
      fontWeight: t.weight('700'),
      color: t.colors.textSecondary,
    },
    live: {
      fontSize: t.font(30),
      lineHeight: t.lineHeight(38),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    saidCard: {
      gap: 8,
      padding: 16,
      borderRadius: 16,
      backgroundColor: t.colors.primaryLight,
    },
    said: {
      fontSize: t.font(26),
      lineHeight: t.lineHeight(34),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimaryLight,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.surface,
    },
    actionText: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    hint: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      color: t.colors.textSecondary,
    },
  });
