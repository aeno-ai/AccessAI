import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

/**
 * "PWD" next to a friend's name — only when they're a PWD account and left
 * "Show that I'm a PWD to friends" on (Edit profile, HANDOFF §56). Screen
 * readers hear it in the row's own label instead.
 */
export function PwdTag() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.tag} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={styles.text} maxFontSizeMultiplier={1.3}>
        PWD
      </Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    tag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: t.colors.primaryLight,
    },
    text: {
      fontSize: t.font(11),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimaryLight,
    },
  });
