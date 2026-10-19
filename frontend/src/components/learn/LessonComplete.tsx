import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import type { Completion } from '@/learn/types';
import { useFeedback } from '@/learn/useFeedback';

type Props = {
  completion: Completion;
  review: boolean;
  quizQuestions: number;
  onContinue: () => void;
};

/**
 * The end of a lesson: it's done, and how it went. No points, streaks or
 * badges (owner, 2026-10-17, HANDOFF.md §38).
 */
export function LessonComplete({ completion, review, quizQuestions, onContinue }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const say = useFeedback();
  const perfect = quizQuestions > 0 && completion.mistakes === 0;

  const lines = [
    perfect ? 'No wrong answers.' : null,
    completion.cameraPassed > 0
      ? `${completion.cameraPassed} sign${completion.cameraPassed === 1 ? '' : 's'} done with the camera.`
      : null,
  ].filter((line): line is string => line !== null);

  useEffect(() => {
    say(`${review ? 'Review' : 'Lesson'} complete. ${lines.join(' ')}`.trim());
    // Once, when it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
      <Text style={styles.title} accessibilityRole="header">
        {review ? 'Review complete!' : 'Lesson complete!'}
      </Text>

      {lines.length ? (
        <View style={styles.card}>
          {lines.map((line) => (
            <Text key={line} style={styles.line}>
              {line}
            </Text>
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
    card: {
      alignSelf: 'stretch',
      gap: 8,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    line: {
      fontSize: t.font(16),
      fontWeight: t.weight('600'),
      color: t.colors.textPrimary,
    },
    button: {
      alignSelf: 'stretch',
      marginTop: 8,
    },
  });
