import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { BADGES, XP, type BadgeId } from '@/learn/progress';
import type { Completion } from '@/learn/types';
import { useFeedback } from '@/learn/useFeedback';

type Props = {
  completion: Completion;
  review: boolean;
  quizQuestions: number;
  newBadges: BadgeId[];
  streak: number;
  todayXp: number;
  dailyGoal: number;
  onContinue: () => void;
};

/** The end of a lesson: what it earned, the streak, the daily goal, new badges. */
export function LessonComplete({ completion, review, quizQuestions, newBadges, streak, todayXp, dailyGoal, onContinue }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const say = useFeedback();
  const perfect = quizQuestions > 0 && completion.mistakes === 0;
  const badges = BADGES.filter((badge) => newBadges.includes(badge.id));
  const goalMet = todayXp >= dailyGoal;

  const lines = [
    `${review ? 'Review' : 'Lesson'} done: ${review ? XP.review : XP.lesson} XP`,
    perfect ? `No wrong answers: +${XP.perfect} XP` : null,
    completion.cameraPassed > 0
      ? `${completion.cameraPassed} sign${completion.cameraPassed === 1 ? '' : 's'} done with the camera: +${completion.cameraPassed * XP.cameraPass} XP`
      : null,
    review ? 'Your hearts are full again.' : null,
  ].filter((line): line is string => line !== null);

  useEffect(() => {
    say(
      `${review ? 'Review' : 'Lesson'} complete. You earned ${completion.xp} XP. ${streak}-day streak.` +
        (badges.length ? ` New badge: ${badges.map((b) => b.title).join(', ')}.` : ''),
    );
    // Once, when it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Ionicons name="trophy" size={64} color={colors.primary} />
      <Text style={styles.title} accessibilityRole="header">
        {review ? 'Review complete!' : 'Lesson complete!'}
      </Text>
      <Text style={styles.xp}>+{completion.xp} XP</Text>

      <View style={styles.card}>
        {lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>

      <View style={styles.row}>
        <View style={styles.stat} accessible accessibilityLabel={`${streak}-day streak`}>
          <Ionicons name="flame" size={24} color={colors.primary} />
          <Text style={styles.statText}>{streak}-day streak</Text>
        </View>
        <View
          style={styles.stat}
          accessible
          accessibilityLabel={goalMet ? 'Daily goal reached' : `Today ${todayXp} of ${dailyGoal} XP`}
        >
          <Ionicons name={goalMet ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={colors.primary} />
          <Text style={styles.statText}>{goalMet ? 'Daily goal reached' : `Today ${todayXp}/${dailyGoal} XP`}</Text>
        </View>
      </View>

      {badges.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            New badge{badges.length === 1 ? '' : 's'}
          </Text>
          {badges.map((badge) => (
            <View key={badge.id} style={styles.badge}>
              <Ionicons name={badge.icon as keyof typeof Ionicons.glyphMap} size={26} color={colors.primary} />
              <View style={styles.badgeText}>
                <Text style={styles.line}>{badge.title}</Text>
                <Text style={styles.small}>{badge.description}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.button}>
        <PrimaryButton title="Continue" onPress={onContinue} />
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      alignItems: 'center',
      gap: 14,
      padding: 20,
      paddingTop: 40,
    },
    title: {
      fontSize: t.font(26),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
      textAlign: 'center',
    },
    xp: {
      fontSize: t.font(34),
      fontWeight: t.weight('800'),
      color: t.colors.primary,
    },
    card: {
      alignSelf: 'stretch',
      gap: 8,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    cardTitle: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    line: {
      fontSize: t.font(16),
      fontWeight: t.weight('600'),
      color: t.colors.textPrimary,
    },
    small: {
      fontSize: t.font(14),
      color: t.colors.textSecondary,
    },
    row: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    stat: {
      flex: 1,
      minWidth: 140,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 14,
      backgroundColor: t.colors.primaryLight,
    },
    statText: {
      flex: 1,
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.onPrimaryLight,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    badgeText: {
      flex: 1,
    },
    button: {
      alignSelf: 'stretch',
      marginTop: 8,
    },
  });
