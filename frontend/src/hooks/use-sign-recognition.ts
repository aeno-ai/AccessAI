import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CameraView } from 'expo-camera';
import { File, UploadTask, UploadType } from 'expo-file-system';
import { apiFetch, apiUrl, isApiError } from '@/api/apiClient';
import type { SignLanguage, SignUnit } from '@/hooks/use-preferences';
import { getToken } from '@/utils/tokenStorage';

/**
 * Sign language → words, hands-free.
 *
 * While sign mode is on, the camera records short video pieces (~2 s) one
 * after another. Each piece is sent to the AccessAI server — the next one
 * records while the last uploads — and the server's AI service (ai/app/sign)
 * finds the hand and body points with MediaPipe, notices when a sign starts
 * and ends (hands rise above the waist, then drop), and asks the sign model
 * which word it was. Videos are never kept.
 *
 * The models and their labels live on the server (ai/models/sign/…), so a
 * better model can be swapped in there without updating the app.
 */
export type SignEvent =
  | { type: 'word'; label: string; confidence: number; top5: { label: string; confidence: number }[] }
  | { type: 'unsure'; top5: { label: string; confidence: number }[] }
  | { type: 'reject'; top5: { label: string; confidence: number }[] }
  | { type: 'hint'; message: string };

/** WAIT: watching for a sign · SIGN: someone is signing · TAIL: reading the sign */
export type SignPhase = 'off' | 'starting' | 'WAIT' | 'SIGN' | 'TAIL' | 'paused';

export type SignModelInfo = { language: SignLanguage; unit: SignUnit; available: boolean; signs: number };

type ChunkResult = { events: SignEvent[]; phase: 'WAIT' | 'SIGN' | 'TAIL'; frames: number; handsSeen: boolean };

const PIECE_SECONDS = 2;
const IDLE_PAUSE_MS = 30 * 1000;

/** Which sign models the server has (e.g. FSL words yes, letters not yet). */
export async function fetchSignModels(): Promise<SignModelInfo[]> {
  const { models } = await apiFetch<{ models: SignModelInfo[] }>('/sign/models', { timeoutMs: 6000 });
  return models;
}

async function uploadPiece(sessionId: string, uri: string, startedAt: number, index: number, final: boolean): Promise<ChunkResult> {
  const token = await getToken();
  const task = new UploadTask(new File(uri), apiUrl(`/sign/session/${sessionId}/chunk`), {
    httpMethod: 'POST',
    uploadType: UploadType.BINARY_CONTENT,
    mimeType: 'video/mp4',
    headers: {
      'Content-Type': 'video/mp4',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Chunk-Start': String(startedAt),
      'X-Chunk-Index': String(index),
      'X-Chunk-Final': final ? '1' : '0',
    },
  });
  const response = await task.uploadAsync();
  let body: (ChunkResult & { message?: string; code?: string }) | null = null;
  try {
    body = JSON.parse(response.body);
  } catch {
    body = null;
  }
  if (response.status < 200 || response.status >= 300 || !body) {
    throw Object.assign(new Error(body?.message ?? 'Sign language is not reachable right now.'), {
      status: response.status,
      code: body?.code,
    });
  }
  return body;
}

type Options = {
  cameraRef: RefObject<CameraView | null>;
  /** Camera on screen and ready. */
  cameraReady: boolean;
  /** Sign mode is on. */
  active: boolean;
  language: SignLanguage;
  unit: SignUnit;
  minConfidence: number;
  flip: boolean;
  onEvent: (event: SignEvent) => void;
};

export function useSignRecognition({ cameraRef, cameraReady, active, language, unit, minConfidence, flip, onEvent }: Options) {
  const [phase, setPhase] = useState<SignPhase>('off');
  const [message, setMessage] = useState('');
  const [resumeKey, setResumeKey] = useState(0);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!active || !cameraReady) {
      return;
    }
    const camera = cameraRef.current;
    let stopped = false;
    let sessionId: string | null = null;
    let queue: Promise<void> = Promise.resolve();
    let lastSigning = Date.now();
    let index = 0;

    const send = (uri: string, startedAt: number, final: boolean) => {
      const pieceIndex = index++;
      queue = queue.then(async () => {
        if (!sessionId) return;
        try {
          const result = await uploadPiece(sessionId, uri, startedAt, pieceIndex, final);
          if (stopped && !final) return;
          if (result.handsSeen || result.phase !== 'WAIT') lastSigning = Date.now();
          if (!stopped) setPhase(result.phase);
          result.events.forEach((event) => onEventRef.current(event));
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === 'SIGN_SESSION_GONE') {
            setMessage('Sign language restarted.');
            stopped = true;
            setResumeKey((key) => key + 1);
          } else if (!stopped) {
            setMessage(error instanceof Error ? error.message : 'Sign language is not reachable right now.');
          }
        } finally {
          try {
            new File(uri).delete();
          } catch {
            // Already gone.
          }
        }
      });
    };

    void (async () => {
      setPhase('starting');
      setMessage('');
      try {
        const session = await apiFetch<{ sessionId: string }>('/sign/session', {
          method: 'POST',
          timeoutMs: 10000,
          body: JSON.stringify({ language, unit, minConfidence, flip }),
        });
        sessionId = session.sessionId;
      } catch (error) {
        setPhase('off');
        setMessage(
          isApiError(error) && error.status === 409
            ? `${language.toUpperCase()} ${unit} aren't available yet — the model is still being trained.`
            : 'Sign language needs the AccessAI server, which is not reachable right now. You can still type.',
        );
        return;
      }
      setPhase('WAIT');
      // The recording loop: one piece after another, hands-free.
      while (!stopped && cameraRef.current) {
        if (Date.now() - lastSigning > IDLE_PAUSE_MS) {
          setPhase('paused');
          setMessage('Paused — no signing for a while. Tap Resume to keep going.');
          break;
        }
        const startedAt = Date.now();
        let video: { uri: string } | undefined;
        try {
          video = await cameraRef.current.recordAsync({ maxDuration: PIECE_SECONDS, codec: 'avc1' });
        } catch {
          // The camera was busy or closed; try again shortly.
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        // A piece cut short by stopping is the last one: the server reads any
        // sign still waiting in it.
        if (video?.uri) send(video.uri, startedAt, stopped);
      }
      // Stopped, paused or the camera closed: finish reading, then close the session.
      await queue;
      if (sessionId) void apiFetch(`/sign/session/${sessionId}`, { method: 'DELETE', timeoutMs: 4000 }).catch(() => {});
    })();

    return () => {
      stopped = true;
      camera?.stopRecording();
    };
  }, [active, cameraReady, language, unit, minConfidence, flip, cameraRef, resumeKey]);

  const resume = useCallback(() => {
    setMessage('');
    setResumeKey((key) => key + 1);
  }, []);

  return { phase: active && cameraReady ? phase : ('off' as SignPhase), message, resume };
}
