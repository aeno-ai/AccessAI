import { useSyncExternalStore } from 'react';

/**
 * How tall the bottom tab bar is (0 when it isn't on screen), measured by
 * the tabs layout — so the Laya button, which lives above every screen,
 * never sits on top of it.
 */
let height = 0;
const listeners = new Set<() => void>();

export function setTabBarHeight(next: number): void {
  if (next === height) return;
  height = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useTabBarHeight = () => useSyncExternalStore(subscribe, () => height);
