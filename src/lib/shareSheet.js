// Opens the app's own share picker. Sharing code (which lives outside React)
// asks for it by event; the mounted ShareSheetHost renders it.
export const SHARE_EVENT = 'sp:open-share-sheet';

export function openShareSheet(payload) {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(SHARE_EVENT, { detail: payload }));
  return true;
}