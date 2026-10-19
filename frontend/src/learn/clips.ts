// Made by scripts/build-sign-clips.js from the clip files in assets/signs/.
// It runs by itself whenever the app's bundler starts — don't edit this file;
// add or replace the clips instead.
import type { Course } from './types';

/** Recorded clips by course and file name (without ".mp4"). A missing one isn't recorded yet. */
export const CLIPS: Record<Course, Record<string, number>> = {
  fsl: {
    "dont-know": require("../../assets/signs/fsl/dont-know.mp4"),
    "good-afternoon": require("../../assets/signs/fsl/good-afternoon.mp4"),
    "hello": require("../../assets/signs/fsl/hello.mp4"),
    "how-are-you": require("../../assets/signs/fsl/how-are-you.mp4"),
    "im-fine": require("../../assets/signs/fsl/im-fine.mp4"),
    "know": require("../../assets/signs/fsl/know.mp4"),
    "nice-to-meet-you": require("../../assets/signs/fsl/nice-to-meet-you.mp4"),
    "no": require("../../assets/signs/fsl/no.mp4"),
    "see-you-tomorrow": require("../../assets/signs/fsl/see-you-tomorrow.mp4"),
    "thank-you": require("../../assets/signs/fsl/thank-you.mp4"),
    "yes": require("../../assets/signs/fsl/yes.mp4"),
    "youre-welcome": require("../../assets/signs/fsl/youre-welcome.mp4"),
  },
  asl: {
    "again": require("../../assets/signs/asl/again.mp4"),
    "fine": require("../../assets/signs/asl/fine.mp4"),
    "help": require("../../assets/signs/asl/help.mp4"),
    "how": require("../../assets/signs/asl/how.mp4"),
    "meet": require("../../assets/signs/asl/meet.mp4"),
    "name": require("../../assets/signs/asl/name.mp4"),
    "no": require("../../assets/signs/asl/no.mp4"),
    "please": require("../../assets/signs/asl/please.mp4"),
    "sorry": require("../../assets/signs/asl/sorry.mp4"),
    "thank-you": require("../../assets/signs/asl/thank-you.mp4"),
    "understand": require("../../assets/signs/asl/understand.mp4"),
    "yes": require("../../assets/signs/asl/yes.mp4"),
  },
};
