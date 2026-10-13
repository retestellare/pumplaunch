// The XLM rewards program. Qualifying activity is recorded as one event per
// wallet, a claim bundles the events that are still unclaimed, and an admin
// approves it before the payout is sent by hand — the app never moves XLM.
import { base44 } from '@/api/base44Client';

export const DEFAULT_RULES = {
  referral_xlm: 5,
  launch_xlm: 20,
  social_xlm: 2,
  min_claim_xlm: 25,
  is_active: true,
  admin_wallets: [],
  rules_note:
    'Earn XLM for inviting a new member, launching a token or collection, and posting a callout in the social feed. Every action is credited once per wallet, and a claim is reviewed by hand before payout.',
};

export const REWARD_TYPES = [
  { key: 'referral', label: 'New member invited', glyph: '🤝', field: 'referral_xlm' },
  { key: 'token_launch', label: 'Token or collection launched', glyph: '🚀', field: 'launch_xlm' },
  { key: 'social_post', label: 'Social callout posted', glyph: '💬', field: 'social_xlm' },
];

let cached = null;

export function rewardFor(rules, type) {
  const row = REWARD_TYPES.find((t) => t.key === type);
  return row ? parseFloat(rules?.[row.field]) || 0 : 0;
}

// The program rules live in one record so an admin can retune the amounts
// without a deploy; the first read materialises it with the defaults.
export async function loadRules() {
  if (cached) return cached;
  const list = await base44.entities.RewardSettings.list('-created_date', 1);
  if (list && list.length > 0) {
    cached = { ...DEFAULT_RULES, ...list[0] };
    return cached;
  }
  cached = await base44.entities.RewardSettings.create({ ...DEFAULT_RULES });
  return cached;
}

export async function saveRules(patch) {
  const rules = await loadRules();
  cached = { ...rules, ...patch };
  if (rules?.id) await base44.entities.RewardSettings.update(rules.id, patch);
  return cached;
}

// One credit per action: the same launch, callout or invited wallet never earns
// twice, however often the app is reopened.
export async function recordReward({ wallet, type, ref, label }) {
  if (!wallet || !type || !ref) return null;
  const rules = await loadRules();
  if (!rules.is_active) return null;
  const existing = await base44.entities.RewardEvent.filter(
    { wallet_address: wallet, type, ref },
    '-created_date',
    1
  );
  if (existing && existing.length > 0) return existing[0];
  const xlm = rewardFor(rules, type);
  if (xlm <= 0) return null;
  return base44.entities.RewardEvent.create({
    wallet_address: wallet,
    type,
    ref,
    label: label || '',
    xlm,
    status: 'credited',
    claim_id: '',
  });
}

// Totals come from the server: one grouped call for the progress rows, one for
// what is still claimable, one count for the referrals themselves.
export async function loadProgress(wallet) {
  const empty = { rows: {}, total: 0, claimable: 0, claimableCount: 0, referrals: 0 };
  if (!wallet) return empty;

  const [byType, claimable, referrals] = await Promise.all([
    base44.entities.RewardEvent.aggregate({
      query: { wallet_address: wallet },
      groupBy: 'type',
      sum: 'xlm',
    }),
    base44.entities.RewardEvent.aggregate({
      query: { wallet_address: wallet, status: 'credited' },
      sum: 'xlm',
    }),
    base44.entities.Referral.count({ referrer_wallet: wallet }),
  ]);

  const rows = {};
  let total = 0;
  for (const row of byType?.rows || []) {
    rows[row.type] = { count: row.count || 0, xlm: row.sum_xlm || 0 };
    total += row.sum_xlm || 0;
  }
  const pending = claimable?.rows?.[0] || {};
  return {
    rows,
    total,
    referrals: referrals || 0,
    claimable: pending.sum_xlm || 0,
    claimableCount: pending.count || 0,
  };
}

export async function loadClaims(wallet, limit = 20) {
  if (!wallet) return [];
  return base44.entities.RewardClaim.filter({ wallet_address: wallet }, '-created_date', limit);
}

