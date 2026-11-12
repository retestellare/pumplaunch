import { useEffect, useState } from 'react';
import { clearHorizonCache } from '@/lib/stellar';

const listeners = new Set();

// One pull has to do what restarting the app does: drop every cached chain
// answer, then have each live screen read its data again.
export function refreshApp() {
  clearHorizonCache();
  listeners.forEach((fn) => fn());
}

// A screen showing live figures listens here; the tick it returns changes on
// every refresh, so an effect that depends on it reloads.
export function useRefreshTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  return tick;
}