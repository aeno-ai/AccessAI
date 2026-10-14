import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SIGN_LANGUAGE_NAMES } from '@/components/sign/SignChoices';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type SignLanguage } from '@/hooks/use-preferences';
import { LOCKED } from '@/learn/content';
import { useLearn, useNow } from '@/learn/LearnProvider';
import { allLessons, coursePath, type Lesson } from '@/learn/lessons';
import { openLesson } from '@/learn/open';
import {
  courseProgress,
  DAILY_GOALS,
  heartsNow,
  manilaDay,
  MAX_HEARTS,
  streakOf,
  xpOn,
  type LessonState,
} from '@/learn/progress';
import type { LockedLevel } from '@/learn/types';

/** A level that can't be opened yet: say why. */
const explainLocked = () => Alert.alert('Finish previous levels first.');

const lessonWords = (lesson: Lesson) =>
  lesson.kind === 'review' ? 'All the signs of this unit' : lesson.signs.map((sign) => sign.display).join(', ');

/**
 * Learn: a short-lesson course in the sign language the person picked
 * (Settings → Sign language). XP and levels, a daily streak and goal,
 * hearts, badges and a weekly leaderboard with friends. It teaches exactly
 * the signs AccessAI's camera can read, so every sign can be practised and
 * checked. Works offline except videos, camera practice and the leaderboard.
 */
