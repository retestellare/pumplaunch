// King of the Hill — the staked throne.
//
// A challenge is a real XLM payment to the platform's central wallet carrying a
// unique KOTH memo. Nothing the client says about that payment is trusted: every
// fact acted on here (transaction success, source account, destination, memo and
// amount) is read back from Horizon, so a caller can only point at a transaction,
// never assert one. The platform wallet itself comes from the app's own secret.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { Keypair, StrKey } from 'npm:@stellar/stellar-sdk@17.1.0';

const HORIZON = 'https://horizon.stellar.org';
const MEMO_PREFIX = 'KOTH';
const MIN_OPENING_XLM = 1;
const DUST = 1e-7;

function platformAddress() {
  return Keypair.fromSecret(secrets.get('PUMPLAUNCH_FUNDER_SECRET')).publicKey();
}

// The memo is the only link between a payment and the token it nominates, so it
// carries a readable token hint plus a random code — short of Stellar's 28-byte
// text limit, and unique per challenge.
function memoFor(symbol, code) {
  const clean =
    String(symbol || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 4) || 'TOKEN';
  return `${MEMO_PREFIX}-${clean}-${code}`;
}

async function horizon(path) {
  const res = await fetch(`${HORIZON}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  return res.json();
}

async function loadKing(base44) {
  const list = await base44.asServiceRole.entities.KothKing.list('-created_date', 1);
  return list[0] || null;
}

async function reject(base44, challenge, reason) {
  await base44.asServiceRole.entities.KothChallenge.update(challenge.id, {
    status: 'invalid',
    error: reason,
  });
}

// The XLM that actually arrived at the platform wallet in this transaction.
async function stakePaid(transactionHash, destination, expected) {
  const payments = await horizon(`/transactions/${transactionHash}/payments`);
  let best = 0;
  for (const p of payments?._embedded?.records || []) {
    if (p.type !== 'payment' || p.asset_type !== 'native' || p.to !== destination) continue;
    const amount = parseFloat(p.amount) || 0;
    if (amount + DUST < expected) continue;
    if (amount > best) best = amount;
  }
  return best || null;
}

// A verified stake takes the throne only if it beats the standing bid; a smaller
// stake is recorded as outbid and leaves the King where he is. A transaction hash
// can never award the throne twice.
async function settle(base44, challenge, { hash, source, amount }) {
  if (challenge.tx_hash) return challenge;
  const seen = await base44.asServiceRole.entities.KothChallenge.filter({ tx_hash: hash }, '-created_date', 1);
  if (seen.length) return challenge;

  const king = await loadKing(base44);
  const standing = Number(king?.bid_xlm) || 0;
  const wins = amount > standing;

  if (wins) {
    const throne = {
      token_id: challenge.token_id,
      token_symbol: challenge.token_symbol,
      token_name: challenge.token_name,
      token_image: challenge.token_image,
      bid_xlm: amount,
      challenger_wallet: source,
      reign_start: new Date().toISOString(),
      tx_hash: hash,
    };
    if (king) await base44.asServiceRole.entities.KothKing.update(king.id, throne);
    else await base44.asServiceRole.entities.KothKing.create(throne);
  }

  const status = wins ? 'won' : 'outbid';
  await base44.asServiceRole.entities.KothChallenge.update(challenge.id, {
    status,
    amount_xlm: amount,
    tx_hash: hash,
  });
  return { ...challenge, status, amount_xlm: amount, tx_hash: hash };
}

// Checks one transaction the client reported, entirely against the chain.
async function settleFromHash(base44, challenge, hash, destination) {
  const tx = await horizon(`/transactions/${hash}`);
  if (!tx) return null;
  if (!tx.successful) {
    await reject(base44, challenge, 'That transaction failed on the network.');
    return null;
  }
  if (tx.memo_type !== 'text' || tx.memo !== challenge.memo) {
    await reject(base44, challenge, 'The payment carried a different memo than this challenge.');
    return null;
  }
  if (tx.source_account !== challenge.wallet_address) {
    await reject(base44, challenge, 'The payment came from a wallet other than the challenger.');
    return null;
  }
  const paid = await stakePaid(hash, destination, Number(challenge.amount_xlm) || 0);
  if (!paid) {
    await reject(base44, challenge, 'No matching XLM stake reached the platform wallet.');
    return null;
  }
  return settle(base44, challenge, { hash, source: tx.source_account, amount: paid });
}

// Incoming stakes are also swept up from the platform wallet's own payment
// history, so a challenge completes even if the challenger closed the app before
// reporting the result.
async function reconcile(base44, destination) {
  const pending = await base44.asServiceRole.entities.KothChallenge.filter(
    { status: 'pending' },
    '-created_date',
    25
  );
  if (!pending.length) return [];

  const payments = await horizon(`/accounts/${destination}/payments?order=desc&limit=50`);
  const settled = [];
  for (const p of payments?._embedded?.records || []) {
    if (p.type !== 'payment' || p.asset_type !== 'native' || p.to !== destination) continue;
    const candidates = pending.filter((c) => !c.tx_hash && c.wallet_address === p.from);
    if (!candidates.length) continue;

    const tx = await horizon(`/transactions/${p.transaction_hash}`);
    if (!tx || !tx.successful || tx.memo_type !== 'text') continue;
    const challenge = candidates.find((c) => c.memo === tx.memo);
    if (!challenge) continue;

    const amount = parseFloat(p.amount) || 0;
    if (amount + DUST < (Number(challenge.amount_xlm) || 0)) continue;

    const done = await settle(base44, challenge, { hash: tx.hash, source: p.from, amount });
    challenge.tx_hash = tx.hash;
    if (done) settled.push(done);
  }
  return settled;
}

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'config';
    const base44 = createClientFromRequest(req);

    let destination: string;
    try {
      destination = platformAddress();
    } catch (e) {
      return Response.json(
        { error: 'The platform wallet is not configured correctly.' },
        { status: 500 }
      );
    }

    if (action === 'config') {
      // Best effort: a sweep failure must not stop the banner from rendering.
      try {
        await reconcile(base44, destination);
      } catch (e) {
        /* the throne still reads from the database */
      }
      const king = await loadKing(base44);
      return Response.json({
        destination,
        memo_prefix: MEMO_PREFIX,
        min_opening_xlm: MIN_OPENING_XLM,
        min_next_bid: king ? Number(king.bid_xlm) || 0 : 0,
        king: king || null,
      });
    }

    if (action === 'challenge') {
      const { wallet_address, token_id, amount_xlm } = body;
      if (!StrKey.isValidEd25519PublicKey(wallet_address || '')) {
        return Response.json({ error: 'Connect a Stellar wallet before challenging.' }, { status: 400 });
      }
      const amount = Number(amount_xlm);
      if (!(amount >= MIN_OPENING_XLM)) {
        return Response.json({ error: `The smallest stake is ${MIN_OPENING_XLM} XLM.` }, { status: 400 });
      }
      const token = await base44.asServiceRole.entities.Token.get(token_id).catch(() => null);
      if (!token) {
        return Response.json({ error: 'That token is not on PumpLaunch.' }, { status: 400 });
      }

      const king = await loadKing(base44);
      const standing = Number(king?.bid_xlm) || 0;
      if (amount <= standing) {
        return Response.json(
          { error: `The stake must beat the standing bid of ${standing} XLM.` },
          { status: 400 }
        );
      }

      const code = crypto.randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
      const memo = memoFor(token.symbol, code);
      const created = await base44.asServiceRole.entities.KothChallenge.create({
        wallet_address,
        token_id: token.id,
        token_symbol: token.symbol,
        token_name: token.name,
        token_image: token.image_url,
        amount_xlm: amount,
        memo,
        destination,
        status: 'pending',
      });

      return Response.json({ id: created.id, memo, destination, amount_xlm: amount });
    }

    if (action === 'verify') {
      const { challenge_id, tx_hash } = body;
      const challenge = await base44.asServiceRole.entities.KothChallenge.get(challenge_id).catch(() => null);
      if (!challenge) return Response.json({ error: 'Challenge not found.' }, { status: 404 });

      if (!challenge.tx_hash) {
        if (tx_hash) await settleFromHash(base44, challenge, tx_hash, destination);
        else await reconcile(base44, destination);
      }

      const [fresh, king] = await Promise.all([
        base44.asServiceRole.entities.KothChallenge.get(challenge.id).catch(() => challenge),
        loadKing(base44),
      ]);

      return Response.json({
        status: fresh.status,
        error: fresh.error || null,
        challenge: {
          id: fresh.id,
          memo: fresh.memo,
          amount_xlm: fresh.amount_xlm,
          status: fresh.status,
          tx_hash: fresh.tx_hash || null,
        },
        king: king || null,
      });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}