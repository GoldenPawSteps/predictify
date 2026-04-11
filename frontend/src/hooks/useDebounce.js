import { useRef, useCallback } from 'react';

/**
 * Returns a debounced version of `fn` that only fires after `delay` ms of inactivity.
 * The timer is cleared imperatively on every call, so React's render/effect scheduling
 * cannot interfere with the reset.
 */
export function useDebouncedCallback(fn, delay = 350) {
  const timerRef = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}
