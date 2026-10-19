/**
 * Where each sign starts and ends in the live stream of landmarks — a copy
 * of ai/app/sign/segmenter.py (the tester's AUTO mode), so signing needs no
 * buttons. On the phone every frame arrives (no 2-second pieces), so there
 * are no gaps to bridge. `scripts/sign-check.ts` proves both cut the same.
 */
import {
  IDX_LSHOULDER,
  IDX_RSHOULDER,
  N_HAND,
  OFF_LHAND,
  OFF_RHAND,
  present,
  x,
  y,
  type Frame,
} from './features';

export const SIGN_ZONE = 1.1; // signing line = shoulders + 1.1 shoulder widths (about waist)
export const AUTO_START_FRAMES = 3; // a hand above the line this many frames in a row = sign starts
export const AUTO_END_GAP = 0.4; // hands below the line / out of view this long (s) = sign ended
export const AUTO_MIN_SIGN = 0.3; // shorter than this (s) = accidental movement, ignored
export const AUTO_MAX_SIGN = 4.0; // longer than this (s) = cut off and read anyway
const BUFFER_FRAMES = 600; // ~20 s at 30 fps

export type Phase = 'WAIT' | 'SIGN' | 'TAIL';

export interface Segmenter {
  readonly phase: Phase;
  /** Feed one frame (t in seconds). Returns the frames of a finished sign or letter. */
  update(t: number, frame: Frame, aspect: number, fixedSeconds: number | null): Frame[] | null;
  /** Signing stopped: whatever is still waiting, with the frames there are. */
  flush(): Frame[][];
  reset(): void;
}

/** Words: a sign is happening while a hand is above the signing line. */
export class AutoSegmenter implements Segmenter {
  private buf: { t: number; frame: Frame }[] = [];
  /** Last seen (centre y, width) of the shoulders, frame-height units. */
  shoulders: [number, number] | null = null;
  private state: 'WAIT' | 'SIGN' = 'WAIT';
  private run = 0;
  /** Whether a hand is above the line in the latest frame. */
  active = false;
  private needRest = false;
  private tRun = 0;
  private tStart = 0;
  private tLast = 0;
  private pending: [number, number][] = [];

  get phase(): Phase {
    if (this.state === 'SIGN') return 'SIGN';
    return this.pending.length ? 'TAIL' : 'WAIT';
  }

  reset(): void {
    this.buf = [];
    this.state = 'WAIT';
    this.run = 0;
    this.active = false;
    this.needRest = false;
    this.pending = [];
  }

  /** The signing line's height (frame units), for the testing view; null until shoulders are seen. */
  get lineY(): number | null {
    return this.shoulders ? this.shoulders[0] + SIGN_ZONE * this.shoulders[1] : null;
  }

  private handsUp(frame: Frame, aspect: number): boolean {
    if (present(frame, IDX_LSHOULDER) > 0 && present(frame, IDX_RSHOULDER) > 0) {
      // x is scaled by the frame's aspect ratio so the line sits at the
      // same body height whatever the camera's shape.
      const width = Math.hypot(
        (x(frame, IDX_RSHOULDER) - x(frame, IDX_LSHOULDER)) * aspect,
        y(frame, IDX_RSHOULDER) - y(frame, IDX_LSHOULDER),
      );
      if (width > 1e-3) this.shoulders = [(y(frame, IDX_LSHOULDER) + y(frame, IDX_RSHOULDER)) / 2, width];
    }
    if (!this.shoulders) return false;
    const [cy, width] = this.shoulders;
    for (const wrist of [OFF_LHAND, OFF_RHAND]) {
      if (present(frame, wrist) > 0 && y(frame, wrist) - cy < SIGN_ZONE * width) return true;
    }
    return false;
  }

  private framesBetween(lo: number, hi: number): Frame[] {
    return this.buf.filter((entry) => lo <= entry.t && entry.t <= hi).map((entry) => entry.frame);
  }

