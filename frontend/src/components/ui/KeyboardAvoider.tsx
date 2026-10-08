import { type ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type KeyboardAvoiderProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Keeps whatever's at the bottom of a screen (a message box, a form's last
 * field) above the on-screen keyboard, on both iPhone and Android.
 *
 * - "padding" on Android too: Android apps now draw edge-to-edge, so the
 *   window no longer shrinks for the keyboard by itself. Leaving Android's
 *   behavior unset is what let the keyboard cover the message box.
 * - The offset is the top safe-area inset: KeyboardAvoidingView measures
 *   itself from inside ScreenShell's safe area, but the keyboard's position
 *   is measured from the top of the screen.
 *
 * Built on React Native's own KeyboardAvoidingView so it works in Expo Go
 * (react-native-keyboard-controller isn't included there).
 */
export function KeyboardAvoider({ children, style }: KeyboardAvoiderProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={[styles.flex, style]} behavior="padding" keyboardVerticalOffset={insets.top}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
