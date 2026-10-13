// Referral links. A Stellar public key is the app's member id, so the link
// carries the inviter's wallet, and the invited member is credited to them the
// first time that wallet shows up in the app.
import { base44 } from '@/api/base44Client';
import { rewardsRefUrl } from '@/lib/share';
import { shortAddr } from '@/lib/profiles';
import { recordReward } from '@/lib/rewards';
import { referralEligibility } from '@/lib/referralEligibility';

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
  let referral = null;

  // A wallet can never invite itself.
  if (ref && address && ref !== address) {
    const existing = await base44.entities.Referral.filter({ referred_wallet: address }, '-created_date', 1);
    referral =
      existing && existing.length > 0
        ? existing[0]
        : await base44.entities.Referral.create({
            referrer_wallet: ref,
            referred_wallet: address,
            source: 'link',
          });
  }
  if (ref) clearReferral();

  // Attribution is recorded straight away; the reward behind it is not — an
  // invitation only earns once the invited member qualifies (see below).
  await syncReferralCredit(address).catch(() => null);
  return referral;
}

// The anti-abuse gate on the invitation reward: the inviter is credited only when
// the invited wallet qualifies as a real member. It runs every time that wallet
// appears in the app, so the credit lands as soon as the requirements are met —
// and recordReward keeps it to one credit per invited wallet however often it
// runs. Returns the member's own invite state for the rewards screen.
export async function syncReferralCredit(address) {
  if (!address) return { invited: false, verified: false, state: null };

  const rows = await base44.entities.Referral.filter({ referred_wallet: address }, '-created_date', 5);
  if (!rows || rows.length === 0) return { invited: false, verified: false, state: null };

  const state = await referralEligibility(address);
  if (!state.eligible) {
    return { invited: true, verified: rows.some((row) => row.verified === true), state };
  }

  let verified = false;
  for (const row of rows) {
    if (!row.referrer_wallet || row.referrer_wallet === address) continue;
    const credited = await recordReward({
      wallet: row.referrer_wallet,
      type: 'referral',
      ref: address,
      label: `New member ${shortAddr(address)}`,
    });
    if (!credited) continue;
    verified = true;
    if (!row.verified) await base44.entities.Referral.update(row.id, { verified: true });
  }
  return { invited: true, verified: verified || rows.some((row) => row.verified === true), state };
}