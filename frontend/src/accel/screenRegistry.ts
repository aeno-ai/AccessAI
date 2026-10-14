import type { IntentId, Slots } from '@/accel/catalog';
import type { Plan } from '@/accel/actions';

/**
 * What a screen tells Accel while it's open, so Accel never guesses: what
 * it shows right now, and the voice commands only it can do. Screens whose
 * contents Accel can read for itself (Home, Friends, Settings…) don't need
 * this — accel/screens.ts describes those. Chats, Conversation mode and a
 * Learn lesson keep their state inside the screen, so they register here
 * (with useAccelScreen, accel/screenContext.ts).
 */
export type ScreenEntry = {
  /** "Conversation mode" — matches the commands' `screen` in catalog.ts. */
  name: string;
  /** A live sentence or two: "Ate Lyka. 12 messages. They spoke last…". */
  describe: () => string | Promise<string>;
  /** Examples for "what can I do here", most useful first. */
  examples: string[];
  /** This screen's own commands. Each runs the same thing as its button. */
  commands: Partial<Record<IntentId, (slots: Slots) => Plan | Promise<Plan>>>;
  /** Whether a command fits right now ("open Ate Lyka" — is there one?). Default yes. */
  accepts?: (intent: IntentId, slots: Slots) => boolean;
};

type Source = () => ScreenEntry;

// The screens in focus, newest last. Only the last one is "on screen".
const open: Source[] = [];

/** Registers a screen; the returned function removes it (the screen left focus). */
export function registerScreen(source: Source): () => void {
  open.push(source);
  return () => {
    const at = open.lastIndexOf(source);
    if (at >= 0) open.splice(at, 1);
  };
}

/** The screen in focus that registered, or null (it describes itself in screens.ts). */
export function currentScreen(): ScreenEntry | null {
  const source = open[open.length - 1];
  return source ? source() : null;
}

/** Does the screen in focus offer this command, with these details? */
export function screenOffers(intent: IntentId, slots: Slots): boolean {
  const screen = currentScreen();
  if (!screen?.commands[intent]) return false;
  return screen.accepts ? screen.accepts(intent, slots) : true;
}
