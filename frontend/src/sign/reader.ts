import type { CameraOutput } from 'react-native-vision-camera';
import {
  createSignLandmarkerOutput,
  signLandmarksAvailable,
  type SignLandmarksFrame,
} from 'react-native-sign-landmarks';
import {
  buildHand21,
  hasHand,
  IDX_LSHOULDER,
  IDX_RSHOULDER,
  makeFeatures,
  MIN_HAND_FRACTION,
  N_HAND,
  normalize,
  OFF_FACE,
  OFF_LHAND,
  OFF_POSE,
  OFF_RHAND,
  present,
  sampleFrameIndices,
  shapeForModel,
  T_FRAMES,
  type Frame,
} from './features';
import type { SignModel } from './models';
import { topK } from './net';
import { AutoSegmenter, HoldSegmenter, judge, type Phase, type Segmenter } from './segmenter';

/**
 * Reads signs from the camera, on the phone (HANDOFF.md §49): MediaPipe's
 * points for every frame (react-native-sign-landmarks) → where a sign starts
 * and ends (segmenter.ts) → the model (net.ts) → an event. The same steps as
 * the laptop tester the models were made with. Plain TypeScript outside
 * React; `useSignRecognition` connects it to a screen.
 */
export type SignEvent =
  | { type: 'word'; label: string; confidence: number; top5: { label: string; confidence: number }[] }
  | { type: 'unsure'; top5: { label: string; confidence: number }[] }
  | { type: 'reject'; top5: { label: string; confidence: number }[] }
  /** A tip about the camera; an empty message means "all fine again". */
  | { type: 'hint'; message: string };

/** What the testing landmark view draws: the latest points and the signing line. */
export type SignDebug = {
  frame: Frame | null;
  aspect: number;
  lineY: number | null;
  phase: Phase;
  guess: string;
  /** Frames received from the camera so far (0 = the native part sends nothing). */
  frames: number;
  /** Frames per second the camera + MediaPipe deliver (the last ~2 s). */
  fps: number;
  modelReady: boolean;
  /** The last error from the native part or the model, if any. */
  error: string;
};

// No one signing for this long: pause, to save battery.
const IDLE_PAUSE_MS = 60 * 1000;
// Camera tips are judged over this much time, and changed at most this often.
const HINT_WINDOW_MS = 2000;
const HINT_EVERY_MS = 3000;

// Left↔right pairs, for the "flip" fix: mirroring the picture swaps the
// hands, the shoulders, elbows and wrists, and the two sides of the face.
const POSE_PAIRS: [number, number][] = [
  [1, 2],
  [3, 4],
  [5, 6],
];
const FACE_PAIRS: [number, number][] = [
  [0, 1],
  [6, 7],
  [8, 9],
  [10, 11],
  [12, 17],
  [13, 16],
  [14, 15],
  [18, 19],
];

/** The same frame as if the picture were mirrored (for phones that mirror the camera). */
export function mirrored(frame: Frame): Frame {
  const out = new Float32Array(frame.length);
  const copy = (from: number, to: number) => {
    out[to * 3] = present(frame, from) > 0 ? 1 - frame[from * 3] : 0;
    out[to * 3 + 1] = frame[from * 3 + 1];
    out[to * 3 + 2] = frame[from * 3 + 2];
  };
  for (let i = 0; i < N_HAND; i += 1) {
    copy(OFF_LHAND + i, OFF_RHAND + i);
    copy(OFF_RHAND + i, OFF_LHAND + i);
  }
  const done = new Set<number>();
  for (const [a, b] of POSE_PAIRS) {
    copy(OFF_POSE + a, OFF_POSE + b);
    copy(OFF_POSE + b, OFF_POSE + a);
    done.add(OFF_POSE + a).add(OFF_POSE + b);
  }
  for (const [a, b] of FACE_PAIRS) {
    copy(OFF_FACE + a, OFF_FACE + b);
    copy(OFF_FACE + b, OFF_FACE + a);
    done.add(OFF_FACE + a).add(OFF_FACE + b);
  }
  for (let p = OFF_POSE; p < frame.length / 3; p += 1) if (!done.has(p)) copy(p, p);
  return out;
}

