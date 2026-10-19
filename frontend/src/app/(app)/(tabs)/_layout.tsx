import { useEffect } from 'react';
import { View } from 'react-native';
import { BottomTabBar, Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/use-app-theme';
import { setTabBarHeight } from '@/hooks/use-tab-bar-height';
import { useFriends } from '@/realtime/FriendsProvider';
import { setTourTarget } from '@/tutorial/targets';

/**
 * The normal tab bar, measured: the tutorial can light it up ("home.tabs"),
 * and the Laya button keeps above it.
 */
function TrackedTabBar(props: BottomTabBarProps) {
  useEffect(() => () => setTabBarHeight(0), []);
  return (
    <View
      ref={(node) => setTourTarget('home.tabs', node)}
      collapsable={false}
      onLayout={(event) => setTabBarHeight(event.nativeEvent.layout.height)}
    >
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors, font, weight } = useAppTheme();
  const { friends, requests } = useFriends();
  const unread = friends.reduce((sum, friend) => sum + friend.unread, 0);
  const waiting = requests.incoming.length;
  const friendsBadge = unread + waiting;
  // Spoken by TalkBack / VoiceOver on the tab itself.
  const friendsLabel = [
    'Friends',
    unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'}` : null,
    waiting > 0 ? `${waiting} friend request${waiting === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Tabs
      tabBar={(props) => <TrackedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // A tab you're not looking at stays as it was ("frozen") instead of
        // redrawing whenever friends, messages or SOS data change elsewhere,
        // so switching tabs stays quick. It catches up when you return.
        freezeOnBlur: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        // Labels grow with the text size setting, but less than body text so
        // five of them still fit across a phone.
        tabBarLabelStyle: { fontSize: Math.min(font(11), 14), fontWeight: weight('600') },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarBadge: friendsBadge > 0 ? friendsBadge : undefined,
          tabBarAccessibilityLabel: friendsLabel,
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="options-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
