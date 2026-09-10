import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, MaxContentWidth } from '@/constants/theme';

type ScreenShellProps = {
  children: ReactNode;
  backgroundColor?: string;
  maxWidth?: number;
  style?: ViewStyle;
};

export function ScreenShell({
  children,
  backgroundColor = colors.background,
  maxWidth = MaxContentWidth.onboarding,
  style,
}: ScreenShellProps) {
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <View
        style={[
          styles.frame,
          Platform.OS === 'web' && styles.webCanvas,
          { backgroundColor: Platform.OS === 'web' ? colors.canvas : backgroundColor },
        ]}
      >
        <View style={[styles.content, { maxWidth, backgroundColor }, style]}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  frame: {
    flex: 1,
    width: '100%',
  },
  webCanvas: {
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
});
