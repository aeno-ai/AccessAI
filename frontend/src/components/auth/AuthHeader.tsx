import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** One short line under the title. Wrap a part in <AuthHeader.Bold> to stress it. */
  children?: ReactNode;
};

/** The round icon, title and one-line explanation at the top of each account page. */
export function AuthHeader({ icon, title, children }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.header}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {children ? <Text style={styles.subtitle}>{children}</Text> : null}
    </View>
  );
}

function Bold({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.bold}>{children}</Text>;
}
AuthHeader.Bold = Bold;

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      alignItems: 'center',
      marginBottom: 28,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      marginTop: 16,
      fontSize: t.font(26),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      color: t.colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
    },
    bold: {
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
  });
