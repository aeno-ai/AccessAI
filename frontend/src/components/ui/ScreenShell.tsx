import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaxContentWidth } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type ScreenShellProps = {
  children: ReactNode;
  /** Defaults to the theme's screen background. */
  backgroundColor?: string;
  maxWidth?: number;
  style?: ViewStyle;
};

export function ScreenShell({ children, backgroundColor, maxWidth = MaxContentWidth.onboarding, style }: ScreenShellProps) {
  const { colors } = useAppTheme();
  const background = backgroundColor ?? colors.background;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: background }]}>
      <View
        style={[
          styles.frame,
          Platform.OS === 'web' && styles.webCanvas,
          { backgroundColor: Platform.OS === 'web' ? colors.surfaceAlt : background },
        ]}
      >
        <View style={[styles.content, { maxWidth, backgroundColor: background }, style]}>{children}</View>
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
