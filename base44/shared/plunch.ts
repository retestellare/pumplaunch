// ─────────────────────────────────────────────────────────────────────────────
// PLUNCH on Stellar mainnet: the asset, its live rate, and the reads the app's
// paying functions share — the daily faucet drop and the referral payout.
// ─────────────────────────────────────────────────────────────────────────────
import * as StellarSdk from 'npm:@stellar/stellar-sdk@17.1.0';

export const HORIZON_URL = 'https://horizon.stellar.org';
export const NETWORK_PASSPHRASE = StellarSdk.Networks.PUBLIC;
export const PLUNCH_CODE = 'PLUNCH';
export const PLUNCH_ISSUER = 'GC37N3TEZDIXDIGZC4PYM2ZTWE5ASWDDJGGXIPWLBGNMFROOBFF5MP2D';
export const PLUNCH_ASSET = new StellarSdk.Asset(PLUNCH_CODE, PLUNCH_ISSUER);

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export function plunchLine(account) {
  return (account?.balances || []).find(
    (line) => line.asset_code === PLUNCH_CODE && line.asset_issuer === PLUNCH_ISSUER
  );
}

export function plunchBalance(account) {
  const line = plunchLine(account);
  return line ? parseFloat(line.balance) : 0;
}

const PRICE_TTL_MS = 60 * 1000;
let priceCache = { price: 0, at: 0 };

// The PLUNCH/XLM rate comes from the mainnet order book. A tight book is read at
// its mid price; a wide or one-sided book falls back to the side that exists, so
// a thin market can never inflate a reward.
export async function plunchPrice(server) {
  if (priceCache.price > 0 && Date.now() - priceCache.at < PRICE_TTL_MS) return priceCache.price;

  let price = 0;
  try {
    const book = await server.orderbook(PLUNCH_ASSET, StellarSdk.Asset.native()).limit(1).call();
    const bid = parseFloat(book?.bids?.[0]?.price ?? '');
    const ask = parseFloat(book?.asks?.[0]?.price ?? '');
    if (bid > 0 && ask > 0 && ask / bid <= 2) price = (bid + ask) / 2;
    else if (bid > 0) price = bid;
    else if (ask > 0) price = ask;
  } catch {
    price = 0;
  }

  if (price > 0) priceCache = { price, at: Date.now() };
  return price;
}

export async function readParked(server, address) {
  try {
    const page = await server.claimableBalances().claimant(address).asset(PLUNCH_ASSET).limit(5).call();
    const match = (page?.records || []).find((b) => parseFloat(b.amount) > 0);
    return match ? { id: match.id, amount: Math.floor(parseFloat(match.amount)) } : null;
  } catch {
    return null;
  }
}

export async function waitForParked(server, address) {
  for (let i = 0; i < 4; i += 1) {
    if (i > 0) await pause(1200);
    const found = await readParked(server, address);
    if (found) return found;
  }
  return null;
}

// Has the app wallet already paid this address since `sinceMs`? Used to settle a
// payment whose submit answer never arrived: an unknown outcome is never a
// reason to pay again.
export async function paidSince(server, funderKey, address, sinceMs) {
  try {
    const page = await server.payments().forAccount(address).order('desc').limit(10).call();
    return (
      (page?.records || []).find(
        (op) =>
          op.type === 'payment' &&
          op.from === funderKey &&
          op.asset_code === PLUNCH_CODE &&
          new Date(op.created_at).getTime() >= sinceMs
      ) || null
    );
  } catch {
    return null;
  }
}

export async function waitForPayout(server, funderKey, address, sinceMs) {
  for (let i = 0; i < 3; i += 1) {
    if (i > 0) await pause(1500);
    const found = await paidSince(server, funderKey, address, sinceMs);
    if (found) return found;
  }
  return null;
}

// The newest payout the app wallet made, read from the chain rather than from a
// row a client could have raced.
export async function lastPayoutAt(server, funderKey) {
  try {
    const page = await server.payments().forAccount(funderKey).order('desc').limit(5).call();
    const op = (page?.records || []).find((r) => r.type === 'payment' && r.from === funderKey);
    return op ? new Date(op.created_at).getTime() : 0;
  } catch {
    return 0;
  }
}

// ── The payout lock ──────────────────────────────────────────────────────────
// One lock row is flipped from free to held by exactly one invocation: a
// conditional update matches at most one caller, so whoever flips it first owns
// the whole check-then-pay sequence. Everyone else is refused instantly.
export const LOCK_TTL_MS = 120 * 1000;

export async function acquireLock(base44, key, holder) {
  const locks = base44.asServiceRole.entities.ClaimLock;
  let docs = ((await locks.filter({ key }, { sort: 'created_date', limit: 10 }))?.items) || [];
  if (!docs.length) {
    await locks.create({ key, holder: '', held_until: 0 });
    docs = ((await locks.filter({ key }, { sort: 'created_date', limit: 10 }))?.items) || [];
  }
  if (!docs.length) return null;

  // A first-ever burst can create more than one lock row: only the oldest counts.
  const [lock, ...redundant] = docs;
  if (redundant.length) {
    await Promise.all(redundant.map((row) => locks.delete(row.id).catch(() => {})));
  }

  const now = Date.now();
  // A lock left behind by a crashed invocation is released by its expiry.
  await locks
    .updateMany({ id: lock.id, held_until: { $lt: now } }, { $set: { holder: '', held_until: 0 } })
    .catch(() => {});
  const taken = await locks.updateMany(
    { id: lock.id, holder: '' },
    { $set: { holder, held_until: now + LOCK_TTL_MS } }
  );
  return taken && taken.updated === 1 ? lock.id : null;
}

export async function releaseLock(base44, key, lockId, holder) {
  if (!lockId) return;
  await base44.asServiceRole.entities.ClaimLock.updateMany(
    { id: lockId, holder },
    { $set: { holder: '', held_until: 0 } }
  ).catch(() => {});
}

// ── Paying out ───────────────────────────────────────────────────────────────
// A wallet that holds the PLUNCH line is paid directly; one that does not gets a
// balance only it can claim, which the app's page claims together with the
// trustline in a single approval. Two submissions landing in the same ledger
// collide on the app wallet's sequence number, and a sequence conflict means the
// payment never applied, so it is safe to rebuild once.
export async function sendPlunch({ server, funder, destination, amount, trustline, memo }) {
  const build = (source) => {
    const builder = new StellarSdk.TransactionBuilder(source, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    if (trustline) {
      builder.addOperation(
        StellarSdk.Operation.payment({ destination, asset: PLUNCH_ASSET, amount: String(amount) })
      );
    } else {
      builder.addOperation(
        StellarSdk.Operation.createClaimableBalance({
          asset: PLUNCH_ASSET,
          amount: String(amount),
          claimants: [new StellarSdk.Claimant(destination)],
        })
      );
    }
    return builder.addMemo(StellarSdk.Memo.text(memo)).setTimeout(180).build();
  };

  let result = null;
  let failure = null;
  for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
    try {
      const source = await server.loadAccount(funder.publicKey());
      const transaction = build(source);
      transaction.sign(funder);
      result = await server.submitTransaction(transaction);
    } catch (error) {
      failure = error;
      const code = error?.response?.data?.extras?.result_codes?.transaction;
      if (code !== 'tx_bad_seq') break;
    }
  }
  return { result, failure };
}