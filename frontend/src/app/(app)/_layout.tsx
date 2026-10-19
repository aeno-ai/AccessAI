import { useWindowDimensions } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { LayaProvider } from '@/laya/LayaProvider';
import { BigTextProvider } from '@/components/conversation/BigTextHost';
import { AppDrawerContent } from '@/components/dashboard/AppDrawerContent';
import { TermsUpdateProvider } from '@/components/legal/TermsUpdateHost';
import { SosProvider } from '@/components/sos/SosProvider';
import { AlertsProvider } from '@/hooks/use-alerts';
import { useAppTheme } from '@/hooks/use-app-theme';
import { LearnProvider } from '@/learn/LearnProvider';
import { usePushNotifications } from '@/notifications/use-push-notifications';
import { FriendsProvider } from '@/realtime/FriendsProvider';
import { TutorialProvider } from '@/tutorial/TutorialProvider';

// Above this width the hamburger opens a persistent side panel instead of a
// slide-out overlay — matches "different from phones to website, web would
// just be panels." This is the first width-based breakpoint in the app;
// everywhere else uses ScreenShell's max-width-container approach instead.
const WIDE_BREAKPOINT = 768;

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const isWide = width >= WIDE_BREAKPOINT;
  // Friends' SOS alerts and messages as phone notifications when AccessAI is closed.
  usePushNotifications();

  return (
    // Alerts (vibrate / flash / read aloud), friends' live messages and SOS
    // alerts, and the SOS dialog (including shake-to-SOS) work from any
    // screen.
    <AlertsProvider>
      <FriendsProvider>
        <SosProvider>
          {/* Learn's progress (offline first, synced when connected). */}
          <LearnProvider>
          {/* Big text: Home's card, a message held in Conversation, and Laya all open it. */}
          <BigTextProvider>
          {/* Laya, the voice assistant: its button, "Hey Laya" and Magic Tap work on every screen. */}
          <LayaProvider>
          {/* "We updated our Terms", once, when the Terms change (inside the app, so SOS still works). */}
          <TermsUpdateProvider>
          {/* The first-time tour of each main page. */}
          <TutorialProvider>
          <Drawer
            drawerContent={(props) => <AppDrawerContent {...props} />}
            // Back returns to the screen you came from (Change password →
            // Edit profile → Home), not always straight to Home.
            backBehavior="history"
            screenOptions={{
              headerShown: false,
              // Screens left behind (Conversation, a chat, Edit profile…) stay
              // as they were but stop redrawing on every friend, message or
              // SOS change until you come back — like the tabs.
              freezeOnBlur: true,
              drawerType: isWide ? 'permanent' : 'front',
              drawerPosition: 'left',
              drawerStyle: {
                width: isWide ? 300 : '82%',
                backgroundColor: colors.background,
                borderRightWidth: isWide ? 1 : 0,
                borderRightColor: colors.border,
              },
              overlayColor: colors.overlay,
            }}
          >
            <Drawer.Screen name="(tabs)" options={{ drawerLabel: 'Home' }} />
            <Drawer.Screen name="conversation" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="profile" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="change-email" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="change-password" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="emergency-contacts" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="chat/[friendId]" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="laya-guide" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="learn-lesson" options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
            <Drawer.Screen name="learn-leaderboard" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="learn-practice" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="learn-credits" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="sign-camera" options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }} />
          </Drawer>
          </TutorialProvider>
          </TermsUpdateProvider>
          </LayaProvider>
          </BigTextProvider>
          </LearnProvider>
        </SosProvider>
      </FriendsProvider>
    </AlertsProvider>
  );
}
