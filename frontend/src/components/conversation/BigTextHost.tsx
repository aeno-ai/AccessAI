import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { BigTextCard } from '@/components/conversation/BigTextCard';

type BigTextValue = {
  /** Opens Big text: showing `text` straight away, or asking what to show. */
  show: (text?: string) => void;
  /** Big text is on screen (the tutorial waits for it to close). */
  open: boolean;
};

const BigTextContext = createContext<BigTextValue | null>(null);

/**
 * One Big text card for the whole app (HANDOFF.md §37): Home's card, a
 * message pressed and held in Conversation, and Laya ("show big text I
 * need to pee") all open the same one.
 */
export function BigTextProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<{ text?: string } | null>(null);
  const show = useCallback((text?: string) => setShown({ text: text?.trim() || undefined }), []);
  const value = useMemo(() => ({ show, open: shown !== null }), [show, shown]);
  return (
    <BigTextContext.Provider value={value}>
      {children}
      <BigTextCard visible={shown !== null} text={shown?.text} onClose={() => setShown(null)} />
    </BigTextContext.Provider>
  );
}

export function useBigText(): BigTextValue {
  const context = useContext(BigTextContext);
  if (!context) throw new Error('useBigText must be used inside BigTextProvider');
  return context;
}
