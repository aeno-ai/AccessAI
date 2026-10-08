import { useWindowDimensions } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { AccelProvider } from '@/accel/AccelProvider';
import { AppDrawerContent } from '@/components/dashboard/AppDrawerContent';
import { SosProvider } from '@/components/sos/SosProvider';
import { AlertsProvider } from '@/hooks/use-alerts';
import { useAppTheme } from '@/hooks/use-app-theme';
import { usePushNotifications } from '@/notifications/use-push-notifications';
import { FriendsProvider } from '@/realtime/FriendsProvider';

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
          {/* Accel, the voice assistant: its button, "Hey Accel" and Magic Tap work on every screen. */}
          <AccelProvider>
          <Drawer
            drawerContent={(props) => <AppDrawerContent {...props} />}
            screenOptions={{
              headerShown: false,
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
            <Drawer.Screen name="emergency-contacts" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="chat/[friendId]" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="accel-guide" options={{ drawerItemStyle: { display: 'none' } }} />
          </Drawer>
          </AccelProvider>
        </SosProvider>
      </FriendsProvider>
    </AlertsProvider>
  );
}
