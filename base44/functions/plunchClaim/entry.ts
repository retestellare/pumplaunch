import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import * as StellarSdk from 'npm:@stellar/stellar-sdk@17.1.0';
import { networkHash } from './network.ts';

const HORIZON_URL = 'https://horizon.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.PUBLIC;
// The drop is worth this much XLM: the faucet pays whatever the live rate buys.
const REWARD_XLM = 0.1;
const ASSET_CODE = 'PLUNCH';
const ASSET_ISSUER = 'GC37N3TEZDIXDIGZC4PYM2ZTWE5ASWDDJGGXIPWLBGNMFROOBFF5MP2D';
const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;
// One connection can only trigger a drop an hour apart. Kept short on purpose:
// mobile carrier NAT puts many honest people behind one address.
const NETWORK_WINDOW_MS = 60 * 60 * 1000;
// A pending reservation holds both slots while its payment is on the wire.
const CLAIM_LOCK_MS = 3 * 60 * 1000;
// Only one payout may leave the faucet at a time, and a burst of fresh wallets
// cannot drain it faster than this.
const PAYOUT_GAP_MS = 75 * 1000;
// A held lock frees itself if the invocation dies mid-flight.
const LOCK_TTL_MS = 120 * 1000;
const LOCK_KEY = 'plunch-faucet';

const HISTORY_LIMIT = 30;
const NETWORK_HISTORY_LIMIT = 20;

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CAPTCHA_REQUIRED = 'Complete the captcha to receive the drop.';

// The token a solved challenge hands to the page is spent exactly once. Cloudflare
// refuses a second verification of the same token, and its hash is written to the
// reservation so two requests racing with one token cannot both be paid.
async function captchaHash(token) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`plunch-captcha:${token}`)
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyCaptcha(secret, token) {
  if (!secret || !token) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => null);
    return Boolean(data && data.success === true);
  } catch {
    return false;
  }
}

const reply = (body, status = 200) => Response.json(body, { status });
const at = (record) => new Date(record.created_date).getTime();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function plunchLine(account) {
  return (account.balances || []).find(
    (line) => line.asset_code === ASSET_CODE && line.asset_issuer === ASSET_ISSUER
  );
}

const plunchBalance = (account) => {
  const line = plunchLine(account);
  return line ? parseFloat(line.balance) : 0;
};

// The X account the wallet's profile claims. The faucet keys its daily window on
// it, so sending a fresh Stellar wallet cannot reopen the day.
function xHandleOf(profile) {
  const clean = String(profile?.x_handle || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/^@+/, '')
    .trim();
  return /^[A-Za-z0-9_]{1,15}$/.test(clean) ? clean.toLowerCase() : '';
}

const X_REQUIRED = 'To receive tokens, you must have profile X connected to the platform.';

const PRICE_TTL_MS = 60 * 1000;
let priceCache = { price: 0, at: 0 };

