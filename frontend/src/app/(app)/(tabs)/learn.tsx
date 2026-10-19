import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SIGN_LANGUAGE_NAMES } from '@/components/sign/SignChoices';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { TabHeader } from '@/components/ui/TabHeader';
import { MaxContentWidth } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type SignLanguage } from '@/hooks/use-preferences';
import { LOCKED } from '@/learn/content';
import { useLearn } from '@/learn/LearnProvider';
import { allLessons, coursePath, type Lesson } from '@/learn/lessons';
import { openLesson } from '@/learn/open';
import { courseProgress, type LessonState } from '@/learn/progress';
import type { LockedLevel } from '@/learn/types';
import { useTour } from '@/tutorial/TutorialProvider';
import { useTourTarget } from '@/tutorial/targets';

/** A level that can't be opened yet: say why. */
const explainLocked = () => Alert.alert('Finish previous levels first.');

const lessonWords = (lesson: Lesson) =>
  lesson.kind === 'review' ? 'All the signs of this unit' : lesson.signs.map((sign) => sign.display).join(', ');

/**
 * Learn: a short-lesson course in the sign language the person picked
 * (Settings → Sign language), and a weekly leaderboard with friends. No
 * points, streaks, hearts or badges (owner, 2026-10-17, HANDOFF.md §38).
 * Works offline except camera practice and the leaderboard.
 */
