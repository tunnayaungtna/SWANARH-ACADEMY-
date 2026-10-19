import { useEffect, useRef } from 'react';

interface BackStackEntry {
  id: string;
  onBack: () => void;
}

const backStack: BackStackEntry[] = [];
let isListenerInitialized = false;

function initGlobalPopStateListener() {
  if (isListenerInitialized || typeof window === 'undefined') return;
  isListenerInitialized = true;

  // Push an initial guard state so the first mobile hardware back press is intercepted
  try {
    window.history.pushState({ classroomBackGuard: true }, '');
  } catch {
    // ignore
  }

  window.addEventListener('popstate', () => {
    // Re-arm the history guard so subsequent mobile Back presses are also intercepted
    // instead of exiting the web app all at once
    try {
      window.history.pushState({ classroomBackGuard: true }, '');
    } catch {
      // ignore
    }

    if (backStack.length > 0) {
      const topEntry = backStack.pop();
      if (topEntry) {
        topEntry.onBack();
      }
    }
  });
}

/**
 * Registers a step in the mobile Back-button navigation stack while `isActive` is true.
 * Pressing the phone's Back key will pop the most recently activated layer one step at a time.
 */
export function useBackHandler(isActive: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    initGlobalPopStateListener();
  }, []);

  useEffect(() => {
    if (!isActive) return;

    initGlobalPopStateListener();

    const entryId = `back-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: BackStackEntry = {
      id: entryId,
      onBack: () => onBackRef.current(),
    };

    backStack.push(entry);

    // Ensure a browser history state exists for this navigation depth
    try {
      window.history.pushState({ classroomBackGuard: true, entryId }, '');
    } catch {
      // ignore
    }

    return () => {
      const index = backStack.findIndex((item) => item.id === entryId);
      if (index !== -1) {
        backStack.splice(index, 1);
      }
    };
  }, [isActive]);
}