// The PLUNCH/XLM rate comes from the mainnet order book. A tight book is read at its
// mid price; a wide or one-sided book falls back to the side that exists, so a thin
// market can never inflate the reward.
async function plunchPrice(server, asset) {
  if (priceCache.price > 0 && Date.now() - priceCache.at < PRICE_TTL_MS) return priceCache.price;

  let price = 0;
  try {
    const book = await server.orderbook(asset, StellarSdk.Asset.native()).limit(1).call();
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

// ── The faucet's mutex ───────────────────────────────────────────────────────
// A single lock row is flipped from free to held by exactly one invocation: a
// conditional update matches at most one caller, so whoever flips it first owns
// the whole check-then-pay sequence. Everyone else is refused instantly.
async function acquireFaucet(base44, holder) {
  const locks = base44.asServiceRole.entities.ClaimLock;
  let docs = ((await locks.filter({ key: LOCK_KEY }, { sort: 'created_date', limit: 10 }))?.items) || [];
  if (!docs.length) {
    await locks.create({ key: LOCK_KEY, holder: '', held_until: 0 });
    docs = ((await locks.filter({ key: LOCK_KEY }, { sort: 'created_date', limit: 10 }))?.items) || [];
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

async function releaseFaucet(base44, lockId, holder) {
  if (!lockId) return;
  await base44.asServiceRole.entities.ClaimLock.updateMany(
    { id: lockId, holder },
    { $set: { holder: '', held_until: 0 } }
  ).catch(() => {});
}

// ── Chain reads ──────────────────────────────────────────────────────────────
// Has the faucet already paid this wallet since `sinceMs`? Used to settle a
// payment whose submit answer never arrived: an unknown outcome is never a
// reason to free the slot.
async function paidSince(server, funder, address, sinceMs) {
  try {
    const page = await server.payments().forAccount(address).order('desc').limit(10).call();
    return (
      (page?.records || []).find(
        (op) =>
          op.type === 'payment' &&
          op.from === funder &&
          op.asset_code === ASSET_CODE &&
          new Date(op.created_at).getTime() >= sinceMs
      ) || null
    );
  } catch {
    return null;
  }
}

async function waitForPayout(server, funder, address, sinceMs) {
  for (let i = 0; i < 3; i += 1) {
    if (i > 0) await pause(1500);
    const found = await paidSince(server, funder, address, sinceMs);
    if (found) return found;
  }
  return null;
}

// The newest payout the faucet made, read from the chain rather than from a row
// a client could have raced.
async function lastPayoutAt(server, funder) {
  try {
    const page = await server.payments().forAccount(funder).order('desc').limit(5).call();
    const op = (page?.records || []).find((r) => r.type === 'payment' && r.from === funder);
    return op ? new Date(op.created_at).getTime() : 0;
  } catch {
    return 0;
  }
}

async function readParked(server, address, asset) {
  try {
    const page = await server.claimableBalances().claimant(address).asset(asset).limit(5).call();
    const match = (page?.records || []).find((b) => parseFloat(b.amount) > 0);
    return match ? { id: match.id, amount: Math.floor(parseFloat(match.amount)) } : null;
  } catch {
    return null;
  }
}

async function waitForParked(server, address, asset) {
  for (let i = 0; i < 4; i += 1) {
    if (i > 0) await pause(1200);
    const found = await readParked(server, address, asset);
    if (found) return found;
  }
  return null;
}

// Wallet-signed rewards: this endpoint has no app-user session to scope by, so the
// claim records are read and written with the service role and are the authority on
// who has already been paid. Clients can read them but never write them.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = ['status', 'confirm', 'claim'].includes(body.action) ? body.action : 'claim';
    const address = String(body.wallet_address || '').trim();

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
      return reply({ error: 'Connect a valid Stellar wallet to continue.' }, 400);
    }

    const funderSecret = secrets.get('PUMPLAUNCH_FUNDER_SECRET');
    const funder = StellarSdk.Keypair.fromSecret(funderSecret);
    const funderKey = funder.publicKey();
    const asset = new StellarSdk.Asset(ASSET_CODE, ASSET_ISSUER);
    const server = new StellarSdk.Horizon.Server(HORIZON_URL);
    const claimsApi = base44.asServiceRole.entities.PlunchClaim;

    // The X account this wallet's profile claims. It is the identity the daily
    // window is charged to, so one X account gets one drop a day whatever wallets
    // it rotates through.
    const profilePage = await base44.asServiceRole.entities.Profile.filter(
      { wallet_address: address },
      { limit: 1 }
    );
    const xHandle = xHandleOf(profilePage?.items?.[0]);

    // The connection this request came from, as a keyed hash. No raw address is
    // ever written down.
    const network = await networkHash(req, funderSecret);

    if (action === 'status') {
      let account;
      try {
        account = await server.loadAccount(address);
      } catch {
        return reply({ error: 'This wallet has no activity on Stellar mainnet yet.' }, 400);
      }
      const line = plunchLine(account);
      const hasTrustline = Boolean(line) && line.is_authorized !== false;

      const history = await claimsApi.filter(
        { wallet_address: address },
        { sort: '-created_date', limit: HISTORY_LIMIT }
      );
      const claims = history?.items || [];

      const networkHistory = network
        ? await claimsApi.filter(
            { network_hash: network },
            { sort: '-created_date', limit: NETWORK_HISTORY_LIMIT }
          )
        : null;
      const networkClaims = networkHistory?.items || [];

      // The day closes on ANY record from this wallet, paid or still reserved: a
      // reservation whose confirmation lagged is not permission for a second drop.
      const dayStart = Date.now() - CLAIM_WINDOW_MS;
      const lastToday = claims.find((claim) => at(claim) >= dayStart);
      const walletNextAt = lastToday ? at(lastToday) + CLAIM_WINDOW_MS : 0;
      const waiting = Boolean(lastToday);
      const locked = claims.some(
        (claim) => claim.status === 'pending' && Date.now() - at(claim) < CLAIM_LOCK_MS
      );

      // The same connection cannot trigger a second drop within the hour, whichever
      // wallet it asks for.
      const networkStart = Date.now() - NETWORK_WINDOW_MS;
      const lastOnNetwork = networkClaims.find((claim) => at(claim) >= networkStart);
      const networkNextAt = lastOnNetwork ? at(lastOnNetwork) + NETWORK_WINDOW_MS : 0;
      const networkWaiting = Boolean(lastOnNetwork);

      // The 24-hour rule follows the X account, so a wallet swap inside the day
      // finds the same closed window.
      const xHistory = xHandle
        ? await claimsApi.filter({ x_handle: xHandle }, { sort: '-created_date', limit: HISTORY_LIMIT })
        : null;
      const lastOnX = (xHistory?.items || []).find((claim) => at(claim) >= dayStart);
      const xNextAt = lastOnX ? at(lastOnX) + CLAIM_WINDOW_MS : 0;
      const xWaiting = Boolean(lastOnX);

      const funderAccount = await server.loadAccount(funderKey);
      const pool = plunchBalance(funderAccount);
      // The price sets the drop, not a fixed token count: the faucet pays what 0.1 XLM
      // buys right now, so the reward keeps its value as PLUNCH moves. An unreadable
      // market never falls back to a guessed amount.
      const price = await plunchPrice(server, asset);
      const reward = price > 0 ? Math.floor(REWARD_XLM / price) : 0;
      const drop = Math.min(reward, Math.floor(pool));
      const lastPaidAt = await lastPayoutAt(server, funderKey);
      const faucetNextAt = lastPaidAt ? lastPaidAt + PAYOUT_GAP_MS : 0;

      return reply({
        amount: drop,
        price,
        target_xlm: REWARD_XLM,
        trustline: hasTrustline,
        balance: plunchBalance(account),
        pool,
        // Without a linked X account nothing is paid, so the card never offers a
        // request it would have to refuse.
        x_linked: Boolean(xHandle),
        x_handle: xHandle || null,
        x_next_at: xNextAt > Date.now() ? new Date(xNextAt).toISOString() : null,
        eligible:
          hasTrustline &&
          Boolean(xHandle) &&
          !waiting &&
          !xWaiting &&
          !networkWaiting &&
          !locked &&
          Date.now() >= faucetNextAt &&
          drop >= 1,
        next_at: waiting
          ? new Date(walletNextAt).toISOString()
          : xWaiting
          ? new Date(xNextAt).toISOString()
          : networkWaiting
          ? new Date(networkNextAt).toISOString()
          : null,
        network_limited: networkWaiting && !waiting,
        network_next_at: networkWaiting ? new Date(networkNextAt).toISOString() : null,
        faucet_next_at: faucetNextAt > Date.now() ? new Date(faucetNextAt).toISOString() : null,
        // False when the request carries no platform connection address, in which
        // case a claim is refused rather than skipping the one-hour rule.
        network_verified: Boolean(network),
      });
    }

    // A wallet that signed the combined trustline + claim transaction reports it
    // here, so the 24-hour window starts from the drop actually landing.
    if (action === 'confirm') {
      const txHash = String(body.tx_hash || '').trim();
      if (!txHash) {
        return reply({ error: 'Missing the claim transaction.' }, 400);
      }
      // A submitted transaction is read back through the call builder; the lookup
      // itself can miss for a ledger or two, which is a wait, not a failure.
      const readTx = async () => {
        try {
          return await server.transactions().transaction(txHash).call();
        } catch {
          return null;
        }
      };
      // Horizon indexes a submitted transaction a ledger or two after it lands, so
      // the report is given a moment instead of failing on that race.
      let tx = await readTx();
      for (let i = 0; i < 4 && !tx; i += 1) {
        await pause(1500);
        tx = await readTx();
      }
      const openRecord = await claimsApi.filter(
        { wallet_address: address, status: 'pending' },
        { sort: '-created_date', limit: 1 }
      );
      const pending = openRecord?.items?.[0];
      if (!tx || tx.successful !== true) {
        // The wallet already submitted the claim, so the drop is reported as landed
        // and the window starts now. The record stays pending and the next status
        // call closes it from the chain, so nothing can be paid twice.
        return reply({
          amount: pending?.amount || 0,
          tx_hash: txHash,
          claimed_at: new Date().toISOString(),
          verified: false,
          next_at: new Date(Date.now() + CLAIM_WINDOW_MS).toISOString(),
        });
      }
      if (pending) {
        await claimsApi.update(pending.id, { status: 'paid', tx_hash: txHash });
      }
      return reply({
        amount: pending?.amount || 0,
        tx_hash: txHash,
        claimed_at: new Date().toISOString(),
        next_at: new Date(Date.now() + CLAIM_WINDOW_MS).toISOString(),
      });
    }

    // ── claim ────────────────────────────────────────────────────────────────
    // No linked X account, no drop: checked before anything is reserved or sent.
    if (!xHandle) {
      return reply({ error: X_REQUIRED, x_linked: false }, 403);
    }

    // A drop also costs a solved captcha. This runs before anything is reserved:
    // a missing, reused or failed token never reaches the faucet's wallet.
    const captchaToken = String(body.turnstile_token || '').trim();
    if (!captchaToken) {
      return reply({ error: CAPTCHA_REQUIRED, captcha_required: true }, 403);
    }
    const captchaKey = await captchaHash(captchaToken);
    const spentTokens = await claimsApi.filter({ captcha: captchaKey }, { limit: 2 });
    if ((spentTokens?.items || []).length) {
      return reply(
        { error: 'That captcha was already used. Complete a new one.', captcha_required: true },
        403
      );
    }
    if (!(await verifyCaptcha(secrets.get('TURNSTILE_SECRET_KEY'), captchaToken))) {
      return reply(
        { error: 'The captcha check did not pass. Complete it again.', captcha_required: true },
        403
      );
    }

    const holder = crypto.randomUUID();
    const lockId = await acquireFaucet(base44, holder);
    if (!lockId) {
      // Another claim is already in flight: nothing is read, nothing is sent.
      return reply({ error: 'A drop is going out right now. Try again in a moment.' }, 429);
    }

    let claim = null;
    let reservedAt = 0;
    let submitted = false;

    try {
      // 1. The slot is taken in the database FIRST — before any account, price or
      //    chain read — so this row exists before a single token can move, and the
      //    next request already finds it.
      reservedAt = Date.now();
      claim = await claimsApi.create({
        wallet_address: address,
        x_handle: xHandle,
        captcha: captchaKey,
        amount: 0,
        status: 'pending',
        network_hash: network,
      });

      // 1b. One token, one reservation. If a parallel request already reserved this
      //     exact token, the older reservation owns it and this one gives way.
      const tokenHolders = await claimsApi.filter(
        { captcha: captchaKey },
        { sort: 'created_date', limit: 5 }
      );
      const firstHolder = tokenHolders?.items?.[0];
      if (firstHolder && firstHolder.id !== claim.id) {
        await claimsApi.delete(claim.id);
        claim = null;
        return reply(
          { error: 'That captcha was already used. Complete a new one.', captcha_required: true },
          403
        );
      }

      // 2. The recipient must exist on mainnet and be able to hold PLUNCH.
      let account;
      try {
        account = await server.loadAccount(address);
      } catch {
        await claimsApi.delete(claim.id);
        claim = null;
        return reply({ error: 'This wallet has no activity on Stellar mainnet yet.' }, 400);
      }
      const line = plunchLine(account);
      const hasTrustline = Boolean(line) && line.is_authorized !== false;

      // 3. A balance already parked for this wallet IS the day's drop: it is handed
      //    back so the wallet claims it in a single approval. It pays nothing new,
      //    so the reservation is dropped and the day is not charged.
      const parked = await readParked(server, address, asset);
      if (parked) {
        await claimsApi.delete(claim.id);
        claim = null;
        return reply({
          amount: parked.amount,
          trustline_required: !hasTrustline,
          claimable_balance_id: parked.id,
        });
      }

      // No usable connection identity means the one-hour rule cannot be applied,
      // and paying anyway is exactly the hole this closes.
      if (!network) {
        await claimsApi.delete(claim.id);
        claim = null;
        return reply(
          { error: 'Your network connection could not be verified, so no drop can be sent right now.' },
          503
        );
      }

      // 4. Both windows are read with the reservation already on disk, so every
      //    later request sees it no matter how fast it arrives.
      const dayStart = Date.now() - CLAIM_WINDOW_MS;
      const networkStart = Date.now() - NETWORK_WINDOW_MS;
      const [ownHistory, networkHistory, xHistory] = await Promise.all([
        claimsApi.filter({ wallet_address: address }, { sort: '-created_date', limit: HISTORY_LIMIT }),
        claimsApi.filter(
          { network_hash: network },
          { sort: '-created_date', limit: NETWORK_HISTORY_LIMIT }
        ),
        claimsApi.filter({ x_handle: xHandle }, { sort: '-created_date', limit: HISTORY_LIMIT }),
      ]);
      const claims = (ownHistory?.items || []).filter((row) => row.id !== claim.id);
      const networkClaims = (networkHistory?.items || []).filter((row) => row.id !== claim.id);
      const xClaims = (xHistory?.items || []).filter((row) => row.id !== claim.id);

      // A wallet can also claim a parked drop straight from its own wallet app. The
      // chain is the truth: a pending record whose balance was already claimed is
      // closed here, so it can never unlock a second drop.
      const openPending = claims.filter((row) => row.status === 'pending');
      if (openPending.length) {
        try {
          const recent = await server.operations().forAccount(address).order('desc').limit(10).call();
          for (const row of openPending) {
            const claimOp = (recent.records || []).find(
              (op) =>
                op.type === 'claim_claimable_balance' &&
                new Date(op.created_at) >= new Date(row.created_date)
            );
            if (!claimOp) continue;
            await claimsApi.update(row.id, { status: 'paid', tx_hash: claimOp.transaction_hash });
          }
        } catch {
          /* chain read is best effort */
        }
      }

      const lastToday = claims.find((row) => at(row) >= dayStart);
      if (lastToday) {
        await claimsApi.delete(claim.id);
        claim = null;
        return reply(
          {
            error: 'This wallet already claimed today.',
            next_at: new Date(at(lastToday) + CLAIM_WINDOW_MS).toISOString(),
          },
          429
        );
      }

      // One drop a day per X account, whatever wallet asks for it.
      const lastOnX = xClaims.find((row) => at(row) >= dayStart);
      if (lastOnX) {
        const nextAt = new Date(at(lastOnX) + CLAIM_WINDOW_MS).toISOString();
        await claimsApi.delete(claim.id);
        claim = null;
        return reply(
          {
            error: 'This X account already claimed today. The next drop opens in 24 hours.',
            next_at: nextAt,
            x_next_at: nextAt,
          },
          429
        );
      }

      const lastOnNetwork = networkClaims.find((row) => at(row) >= networkStart);
      if (lastOnNetwork) {
        const nextAt = new Date(at(lastOnNetwork) + NETWORK_WINDOW_MS).toISOString();
        await claimsApi.delete(claim.id);
        claim = null;
        return reply(
          {
            error:
              'A drop was already sent from this network in the last hour. If you share a connection, try again a little later.',
            next_at: nextAt,
            network_next_at: nextAt,
          },
          429
        );
      }

      // 5. One payout at a time, however many fresh wallets ask: the chain is the
      //    clock, so a burst of requests cannot send two drops back to back.
      const newestPaid = await claimsApi.filter({ status: 'paid' }, { sort: '-created_date', limit: 1 });
      const newestRowAt = newestPaid?.items?.[0] ? at(newestPaid.items[0]) : 0;
      const lastAt = Math.max(await lastPayoutAt(server, funderKey), newestRowAt);
      if (lastAt && Date.now() - lastAt < PAYOUT_GAP_MS) {
        const nextAt = new Date(lastAt + PAYOUT_GAP_MS).toISOString();
        await claimsApi.delete(claim.id);
        claim = null;
        return reply(
          {
            error: `The faucet is sending another drop. Try again in ${Math.ceil(
              (lastAt + PAYOUT_GAP_MS - Date.now()) / 1000
            )}s.`,
            next_at: nextAt,
            faucet_next_at: nextAt,
          },
          429
        );
      }

      // 6. The app's own funded wallet pays the reward.
      const funderAccount = await server.loadAccount(funderKey);
      const pool = plunchBalance(funderAccount);
      const price = await plunchPrice(server, asset);
      const reward = price > 0 ? Math.floor(REWARD_XLM / price) : 0;
      // The drop is the full reward while the faucet can cover it. When the pool runs
      // low the claim still goes through for everything it holds, and the card shows
      // that amount instead of a reward the wallet would never receive.
      const drop = Math.min(reward, Math.floor(pool));

      if (drop < 1) {
        await claimsApi.delete(claim.id);
        claim = null;
        if (price <= 0) {
          return reply(
            { error: 'The PLUNCH market price cannot be read right now, so no drop can be priced.' },
            503
          );
        }
        return reply({ error: 'The daily PLUNCH pool is empty right now.' }, 503);
      }

      await claimsApi.update(claim.id, { amount: drop });
      claim.amount = drop;

      // 7. Pay. Two submissions landing in the same ledger collide on the app
      // wallet's sequence number; a sequence conflict means the payment never
      // applied, so it is safe to rebuild once against fresh sequence state.
      if (!hasTrustline) {
        let result = null;
        let failure = null;
        submitted = true;
        for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
          try {
            const source = attempt === 0 ? funderAccount : await server.loadAccount(funderKey);
            const transaction = new StellarSdk.TransactionBuilder(source, {
              fee: StellarSdk.BASE_FEE,
              networkPassphrase: NETWORK_PASSPHRASE,
            })
              .addOperation(
                StellarSdk.Operation.createClaimableBalance({
                  asset,
                  amount: String(drop),
                  claimants: [new StellarSdk.Claimant(address)],
                })
              )
              .addMemo(StellarSdk.Memo.text('PLUNCH daily reward'))
              .setTimeout(180)
              .build();
            transaction.sign(funder);
            result = await server.submitTransaction(transaction);
          } catch (error) {
            failure = error;
            const code = error?.response?.data?.extras?.result_codes?.transaction;
            if (code !== 'tx_bad_seq') break;
          }
        }

        // A submit answer that never came back is not a failed payout: the only
        // honest reading is the chain. A parked balance means the drop landed, so
        // the reservation stands and the wallet can still claim it.
        // A rejected submit still gets one chain read: the balance may exist anyway.
        const settled = result ? await waitForParked(server, address, asset) : await readParked(server, address, asset);
        if (!result && !settled) {
          const codes = failure?.response?.data?.extras?.result_codes;
          const detail = codes?.operations?.join(', ') || codes?.transaction || failure?.message;
          await claimsApi.delete(claim.id);
          claim = null;
          return reply({ error: `The drop could not be reserved (${detail}). Nothing was sent.` }, 502);
        }
        if (!settled) {
          // The submit succeeded but Horizon has not indexed the balance yet. The
          // reservation stays pending, so the next request finds the balance and
          // hands it over instead of paying a second time.
          claim = null;
          return reply({ error: 'The drop was reserved but not readable yet. Try again in a moment.' }, 502);
        }

        claim = null;
        return reply({
          amount: settled.amount || drop,
          trustline_required: true,
          claimable_balance_id: settled.id,
        });
      }

      let result = null;
      let failure = null;
      submitted = true;
      for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
        try {
          const source = attempt === 0 ? funderAccount : await server.loadAccount(funderKey);
          const transaction = new StellarSdk.TransactionBuilder(source, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(
              StellarSdk.Operation.payment({
                destination: address,
                asset,
                amount: String(drop),
              })
            )
            .addMemo(StellarSdk.Memo.text('PLUNCH daily reward'))
            .setTimeout(180)
            .build();
          transaction.sign(funder);
          result = await server.submitTransaction(transaction);
        } catch (error) {
          failure = error;
          const code = error?.response?.data?.extras?.result_codes?.transaction;
          if (code !== 'tx_bad_seq') break;
        }
      }

      if (!result) {
        // Never free the slot on a guess: if the chain shows the payment, the drop
        // is recorded as paid and the day stays closed.
        const landed = await waitForPayout(server, funderKey, address, reservedAt);
        if (landed) {
          await claimsApi.update(claim.id, { status: 'paid', tx_hash: landed.transaction_hash });
          claim = null;
          return reply({
            amount: drop,
            tx_hash: landed.transaction_hash,
            claimed_at: new Date().toISOString(),
            next_at: new Date(Date.now() + CLAIM_WINDOW_MS).toISOString(),
          });
        }
        const codes = failure?.response?.data?.extras?.result_codes;
        const detail = codes?.operations?.join(', ') || codes?.transaction || failure?.message;
        await claimsApi.delete(claim.id);
        claim = null;
        return reply({ error: `The payment did not go through (${detail}). Nothing was sent.` }, 502);
      }

      await claimsApi.update(claim.id, { status: 'paid', tx_hash: result.hash });
      claim = null;

      return reply({
        amount: drop,
        tx_hash: result.hash,
        claimed_at: new Date().toISOString(),
        next_at: new Date(Date.now() + CLAIM_WINDOW_MS).toISOString(),
      });
    } catch (error) {
      // A failure of unknown outcome keeps the reservation when the chain shows a
      // payment; a known failure frees both slots for a legitimate retry.
      if (claim) {
        const landed = submitted ? await waitForPayout(server, funderKey, address, reservedAt) : null;
        if (landed) {
          await claimsApi
            .update(claim.id, { status: 'paid', tx_hash: landed.transaction_hash })
            .catch(() => {});
          return reply({
            amount: claim.amount || 0,
            tx_hash: landed.transaction_hash,
            claimed_at: new Date().toISOString(),
            next_at: new Date(Date.now() + CLAIM_WINDOW_MS).toISOString(),
          });
        }
        await claimsApi.delete(claim.id).catch(() => {});
      }
      return reply({ error: error.message }, submitted ? 502 : 500);
    } finally {
      await releaseFaucet(base44, lockId, holder);
    }
  } catch (error) {
    return reply({ error: error.message }, 500);
  }
}