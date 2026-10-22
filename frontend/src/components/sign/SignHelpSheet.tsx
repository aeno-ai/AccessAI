import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PHASE_TEXT } from '@/components/sign/signText';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type SignUnit } from '@/hooks/use-preferences';
import { speakMixed, stopMixed } from '@/utils/speechHelper';

const OWNER = 'sign-help';

type Help = { title: string; steps: string[]; tips: string[] };

// How the reader works (src/sign/segmenter.ts): a word starts when a hand
// goes above the waist line and ends when the hands come down; a letter is
// one handshape held still. The steps quote the camera's own labels.
export const SIGN_HELP: Record<SignUnit, Help> = {
  words: {
    title: 'How to sign words',
    steps: [
      'Stand back so your head, both shoulders and your waist are in the picture.',
      `Wait until it says “${PHASE_TEXT.WAIT}”.`,
      `Raise your hands above your waist and sign one word. It says “${PHASE_TEXT.SIGN}”.`,
      `Lower your hands. It says “${PHASE_TEXT.TAIL}”, then the word shows up.`,
      'Sign the next word the same way. Lower your hands between words.',
      'When you’re done, stop for 2 seconds. With internet, your words become a sentence.',
    ],
    tips: [
      'Use good light and face the camera.',
      'Sign at your normal speed. Very quick movements are skipped.',
      'Not sure which word it saw? Pick it under “Did you mean”.',
      'A wrong word? Tap Undo last word.',
    ],
  },
  letters: {
    title: 'How to spell with letters',
    steps: [
      'Hold one hand up so the whole hand is in the picture.',
      `Wait until it says “${PHASE_TEXT.WAIT}”.`,
      `Make a letter and hold your hand still for a moment. It says “${PHASE_TEXT.SIGN}”, then the letter shows up.`,
      'For the next letter, change your handshape and hold it still again.',
      'The same letter twice, like the L in “hello”? Move your hand a little, then hold it again.',
      'When the word is done, stop for 2 seconds.',
    ],
    tips: [
      'Keep your fingers clear and the light good.',
      'Letters that need a movement, like J and Z, are harder to read.',
      'A wrong letter? Tap Undo last letter.',
    ],
  },
};

type Props = {
  visible: boolean;
  unit: SignUnit;
  onClose: () => void;
};

/** "How to sign": short steps for words or letters, readable aloud. */
export function SignHelpSheet({ visible, unit, onClose }: Props) {
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const help = SIGN_HELP[unit];

  // Closing stops the reading.
  useEffect(() => {
    if (!visible) stopMixed({ owner: OWNER });
  }, [visible]);

  const hear = () => {
    const text = [help.title + '.', ...help.steps, 'Tips.', ...help.tips].join(' ');
    void speakMixed(text, { rate: prefs.speechRate, owner: OWNER });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <Text style={styles.title} accessibilityRole="header">
          {help.title}
        </Text>
        <ScrollView contentContainerStyle={styles.content}>
          {help.steps.map((step, i) => (
            <View key={step} style={styles.step} accessible accessibilityLabel={`Step ${i + 1} of ${help.steps.length}. ${step}`}>
              <View style={styles.number}>
                <Text style={styles.numberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          <Text style={styles.tipsTitle} accessibilityRole="header">
            Tips
          </Text>
          {help.tips.map((tip) => (
            <View key={tip} style={styles.tip}>
              <Ionicons name="bulb-outline" size={18} color={colors.primary} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.buttons}>
          <Pressable style={styles.secondary} onPress={hear} accessibilityRole="button" accessibilityLabel="Hear the steps">
            <Ionicons name="volume-high-outline" size={20} color={colors.primary} />
            <Text style={styles.secondaryText}>Hear the steps</Text>
          </Pressable>
          <Pressable style={styles.done} onPress={onClose} accessibilityRole="button">
            <Text style={styles.doneText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
    },
    sheet: {
      maxHeight: '88%',
      backgroundColor: t.colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 28,
      gap: 12,
    },
    title: {
      fontSize: t.font(20),
      fontWeight: t.weight('900'),
      color: t.colors.textPrimary,
    },
    content: {
      gap: 12,
      paddingBottom: 8,
    },
    step: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    number: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    numberText: {
      color: t.colors.onPrimary,
      fontSize: t.font(15),
      fontWeight: t.weight('800'),
    },
    stepText: {
      flex: 1,
      fontSize: t.font(16),
      lineHeight: t.lineHeight(23),
      color: t.colors.textPrimary,
    },
    tipsTitle: {
      marginTop: 6,
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    tip: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
      padding: 12,
      borderRadius: 14,
      backgroundColor: t.colors.primaryLight,
    },
    tipText: {
      flex: 1,
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      color: t.colors.onPrimaryLight,
    },
    buttons: {
      gap: 10,
    },
    secondary: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.surface,
    },
    secondaryText: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    done: {
      minHeight: 52,
      borderRadius: 26,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneText: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimary,
    },
  });
