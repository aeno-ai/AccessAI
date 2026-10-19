import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { block, unblock } from '@/audio/recognizer';
import { useBigText } from '@/components/conversation/BigTextHost';
import { useTermsUpdate } from '@/components/legal/TermsUpdateHost';
import { useSos } from '@/components/sos/SosProvider';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { usePreferences } from '@/hooks/use-preferences';
import { useLaya } from '@/laya/LayaProvider';
import { TutorialHost } from '@/tutorial/TutorialHost';
import { stepsFor, type TourId, type TourStep } from '@/tutorial/tours';

/**
 * The first-time tutorial (owner, 2026-10-17, HANDOFF.md §40): the first
 * time someone opens Home, Conversation, Friends, Add a friend, Learn or
 * Settings, the page is dimmed and its main controls are lit up one at a
 * time with a short explanation — "Next", or "Skip". New and existing
 * accounts see each page's tour once (Settings → "Show the tutorial
 * again" brings them back). With the Blind / low vision profile, Laya is
 * the tutorial: she says each step out loud.
 *
 * A tour waits while something more important is open (an SOS, Laya, Big
 * text, the new Terms), and "Hey Laya" rests while a tour is showing.
 */
type Active = { id: TourId; steps: TourStep[]; index: number };

type TutorialValue = {
  /** A page in focus asks for its tour (shown only if not seen yet). */
  request: (id: TourId) => void;
  /** The page left focus before its tour started. */
  withdraw: (id: TourId) => void;
};

const TutorialContext = createContext<TutorialValue | null>(null);

// Lets the page finish drawing before it's measured.
const START_DELAY_MS = 700;

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { prefs, setPref, ready } = usePreferences();
  const { role } = useBootstrap();
  const sos = useSos();
  const bigText = useBigText();
  const laya = useLaya();
  const terms = useTermsUpdate();
  const [requested, setRequested] = useState<TourId | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const seenRef = useRef(prefs.tutorialSeen);
  useEffect(() => {
    seenRef.current = prefs.tutorialSeen;
  }, [prefs.tutorialSeen]);

  const busy = sos.flowOpen || bigText.open || laya.open || terms.pending;

  const request = useCallback((id: TourId) => setRequested(id), []);
  const withdraw = useCallback((id: TourId) => setRequested((current) => (current === id ? null : current)), []);

  // Start the page's tour once nothing else is in the way.
  useEffect(() => {
    if (!ready || !requested || active || busy || prefs.tutorialSeen.includes(requested)) return;
    const timer = setTimeout(() => {
      const steps = stepsFor(requested, {
        pwd: role !== 'non_pwd',
        layaOn: prefs.layaEnabled,
        hasQuickReplies: prefs.quickReplies.length > 0,
      });
      if (!steps.length) return;
      block('tutorial');
      setActive({ id: requested, steps, index: 0 });
    }, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, requested, active, busy, prefs.tutorialSeen, prefs.layaEnabled, prefs.quickReplies.length, role]);

  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const finish = useCallback(() => {
    const done = activeRef.current;
    if (done && !seenRef.current.includes(done.id)) setPref('tutorialSeen', [...seenRef.current, done.id]);
    setActive(null);
    setRequested(null);
    unblock('tutorial');
  }, [setPref]);

  const next = useCallback(() => {
    setActive((current) => (current && current.index + 1 < current.steps.length ? { ...current, index: current.index + 1 } : current));
  }, []);

  // Leaving (signing out) mid-tour gives the mic back.
  useEffect(() => () => unblock('tutorial'), []);

  const value = useMemo(() => ({ request, withdraw }), [request, withdraw]);
  const last = active ? active.index + 1 >= active.steps.length : false;

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {active ? (
        <TutorialHost
          key={`${active.id}:${active.index}`}
          step={active.steps[active.index]}
          stepNumber={active.index + 1}
          stepCount={active.steps.length}
          first={active.index === 0}
          last={last}
          layaLed={prefs.profile === 'blind-low-vision'}
          onNext={last ? finish : next}
          onSkip={finish}
        />
      ) : null}
    </TutorialContext.Provider>
  );
}

/**
 * Shows this page's tour the first time it's opened. `ready`: the page's
 * controls are on screen (e.g. Conversation after its naming step).
 */
export function useTour(id: TourId, ready = true): void {
  const tutorial = useContext(TutorialContext);
  useFocusEffect(
    useCallback(() => {
      if (!tutorial || !ready) return;
      tutorial.request(id);
      return () => tutorial.withdraw(id);
    }, [tutorial, id, ready]),
  );
}
