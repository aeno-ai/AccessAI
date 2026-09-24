import { useEffect } from 'react';

// Screen readers announce the page title on navigation, so every page sets
// its own.
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · AccessAI Admin`;
  }, [title]);
}
