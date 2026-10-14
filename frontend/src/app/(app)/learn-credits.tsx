import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

/** Who made the sign videos, and where Learn's signs come from. */
export default function CreditsScreen() {
  const styles = useThemedStyles(makeStyles);

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScreenHeader title="Credits" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.text}>The sign videos were recorded by the AccessAI team.</Text>

        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">
            American Sign Language (ASL)
          </Text>
          <Text style={styles.text}>
            AccessAI learned to read ASL signs from the WLASL videos (Dongxu Li and others).
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">
            Filipino Sign Language (FSL)
          </Text>
          <Text style={styles.text}>
            AccessAI learned to read FSL signs from the FSL-105 videos (Isaiah Jassen Tupal, De La Salle University).
          </Text>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      gap: 12,
      padding: 16,
    },
    card: {
      gap: 8,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    title: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    text: {
      fontSize: t.font(15),
      color: t.colors.textSecondary,
    },
  });
