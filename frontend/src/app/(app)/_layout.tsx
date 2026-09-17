import { useWindowDimensions } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { AppDrawerContent } from '@/components/dashboard/AppDrawerContent';
import { colors } from '@/constants/theme';

// Above this width the hamburger opens a persistent side panel instead of a
// slide-out overlay — matches "different from phones to website, web would
// just be panels." This is the first width-based breakpoint in the app;
// everywhere else uses ScreenShell's max-width-container approach instead.
const WIDE_BREAKPOINT = 768;

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: isWide ? 'permanent' : 'front',
        drawerPosition: 'left',
        drawerStyle: {
          width: isWide ? 300 : '78%',
          backgroundColor: colors.white,
          borderRightWidth: isWide ? 1 : 0,
          borderRightColor: colors.border,
        },
        overlayColor: 'rgba(20, 16, 36, 0.4)',
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ drawerLabel: 'Home' }} />
      <Drawer.Screen name="conversation" options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}
