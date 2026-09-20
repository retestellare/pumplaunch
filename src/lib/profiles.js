import { base44 } from '@/api/base44Client';

export function shortAddr(addr) {
  if (!addr) return 'Anonymous';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export async function resolveProfile(walletAddress) {
  if (!walletAddress) return null;
  try {
    const list = await base44.entities.Profile.filter({ wallet_address: walletAddress });
    return list && list.length > 0 ? list[0] : null;
  } catch {
    return null;
  }
}

export async function resolveProfiles(addresses) {
  const unique = [...new Set(addresses.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const list = await base44.entities.Profile.filter({ wallet_address: { $in: unique } });
    const map = {};
    for (const p of list || []) {
      map[p.wallet_address] = p;
    }
    return map;
  } catch {
    return {};
  }
}

export function displayName(profile, fallbackAddress) {
  if (profile?.display_name) return profile.display_name;
  return shortAddr(fallbackAddress);
}