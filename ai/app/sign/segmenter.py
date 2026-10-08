"""Finding where each sign starts and ends in a continuous stream — the
tester's AUTO mode, so signing needs no buttons.

AutoSegmenter and judge() are copied from AccessAI-tester/tester.py. Two
small additions for the phone, which sends video in ~2-second pieces with
short gaps between them:
  * bridge_gap(): a sign still going when one piece ends isn't cut off by
    the gap before the next piece;
  * flush(): when signing stops, a sign still waiting for its padding is
    read with the frames there are.
"""
from collections import deque

import numpy as np

from .features import IDX_LSHOULDER, IDX_RSHOULDER, OFF_LHAND, OFF_RHAND

SIGN_ZONE = 1.1         # signing line = shoulders + 1.1 shoulder widths (about waist)
AUTO_START_FRAMES = 3   # a hand above the line this many frames in a row = sign starts
AUTO_END_GAP = 0.4      # hands below the line / out of view this long (s) = sign ended
AUTO_MIN_SIGN = 0.3     # shorter than this (s) = accidental movement, ignored
AUTO_MAX_SIGN = 4.0     # longer than this (s) = cut off and read anyway
AUTO_MIN_CONF = 0.50    # below this it's "not sure" (the app's Loose/Normal/Strict changes it)


class AutoSegmenter:
    """Watches the landmark stream and cuts out one clip per sign.

    Rule: a sign is happening while a hand is above the signing line (about
    waist height, measured from the shoulders). It ends when the hands drop
    below the line or leave the frame for AUTO_END_GAP seconds.

    The clip given to the model is padded to look like its training clips:
    FSL-105 clips are 4 s with resting hands before and after, so the sign is
    centred in a ~4 s window. WLASL clips are trimmed, so only a little
    padding is added. Finished signs wait in a queue for their padding while
    detection keeps running, so signing the next word right away is fine.
    """

    def __init__(self):
        self.buf = deque(maxlen=600)   # ~20 s of (time, frame) at 30 fps
        self.shoulders = None          # last seen (centre y, width), frame-height units
        self.reset()

    def reset(self):
        self.buf.clear()
        self.state, self.run, self.active = "WAIT", 0, False
        self.need_rest = False
        self.t_run = self.t_start = self.t_last = None
        self.pending = []              # finished signs waiting for their padding
        self.last_window = None

    @property
    def phase(self):
        """SIGN while signing, TAIL while a sign is being read, else WAIT."""
        if self.state == "SIGN":
            return "SIGN"
        return "TAIL" if self.pending else "WAIT"

    def _hands_up(self, packed, aspect):
        ls, rs = packed[IDX_LSHOULDER], packed[IDX_RSHOULDER]
        if ls[2] > 0 and rs[2] > 0:
            # x is scaled by the frame's aspect ratio so the line sits at the
            # same body height whatever the camera's shape
            width = float(np.hypot((rs[0] - ls[0]) * aspect, rs[1] - ls[1]))
            if width > 1e-3:
                self.shoulders = ((ls[1] + rs[1]) / 2.0, width)
        if self.shoulders is None:
            return False
        cy, width = self.shoulders
        for wrist in (packed[OFF_LHAND], packed[OFF_RHAND]):
            if wrist[2] > 0 and wrist[1] - cy < SIGN_ZONE * width:
                return True
        return False

    def bridge_gap(self, t):
        """A new video piece starts at time t. Recording paused between pieces
        (no frames, not "hands down"), so an ongoing sign carries on."""
        if self.state == "SIGN" and self.t_last is not None:
            self.t_last = max(self.t_last, t)

    def update(self, t, packed, aspect, fixed_seconds):
        """Feed one frame. Returns the frames of a finished sign, else None."""
        self.buf.append((t, packed))
        self.active = up = self._hands_up(packed, aspect)

        out = None
        if self.pending and t >= self.pending[0][1]:
            lo, hi = self.pending.pop(0)
            frames = [p for (tt, p) in self.buf if lo <= tt <= hi]
            if frames:
                out, self.last_window = np.stack(frames), (lo, hi)

        if self.state == "WAIT":
            if self.need_rest:                 # after a cut-off sign, wait for hands down
                if not up:
                    self.need_rest = False
            elif up:
                if self.run == 0:
                    self.t_run = t
                self.run += 1
                if self.run >= AUTO_START_FRAMES:
                    self.state, self.t_start, self.t_last = "SIGN", self.t_run, t
            else:
                self.run = 0

        elif self.state == "SIGN":
            if up:
                self.t_last = t
            too_long = t - self.t_start >= AUTO_MAX_SIGN
            ended = (not up) and (t - self.t_last >= AUTO_END_GAP)
            if ended or too_long:
                t_end = t if too_long else self.t_last
                self.state, self.run, self.need_rest = "WAIT", 0, too_long
                length = t_end - self.t_start
                if length >= AUTO_MIN_SIGN:
                    pad = max(0.3, (fixed_seconds - length) / 2) if fixed_seconds else 0.15
                    self.pending.append((self.t_start - pad, t_end + pad))
        return out

    def flush(self):
        """Signing stopped: read whatever is still waiting, with the frames there are."""
        clips = []
        if self.state == "SIGN" and self.t_start is not None and self.t_last - self.t_start >= AUTO_MIN_SIGN:
            self.pending.append((self.t_start - 0.15, self.t_last + 0.15))
            self.state = "WAIT"
        for lo, hi in self.pending:
            frames = [p for (tt, p) in self.buf if lo <= tt <= hi]
            if frames:
                clips.append(np.stack(frames))
        self.pending = []
        return clips


def judge(res, min_conf):
    """Verdict on one prediction: accept / unsure / reject / error."""
    if "top" not in res:
        return "error"
    p = res["top"][0][1]
    if p >= min_conf:
        return "accept"
    return "unsure" if p >= min_conf / 2 else "reject"
