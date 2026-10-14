import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useLearn, useNow } from '@/learn/LearnProvider';
import { BADGES, earnedBadges } from '@/learn/progress';

/** Every badge, earned or still to earn (worked out from the finished lessons, offline). */
export default function BadgesScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { completions } = useLearn();
  const now = useNow();
  const earned = earnedBadges(completions, now);

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScreenHeader title="Badges" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.note}>
          {earned.size} of {BADGES.length} earned
        </Text>
        {BADGES.map((badge) => {
          const has = earned.has(badge.id);
          return (
            <View
              key={badge.id}
              style={[styles.badge, has && styles.badgeEarned]}
              accessible
              accessibilityLabel={`${badge.title}. ${has ? 'Earned' : 'Not yet'}. ${badge.description}`}
            >
              <Ionicons
                name={(has ? badge.icon : 'lock-closed-outline') as keyof typeof Ionicons.glyphMap}
                size={30}
                color={has ? colors.primary : colors.textMuted}
              />
              <View style={styles.text}>
                <Text style={styles.title}>{badge.title}</Text>
                <Text style={styles.description}>{badge.description}</Text>
              </View>
              <Text style={has ? styles.earned : styles.notYet}>{has ? 'Earned' : 'Not yet'}</Text>
            </View>
          );
        })}
      </ScrollView>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      gap: 10,
      padding: 16,
    },
    note: {
      fontSize: t.font(15),
      color: t.colors.textSecondary,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 64,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    badgeEarned: {
      borderWidth: 2,
      borderColor: t.colors.primary,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    description: {
      fontSize: t.font(14),
      color: t.colors.textSecondary,
    },
    earned: {
      fontSize: t.font(14),
      fontWeight: t.weight('800'),
      color: t.colors.primary,
    },
    notYet: {
      fontSize: t.font(14),
      fontWeight: t.weight('600'),
      color: t.colors.textMuted,
    },
  });
