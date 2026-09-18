const STORAGE_KEY = 'stellarlaunch_launch_attempt';

export function saveLaunchAttempt(attempt) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    /* storage unavailable */
  }
}

export function loadLaunchAttempt() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLaunchAttempt() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function getLaunchAttemptForWallet(walletAddress) {
  const attempt = loadLaunchAttempt();
  if (!attempt || attempt.walletAddress !== walletAddress) return null;
  return attempt;
}