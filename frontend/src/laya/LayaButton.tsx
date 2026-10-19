import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import { useTabBarHeight } from '@/hooks/use-tab-bar-height';
import { useTourTarget } from '@/tutorial/targets';

const SIZE = 68;
const EDGE = 12;
// The menu opens with a swipe from the left edge (its first 32 points): on
// the left, the button stays clear of that strip so dragging it never opens
// the menu.
const LEFT_EDGE = 36;
// Message boxes (Conversation, a chat) sit at the bottom of the screen.
const KEEP_CLEAR_BOTTOM = 150;
// Moving less than this is a tap, not a drag.
const DRAG_DISTANCE = 8;
// Each "move up / down" from a screen reader.
const STEP = 0.2;

type Props = { onPress: () => void };

/**
 * The Laya button (owner, 2026-10-17, HANDOFF.md §35): a tap opens Laya;
 * a drag moves it anywhere, and it settles against the nearer side, clear
 * of the tab bar and message boxes. Where it was left is remembered.
 * TalkBack / VoiceOver: double-tap opens Laya; the actions menu moves it.
 */
export function LayaButton({ onPress }: Props) {
  const { colors, reduceMotion } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { prefs, setPref } = usePreferences();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarHeight();
  const tourRef = useTourTarget('laya.button');

  // Where it may go (top-left corner of the button).
  const leftX = insets.left + LEFT_EDGE;
  const rightX = width - insets.right - EDGE - SIZE;
  const minY = insets.top + 8;
  const maxY = Math.max(minY, height - insets.bottom - Math.max(tabBar, KEEP_CLEAR_BOTTOM) - SIZE);
  // Its first spot: the right side, about a third of the way up (where it always was).
  const saved = prefs.layaButton ?? { side: 'right' as const, y: (height * 0.7 - SIZE - minY) / Math.max(1, maxY - minY) };
  const share = Math.min(1, Math.max(0, saved.y));
  const homeX = saved.side === 'left' ? leftX : rightX;
  const homeY = minY + share * (maxY - minY);

  const x = useSharedValue(homeX);
  const y = useSharedValue(homeY);
  const startX = useSharedValue(homeX);
  const startY = useSharedValue(homeY);
  // A drag just ended: the finger lifting isn't a tap.
  const dragged = useSharedValue(false);

  // The screen turned, the tab bar appeared, or it was moved by a screen reader.
  // (.get() / .set(): Reanimated's way that works with the React Compiler.)
  useEffect(() => {
    x.set(homeX);
    y.set(homeY);
  }, [homeX, homeY, x, y]);

  const save = (side: 'left' | 'right', top: number) => {
    setPref('layaButton', { side, y: maxY > minY ? (top - minY) / (maxY - minY) : 0 });
    setTimeout(() => dragged.set(false), 250);
  };

  const pan = Gesture.Pan()
    .minDistance(DRAG_DISTANCE)
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
      dragged.set(true);
    })
    .onUpdate((event) => {
      x.set(Math.min(rightX, Math.max(leftX, startX.get() + event.translationX)));
      y.set(Math.min(maxY, Math.max(minY, startY.get() + event.translationY)));
    })
    .onEnd(() => {
      const left = x.get() + SIZE / 2 < width / 2;
      const targetX = left ? leftX : rightX;
      x.set(reduceMotion ? targetX : withSpring(targetX, { damping: 18, stiffness: 180 }));
      scheduleOnRN(save, left ? 'left' : 'right', y.get());
    });

  const position = useAnimatedStyle(() => ({ left: x.get(), top: y.get() }));

  const move = (action: string) => {
    const side = action === 'left' ? 'left' : action === 'right' ? 'right' : saved.side;
    const nextShare = action === 'up' ? share - STEP : action === 'down' ? share + STEP : share;
    setPref('layaButton', { side, y: Math.min(1, Math.max(0, nextShare)) });
  };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.wrap, position]} ref={tourRef} collapsable={false}>
        <Pressable
          style={styles.fab}
          onPress={() => {
            if (!dragged.get()) onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel="Laya, voice assistant"
          accessibilityHint="Listens for what you want to do"
          accessibilityActions={[
            { name: 'left', label: 'Move to the left side' },
            { name: 'right', label: 'Move to the right side' },
            { name: 'up', label: 'Move up' },
            { name: 'down', label: 'Move down' },
          ]}
          onAccessibilityAction={(event) => move(event.nativeEvent.actionName)}
        >
          <Ionicons name="mic" size={28} color={colors.onPrimary} />
          <Text style={styles.fabText} importantForAccessibility="no">
            Laya
          </Text>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      width: SIZE,
      height: SIZE,
    },
    fab: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
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
  });
