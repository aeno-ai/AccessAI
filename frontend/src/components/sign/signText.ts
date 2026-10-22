// What the sign camera's badge says in each phase (SignPanel), shared with
// the "How to sign" help so the steps quote the screen word for word.
export const PHASE_TEXT = {
  off: 'Starting the camera…',
  starting: 'Getting ready…',
  WAIT: 'Watching — sign whenever you’re ready',
  SIGN: 'Signing…',
  TAIL: 'Reading the sign…',
  paused: 'Paused',
} as const;
