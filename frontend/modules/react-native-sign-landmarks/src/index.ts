import { Platform } from 'react-native';
import { NitroModules } from 'react-native-nitro-modules';
import type { CameraOutput } from 'react-native-vision-camera';
import type { SignLandmarkerFactory, SignLandmarkerOutputOptions } from './specs/SignLandmarker.nitro';

export type { SignLandmarksFrame, SignLandmarkerOutputOptions } from './specs/SignLandmarker.nitro';

// Android only for now (owner, 2026-10-18). Missing in Expo Go, on iPhone,
// and in app builds made before this module existed.
let factory: SignLandmarkerFactory | null = null;
if (Platform.OS === 'android') {
  try {
    factory = NitroModules.createHybridObject<SignLandmarkerFactory>('SignLandmarkerFactory');
  } catch {
    factory = null;
  }
}

/** Whether this phone can read signs (the native part is in this app build). */
export const signLandmarksAvailable = factory !== null;

/** A VisionCamera output that reads MediaPipe Holistic landmarks on every frame. */
export function createSignLandmarkerOutput(options: SignLandmarkerOutputOptions): CameraOutput {
  if (!factory) throw new Error('Sign language reading is not in this version of the app.');
  return factory.createSignLandmarkerOutput(options);
}
