import { useEffect, useMemo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppThemeProvider, useAppTheme } from '@/hooks/use-app-theme';
import { useAppVoice } from '@/hooks/use-app-voice';
import { BootstrapProvider, useBootstrap } from '@/hooks/use-bootstrap';
import { useConnectivitySync } from '@/hooks/use-connectivity-sync';
import { PreferencesProvider, usePreferences } from '@/hooks/use-preferences';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(app)',
};

function BootstrapLoader() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.loader, { backgroundColor: colors.primary }]}>
      <ActivityIndicator color={colors.onPrimary} size="large" />
    </View>
  );
}

function RootNavigator() {
  const { ready: sessionReady, isLoggedIn, hasOnboarded } = useBootstrap();
  // Display settings load before the splash hides, so the app never flashes
  // the wrong colors or text size.
  const { ready: prefsReady } = usePreferences();
  const ready = sessionReady && prefsReady;

  // Watches for the device coming back online and syncs any locally-saved
  // conversations to the backend when it does (see the hook for details).
  useConnectivitySync();
  // Settings → Voice (Man / Woman / Automatic) for everything read aloud.
  useAppVoice();

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return <BootstrapLoader />;
  }

  // Logged out → login/register. Logged in on a device that has never
  // finished onboarding (a brand-new sign-up, or an existing user on a new
  // or reset phone) → onboarding, once. Otherwise → the app.
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Protected guard={isLoggedIn && hasOnboarded}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={isLoggedIn && !hasOnboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      {/* Outside every guard: Register and the menu both link here. */}
      <Stack.Screen name="terms" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

/**
 * Makes everything outside our own screens follow the chosen colors too:
 * the status bar, the navigators' backgrounds and headers, and the window
 * behind the app (seen briefly during transitions and keyboard animations).
 */
function ThemedNavigation({ children }: { children: ReactNode }) {
  const { colors, isDark } = useAppTheme();

  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, isDark]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <PreferencesProvider>
        <AppThemeProvider>
          <BootstrapProvider>
            <ThemedNavigation>
              <RootNavigator />
            </ThemedNavigation>
          </BootstrapProvider>
        </AppThemeProvider>
      </PreferencesProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
