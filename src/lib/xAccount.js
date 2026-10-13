// The X account a profile claims. X's API only ever exposes the app owner's own
// account, so a member names their handle here and the payout reviewer checks it
// against their X profile before a claim is paid.
export function normalizeXHandle(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/^@+/, '')
    .trim();
}

export function isXHandle(value) {
  return /^[A-Za-z0-9_]{1,15}$/.test(normalizeXHandle(value));
}

export function xProfileUrl(handle) {
  const clean = normalizeXHandle(handle);
  return clean ? `https://x.com/${clean}` : '';
}

export const X_REQUIREMENT =
  'Connect your X account to your profile — a linked X account is required to receive a payout.';