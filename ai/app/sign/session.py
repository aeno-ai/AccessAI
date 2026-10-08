"""One person signing: their stream of video pieces → words.

The phone records ~2-second video pieces back to back and sends each one.
A session keeps what must carry over from piece to piece: MediaPipe's
tracking, and the AUTO-mode segmenter that decides where each sign starts
and ends. Video is read straight from memory into a temporary file, used
and deleted — nothing is kept.
"""
import os
import secrets
import tempfile
import threading
import time

import numpy as np

from .features import IDX_LSHOULDER, IDX_RSHOULDER, OFF_LHAND, OFF_POSE, new_holistic, pack
from .segmenter import AutoSegmenter, judge

IDLE_SECONDS = 120          # a session nobody sends to for 2 minutes is closed
MAX_SESSIONS = 4            # MediaPipe is heavy; a laptop handles a few at once
MAX_FPS = float(os.environ.get("SIGN_MAX_FPS", "30"))  # lower (e.g. 15) on a slow computer


class SessionGone(Exception):
    """No such session (expired, or someone else's)."""


class SignSession:
    def __init__(self, owner, model, min_confidence, flip=False):
        self.id = secrets.token_hex(16)
        self.owner = owner
        self.model = model
        self.min_confidence = min_confidence
        self.flip = flip
        self.holistic = new_holistic()
        self.segmenter = AutoSegmenter()
        self.lock = threading.Lock()     # pieces are read one at a time, in order
        self.last_used = time.monotonic()

    def close(self):
        try:
            self.holistic.close()
        except Exception:  # noqa: BLE001
            pass

    def _event_for(self, clip):
        res = self.model.predict(clip)
        verdict = judge(res, self.min_confidence)
        if verdict == "error":
            return {"type": "hint", "message": res["error"]}
        top5 = [{"label": self.model.labels[i], "confidence": round(p, 3)} for i, p in res["top"]]
        if verdict == "accept":
            return {"type": "word", "label": top5[0]["label"], "confidence": top5[0]["confidence"], "top5": top5}
        if verdict == "unsure":
            return {"type": "unsure", "top5": top5}
        return {"type": "reject", "top5": top5}

    def process(self, video_path, chunk_start_ms, final=False):
        """Reads one video piece. Returns {events, phase, frames}."""
        import cv2  # slow to import; only sign language needs it

        self.last_used = time.monotonic()
        events = []
        frames_read = frames_with_person = frames_with_shoulders = frames_with_hands = 0
        brightness = []
        t0 = chunk_start_ms / 1000.0
        last_t = None
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        index = 0
        self.segmenter.bridge_gap(t0)
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                position_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                t = t0 + (position_ms / 1000.0 if position_ms > 0 else index / fps)
                index += 1
                # Too many frames for this computer to keep up: skip some.
                if last_t is not None and t - last_t < 1.0 / MAX_FPS - 1e-3:
                    continue
                last_t = t
                frames_read += 1
                # The models were trained on unmirrored video; `flip` undoes a
                # phone that saved it mirrored.
                if self.flip:
                    frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                rgb.flags.writeable = False
                packed = pack(self.holistic.process(rgb))
                if frames_read % 10 == 1:
                    brightness.append(float(rgb.mean()))
                if packed[:, 2].any():
                    frames_with_person += 1
                if packed[IDX_LSHOULDER, 2] > 0 and packed[IDX_RSHOULDER, 2] > 0:
                    frames_with_shoulders += 1
                if packed[OFF_LHAND:OFF_POSE, 2].any():
                    frames_with_hands += 1
                aspect = frame.shape[1] / frame.shape[0]
                clip = self.segmenter.update(t, packed, aspect, self.model.fixed_seconds)
                if clip is not None:
                    events.append(self._event_for(clip))
        finally:
            cap.release()

        if final:
            events.extend(self._event_for(clip) for clip in self.segmenter.flush())

        # Gentle tips when the camera can't see well enough.
        if frames_read == 0:
            events.append({"type": "hint", "message": "The video couldn't be read. Trying again…"})
        elif brightness and np.mean(brightness) < 40:
            events.append({"type": "hint", "message": "It's too dark. Turn on a light or face a window."})
        elif frames_with_person < frames_read * 0.3:
            events.append({"type": "hint", "message": "I can't see anyone. Point the camera at the signer."})
        elif frames_with_shoulders < frames_read * 0.5:
            events.append({"type": "hint", "message": "Step back so both shoulders are in view."})

        return {
            "events": events,
            "phase": self.segmenter.phase,
            "frames": frames_read,
            "handsSeen": frames_with_hands > 0,
        }


class SessionStore:
    def __init__(self):
        self.sessions = {}
        self.lock = threading.Lock()

    def _prune(self):
        now = time.monotonic()
        for session_id, session in list(self.sessions.items()):
            if now - session.last_used > IDLE_SECONDS:
                self.sessions.pop(session_id).close()

    def create(self, owner, model, min_confidence, flip=False):
        with self.lock:
            self._prune()
            # One session per person: starting again replaces the old one.
            for session_id, session in list(self.sessions.items()):
                if session.owner == owner:
                    self.sessions.pop(session_id).close()
            if len(self.sessions) >= MAX_SESSIONS:
                oldest = min(self.sessions.values(), key=lambda s: s.last_used)
                self.sessions.pop(oldest.id).close()
            session = SignSession(owner, model, min_confidence, flip)
            self.sessions[session.id] = session
            return session

    def get(self, session_id, owner):
        with self.lock:
            self._prune()
            session = self.sessions.get(session_id)
        if session is None or session.owner != owner:
            raise SessionGone()
        return session

    def delete(self, session_id, owner):
        with self.lock:
            session = self.sessions.get(session_id)
            if session is not None and session.owner == owner:
                self.sessions.pop(session_id).close()


def process_bytes(session, data, chunk_start_ms, final=False):
    """Writes the piece to a temporary file (OpenCV reads files), reads it, deletes it."""
    handle, path = tempfile.mkstemp(suffix=".mp4")
    try:
        with os.fdopen(handle, "wb") as file:
            file.write(data)
        with session.lock:
            return session.process(path, chunk_start_ms, final=final)
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
