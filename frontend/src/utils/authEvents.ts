/**
 * Minimal pub/sub bridge between the plain `apiFetch` module and React auth
 * state. `apiClient.ts` isn't a React component/hook, so it can't call
 * `useBootstrap()` directly — instead it emits an event here whenever a
 * request comes back 401, and `BootstrapProvider` subscribes to it to sign
 * the user out immediately, even mid-session (not just at app boot).
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitUnauthorized(): void {
  for (const listener of listeners) {
    listener();
  }
}
