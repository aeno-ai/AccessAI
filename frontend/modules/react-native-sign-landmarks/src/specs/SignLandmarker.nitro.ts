import type { HybridObject } from 'react-native-nitro-modules';
import type { CameraOutput } from 'react-native-vision-camera';

/**
 * One camera frame read by MediaPipe Holistic on the phone (HANDOFF.md §49).
 * `points` is 69 × (x, y, present) = 207 numbers, in exactly the order of
 * ai/app/sign/features.py `pack()`: left hand 21, right hand 21, pose 7
 * (POSE_IDX), face 20 (FACE_IDX). x and y are 0–1 of the (upright) frame.
 */
export interface SignLandmarksFrame {
  points: number[];
  /** The upright frame's size, for its aspect ratio. */
  width: number;
  height: number;
  /** Average brightness 0–255 (for "it's too dark"). */
  brightness: number;
  /** Camera time of the frame, in milliseconds. */
  timestamp: number;
}

export interface SignLandmarkerOutputOptions {
  /** Every frame MediaPipe read (frames are skipped while it's busy). */
  onLandmarks: (frame: SignLandmarksFrame) => void;
  onError: (error: Error) => void;
}

export interface SignLandmarkerFactory extends HybridObject<{ android: 'kotlin' }> {
  /**
   * A camera output that runs MediaPipe Holistic on every frame, on the
   * phone. Frames are never stored or sent anywhere.
   */
  createSignLandmarkerOutput(options: SignLandmarkerOutputOptions): CameraOutput;
}
