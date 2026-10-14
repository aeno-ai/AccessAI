import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Plan } from '@/accel/actions';
import type { Slots } from '@/accel/catalog';
import { normalize } from '@/accel/language';
import { useAccelScreen } from '@/accel/screenContext';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ChoiceGrid } from '@/components/learn/ChoiceGrid';
import { LessonComplete } from '@/components/learn/LessonComplete';
import { MatchPairs } from '@/components/learn/MatchPairs';
import { SignCheck } from '@/components/learn/SignCheck';
import { clipPlayerInApp, SignClip } from '@/components/learn/SignClip';
import { SignSteps } from '@/components/learn/SignSteps';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useIsOnline } from '@/hooks/use-is-online';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { signReady, useSignModels } from '@/hooks/use-sign-recognition';
import { useLearn, useNow } from '@/learn/LearnProvider';
import { buildExercises, findLesson, type Exercise, type Lesson } from '@/learn/lessons';
import { heartsNow, manilaDay, streakOf, xpOn, type BadgeId } from '@/learn/progress';
import type { Completion, Sign } from '@/learn/types';
import { useDescribeSigns, useFeedback } from '@/learn/useFeedback';
import { stopMixed } from '@/utils/speechHelper';

/**
 * Playing one lesson: its exercises one by one, then what it earned.
 * Opened with `lessonId` (and `opened`, so opening it again starts fresh).
 */
export default function LessonScreen() {
  const { lessonId, opened } = useLocalSearchParams<{ lessonId: string; opened?: string }>();
  const lesson = lessonId ? findLesson(lessonId) : null;
  if (!lesson) {
    return (
      <ScreenShell maxWidth={MaxContentWidth.app}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <PrimaryButton title="Back to Learn" onPress={() => router.navigate('/learn')} />
        </View>
      </ScreenShell>
    );
  }
  return <LessonPlayer key={`${lesson.id}:${opened ?? ''}`} lesson={lesson} />;
}

type Checked = { right: boolean; answer: string } | null;

const leaveLesson = () => router.navigate('/learn');

/**
 * Chooses the lesson's exercises once the sign reader has answered (or
 * straight away offline, where camera practice can't work anyway). They're
 * fixed from then on: the player keeps the first list it gets.
 */
function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const styles = useThemedStyles(makeStyles);
  const online = useIsOnline();
  const { describe } = useDescribeSigns();
  const models = useSignModels();

  if (models === null && online) {
    return (
      <ScreenShell maxWidth={MaxContentWidth.app}>
        <View style={styles.center}>
          <Text style={styles.prompt}>Getting the lesson ready…</Text>
        </View>
      </ScreenShell>
    );
  }
  const exercises = buildExercises(lesson, {
    // The clips come with the app: no internet needed.
    video: clipPlayerInApp,
    camera: online && signReady(models, lesson.course, 'words'),
    describe,
  });
  return <LessonRun lesson={lesson} initialExercises={exercises} models={models} />;
}

