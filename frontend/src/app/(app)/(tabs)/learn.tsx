import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { colors, MaxContentWidth } from '@/constants/theme';

export default function LearnScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
});
