import { useCallback } from 'react';
import type { View } from 'react-native';

/**
 * The controls the first-time tutorial can light up (HANDOFF.md §40). A
 * screen wraps each one in `<View ref={useTourTarget('home.menu')}
 * collapsable={false}>`; the tutorial measures it when its step comes.
 * Ids are "<page>.<thing>".
 */
const targets = new Map<string, View>();

/** A ref for the View around one control of the tour. */
export function useTourTarget(id: string): (node: View | null) => void {
  return useCallback(
    (node: View | null) => {
      if (node) targets.set(id, node);
      else if (targets.has(id)) targets.delete(id);
    },
    [id],
  );
}

/** Registers a target from outside a component's own render (e.g. the tab bar). */
export function setTourTarget(id: string, node: View | null): void {
  if (node) targets.set(id, node);
  else targets.delete(id);
}

export type TargetBox = { x: number; y: number; width: number; height: number };

/** Where the control is on screen right now, or null if it isn't there. */
export function measureTarget(id: string): Promise<TargetBox | null> {
  const node = targets.get(id);
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
    } catch {
      resolve(null);
    }
  });
}
