import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SignCheck } from '@/components/learn/SignCheck';
import { SignClip } from '@/components/learn/SignClip';
import { SignSteps } from '@/components/learn/SignSteps';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useIsOnline } from '@/hooks/use-is-online';
import { usePreferences } from '@/hooks/use-preferences';
import { signReady, useSignModels } from '@/hooks/use-sign-recognition';
import { useLearn } from '@/learn/LearnProvider';
import { allLessons } from '@/learn/lessons';
import type { Sign } from '@/learn/types';
import { useDescribeSigns } from '@/learn/useFeedback';

/**
 * Free camera practice: pick any sign of your course and make it in front
 * of the camera as often as you like. No hearts, no XP. Needs the internet.
 */
export default function PracticeScreen() {
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { completions } = useLearn();
  const online = useIsOnline();
  const models = useSignModels();
  const { aloud } = useDescribeSigns();
  const course = prefs.signLanguage;
  const [sign, setSign] = useState<Sign | null>(null);
  const [round, setRound] = useState(0);

  // Signs from finished lessons first, then the rest of the course.
  const { learned, rest } = useMemo(() => {
    const done = new Set(completions.filter((c) => c.course === course).map((c) => c.lessonId));
    const learnedSet = new Set<Sign>();
    const all: Sign[] = [];
    for (const lesson of allLessons(course)) {
      if (lesson.kind !== 'lesson') continue;
      for (const s of lesson.signs) {
        all.push(s);
        if (done.has(lesson.id)) learnedSet.add(s);
      }
    }
    return { learned: all.filter((s) => learnedSet.has(s)), rest: all.filter((s) => !learnedSet.has(s)) };
  }, [completions, course]);

  const ready = online && signReady(models, course, 'words');

  if (sign) {
    return (
      <ScreenShell maxWidth={MaxContentWidth.app}>
        <ScreenHeader title={`Practise: ${sign.display}`} />
        <ScrollView contentContainerStyle={styles.content}>
          <SignClip source={sign.video} label={`the sign for ${sign.display}`} />
          <SignSteps key={sign.label} sign={sign} intro={`Practise ${sign.display}.`} speakNow={aloud} />
          <SignCheck
            key={`${sign.label}:${round}`}
            course={course}
            sign={sign}
            onPass={() => setRound((n) => n + 1)}
            onSkip={() => setSign(null)}
            onUnavailable={() => setSign(null)}
            skipLabel="Pick another sign"
          />
        </ScrollView>
      </ScreenShell>
    );
  }

  const list = (title: string, signs: Sign[]) =>
    signs.length ? (
      <View style={styles.group}>
        <Text style={styles.groupTitle} accessibilityRole="header">
          {title}
        </Text>
        {signs.map((s) => (
          <Pressable
            key={s.label}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setSign(s)}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            accessibilityLabel={`Practise ${s.display}`}
          >
            <Ionicons name="videocam-outline" size={22} color={ready ? colors.primary : colors.textMuted} />
            <Text style={styles.rowText}>{s.display}</Text>
          </Pressable>
        ))}
      </View>
    ) : null;

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScreenHeader title="Practice" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.note}>
          {ready
            ? 'Pick a sign and make it in front of the camera. Practice is free: no hearts, as often as you like.'
            : models === null && online
              ? 'Getting ready…'
              : 'Camera practice needs the internet.'}
        </Text>
        {list('Signs you learned', learned)}
        {list(learned.length ? 'More signs' : 'All signs', rest)}
      </ScrollView>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      gap: 12,
      padding: 16,
      paddingBottom: 40,
    },
    note: {
      fontSize: t.font(15),
      color: t.colors.textSecondary,
    },
    group: {
      gap: 8,
    },
    groupTitle: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 52,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    pressed: {
      opacity: 0.85,
    },
    rowText: {
      flex: 1,
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
  });
