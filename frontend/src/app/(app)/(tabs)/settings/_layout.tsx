import { Stack } from 'expo-router';
import { useAppTheme } from '@/hooks/use-app-theme';

/**
 * Settings is a short list of categories, each opening its own page — easier
 * to move around with TalkBack / VoiceOver than one very long screen. The tab
 * bar stays visible on every page.
 */
export default function SettingsLayout() {
  const { colors, font, weight } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.textPrimary, fontSize: font(17), fontWeight: weight('800') },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Settings' }} />
      <Stack.Screen name="needs" options={{ title: 'Preferences' }} />
      <Stack.Screen name="display" options={{ title: 'Display & text' }} />
      <Stack.Screen name="speech" options={{ title: 'Conversation & speech' }} />
      <Stack.Screen name="quick-replies" options={{ title: 'Quick replies' }} />
      <Stack.Screen name="alerts" options={{ title: 'Alerts' }} />
      <Stack.Screen name="sos" options={{ title: 'Emergency SOS' }} />
      <Stack.Screen name="accel" options={{ title: 'Accel, voice assistant' }} />
    </Stack>
  );
}