export async function loadPendingClaims(limit = 30) {
  return base44.entities.RewardClaim.filter({ status: 'pending' }, 'created_date', limit);
}

export async function loadRecentClaims(limit = 25) {
  return base44.entities.RewardClaim.list('-created_date', limit);
}

// A claim freezes the credited events until it is reviewed, so the same XLM can
// never be claimed twice while it waits.
export async function submitClaim(wallet) {
  const rules = await loadRules();
  const pending = await base44.entities.RewardClaim.filter(
    { wallet_address: wallet, status: 'pending' },
    '-created_date',
    5
  );
  if (pending && pending.length > 0) throw new Error('A claim of yours is already waiting for review.');

  const events = await base44.entities.RewardEvent.filter(
    { wallet_address: wallet, status: 'credited' },
    'created_date',
    100
  );
  const amount = (events || []).reduce((sum, e) => sum + (parseFloat(e.xlm) || 0), 0);
  if (amount <= 0) throw new Error('Nothing to claim yet — earn a reward first.');
  const min = parseFloat(rules.min_claim_xlm) || 0;
  if (amount < min) throw new Error(`Claims start at ${min} XLM — you have ${amount.toFixed(2)} XLM so far.`);

  const claim = await base44.entities.RewardClaim.create({
    wallet_address: wallet,
    amount_xlm: amount,
    event_ids: (events || []).map((e) => e.id),
    event_count: (events || []).length,
    status: 'pending',
    payout_address: wallet,
  });
  await base44.entities.RewardEvent.bulkUpdate(
    (events || []).map((e) => ({ id: e.id, status: 'claimed', claim_id: claim.id }))
  );
  return claim;
}

function assertNotOwnClaim(claim, wallet) {
  if (wallet && claim?.wallet_address === wallet) {
    throw new Error('You cannot review your own claim.');
  }
}

export async function reviewClaim({ claim, status, note, reviewer, wallet }) {
  assertNotOwnClaim(claim, wallet);
  await base44.entities.RewardClaim.update(claim.id, {
    status,
    review_note: note || '',
    reviewer_wallet: reviewer || '',
    reviewed_date: new Date().toISOString(),
  });
  // A rejection hands the events back so the work behind them is not lost.
  if (status === 'rejected') {
    const ids = claim.event_ids || [];
    if (ids.length > 0) {
      await base44.entities.RewardEvent.bulkUpdate(ids.map((id) => ({ id, status: 'credited', claim_id: '' })));
    }
  }
}

export async function markClaimPaid({ claim, reviewer, wallet }) {
  assertNotOwnClaim(claim, wallet);
  await base44.entities.RewardClaim.update(claim.id, {
    status: 'paid',
    paid_date: new Date().toISOString(),
    reviewer_wallet: reviewer || claim.reviewer_wallet || '',
  });
  const ids = claim.event_ids || [];
  if (ids.length > 0) {
    await base44.entities.RewardEvent.bulkUpdate(ids.map((id) => ({ id, status: 'paid' })));
  }
}

// Who may open the review screen: a signed-in admin of the app, or a wallet the
// owner has listed. With no wallet listed yet, the screen offers to claim it.
export async function reviewerAccess(wallet) {
  const rules = await loadRules();
  const me = await base44.auth.me().catch(() => null);
  const admins = rules.admin_wallets || [];
  if (me?.role === 'admin') return { mode: 'signed-in-admin', allowed: true, rules };
  if (wallet && admins.includes(wallet)) return { mode: 'owner', allowed: true, rules };
  if (wallet && admins.length === 0) return { mode: 'bootstrap', allowed: false, rules };
  return { mode: wallet ? 'denied' : 'no-wallet', allowed: false, rules };
}

export async function claimOwnership(wallet) {
  const rules = await loadRules();
  const admins = rules.admin_wallets || [];
  if (admins.includes(wallet)) return rules;
  if (admins.length > 0) throw new Error('Another wallet already runs this rewards program.');
  return saveRules({ admin_wallets: [wallet] });
}