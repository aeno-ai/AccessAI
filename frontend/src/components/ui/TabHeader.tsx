import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DrawerToggleButton } from 'expo-router/drawer';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useTourTarget } from '@/tutorial/targets';

type TabHeaderProps = {
  /** The page's name, read as a heading by TalkBack / VoiceOver. */
  title: string;
  /** Shown instead of the title text (Home's logo and wordmark); `title` is still what screen readers hear. */
  titleContent?: ReactNode;
  /** One action on the right (Add friend, New, Switch to ASL…). */
  right?: ReactNode;
  /** The tutorial's id for the ☰ button, on pages whose tour explains it. */
  menuTarget?: string;
};

/**
 * The same top bar on all five tabs (owner, 2026-10-17, HANDOFF.md §36):
 * the ☰ "Open menu" button first — TalkBack takes over the edge swipe, so
 * a real button is the only reliable way into the menu — then the page's
 * name as a heading, then the page's own action.
 */
export function TabHeader({ title, titleContent, right, menuTarget }: TabHeaderProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const menuRef = useTourTarget(menuTarget ?? '');
  return (
    <View style={styles.header}>
      <View style={styles.side} ref={menuTarget ? menuRef : undefined} collapsable={false}>
        <DrawerToggleButton tintColor={colors.textPrimary} accessibilityLabel="Open menu" />
      </View>
      <View style={styles.titleWrap} accessible accessibilityRole="header" accessibilityLabel={title}>
        {titleContent ?? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 56,
    },
    side: {
      minWidth: 48,
      minHeight: 48,
      justifyContent: 'center',
    },
    right: {
      alignItems: 'flex-end',
    },
    titleWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    title: {
      fontSize: t.font(22),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
  });
