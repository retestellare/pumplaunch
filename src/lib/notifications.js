import { base44 } from '@/api/base44Client';
import { resolveProfiles, shortAddr } from '@/lib/profiles';

const PREFS_KEY = 'sp:notifications';
const SEEN_KEY = 'sp:notifications-seen:';
const PREFS_EVENT = 'sp:notification-prefs';

// Notifications are on until the wallet turns them off in settings.
export function notificationsEnabled() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return raw.enabled !== false;
  } catch {
    return true;
  }
}

export function setNotificationsEnabled(enabled) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ enabled }));
  } catch {
    /* the preference simply won't survive a reload */
  }
  window.dispatchEvent(new Event(PREFS_EVENT));
}

export function onNotificationPrefsChange(handler) {
  window.addEventListener(PREFS_EVENT, handler);
  return () => window.removeEventListener(PREFS_EVENT, handler);
}

// How far the wallet has read; everything newer than this is the bell's count.
export function notificationsSeenAt(wallet) {
  const value = Number(localStorage.getItem(SEEN_KEY + (wallet || 'guest')));
  return isNaN(value) ? 0 : value;
}

export function markNotificationsSeen(wallet) {
  try {
    localStorage.setItem(SEEN_KEY + (wallet || 'guest'), String(Date.now()));
  } catch {
    /* the badge just comes back next visit */
  }
}

export function notificationAge(at) {
  const minutes = Math.floor((Date.now() - at) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const when = (date) => new Date(date).getTime() || 0;

// The feed: what the platform has been doing, plus this wallet's own rewards,
// newest first. Every row carries the face behind the action.
export async function fetchNotifications(wallet) {
  const [tokens, posts, trades, rewards] = await Promise.all([
    base44.entities.Token.list('-created_date', 15).catch(() => []),
    base44.entities.Post.list('-created_date', 15).catch(() => []),
    base44.entities.Trade.list('-created_date', 15).catch(() => []),
    wallet
      ? base44.entities.RewardEvent.filter({ wallet_address: wallet }, '-created_date', 8).catch(() => [])
      : Promise.resolve([]),
  ]);

  const items = [
    ...(tokens || []).map((t) => ({
      id: `launch-${t.id}`,
      address: t.creator,
      text: `launched $${t.symbol}`,
      at: when(t.created_date),
      to: `/token/${t.id}`,
    })),
    ...(posts || []).map((p) => ({
      id: `post-${p.id}`,
      address: p.author,
      text: p.token_symbol ? `posted about $${p.token_symbol}` : 'shared a callout',
      at: when(p.created_date),
      to: null,
    })),
    ...(trades || []).map((t) => ({
      id: `trade-${t.id}`,
      address: t.user_address,
      text: `${t.type === 'sell' ? 'sold' : 'bought'} $${t.token_symbol || t.token_name || ''}`.trim(),
      at: when(t.created_date),
      to: t.token_id ? `/token/${t.token_id}` : null,
    })),
    ...(rewards || []).map((r) => ({
      id: `reward-${r.id}`,
      address: r.wallet_address,
      text: `your reward was credited · +${r.xlm || 0} XLM${r.label ? ` ${r.label}` : ''}`,
      at: when(r.created_date),
      to: '/rewards',
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 30);

  const profiles = await resolveProfiles(items.map((i) => i.address)).catch(() => ({}));

  return items.map((item) => {
    const profile = profiles[item.address] || null;
    return {
      ...item,
      profile,
      handle: profile?.display_name ? `@${profile.display_name}` : shortAddr(item.address),
    };
  });
}