export default function LearnScreen() {
  const { prefs, setPref } = usePreferences();
  const learn = useLearn();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const course = prefs.signLanguage;
  const other: SignLanguage = course === 'fsl' ? 'asl' : 'fsl';
  const switchRef = useTourTarget('learn.switch');
  const continueRef = useTourTarget('learn.continue');
  const linksRef = useTourTarget('learn.links');
  const unitsRef = useTourTarget('learn.units');

  // Opening Learn sends finished lessons and fetches ones done on another phone.
  const { sync } = learn;
  useFocusEffect(
    useCallback(() => {
      void sync();
    }, [sync]),
  );

  const choose = (language: SignLanguage) => {
    setPref('signLanguage', language);
    setPref('signLanguageChosen', true);
  };

  const progress = prefs.signLanguageChosen ? courseProgress(course, learn.completions) : null;
  // The next lesson, right at the top, so nobody has to scroll (or swipe) past everything to start.
  const nextLesson = progress?.next ? (allLessons(course).find((lesson) => lesson.id === progress.next) ?? null) : null;

  useTour('learn', prefs.signLanguageChosen);

  if (!progress) {
    return (
      <ScreenShell maxWidth={MaxContentWidth.app}>
        <ScrollView contentContainerStyle={styles.content}>
          <TabHeader title="Learn" />
          <Ionicons name="school-outline" size={48} color={colors.primary} />
          <Text style={styles.title} accessibilityRole="header">
            Which sign language do you want to learn?
          </Text>
          <Text style={styles.note}>You can switch any time. Each keeps its own progress.</Text>
          {(['fsl', 'asl'] as const).map((language) => (
            <Pressable
              key={language}
              style={({ pressed }) => [styles.bigChoice, pressed && styles.pressed]}
              onPress={() => choose(language)}
              accessibilityRole="button"
              accessibilityLabel={`${SIGN_LANGUAGE_NAMES[language]} (${language.toUpperCase()})`}
            >
              <Text style={styles.bigChoiceTitle}>{SIGN_LANGUAGE_NAMES[language]}</Text>
              <Text style={styles.bigChoiceText}>{language.toUpperCase()}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScreenShell>
    );
  }

  const units = coursePath(course);
  const locked = LOCKED[course];

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScrollView contentContainerStyle={styles.content}>
        <TabHeader
          title={`Learn ${course.toUpperCase()}`}
          right={
            <View ref={switchRef} collapsable={false}>
              <Pressable
                style={styles.switch}
                onPress={() => choose(other)}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${SIGN_LANGUAGE_NAMES[other]}`}
              >
                <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                <Text style={styles.switchText}>{other.toUpperCase()}</Text>
              </Pressable>
            </View>
          }
        />

        {nextLesson ? (
          <View ref={continueRef} collapsable={false}>
            <Pressable
              style={({ pressed }) => [styles.continue, pressed && styles.pressed]}
              onPress={() => openLesson(nextLesson.id)}
              accessibilityRole="button"
              accessibilityLabel={`Continue: ${nextLesson.unitTitle}, ${nextLesson.title}. ${lessonWords(nextLesson)}`}
            >
              <Ionicons name={nextLesson.kind === 'review' ? 'refresh-circle' : 'play-circle'} size={32} color={colors.onPrimary} />
              <View style={styles.lessonText}>
                <Text style={styles.continueTitle}>Continue: {nextLesson.title}</Text>
                <Text style={styles.continueWords} numberOfLines={1}>
                  {lessonWords(nextLesson)}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.links} ref={linksRef} collapsable={false}>
          <LinkButton icon="podium-outline" title="Leaderboard" onPress={() => router.navigate('/learn-leaderboard')} />
          <LinkButton icon="videocam-outline" title="Practice" onPress={() => router.navigate('/learn-practice')} />
          <LinkButton icon="information-circle-outline" title="Credits" onPress={() => router.navigate('/learn-credits')} />
        </View>

        <View style={styles.units} ref={unitsRef} collapsable={false}>
          {units.map((unit) => (
            <View key={unit.id} style={styles.unit}>
              <Text style={styles.unitTitle} accessibilityRole="header">
                Unit {unit.number} · {unit.title}
              </Text>
              {unit.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  state={progress.states.get(lesson.id) ?? 'locked'}
                  isNext={progress.next === lesson.id}
                />
              ))}
            </View>
          ))}
        </View>
        {progress.next === null ? (
          <Text style={styles.note}>
            {locked.length ? 'You finished every open lesson. Well done! More lessons are coming soon.' : 'You finished the whole course. Well done!'}
          </Text>
        ) : null}
        {locked.map((unit, i) => (
          <View key={unit.title} style={styles.unit}>
            <Text style={styles.unitTitle} accessibilityRole="header">
              Unit {units.length + i + 1} · {unit.title}
            </Text>
            {unit.levels.map((level) => (
              <LockedRow key={level.title} level={level} />
            ))}
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

function LinkButton({ icon, title, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  return (
    <Pressable style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.linkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {title}
      </Text>
    </Pressable>
  );
}

function LessonRow({ lesson, state, isNext }: { lesson: Lesson; state: LessonState; isNext: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const review = lesson.kind === 'review';
  const words = lessonWords(lesson);
  const status = state === 'done' ? 'Done' : state === 'locked' ? 'Locked' : 'Start';
  const icon = state === 'done' ? 'checkmark-circle' : state === 'locked' ? 'lock-closed-outline' : review ? 'refresh-circle' : 'play-circle';

  return (
    <Pressable
      style={({ pressed }) => [styles.lesson, isNext && styles.lessonNext, pressed && styles.pressed]}
      onPress={() => (state === 'locked' ? explainLocked() : openLesson(lesson.id))}
      accessibilityRole="button"
      accessibilityLabel={`${lesson.title}. ${words}. ${status}${state === 'done' ? '. Tap to do it again' : ''}`}
    >
      <Ionicons name={icon} size={30} color={state === 'locked' ? colors.textMuted : colors.primary} />
      <View style={styles.lessonText}>
        <Text style={styles.lessonTitle}>{lesson.title}</Text>
        <Text style={styles.lessonWords} numberOfLines={2}>
          {words}
        </Text>
      </View>
      <Text style={[styles.lessonStatus, state === 'locked' && styles.muted]}>{status}</Text>
    </Pressable>
  );
}

/** A level after the real ones: a title and an icon, always locked. */
function LockedRow({ level }: { level: LockedLevel }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.lesson, pressed && styles.pressed]}
      onPress={explainLocked}
      accessibilityRole="button"
      accessibilityLabel={`${level.title}. Locked`}
    >
      <Ionicons name={level.icon} size={30} color={colors.textMuted} />
      <View style={styles.lessonText}>
        <Text style={styles.lessonTitle}>{level.title}</Text>
      </View>
      <Text style={[styles.lessonStatus, styles.muted]}>Locked</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      gap: 14,
      padding: 16,
      paddingBottom: 40,
    },
    title: {
      fontSize: t.font(26),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    note: {
      fontSize: t.font(15),
      color: t.colors.textSecondary,
    },
    switch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
    },
    switchText: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    bigChoice: {
      gap: 4,
      padding: 18,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.surface,
    },
    bigChoiceTitle: {
      fontSize: t.font(19),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    bigChoiceText: {
      fontSize: t.font(15),
      color: t.colors.textSecondary,
    },
    pressed: {
      opacity: 0.85,
    },
    links: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    continue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 64,
      padding: 14,
      borderRadius: 16,
      backgroundColor: t.colors.primary,
    },
    continueTitle: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimary,
    },
    continueWords: {
      fontSize: t.font(14),
      color: t.colors.onPrimary,
    },
    // Three in a row, icon above the word so "Leaderboard" fits on one line;
    // with big text they go two to a row instead of squeezing.
    linkButton: {
      flexGrow: 1,
      flexBasis: t.font(10) >= 13 ? '45%' : '30%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: 60,
      paddingHorizontal: 6,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    linkText: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    units: {
      gap: 14,
    },
    unit: {
      gap: 8,
      marginTop: 6,
    },
    unitTitle: {
      fontSize: t.font(18),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    lesson: {
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
    lessonNext: {
      borderWidth: 2,
      borderColor: t.colors.primary,
    },
    lessonText: {
      flex: 1,
      gap: 2,
    },
    lessonTitle: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    lessonWords: {
      fontSize: t.font(14),
      color: t.colors.textSecondary,
    },
    lessonStatus: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    muted: {
      color: t.colors.textMuted,
    },
  });
