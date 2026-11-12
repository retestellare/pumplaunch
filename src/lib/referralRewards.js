// The referral reward service. Everything that decides an amount or moves tokens
// happens in the backend function; the page only asks and shows what came back.
import { base44 } from '@/api/base44Client';

async function call(payload) {
  try {
    const res = await base44.functions.invoke('referralReward', payload);
    return { data: res?.data ?? res, error: null };
  } catch (err) {
    const data = err?.response?.data;
    // Only real text is shown, never "[object Object]".
    const text = [data?.error, err?.message].find((v) => typeof v === 'string' && v.trim());
    return { data, error: text || 'The rewards service did not answer.' };
  }
}

export function referralStatus(wallet_address) {
  return call({ action: 'status', wallet_address });
}

// Credits any invitation of this wallet whose member has just completed a profile.
export function syncReferralRewards(wallet_address) {
  return call({ action: 'sync', wallet_address });
}

export function requestReferralPayout(wallet_address) {
  return call({ action: 'claim', wallet_address });
}

export function confirmReferralPayout(wallet_address, tx_hash) {
  return call({ action: 'confirm', wallet_address, tx_hash });
}