function LessonRun({
  lesson,
  initialExercises,
  models,
}: {
  lesson: Lesson;
  initialExercises: Exercise[];
  models: ReturnType<typeof useSignModels>;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const say = useFeedback();
  const learn = useLearn();
  const online = useIsOnline();
  const screenReader = useScreenReader();
  const { describe, aloud } = useDescribeSigns();
  const now = useNow(15 * 1000);
  const review = lesson.kind === 'review';
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Checked>(null);
  const [mistakes, setMistakes] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState(0);
  const [cameraPassed, setCameraPassed] = useState(0);
  const [outOfHearts, setOutOfHearts] = useState(false);
  const [finished, setFinished] = useState<{ completion: Completion; newBadges: BadgeId[] } | null>(null);
  // The video showing in read-pick and match (one player for all).
  const [showing, setShowing] = useState<Sign | null>(null);
  const [tryingIntro, setTryingIntro] = useState(false);
  const [showHow, setShowHow] = useState(false);
  // Each question's heading: TalkBack / VoiceOver move there when it changes.
  const headingRef = useRef<Text>(null);

  useEffect(() => {
    if (!screenReader) return;
    const timer = setTimeout(() => {
      const node = headingRef.current && findNodeHandle(headingRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 400);
    return () => clearTimeout(timer);
  }, [index, screenReader]);

  // Leaving the lesson stops any steps still being said.
  useEffect(() => () => stopMixed(), []);

  const hearts = heartsNow(learn.hearts, now).hearts.count;
  const exercise = exercises[index] ?? null;

  const finish = useCallback(async () => {
    const result = await learn.finishLesson({ lesson, mistakes, quizQuestions, cameraPassed: Math.min(10, cameraPassed) });
    setFinished(result);
  }, [learn, lesson, mistakes, quizQuestions, cameraPassed]);

  const next = useCallback(() => {
    setSelected(null);
    setChecked(null);
    setShowing(null);
    setTryingIntro(false);
    setShowHow(false);
    if (index + 1 >= exercises.length) void finish();
    else setIndex((i) => i + 1);
  }, [exercises, index, finish]);

  // A quiz answer: right, or a mistake (a heart, except in a review).
  const grade = (right: boolean, answer: string) => {
    setChecked({ right, answer });
    setQuizQuestions((n) => n + 1);
    if (right) {
      say("That's right!");
    } else {
      setMistakes((n) => n + 1);
      say(`Not quite. The answer is ${answer}.`);
      if (!review) learn.loseHeart();
    }
  };

  const afterAnswer = () => {
    // The heart just lost was the last one: the lesson stops here.
    if (!review && heartsNow(learn.hearts, Date.now()).hearts.count <= 0) setOutOfHearts(true);
    else next();
  };

  // ---- Accel: a blind learner answers by voice. Each command does what its
  // button does. (Matching and picking a video need sight, and aren't in a
  // lesson told in words.)
  const picking = exercise?.kind === 'watch-pick' || exercise?.kind === 'read-pick' ? exercise : null;
  const choiceName = (option: Sign, i: number) => (exercise?.kind === 'read-pick' ? `video ${i + 1}` : option.display);
  const findChoice = (slots: Slots): Sign | null => {
    if (!picking) return null;
    if (slots.number) return picking.options[slots.number - 1] ?? null;
    const said = slots.messageText ? normalize(slots.messageText) : '';
    return picking.options.find((option, i) => said !== '' && normalize(choiceName(option, i)) === said) ?? null;
  };
  const stepsOf = (sign: Sign) => sign.steps.join(' ');
  const choicesText = () => (picking ? picking.options.map((option, i) => `${i + 1}, ${choiceName(option, i)}`).join('. ') : '');
  const lessonPlan = (text: string): Plan => ({ kind: 'say', text });
  useAccelScreen({
    name: 'a Learn lesson',
    describe: () => {
      if (finished) return 'The lesson is done. Say "continue" to go back to Learn.';
      if (outOfHearts || (!review && hearts <= 0 && index === 0)) return "You're out of hearts. Say go back to return to Learn.";
      const left = review ? '' : ` ${hearts} ${hearts === 1 ? 'heart' : 'hearts'} left.`;
      if (!exercise) return 'The lesson is getting ready.';
      switch (exercise.kind) {
        case 'intro':
          return `New sign: ${exercise.sign.display}. ${stepsOf(exercise.sign)} Say "continue" when you're ready.${left}`;
        case 'watch-pick':
        case 'read-pick': {
          const question =
            exercise.kind === 'read-pick'
              ? `Which video signs ${exercise.sign.display}?`
              : describe
                ? `What sign do these steps make? ${stepsOf(exercise.sign)}`
                : 'What does this sign mean?';
          const state = checked
            ? ` ${checked.right ? 'You got it right.' : `The answer was ${checked.answer}.`} Say "continue".`
            : selected
              ? ` You chose ${choiceName(exercise.options.find((o) => o.label === selected)!, exercise.options.findIndex((o) => o.label === selected))}. Say "check".`
              : ' Say "the first one", or the answer.';
          return `${question} The choices: ${choicesText()}.${state}${left}`;
        }
        case 'do-sign':
          return `Your turn: sign ${exercise.sign.display} in front of the camera. Say "hear the steps" for how, or "skip".${left}`;
        case 'match':
          return `Match each video to its word.${left}`;
      }
    },
    examples: ['the first one', 'check', 'continue', 'hear the steps', 'skip'],
    accepts: (intent, slots) => intent !== 'learn.choose' || (findChoice(slots) !== null && !checked),
    commands: {
      'learn.choose': (slots) => {
        const choice = findChoice(slots);
        if (!picking || !choice) return lessonPlan(`Say one of the choices: ${choicesText() || 'there are none here'}.`);
        if (checked) return lessonPlan('That question is done. Say "continue".');
        return {
          kind: 'do',
          run: async () => {
            setSelected(choice.label);
            if (exercise?.kind === 'read-pick') setShowing(choice);
            return { say: `${choiceName(choice, picking.options.indexOf(choice))}. Say "check" to check it.` };
          },
        };
      },
      'learn.check': () => {
        if (!picking) return lessonPlan('There is nothing to check here. Say "continue".');
        if (checked) return lessonPlan('Already checked. Say "continue".');
        if (!selected) return lessonPlan(`Choose an answer first. The choices: ${choicesText()}.`);
        const right = selected === picking.sign.label;
        const answer = picking.kind === 'read-pick' ? `video ${picking.options.indexOf(picking.sign) + 1}` : picking.sign.display;
        return {
          kind: 'do',
          run: async () => {
            grade(right, answer);
            return { say: `${right ? "That's right!" : `Not quite. The answer is ${answer}.`} Say "continue".` };
          },
        };
      },
      'learn.continue': () => {
        if (finished) return { kind: 'do', run: async () => ({ say: '', after: leaveLesson }) };
        if (picking && !checked) return lessonPlan(selected ? 'Say "check" first.' : `Choose an answer first. The choices: ${choicesText()}.`);
        return { kind: 'do', run: async () => ({ say: '', after: picking ? afterAnswer : next }) };
      },
      'learn.hear_steps': () => {
        const sign = exercise && exercise.kind !== 'match' ? exercise.sign : null;
        if (!sign || exercise?.kind === 'read-pick') return lessonPlan('This question has no steps to hear.');
        // A quiz reads the steps without the word: saying it would give the answer away.
        return lessonPlan(exercise?.kind === 'watch-pick' ? `${stepsOf(sign)} Is it ${choicesText()}?` : `${sign.display}. ${stepsOf(sign)}`);
      },
      'learn.skip': () => {
        if (exercise?.kind === 'do-sign') return { kind: 'do', run: async () => ({ say: 'Skipped.', after: next }) };
        if (exercise?.kind === 'intro' && tryingIntro) return { kind: 'do', run: async () => ({ say: 'Okay.', after: () => setTryingIntro(false) }) };
        return lessonPlan('This one can’t be skipped. Answer it, or say "go back" to leave the lesson.');
      },
    },
  });

  // Lessons (not reviews) need a heart to start.
  if (!review && hearts <= 0 && index === 0 && !finished) {
    return (
      <ScreenShell maxWidth={MaxContentWidth.app}>
        <OutOfHearts onBack={leaveLesson} />
      </ScreenShell>
    );
  }

  if (finished) {
    return (
      <ScreenShell maxWidth={MaxContentWidth.app}>
        <LessonComplete
          completion={finished.completion}
          review={review}
          quizQuestions={quizQuestions}
          newBadges={finished.newBadges}
          streak={streakOf(learn.completions, now).current}
          todayXp={xpOn(learn.completions, manilaDay(now))}
          dailyGoal={learn.dailyGoal}
          onContinue={leaveLesson}
        />
      </ScreenShell>
    );
  }

  if (outOfHearts) {
    return (
      <ScreenShell maxWidth={MaxContentWidth.app}>
        <OutOfHearts onBack={leaveLesson} midLesson />
      </ScreenShell>
    );
  }

  const confirmLeave = () =>
    Alert.alert('Leave the lesson?', "What you did in this lesson won't be saved.", [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: leaveLesson },
    ]);

  // Camera practice can't work here after all: skip the rest of it.
  const cameraUnavailable = () => {
    setExercises((current) => [...current.slice(0, index + 1), ...current.slice(index + 1).filter((e) => e.kind !== 'do-sign')]);
    if (exercise?.kind === 'do-sign') next();
    else setTryingIntro(false);
  };

  const progress = exercises.length ? index / exercises.length : 0;

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <View style={styles.top}>
        <Pressable onPress={confirmLeave} style={styles.close} accessibilityRole="button" accessibilityLabel="Leave the lesson">
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </Pressable>
        <View
          style={styles.bar}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Lesson progress"
          accessibilityValue={{ min: 0, max: exercises.length, now: index }}
        >
          <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        {review ? null : (
          <View style={styles.hearts} accessible accessibilityLabel={`${hearts} heart${hearts === 1 ? '' : 's'} left`}>
            <Ionicons name="heart" size={22} color={colors.dangerText} />
            <Text style={styles.heartsText}>{hearts}</Text>
          </View>
        )}
      </View>

      <ScrollView key={index} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!exercise ? (
          <Text style={styles.prompt}>Getting the lesson ready…</Text>
        ) : exercise.kind === 'intro' ? (
          <View style={styles.block}>
            <Text style={styles.kicker}>New sign</Text>
            <Text
              ref={headingRef}
              style={styles.word}
              accessibilityRole="header"
              accessibilityLabel={`New sign: ${exercise.sign.display}`}
            >
              {exercise.sign.display}
            </Text>
            <SignClip source={exercise.sign.video} label={`the sign for ${exercise.sign.display}`} />
            <SignSteps sign={exercise.sign} intro={`New sign: ${exercise.sign.display}.`} speakNow={aloud} />
            {tryingIntro ? (
              <SignCheck
                course={lesson.course}
                sign={exercise.sign}
                onPass={() => {
                  setCameraPassed((n) => n + 1);
                  next();
                }}
                onSkip={() => setTryingIntro(false)}
                onUnavailable={cameraUnavailable}
                skipLabel="Not now"
              />
            ) : (
              <View style={styles.actions}>
                {online && signReady(models, lesson.course, 'words') ? (
                  <Pressable
                    style={styles.secondary}
                    onPress={() => setTryingIntro(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Try ${exercise.sign.display} with the camera`}
                  >
                    <Ionicons name="videocam-outline" size={20} color={colors.primary} />
                    <Text style={styles.secondaryText}>Try it with the camera</Text>
                  </Pressable>
                ) : null}
                <PrimaryButton title="Continue" onPress={next} />
              </View>
            )}
          </View>
        ) : exercise.kind === 'watch-pick' ? (
          <View style={styles.block}>
            <Text ref={headingRef} style={styles.prompt} accessibilityRole="header">
              {describe ? 'What sign do these steps make?' : 'What does this sign mean?'}
            </Text>
            {exercise.sign.video && clipPlayerInApp ? <SignClip source={exercise.sign.video} label="a sign" /> : null}
            {describe ? (
              <SignSteps
                sign={exercise.sign}
                intro="What sign do these steps make?"
                outro={`Is it ${exercise.options.map((option) => option.display).join(', or ')}?`}
                speakNow={aloud}
              />
            ) : null}
            <ChoiceGrid
              label={describe ? 'What sign do these steps make?' : 'What does this sign mean?'}
              choices={exercise.options.map((option) => ({ key: option.label, label: option.display }))}
              selected={selected}
              onSelect={setSelected}
              answer={checked ? exercise.sign.label : null}
            />
            <AnswerBar
              checked={checked}
              canCheck={selected !== null}
              onCheck={() => grade(selected === exercise.sign.label, exercise.sign.display)}
              onContinue={afterAnswer}
            />
          </View>
        ) : exercise.kind === 'read-pick' ? (
          <View style={styles.block}>
            <Text ref={headingRef} style={styles.prompt} accessibilityRole="header">
              Which video signs “{exercise.sign.display}”?
            </Text>
            <SignClip
              source={(showing ?? exercise.options[0]).video}
              label={`video ${exercise.options.indexOf(showing ?? exercise.options[0]) + 1}`}
            />
            <ChoiceGrid
              label={`Which video signs ${exercise.sign.display}?`}
              choices={exercise.options.map((option, i) => ({ key: option.label, label: `Video ${i + 1}`, icon: 'play-circle-outline' }))}
              selected={selected}
              onSelect={(key) => {
                setSelected(key);
                setShowing(exercise.options.find((option) => option.label === key) ?? null);
              }}
              answer={checked ? exercise.sign.label : null}
            />
            <AnswerBar
              checked={checked}
              canCheck={selected !== null}
              onCheck={() =>
                grade(selected === exercise.sign.label, `video ${exercise.options.indexOf(exercise.sign) + 1}`)
              }
              onContinue={afterAnswer}
            />
          </View>
        ) : exercise.kind === 'do-sign' ? (
          <View style={styles.block}>
            <Text style={styles.kicker}>Your turn</Text>
            <Text
              ref={headingRef}
              style={styles.word}
              accessibilityRole="header"
              accessibilityLabel={`Your turn. Sign ${exercise.sign.display}`}
            >
              Sign “{exercise.sign.display}”
            </Text>
            {showHow || describe ? (
              <>
                <SignClip source={exercise.sign.video} label={`the sign for ${exercise.sign.display}`} />
                <SignSteps
                  sign={exercise.sign}
                  intro={`Your turn. Sign ${exercise.sign.display}.`}
                  speakNow={aloud && !showHow}
                />
              </>
            ) : (
              <Pressable
                style={styles.link}
                onPress={() => setShowHow(true)}
                accessibilityRole="button"
                accessibilityLabel={`Show me how to sign ${exercise.sign.display}`}
              >
                <Text style={styles.linkText}>Show me how</Text>
              </Pressable>
            )}
            <SignCheck
              course={lesson.course}
              sign={exercise.sign}
              onPass={() => {
                setCameraPassed((n) => n + 1);
                next();
              }}
              onSkip={next}
              onUnavailable={cameraUnavailable}
            />
          </View>
        ) : (
          <View style={styles.block}>
            <Text ref={headingRef} style={styles.prompt} accessibilityRole="header">
              Match each video to its word
            </Text>
            <SignClip source={(showing ?? exercise.pairs[0]).video} label="a sign" />
            <MatchPairs
              pairs={exercise.pairs}
              onShow={setShowing}
              onMistake={() => {
                setMistakes((n) => n + 1);
                say('Not a match.');
                if (!review) {
                  learn.loseHeart();
                  if (heartsNow(learn.hearts, Date.now()).hearts.count <= 1) setOutOfHearts(true);
                }
              }}
              onDone={() => {
                setQuizQuestions((n) => n + 1);
                say('All matched!');
                next();
              }}
            />
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

/** "Check", then the verdict and "Continue". */
function AnswerBar({
  checked,
  canCheck,
  onCheck,
  onContinue,
}: {
  checked: Checked;
  canCheck: boolean;
  onCheck: () => void;
  onContinue: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  if (!checked) return <PrimaryButton title="Check" onPress={onCheck} disabled={!canCheck} />;
  return (
    <View style={[styles.verdict, checked.right ? styles.verdictRight : styles.verdictWrong]}>
      <View style={styles.verdictRow} accessible accessibilityLiveRegion="polite">
        <Ionicons
          name={checked.right ? 'checkmark-circle' : 'close-circle'}
          size={26}
          color={checked.right ? colors.primary : colors.dangerText}
        />
        <Text style={styles.verdictText}>{checked.right ? "That's right!" : `Not quite. The answer: ${checked.answer}`}</Text>
      </View>
      <PrimaryButton title="Continue" onPress={onContinue} />
    </View>
  );
}

function OutOfHearts({ onBack, midLesson = false }: { onBack: () => void; midLesson?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const learn = useLearn();
  const now = useNow();
  const { nextInMs } = heartsNow(learn.hearts, now);
  const minutes = nextInMs ? Math.max(1, Math.ceil(nextInMs / 60000)) : null;
  return (
    <View style={styles.center}>
      <Ionicons name="heart-dislike-outline" size={56} color={colors.dangerText} />
      <Text style={styles.word} accessibilityRole="header">
        You&apos;re out of hearts
      </Text>
      <Text style={styles.centerText}>
        {midLesson ? 'This lesson stops here. ' : ''}
        {minutes ? `A heart comes back in ${minutes} min. ` : ''}A unit review fills them up, and camera practice is always free.
      </Text>
      <PrimaryButton title="Back to Learn" onPress={onBack} />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    close: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bar: {
      flex: 1,
      height: 14,
      borderRadius: 7,
      backgroundColor: t.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      backgroundColor: t.colors.primary,
    },
    hearts: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minWidth: 48,
    },
    heartsText: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    block: {
      gap: 14,
    },
    kicker: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.textSecondary,
      textTransform: 'uppercase',
    },
    word: {
      fontSize: t.font(26),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    prompt: {
      fontSize: t.font(21),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    how: {
      gap: 6,
      padding: 12,
      borderRadius: 12,
      backgroundColor: t.colors.surfaceAlt,
    },
    howText: {
      fontSize: t.font(16),
      color: t.colors.textPrimary,
    },
    actions: {
      gap: 10,
    },
    secondary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
    },
    secondaryText: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      alignSelf: 'flex-start',
    },
    linkText: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
      textDecorationLine: 'underline',
    },
    verdict: {
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 2,
    },
    verdictRight: {
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primaryLight,
    },
    verdictWrong: {
      borderColor: t.colors.dangerText,
      backgroundColor: t.colors.surface,
    },
    verdictRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    verdictText: {
      flex: 1,
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      padding: 24,
    },
    centerText: {
      fontSize: t.font(16),
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
  });