export default function LearnScreen() {
  const { prefs, setPref } = usePreferences();
  const learn = useLearn();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const now = useNow();
  const course = prefs.signLanguage;
  const other: SignLanguage = course === 'fsl' ? 'asl' : 'fsl';

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

  if (!prefs.signLanguageChosen) {
    return (
      <ScreenShell maxWidth={MaxContentWidth.app}>
        <ScrollView contentContainerStyle={styles.content}>
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

  const progress = courseProgress(course, learn.completions);
  const streak = streakOf(learn.completions, now);
  const today = xpOn(learn.completions, manilaDay(now));
  const { hearts: heartState, nextInMs } = heartsNow(learn.hearts, now);
  const hearts = heartState.count;
  const goal = learn.dailyGoal;
  const units = coursePath(course);
  const locked = LOCKED[course];
  const levelShare = progress.levelSize ? progress.intoLevel / progress.levelSize : 0;
  // The next lesson, right at the top, so nobody has to scroll (or swipe) past everything to start.
  const nextLesson = progress.next ? (allLessons(course).find((lesson) => lesson.id === progress.next) ?? null) : null;
  const canStartNext = nextLesson !== null && (hearts > 0 || nextLesson.kind === 'review');

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Learn {course.toUpperCase()}
          </Text>
          <Pressable
            style={styles.switch}
            onPress={() => choose(other)}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${SIGN_LANGUAGE_NAMES[other]}`}
          >
            <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
            <Text style={styles.switchText}>Switch to {other.toUpperCase()}</Text>
          </Pressable>
        </View>

        {nextLesson && canStartNext ? (
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
        ) : null}

        {/* Level and XP */}
        <View
          style={styles.card}
          accessible
          accessibilityLabel={`Level ${progress.level}. ${progress.xp} XP. ${progress.levelSize - progress.intoLevel} XP to level ${progress.level + 1}.`}
        >
          <View style={styles.rowBetween}>
            <Text style={styles.level}>Level {progress.level}</Text>
            <Text style={styles.small}>{progress.xp} XP</Text>
          </View>
          <Bar share={levelShare} />
          <Text style={styles.small}>
            {progress.levelSize - progress.intoLevel} XP to level {progress.level + 1}
          </Text>
        </View>

        {/* Streak, hearts, today's goal */}
        <View style={styles.stats}>
          <View style={styles.stat} accessible accessibilityLabel={`${streak.current}-day streak${streak.doneToday ? '' : '. Do a lesson today to keep it'}`}>
            <Ionicons name={streak.doneToday ? 'flame' : 'flame-outline'} size={26} color={colors.primary} />
            <Text style={styles.statValue}>{streak.current}</Text>
            <Text style={styles.statLabel}>day streak</Text>
          </View>
          <View
            style={styles.stat}
            accessible
            accessibilityLabel={`${hearts} of ${MAX_HEARTS} hearts${nextInMs ? `. Next one in ${Math.ceil(nextInMs / 60000)} minutes` : ''}`}
          >
            <Ionicons name="heart" size={26} color={colors.dangerText} />
            <Text style={styles.statValue}>{hearts}</Text>
            <Text style={styles.statLabel}>{nextInMs ? `+1 in ${Math.ceil(nextInMs / 60000)} min` : 'hearts'}</Text>
          </View>
          <View style={styles.stat} accessible accessibilityLabel={`Today ${today} of ${goal} XP${today >= goal ? '. Daily goal reached' : ''}`}>
            <Ionicons name={today >= goal ? 'checkmark-circle' : 'today-outline'} size={26} color={colors.primary} />
            <Text style={styles.statValue}>
              {Math.min(today, goal)}/{goal}
            </Text>
            <Text style={styles.statLabel}>XP today</Text>
          </View>
        </View>
        <Bar share={Math.min(1, today / goal)} label="Daily goal" />

        <View style={styles.goalRow} accessibilityRole="radiogroup" accessibilityLabel="Daily goal">
          <Text style={styles.small}>Daily goal:</Text>
          {DAILY_GOALS.map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, goal === value && styles.chipOn]}
              onPress={() => learn.setDailyGoal(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: goal === value }}
              accessibilityLabel={`${value} XP a day`}
            >
              <Text style={[styles.chipText, goal === value && styles.chipTextOn]}>{value}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.links}>
          <LinkButton icon="podium-outline" title="Leaderboard" onPress={() => router.navigate('/learn-leaderboard')} />
          <LinkButton icon="ribbon-outline" title="Badges" onPress={() => router.navigate('/learn-badges')} />
          <LinkButton icon="videocam-outline" title="Practice" onPress={() => router.navigate('/learn-practice')} />
          <LinkButton icon="information-circle-outline" title="Credits" onPress={() => router.navigate('/learn-credits')} />
        </View>

        <Text style={styles.note}>You learn the signs AccessAI can read with the camera, so you can practise each one.</Text>

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
                noHearts={hearts <= 0}
              />
            ))}
          </View>
        ))}
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

function Bar({ share, label }: { share: number; label?: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View
      style={styles.bar}
      accessible={Boolean(label)}
      accessibilityRole={label ? 'progressbar' : undefined}
      accessibilityLabel={label}
      accessibilityValue={label ? { min: 0, max: 100, now: Math.round(share * 100) } : undefined}
    >
      <View style={[styles.barFill, { width: `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%` }]} />
    </View>
  );
}

function LinkButton({ icon, title, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  return (
    <Pressable style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.linkText}>{title}</Text>
    </Pressable>
  );
}

function LessonRow({ lesson, state, isNext, noHearts }: { lesson: Lesson; state: LessonState; isNext: boolean; noHearts: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const review = lesson.kind === 'review';
  // Out of hearts: only reviews (they fill hearts back up) can be started.
  const blocked = noHearts && !review && state !== 'locked';
  const words = lessonWords(lesson);
  const status = state === 'done' ? 'Done' : state === 'locked' ? 'Locked' : noHearts && !review ? 'No hearts left' : 'Start';
  const icon = state === 'done' ? 'checkmark-circle' : state === 'locked' ? 'lock-closed-outline' : review ? 'refresh-circle' : 'play-circle';

  return (
    <Pressable
      style={({ pressed }) => [styles.lesson, isNext && styles.lessonNext, pressed && !blocked && styles.pressed]}
      onPress={() => (state === 'locked' ? explainLocked() : openLesson(lesson.id))}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked }}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
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
    card: {
      gap: 8,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    level: {
      fontSize: t.font(20),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    small: {
      fontSize: t.font(14),
      color: t.colors.textSecondary,
    },
    bar: {
      height: 12,
      borderRadius: 6,
      backgroundColor: t.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      backgroundColor: t.colors.primary,
    },
    stats: {
      flexDirection: 'row',
      gap: 10,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: t.colors.primaryLight,
    },
    statValue: {
      fontSize: t.font(20),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimaryLight,
    },
    statLabel: {
      fontSize: t.font(12),
      fontWeight: t.weight('600'),
      color: t.colors.onPrimaryLight,
      textAlign: 'center',
    },
    goalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      minWidth: 48,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: t.colors.inputBorder,
    },
    chipOn: {
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primary,
    },
    chipText: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    chipTextOn: {
      color: t.colors.onPrimary,
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
    linkButton: {
      flexGrow: 1,
      flexBasis: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 52,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    linkText: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
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
