const STORAGE_PREFIX = 'stellarlaunch_launch_attempt_';

function keyFor(symbol) {
  return `${STORAGE_PREFIX}${(symbol || '').toUpperCase()}`;
}

export function saveLaunchAttempt(attempt) {
  if (!attempt) return;
  try {
    const sym = attempt.symbol || '';
    localStorage.setItem(keyFor(sym), JSON.stringify(attempt));
  } catch {
    /* storage unavailable */
  }
}

export function getCurrentLaunchAttempt(walletAddress, symbol) {
  try {
    const raw = localStorage.getItem(keyFor(symbol));
    if (!raw) return null;
    const attempt = JSON.parse(raw);
    if (!attempt || attempt.walletAddress !== walletAddress) return null;
    return attempt;
  } catch {
    return null;
  }
}

export function clearLaunchAttempt(symbol) {
  try {
    localStorage.removeItem(keyFor(symbol));
  } catch {
    /* storage unavailable */
  }
}

export function listLaunchAttempts() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        try {
          out.push(JSON.parse(localStorage.getItem(k)));
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    /* storage unavailable */
  }
  return out;
}