/**
 * One finished sign's frames → an event (the same checks as the server's
 * registry.predict). `aspect` = the camera picture's width ÷ height.
 */
export function readSign(model: SignModel, clip: Frame[], minConfidence: number, aspect: number): SignEvent {
  const shaped = clip.map((f) => shapeForModel(f, aspect, model.aspectCorrected));
  let rows: Float32Array[];
  if (model.unit === 'letters') {
    const hand = buildHand21(shaped);
    if (!hand) return { type: 'hint', message: 'Keep your whole hand in view.' };
    rows = [hand];
  } else {
    if (shaped.length < 8) return { type: 'hint', message: 'That was too short. Sign a little slower.' };
    const seq = sampleFrameIndices(shaped.length, T_FRAMES).map((i) => shaped[i]);
    if (seq.filter(hasHand).length < T_FRAMES * MIN_HAND_FRACTION) {
      return { type: 'hint', message: "Your hands weren't clear enough. Check the light and keep your hands in view." };
    }
    rows = makeFeatures(normalize(seq), model.features);
  }
  const probs = model.net.predict(rows);
  const top5 = topK(probs).map(([i, p]) => ({ label: model.labels[i], confidence: p }));
  const verdict = judge(top5[0].confidence, minConfidence);
  if (verdict === 'accept') return { type: 'word', label: top5[0].label, confidence: top5[0].confidence, top5 };
  return { type: verdict, top5 };
}

type Listeners = {
  event?: (event: SignEvent) => void;
  phase?: (phase: Phase) => void;
  paused?: (paused: boolean) => void;
};

export class SignReader {
  /** The camera output that feeds this reader; null where the phone can't read signs. */
  readonly output: CameraOutput | null;
  /** The latest points, for the testing landmark view (kept only with `debug`). */
  readonly debug: SignDebug = { frame: null, aspect: 1, lineY: null, phase: 'WAIT', guess: '', frames: 0, fps: 0, modelReady: false, error: '' };

  private active = false;
  private minConfidence = 0.5;
  private flip = false;
  private keepDebug = false;
  private model: SignModel | null = null;
  private segmenter: Segmenter = new AutoSegmenter();
  private phase: Phase = 'WAIT';
  private paused = false;
  private lastActivity = 0;
  private stats: { at: number; person: boolean; shoulders: boolean; brightness: number }[] = [];
  private hint = '';
  private hintAt = 0;
  private frameTimes: number[] = [];
  private listeners: Listeners = {};

  constructor() {
    let output: CameraOutput | null = null;
    if (signLandmarksAvailable) {
      try {
        output = createSignLandmarkerOutput({
          onLandmarks: (frame) => this.onFrame(frame),
          onError: (error) => {
            this.debug.error = String(error?.message ?? error).slice(0, 160);
            console.warn('[sign] landmarks failed:', error);
          },
        });
      } catch (error) {
        this.debug.error = `start: ${String((error as Error)?.message ?? error).slice(0, 150)}`;
        console.warn('[sign] could not start the sign reader:', error);
      }
    }
    this.output = output;
  }

  configure(options: { active: boolean; minConfidence: number; flip: boolean; debug: boolean }): void {
    if (options.active && !this.active) this.lastActivity = Date.now();
    this.active = options.active;
    this.minConfidence = options.minConfidence;
    this.flip = options.flip;
    this.keepDebug = options.debug;
  }

  listen(listeners: Listeners): () => void {
    this.listeners = listeners;
    return () => {
      if (this.listeners === listeners) this.listeners = {};
    };
  }

  /** The model to read with (words: AUTO segmenting; letters: held handshapes). */
  setModel(model: SignModel | null): void {
    this.model = model;
    this.debug.modelReady = model !== null;
    this.segmenter = model?.unit === 'letters' ? new HoldSegmenter() : new AutoSegmenter();
    this.setPhase('WAIT');
    this.resume();
  }

