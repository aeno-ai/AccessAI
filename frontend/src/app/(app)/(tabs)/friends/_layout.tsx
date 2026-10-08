import { Stack } from 'expo-router';
import { useAppTheme } from '@/hooks/use-app-theme';

/** Friends list, adding a friend, and friend requests. Chats open on their own screen. */
export default function FriendsLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Friends' }} />
      <Stack.Screen name="add" options={{ title: 'Add a friend' }} />
      <Stack.Screen name="requests" options={{ title: 'Friend requests' }} />
    </Stack>
  );
}
