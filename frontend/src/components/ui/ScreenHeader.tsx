import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { Spacing } from '@/constants/theme';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { goBack } from '@/utils/navigation';

type Props = {
  title: string;
  /** While true, the back arrow is greyed out (e.g. something is saving). */
  backDisabled?: boolean;
  /** One 48 px button on the right (e.g. a "?" help button); empty space if none. */
  right?: ReactNode;
};

/** Back arrow and a centred title, for screens opened from Edit profile. */
export function ScreenHeader({ title, backDisabled = false, right }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.header}>
      <IconButton icon="arrow-back" label="Go back" onPress={() => goBack()} disabled={backDisabled} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.two,
      paddingTop: Spacing.two,
    },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    spacer: {
      width: 48,
    },
  });