  resume(): void {
    this.lastActivity = Date.now();
    this.segmenter.reset();
    if (this.paused) {
      this.paused = false;
      this.listeners.paused?.(false);
    }
  }

  private setPhase(next: Phase): void {
    if (next === this.phase) return;
    this.phase = next;
    this.listeners.phase?.(next);
  }

  private onFrame(f: SignLandmarksFrame): void {
    this.debug.frames += 1;
    this.frameTimes.push(f.timestamp);
    while (this.frameTimes.length > 1 && this.frameTimes[0] < f.timestamp - 2000) this.frameTimes.shift();
    const span = f.timestamp - this.frameTimes[0];
    this.debug.fps = span > 0 ? ((this.frameTimes.length - 1) * 1000) / span : 0;
    const raw = Float32Array.from(f.points);
    const frame = this.flip ? mirrored(raw) : raw;
    // The testing view shows the points even before the model is ready.
    if (this.keepDebug) {
      this.debug.frame = frame;
      this.debug.aspect = f.width / f.height;
    }
    if (!this.active || !this.model || this.paused) return;
    const now = Date.now();
    this.updateHint(frame, f.brightness, now);

    const clip = this.segmenter.update(f.timestamp / 1000, frame, f.width / f.height, this.model.fixedSeconds);
    if (hasHand(frame) || this.segmenter.phase !== 'WAIT') this.lastActivity = now;
    this.setPhase(this.segmenter.phase);
    if (clip) {
      let event: SignEvent;
      try {
        event = readSign(this.model, clip, this.minConfidence, f.width / f.height);
      } catch (error) {
        this.debug.error = `model: ${String((error as Error)?.message ?? error).slice(0, 150)}`;
        console.warn('[sign] reading the sign failed:', error);
        return;
      }
      if (this.keepDebug && event.type !== 'hint') {
        this.debug.guess = `${event.top5[0].label} ${event.top5[0].confidence.toFixed(2)}`;
      }
      this.listeners.event?.(event);
    }
    if (this.keepDebug) {
      this.debug.frame = frame;
      this.debug.aspect = f.width / f.height;
      this.debug.lineY = this.segmenter instanceof AutoSegmenter ? this.segmenter.lineY : null;
      this.debug.phase = this.segmenter.phase;
    }
    if (now - this.lastActivity > IDLE_PAUSE_MS) {
      this.paused = true;
      this.listeners.paused?.(true);
    }
  }

  // Camera tips: too dark, no one in view, shoulders out of view.
  private updateHint(frame: Frame, brightness: number, now: number): void {
    let person = false;
    for (let i = 2; i < frame.length; i += 3) {
      if (frame[i] > 0) {
        person = true;
        break;
      }
    }
    const shoulders = present(frame, IDX_LSHOULDER) > 0 && present(frame, IDX_RSHOULDER) > 0;
    this.stats.push({ at: now, person, shoulders, brightness });
    while (this.stats.length && this.stats[0].at < now - HINT_WINDOW_MS) this.stats.shift();
    if (now - this.hintAt < HINT_EVERY_MS || this.stats.length < 10) return;
    const n = this.stats.length;
    const dark = this.stats.reduce((sum, s) => sum + s.brightness, 0) / n < 40;
    const people = this.stats.filter((s) => s.person).length / n;
    const withShoulders = this.stats.filter((s) => s.shoulders).length / n;
    const hint = dark
      ? "It's too dark. Turn on a light or face a window."
      : people < 0.3
        ? "I can't see anyone. Point the camera at the signer."
        : withShoulders < 0.5
          ? 'Step back so both shoulders are in view.'
          : '';
    if (hint === this.hint) return;
    this.hint = hint;
    this.hintAt = now;
    this.listeners.event?.({ type: 'hint', message: hint });
  }
}
