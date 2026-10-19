/**
 * Saved settings from older versions of the app, brought up to date before
 * they're merged over the defaults (use-preferences `fromSaved`). No imports,
 * so the check scripts can load it in Node.
 */

// The voice assistant was called Accel until 2026-10-17 (HANDOFF.md §32).
const RENAMED = {
  accelEnabled: 'layaEnabled',
  accelWakeWord: 'layaWakeWord',
  accelSmart: 'layaSmart',
  accelVoice: 'layaVoice',
  accelIntroDone: 'layaIntroDone',
} as const;

/**
 * Old setting names moved to their new ones (a value already saved under the
 * new name wins), and the old names dropped. Someone who had already heard
 * Accel introduce itself hears once that it's called Laya now
 * (`layaRenameNoticeDone: false`).
 */
export function migrateSavedPreferences(saved: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...saved };
  for (const [old, now] of Object.entries(RENAMED)) {
    if (!(old in out)) continue;
    if (out[now] === undefined) out[now] = out[old];
    delete out[old];
  }
  if (saved.accelIntroDone === true && saved.layaRenameNoticeDone === undefined) {
    out.layaRenameNoticeDone = false;
  }
  return out;
}