  update(t: number, frame: Frame, aspect: number, fixedSeconds: number | null): Frame[] | null {
    this.buf.push({ t, frame });
    if (this.buf.length > BUFFER_FRAMES) this.buf.shift();
    const up = this.handsUp(frame, aspect);
    this.active = up;

    let out: Frame[] | null = null;
    if (this.pending.length && t >= this.pending[0][1]) {
      const [lo, hi] = this.pending.shift()!;
      const frames = this.framesBetween(lo, hi);
      if (frames.length) out = frames;
    }

    if (this.state === 'WAIT') {
      if (this.needRest) {
        // After a cut-off sign, wait for hands down.
        if (!up) this.needRest = false;
      } else if (up) {
        if (this.run === 0) this.tRun = t;
        this.run += 1;
        if (this.run >= AUTO_START_FRAMES) {
          this.state = 'SIGN';
          this.tStart = this.tRun;
          this.tLast = t;
        }
      } else {
        this.run = 0;
      }
    } else {
      if (up) this.tLast = t;
      const tooLong = t - this.tStart >= AUTO_MAX_SIGN;
      const ended = !up && t - this.tLast >= AUTO_END_GAP;
      if (ended || tooLong) {
        const tEnd = tooLong ? t : this.tLast;
        this.state = 'WAIT';
        this.run = 0;
        this.needRest = tooLong;
        const length = tEnd - this.tStart;
        if (length >= AUTO_MIN_SIGN) {
          const pad = fixedSeconds ? Math.max(0.3, (fixedSeconds - length) / 2) : 0.15;
          this.pending.push([this.tStart - pad, tEnd + pad]);
        }
      }
    }
    return out;
  }

  flush(): Frame[][] {
    const clips: Frame[][] = [];
    if (this.state === 'SIGN' && this.tLast - this.tStart >= AUTO_MIN_SIGN) {
      this.pending.push([this.tStart - 0.15, this.tLast + 0.15]);
      this.state = 'WAIT';
    }
    for (const [lo, hi] of this.pending) {
      const frames = this.framesBetween(lo, hi);
      if (frames.length) clips.push(frames);
    }
    this.pending = [];
    return clips;
  }
}

export const HOLD_SECONDS = 0.4; // a handshape held this long (s) = one letter
export const HOLD_SHAPE = 0.12; // how much the handshape may change and still be "held" (hand sizes)
export const HOLD_MOVE = 0.25; // how far the wrist may drift and still be "held" (hand sizes)

type HandRef = { shape: Float32Array; wristX: number; wristY: number; size: number };

/** Letters: a letter is a handshape held still for HOLD_SECONDS. */
export class HoldSegmenter implements Segmenter {
  private held: Frame[] = [];
  private tHold = 0;
  private ref: HandRef | null = null;
  private read = false;

  get phase(): Phase {
    return this.held.length && !this.read ? 'SIGN' : 'WAIT';
  }

  reset(): void {
    this.held = [];
    this.ref = null;
    this.read = false;
  }

  private static hand(frame: Frame): HandRef | null {
    for (const off of [OFF_RHAND, OFF_LHAND]) {
      let all = true;
      for (let p = 0; p < N_HAND; p += 1) if (!(present(frame, off + p) > 0)) all = false;
      if (!all) continue;
      const wx = x(frame, off);
      const wy = y(frame, off);
      let size = 0;
      for (let p = 0; p < N_HAND; p += 1) size = Math.max(size, Math.hypot(x(frame, off + p) - wx, y(frame, off + p) - wy));
      size = Math.max(size, 1e-6);
      const shape = new Float32Array(N_HAND * 2);
      for (let p = 0; p < N_HAND; p += 1) {
        shape[p * 2] = (x(frame, off + p) - wx) / size;
        shape[p * 2 + 1] = (y(frame, off + p) - wy) / size;
      }
      return { shape, wristX: wx, wristY: wy, size };
    }
    return null;
  }

  update(t: number, frame: Frame): Frame[] | null {
    const hand = HoldSegmenter.hand(frame);
    if (!hand) {
      this.reset(); // hand gone: whatever comes next is a new letter
      return null;
    }
    let changed = Infinity;
    let moved = Infinity;
    if (this.ref) {
      changed = 0;
      for (let p = 0; p < N_HAND; p += 1) {
        const d = Math.hypot(hand.shape[p * 2] - this.ref.shape[p * 2], hand.shape[p * 2 + 1] - this.ref.shape[p * 2 + 1]);
        changed = Math.max(changed, d);
      }
      moved = Math.hypot(hand.wristX - this.ref.wristX, hand.wristY - this.ref.wristY) / this.ref.size;
    }
    if (!this.ref || changed > HOLD_SHAPE || moved > HOLD_MOVE) {
      this.held = [frame];
      this.tHold = t;
      this.ref = hand;
      this.read = false;
      return null;
    }
    this.held.push(frame);
    if (!this.read && t - this.tHold >= HOLD_SECONDS) {
      this.read = true;
      return [...this.held];
    }
    return null;
  }

  flush(): Frame[][] {
    return [];
  }
}

export type Verdict = 'accept' | 'unsure' | 'reject';

/** `judge`: accept / unsure / reject from the best guess's probability. */
export function judge(best: number, minConfidence: number): Verdict {
  if (best >= minConfidence) return 'accept';
  return best >= minConfidence / 2 ? 'unsure' : 'reject';
}
