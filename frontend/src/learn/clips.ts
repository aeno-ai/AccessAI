// Made by scripts/build-sign-clips.js from the clip files in assets/signs/.
// It runs by itself whenever the app's bundler starts — don't edit this file;
// add or replace the clips instead.
import type { Course } from './types';

/** Recorded clips by course and file name (without ".mp4"). A missing one isn't recorded yet. */
export const CLIPS: Record<Course, Record<string, number>> = {
  fsl: {},
  asl: {},
};
