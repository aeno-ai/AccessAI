/**
 * Turning the camera's landmarks into the numbers the sign models were
 * trained on — a line-by-line copy of ai/app/sign/features.py (which is a
 * copy of the tester and the training notebooks). If one changes, change
 * the other: a model fed numbers it never saw is wrong without any error.
 * `scripts/sign-check.ts` proves both give the same numbers.
 *
 *   frame -> Holistic -> 69 points (x, y, present)
 *   32 evenly spaced frames -> centre on the shoulders, scale by shoulder
 *   width -> (32, 207) -> extra numbers from the model's features.json -> model
 *
 * Pure TypeScript, no React Native: also runs on the laptop for the checks.
 */

export const POSE_IDX = [0, 11, 12, 13, 14, 15, 16];
export const FACE_IDX = [61, 291, 0, 17, 13, 14, 78, 308, 82, 312, 87, 317, 70, 105, 107, 336, 334, 300, 33, 263];
export const N_HAND = 21;
export const N_POSE = POSE_IDX.length;
export const N_FACE = FACE_IDX.length;
export const N_POINTS = N_HAND * 2 + N_POSE + N_FACE; // 69
export const OFF_LHAND = 0;
export const OFF_RHAND = N_HAND;
export const OFF_POSE = N_HAND * 2;
export const OFF_FACE = OFF_POSE + N_POSE;
export const IDX_LSHOULDER = OFF_POSE + 1;
export const IDX_RSHOULDER = OFF_POSE + 2;
export const T_FRAMES = 32;
/** Same rule the extraction used to drop clips. */
export const MIN_HAND_FRACTION = 0.25;

/** One frame: 69 points × (x, y, present), flattened (length 207). */
export type Frame = Float32Array;

export const x = (frame: Frame, point: number) => frame[point * 3];
export const y = (frame: Frame, point: number) => frame[point * 3 + 1];
export const present = (frame: Frame, point: number) => frame[point * 3 + 2];

/** numpy's round-half-to-even, as `np.linspace(...).round()` does. */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** `sample_frame_indices(n_total, n_want)`: n_want evenly spaced indices. */
export function sampleFrameIndices(nTotal: number, nWant: number, start = 0, end: number | null = null): number[] {
  const stop = end === null ? nTotal : Math.trunc(Math.min(end, nTotal));
  const first = Math.trunc(Math.max(0, Math.min(start, Math.max(0, stop - 1))));
  const span = Math.max(1, stop - first);
  const out: number[] = [];
  for (let i = 0; i < nWant; i += 1) {
    const step = nWant === 1 ? 0 : (i * (span - 1)) / (nWant - 1);
    out.push(first + roundHalfEven(step));
  }
  return out;
}

/**
 * The picture shape the current models were trained on (landscape videos).
 * MediaPipe's x is a share of the picture's width and y of its height, and
 * `normalize` divides both by the shoulder width — so on a portrait phone
 * picture every up-down distance came out ~3× too small (HANDOFF.md §49).
 */
export const LEGACY_TRAINING_ASPECT = 16 / 9;

/**
 * x stretched so the frame has the proportions the model was trained with:
 * real proportions (x × width ÷ height) for a model trained that way
 * (`aspectCorrected`), else those of a 16:9 training video.
 */
export function shapeForModel(frame: Frame, aspect: number, aspectCorrected: boolean): Frame {
  const factor = aspectCorrected ? aspect : aspect / LEGACY_TRAINING_ASPECT;
  const out = Float32Array.from(frame);
  for (let p = 0; p < out.length / 3; p += 1) out[p * 3] *= factor;
  return out;
}

function median(values: number[]): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * `normalize` for one clip: (T frames) → centred on the shoulders, scaled by
 * shoulder width, with each point's `present` kept. Frames without both
 * shoulders use the clip's median centre and width (as the notebook does).
 */
