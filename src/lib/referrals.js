// Referral links. A Stellar public key is the app's member id, so the link
// carries the inviter's wallet, and the invited member is credited to them the
// first time that wallet shows up in the app.
import { base44 } from '@/api/base44Client';
import { rewardsRefUrl } from '@/lib/share';
import { shortAddr } from '@/lib/profiles';
import { recordReward } from '@/lib/rewards';

const KEY = 'sp_referral';

export function isWallet(value) {
  return typeof value === 'string' && /^G[A-Z2-7]{55}$/.test(value.trim());
}

export function referralLink(wallet) {
  return rewardsRefUrl(wallet);
}

export function storedReferral() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearReferral() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// The link may be opened long before a wallet is connected, so the inviter is
// remembered until the invited member arrives with a wallet.
export function captureReferralFromUrl() {
  if (typeof window === 'undefined') return null;
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (!isWallet(ref)) return null;
  try {
    window.localStorage.setItem(KEY, ref.trim());
  } catch {
    /* ignore */
  }
  return ref.trim();
}

export function referralCountLabel(count) {
  return count === 1 ? '1 member joined' : `${count} members joined`;
}

export async function attributeReferral(address) {
  const ref = storedReferral();
  if (!ref || !address) return null;
  // A wallet can never invite itself.
  if (ref === address) {
    clearReferral();
    return null;
  }
  const existing = await base44.entities.Referral.filter({ referred_wallet: address }, '-created_date', 1);
  if (existing && existing.length > 0) {
    clearReferral();
    return existing[0];
  }
  const referral = await base44.entities.Referral.create({
    referrer_wallet: ref,
    referred_wallet: address,
    source: 'link',
  });
  try {
    await recordReward({
      wallet: ref,
      type: 'referral',
      ref: address,
      label: `New member ${shortAddr(address)}`,
    });
  } catch {
    /* the attribution is what matters; the credit can be re-recorded later */
  }
  clearReferral();
  return referral;
}