import type { Ionicons } from '@expo/vector-icons';

/** The two courses: the same choice as the sign language in Settings. */
export type Course = 'fsl' | 'asl';

/** A sign as written in content.ts. */
export type SignContent = {
  /** Exactly what the sign reader answers (its label), e.g. "GOOD AFTERNOON" or "help". */
  label: string;
  /** What people see, e.g. "Good afternoon". */
  display: string;
  /** Read right every time in testing: tried with the camera first. */
  easy: boolean;
  /** The recorded clip's file name in assets/signs/<fsl|asl>/, without ".mp4", e.g. "good-afternoon". */
  clip: string;
  /**
   * How to make the sign, one short step at a time — spoken to blind and
   * low-vision learners. Never names the word (a quiz reads the steps out).
   */
  steps: string[];
};

/** A recorded clip bundled with the app (what require() gives for a video file). */
export type ClipSource = number;

/** A sign as the app uses it: with its clip, or null while it isn't recorded yet. */
export type Sign = SignContent & { video: ClipSource | null };

export type UnitContent = { id: string; title: string; signs: SignContent[] };

export type Unit = { id: string; title: string; signs: Sign[] };

/** A level shown after the real ones: a title and an icon, always locked, nothing inside. */
export type LockedLevel = { title: string; icon: keyof typeof Ionicons.glyphMap };

export type LockedUnit = { title: string; levels: LockedLevel[] };

/** One finished lesson, as saved on the phone and copied to the account. */
export type Completion = {
  /** Made by the phone, so sending it twice saves it once. */
  clientId: string;
  course: Course;
  lessonId: string;
  xp: number;
  /** Wrong quiz answers (0 = perfect). */
  mistakes: number;
  /** Signs done right in front of the camera. */
  cameraPassed: number;
  completedAt: number;
};

/** Hearts: 5 at most, one back every 30 minutes. */
export type Hearts = { count: number; updatedAt: number };

export type DailyGoal = 10 | 20 | 30 | 50;
