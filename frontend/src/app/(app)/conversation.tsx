import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { DASHBOARD_FEATURES, type ConversationMode } from '@/constants/dashboard';

function modeLabel(mode: string | undefined): string {
  if (!mode) {
    return 'the full combined conversation experience';
  }
  const feature = DASHBOARD_FEATURES.find((item) => item.id === (mode as ConversationMode));
  return feature ? feature.title : mode;
}

/**
 * Every dashboard entry point (each of the 4 feature tiles, plus the
 * flagship AI Conversation Mode banner) leads here — there's one real
 * conversation screen, not four separate isolated ones. STT/TTS/sign
 * language logic itself isn't built yet (this pass is scoped to the
 * dashboard UI), so this is intentionally a lightweight placeholder for now.
 */
export default function ConversationScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  return (
    <ScreenShell maxWidth={MaxContentWidth.auth}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.primary} />
        <Text style={styles.title}>Conversation mode — coming soon</Text>
        <Text style={styles.subtitle}>
          Starting with {modeLabel(mode)}. Speech, sign language, and text-to-speech will be
          usable together in this one screen — offline, except for the full AI mode.
        </Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
