import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePickedVoices } from '@/hooks/use-app-voice';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { speakMixed, stopMixed } from '@/utils/speechHelper';
import { measureTarget, type TargetBox } from '@/tutorial/targets';
import type { TourStep } from '@/tutorial/tours';

type Props = {
  step: TourStep;
  stepNumber: number;
  stepCount: number;
  first: boolean;
  last: boolean;
  /** Blind / low vision: Laya says each step, and a tap anywhere goes on. */
  layaLed: boolean;
  onNext: () => void;
  onSkip: () => void;
};

// Laya's own speech while she leads the tour.
const OWNER = 'tutorial';
// The lit-up space around a control.
const PADDING = 6;

/**
 * One step of a tour: everything dimmed except the control it's about
 * (four dark rectangles around it — no drawing library needed), and a card
 * saying what it is, with Next and Skip. A control that isn't on screen
 * right now (scrolled away, not there yet) gets the card alone.
 */
export function TutorialHost({ step, stepNumber, stepCount, first, last, layaLed, onNext, onSkip }: Props) {
  const { colors, reduceMotion } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { prefs } = usePreferences();
  const screenReader = useScreenReader();
  const { width, height } = useWindowDimensions();
  const voices = usePickedVoices(prefs.layaVoice === 'app' ? prefs.appVoice : prefs.layaVoice);
  const [box, setBox] = useState<TargetBox | null | undefined>(step.target ? undefined : null);
  const focusRef = useRef<View>(null);

  // Where the control is.
  useEffect(() => {
    if (!step.target) return;
    let cancelled = false;
    void measureTarget(step.target).then((found) => {
      if (cancelled) return;
      const onScreen = found && found.y >= 0 && found.y + found.height <= height && found.x >= 0 && found.x + found.width <= width;
      setBox(onScreen ? found : null);
    });
    return () => {
      cancelled = true;
    };
  }, [step.target, width, height]);

  const measured = box !== undefined;
  const spoken = `${step.title}. ${step.text}`;

  // Laya says it (Blind / low vision); otherwise a screen reader reads the card.
  useEffect(() => {
    if (!measured) return;
    if (layaLed) {
      const intro = first ? "I'm Laya. I'll show you around this page. Tap anywhere on the screen to go on. " : '';
      const outro = last ? " That's all for this page." : '';
      void speakMixed(`${intro}${spoken}${outro}`, {
        owner: OWNER,
        rate: prefs.speechRate,
        voices: voices ? { en: voices.en, fil: voices.fil } : undefined,
      });
    }
    if (screenReader) {
      const timer = setTimeout(() => {
        const node = focusRef.current && findNodeHandle(focusRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [measured, layaLed, screenReader, first, last, spoken, prefs.speechRate, voices]);

  // Moving on stops whatever Laya was still saying about this step.
  useEffect(() => () => stopMixed({ owner: OWNER }), []);

  const lit = box ? { x: box.x - PADDING, y: box.y - PADDING, w: box.width + PADDING * 2, h: box.height + PADDING * 2 } : null;
  // The card goes below a control in the top half of the screen, above one in the bottom half.
  const cardBelow = lit ? lit.y + lit.h / 2 < height / 2 : false;
  const cardPosition = !lit ? styles.cardCentered : cardBelow ? { top: lit.y + lit.h + 12 } : { bottom: height - lit.y + 12 };

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onSkip}
    >
      {/* With Laya leading, a tap anywhere goes on. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={layaLed ? onNext : undefined} accessible={false}>
        {!measured ? null : lit ? (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(0, lit.y) }]} />
            <View style={[styles.dim, { top: lit.y + lit.h, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.dim, { top: lit.y, left: 0, width: Math.max(0, lit.x), height: lit.h }]} />
            <View style={[styles.dim, { top: lit.y, left: lit.x + lit.w, right: 0, height: lit.h }]} />
            <View pointerEvents="none" style={[styles.ring, { top: lit.y, left: lit.x, width: lit.w, height: lit.h }]} />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFill]} />
        )}
      </Pressable>

      {measured ? (
        <View style={[styles.card, cardPosition]} accessibilityViewIsModal>
          <View
            ref={layaLed ? undefined : focusRef}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`Step ${stepNumber} of ${stepCount}. ${spoken}`}
          >
            <Text style={styles.count}>
              {stepNumber} of {stepCount}
            </Text>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.text}>{step.text}</Text>
          </View>
          <View style={styles.row}>
            <Pressable onPress={onSkip} style={styles.skip} accessibilityRole="button" accessibilityLabel="Skip the tour">
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable
              ref={layaLed ? focusRef : undefined}
              onPress={onNext}
              style={styles.next}
              accessibilityRole="button"
              accessibilityLabel={last ? 'Got it' : 'Next'}
            >
              <Text style={[styles.nextText, { color: colors.onPrimary }]}>{last ? 'Got it' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    dim: {
      position: 'absolute',
      backgroundColor: t.colors.overlay,
    },
    ring: {
      position: 'absolute',
      borderRadius: 14,
      borderWidth: 3,
      borderColor: t.colors.onPrimary,
    },
    card: {
      position: 'absolute',
      left: 16,
      right: 16,
      gap: 12,
      padding: 18,
      borderRadius: 18,
      backgroundColor: t.colors.surface,
      elevation: 12,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    cardCentered: {
      top: '35%',
    },
    count: {
      fontSize: t.font(13),
      fontWeight: t.weight('700'),
      color: t.colors.textSecondary,
    },
    title: {
      marginTop: 2,
      fontSize: t.font(20),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    text: {
      marginTop: 4,
      fontSize: t.font(16),
      lineHeight: t.lineHeight(23),
      color: t.colors.textPrimary,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    skip: {
      minHeight: 48,
      minWidth: 72,
      paddingHorizontal: 16,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skipText: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.textSecondary,
    },
    next: {
      minHeight: 48,
      minWidth: 96,
      paddingHorizontal: 20,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.primary,
    },
    nextText: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
    },
  });
