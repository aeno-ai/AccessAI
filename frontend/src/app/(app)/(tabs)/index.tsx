import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { DrawerToggleButton } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { FeatureTile } from '@/components/dashboard/FeatureTile';
import { SosBanner } from '@/components/dashboard/SosBanner';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { DASHBOARD_FEATURES } from '@/constants/dashboard';
import { useBootstrap } from '@/hooks/use-bootstrap';

function openConversation() {
  router.push('/conversation');
}

export default function HomeScreen() {
  const { role } = useBootstrap();

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <DrawerToggleButton tintColor={colors.textPrimary} />
          <View style={styles.wordmarkRow}>
            <AppLogo size={28} />
            <Text style={styles.wordmark}>PDAccessAI</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
          </View>
        </View>

        <Pressable
          style={styles.greetingCard}
          onPress={() => openConversation()}
          accessibilityRole="button"
          accessibilityLabel="Start a conversation"
        >
          <Text style={styles.greetingTitle}>Hello!</Text>
          <Text style={styles.greetingSubtitle}>
            What kind of conversation do you need help with right now?
          </Text>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>STT</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>TTS</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Sign Language Recognition</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Core AI Features</Text>
          <Text style={styles.sectionHint}>available in every conversation</Text>
        </View>
        <View style={styles.grid}>
          {DASHBOARD_FEATURES.map((feature) => (
            <FeatureTile
              key={feature.id}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </View>

        {/* SOS is for PWD accounts only (the backend refuses it for non-PWD
            too). Hidden only when the role is known to be non-PWD: if it's
            ever unknown, an emergency button shouldn't silently vanish. */}
        {role !== 'non_pwd' ? <SosBanner /> : null}

        <TouchableOpacity
          style={styles.aiBanner}
          onPress={() => openConversation()}
          accessibilityRole="button"
          accessibilityLabel="Start AI Conversation Mode"
          activeOpacity={0.85}
        >
          <View style={styles.aiBannerIcon}>
            <Ionicons name="sync-outline" size={20} color={colors.white} />
          </View>
          <View style={styles.aiBannerText}>
            <Text style={styles.aiBannerTitle}>AI Conversation Mode</Text>
            <Text style={styles.aiBannerSubtitle}>
              STT + TTS + Sign Language combined — talk both ways, seamlessly.
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: Spacing.four,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 6,
    lineHeight: 18,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  pillText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: 16,
    padding: 14,
  },
  aiBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  aiBannerText: {
    flex: 1,
    marginRight: 10,
  },
  aiBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 2,
  },
  aiBannerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 15,
  },
});
