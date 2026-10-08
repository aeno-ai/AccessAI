import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

export default function LearnScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <View style={styles.container}>
        <Ionicons name="book-outline" size={40} color={colors.primary} />
        <Text style={styles.title}>Learn</Text>
        <Text style={styles.subtitle}>
          Tutorials and accessibility tips are coming soon.
        </Text>
      </View>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    title: {
      marginTop: 16,
      fontSize: t.font(22),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    subtitle: {
      marginTop: 8,
      fontSize: t.font(14),
      color: t.colors.textSecondary,
      textAlign: 'center',
      maxWidth: 320,
    },
  });
