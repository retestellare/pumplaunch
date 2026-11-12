import { useEffect, useRef, useState } from 'react';

export const PULL_THRESHOLD = 70;
const MAX_PULL = 110;

// Touch-driven pull-to-refresh for a page that owns its own scroll position.
// Only engages at the very top of the page; releasing past the threshold runs
// the refresh and holds the indicator until it resolves.
export default function usePullToRefresh(onRefresh, enabled = true) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const distance = useRef(0);
  const pulling = useRef(false);
  const callback = useRef(onRefresh);

  useEffect(() => {
    callback.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return undefined;

    const reset = () => {
      pulling.current = false;
      startY.current = null;
      distance.current = 0;
      setPull(0);
    };

    const onTouchStart = (e) => {
      if (refreshing || window.scrollY > 0 || e.touches.length !== 1) return;
      startY.current = e.touches[0].clientY;
      distance.current = 0;
      pulling.current = true;
    };

    const onTouchMove = (e) => {
      if (!pulling.current || startY.current == null) return;
      if (window.scrollY > 0) {
        reset();
        return;
      }
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        distance.current = 0;
        setPull(0);
        return;
      }
      // Rubber-band: the pull slows down the further it goes.
      distance.current = Math.min(MAX_PULL, delta * 0.5);
      setPull(distance.current);
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      const pulled = distance.current;
      pulling.current = false;
      startY.current = null;
      distance.current = 0;
      if (pulled < PULL_THRESHOLD) {
        setPull(0);
        return;
      }
      setPull(PULL_THRESHOLD);
      setRefreshing(true);
      // The indicator is held briefly so the refresh is visible, but it never
      // waits on a single read: a slow endpoint cannot leave it spinning.
      const started = Date.now();
      try {
        await callback.current?.();
      } finally {
        const shown = Date.now() - started;
        if (shown < 450) await new Promise((r) => setTimeout(r, 450 - shown));
        setRefreshing(false);
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', reset);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', reset);
    };
  }, [enabled, refreshing]);

  return { pull, refreshing, ready: pull >= PULL_THRESHOLD };
}