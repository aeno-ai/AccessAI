import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BootstrapProvider, useBootstrap } from '@/hooks/use-bootstrap';
import { useConnectivitySync } from '@/hooks/use-connectivity-sync';
import { colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(app)',
};

function BootstrapLoader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.white} size="large" />
    </View>
  );
}

function RootNavigator() {
  const { ready, isLoggedIn, hasOnboarded } = useBootstrap();

  // Watches for the device coming back online and syncs any locally-saved
  // conversations to the backend when it does (see the hook for details).
  useConnectivitySync();

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
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <BootstrapProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </BootstrapProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loader: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