export function normalize(frames: Frame[]): Frame[] {
  const T = frames.length;
  const ok: boolean[] = [];
  const widths: number[] = [];
  const centres: [number, number][] = [];
  for (const f of frames) {
    const good = present(f, IDX_LSHOULDER) > 0 && present(f, IDX_RSHOULDER) > 0;
    ok.push(good);
    const lx = x(f, IDX_LSHOULDER);
    const ly = y(f, IDX_LSHOULDER);
    const rx = x(f, IDX_RSHOULDER);
    const ry = y(f, IDX_RSHOULDER);
    widths.push(Math.hypot(lx - rx, ly - ry));
    centres.push([(lx + rx) / 2, (ly + ry) / 2]);
  }
  const okWidths = widths.filter((_, t) => ok[t]);
  let med = median(okWidths);
  if (Number.isNaN(med)) med = 0.25;
  if (med < 1e-6) med = 0.25;
  const okCentres = centres.filter((_, t) => ok[t]);
  let cmx = median(okCentres.map((c) => c[0]));
  let cmy = median(okCentres.map((c) => c[1]));
  if (Number.isNaN(cmx)) cmx = 0.5;
  if (Number.isNaN(cmy)) cmy = 0.5;

  const out: Frame[] = [];
  for (let t = 0; t < T; t += 1) {
    const f = frames[t];
    const [cx, cy] = ok[t] ? centres[t] : [cmx, cmy];
    const scale = Math.max(ok[t] ? widths[t] : med, 1e-6);
    const n = new Float32Array(N_POINTS * 3);
    for (let p = 0; p < N_POINTS; p += 1) {
      const pres = present(f, p);
      // Float32 like the notebook (xy is float32 there), then the same steps.
      n[p * 3] = Math.fround((Math.fround(x(f, p)) - Math.fround(cx)) / Math.fround(scale)) * pres;
      n[p * 3 + 1] = Math.fround((Math.fround(y(f, p)) - Math.fround(cy)) / Math.fround(scale)) * pres;
      n[p * 3 + 2] = pres;
    }
    out.push(n);
  }
  return out;
}

export type FeatureOptions = { hand?: boolean; velocity?: boolean };

/**
 * `make_features` for one normalized clip → T rows of FEAT numbers.
 * Order: base 207 | left-hand shape 42 | right-hand shape 42 | velocity 138.
 */
export function makeFeatures(clip: Frame[], { hand = false, velocity = false }: FeatureOptions = {}): Float32Array[] {
  const width = featureWidth({ hand, velocity });
  return clip.map((f, t) => {
    const row = new Float32Array(width);
    row.set(f, 0);
    let at = N_POINTS * 3;
    if (hand) {
      for (const off of [OFF_LHAND, OFF_RHAND]) {
        const pres = present(f, off);
        const wx = x(f, off);
        const wy = y(f, off);
        const palm = Math.max(Math.hypot(x(f, off + 9) - wx, y(f, off + 9) - wy), 1e-3);
        for (let i = 0; i < N_HAND; i += 1) {
          row[at++] = ((x(f, off + i) - wx) / palm) * pres;
          row[at++] = ((y(f, off + i) - wy) / palm) * pres;
        }
      }
    }
    if (velocity) {
      const prev = t > 0 ? clip[t - 1] : null;
      for (let p = 0; p < N_POINTS; p += 1) {
        if (!prev) {
          row[at++] = 0;
          row[at++] = 0;
          continue;
        }
        const both = present(f, p) * present(prev, p);
        row[at++] = (x(f, p) - x(prev, p)) * both;
        row[at++] = (y(f, p) - y(prev, p)) * both;
      }
    }
    return row;
  });
}

/** How many numbers per frame makeFeatures gives (207, 291, 345 or 429). */
export function featureWidth({ hand = false, velocity = false }: FeatureOptions = {}): number {
  return N_POINTS * 3 + (hand ? N_HAND * 2 * 2 : 0) + (velocity ? N_POINTS * 2 : 0);
}

/** Whether a frame has any hand. */
export function hasHand(frame: Frame): boolean {
  for (let p = OFF_LHAND; p < OFF_POSE; p += 1) if (present(frame, p) > 0) return true;
  return false;
}

/** `normalize_hand` for letters (registry.py): wrist-relative, scaled so the hand's size is 1. */
export function normalizeHand(frame: Frame, offset: number): Float32Array {
  const out = new Float32Array(N_HAND * 2);
  const wx = x(frame, offset);
  const wy = y(frame, offset);
  let size = 0;
  for (let i = 0; i < N_HAND; i += 1) size = Math.max(size, Math.hypot(x(frame, offset + i) - wx, y(frame, offset + i) - wy));
  const div = size > 1e-6 ? size : 1;
  for (let i = 0; i < N_HAND; i += 1) {
    out[i * 2] = (x(frame, offset + i) - wx) / div;
    out[i * 2 + 1] = (y(frame, offset + i) - wy) / div;
  }
  return out;
}

/** `build_hand21`: the held hand nearest the middle of the hold → 42 numbers, or null. */
export function buildHand21(frames: Frame[]): Float32Array | null {
  const middle = Math.floor(frames.length / 2);
  const order = frames.map((_, i) => i).sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || a - b);
  for (const i of order) {
    for (const off of [OFF_RHAND, OFF_LHAND]) {
      let all = true;
      for (let p = 0; p < N_HAND; p += 1) if (!(present(frames[i], off + p) > 0)) all = false;
      if (all) return normalizeHand(frames[i], off);
    }
  }
  return null;
}
