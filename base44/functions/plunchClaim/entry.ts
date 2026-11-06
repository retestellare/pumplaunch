import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import * as StellarSdk from 'npm:@stellar/stellar-sdk@17.1.0';

const HORIZON_URL = 'https://horizon.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.PUBLIC;
const REWARD_AMOUNT = 90000;
const ASSET_CODE = 'PLUNCH';
const ASSET_ISSUER = 'GC37N3TEZDIXDIGZC4PYM2ZTWE5ASWDDJGGXIPWLBGNMFROOBFF5MP2D';
const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;
// A claim holds the wallet's slot while its payment is on the wire.
const CLAIM_LOCK_MS = 3 * 60 * 1000;

const HISTORY_LIMIT = 30;

const reply = (body, status = 200) => Response.json(body, { status });

function plunchLine(account) {
  return (account.balances || []).find(
    (line) => line.asset_code === ASSET_CODE && line.asset_issuer === ASSET_ISSUER
  );
}

const plunchBalance = (account) => {
  const line = plunchLine(account);
  return line ? parseFloat(line.balance) : 0;
};

// Wallet-signed rewards: this endpoint has no app-user session to scope by, so the
// claim records are read and written with the service role and are the authority on
// who has already been paid. Clients can read them but never write them.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = ['status', 'confirm'].includes(body.action) ? body.action : 'claim';
    const address = String(body.wallet_address || '').trim();

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
      return reply({ error: 'Connect a valid Stellar wallet to continue.' }, 400);
    }

    const server = new StellarSdk.Horizon.Server(HORIZON_URL);

    // The recipient must exist on mainnet and be able to hold PLUNCH.
    let account;
    try {
      account = await server.loadAccount(address);
    } catch (error) {
      return reply({ error: 'This wallet has no activity on Stellar mainnet yet.' }, 400);
    }
    const line = plunchLine(account);
    const hasTrustline = Boolean(line) && line.is_authorized !== false;

    const history = await base44.asServiceRole.entities.PlunchClaim.filter(
      { wallet_address: address },
      { sort: '-created_date', limit: HISTORY_LIMIT }
    );
    const claims = history?.items || [];

    // A wallet can also claim a parked drop straight from its own wallet app. The
    // chain is the truth: a pending record whose balance was already claimed is
    // closed here, so it can never unlock a second drop.
    const openPending = claims.filter((claim) => claim.status === 'pending');
    if (openPending.length) {
      try {
        const recent = await server.operations().forAccount(address).order('desc').limit(10).call();
        for (const record of openPending) {
          // The app only ever parks PLUNCH for a wallet, so a claim of any balance
          // after a pending record was opened is that drop being collected.
          const claimOp = (recent.records || []).find(
            (op) =>
              op.type === 'claim_claimable_balance' &&
              new Date(op.created_at) >= new Date(record.created_date)
          );
          if (!claimOp) continue;
          record.status = 'paid';
          record.tx_hash = claimOp.transaction_hash;
          await base44.asServiceRole.entities.PlunchClaim.update(record.id, {
            status: 'paid',
            tx_hash: claimOp.transaction_hash,
          });
        }
      } catch {
        /* chain read is best effort */
      }
    }

    const lastPaid = claims.find((claim) => claim.status === 'paid');
    const lastPaidAt = lastPaid ? new Date(lastPaid.created_date).getTime() : 0;
    const nextAt = lastPaidAt ? lastPaidAt + CLAIM_WINDOW_MS : 0;
    const waiting = nextAt > Date.now();
    const locked = claims.some(
      (claim) => claim.status === 'pending' && Date.now() - new Date(claim.created_date).getTime() < CLAIM_LOCK_MS
    );

    // The app's own funded wallet pays the reward.
    const funder = StellarSdk.Keypair.fromSecret(secrets.get('PUMPLAUNCH_FUNDER_SECRET'));
    const funderAccount = await server.loadAccount(funder.publicKey());
    const pool = plunchBalance(funderAccount);
    // The drop is the full reward while the faucet can cover it. When the pool runs
    // low the claim still goes through for everything it holds, and the card shows
    // that amount instead of a reward the wallet would never receive.
    const drop = Math.min(REWARD_AMOUNT, Math.floor(pool));

    if (action === 'status') {
      return reply({
        amount: drop,
        trustline: hasTrustline,
        balance: plunchBalance(account),
        pool,
        eligible: hasTrustline && !waiting && !locked && drop >= 1,
        next_at: waiting ? new Date(nextAt).toISOString() : null,
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
        await new Promise((r) => setTimeout(r, 1500));
        tx = await readTx();
      }
      if (!tx || tx.successful !== true) {
        // The wallet already submitted the claim, so the drop is reported as landed
        // and the window starts now. The record stays pending and the next status
        // call closes it from the chain, so nothing can be paid twice.
        const pendingRead = await base44.asServiceRole.entities.PlunchClaim.filter(
          { wallet_address: address, status: 'pending' },
          { sort: '-created_date', limit: 1 }
        );
        return reply({
          amount: pendingRead?.items?.[0]?.amount || drop,
          tx_hash: txHash,
          claimed_at: new Date().toISOString(),
          verified: false,
          next_at: new Date(Date.now() + CLAIM_WINDOW_MS).toISOString(),
        });
      }
      const openRecord = await base44.asServiceRole.entities.PlunchClaim.filter(
        { wallet_address: address, status: 'pending' },
        { sort: '-created_date', limit: 1 }
      );
      const pending = openRecord?.items?.[0];
      if (pending) {
        await base44.asServiceRole.entities.PlunchClaim.update(pending.id, {
          status: 'paid',
          tx_hash: txHash,
        });
      }
      return reply({
        amount: pending?.amount || drop,
        tx_hash: txHash,
        claimed_at: new Date().toISOString(),
        next_at: new Date(Date.now() + CLAIM_WINDOW_MS).toISOString(),
      });
    }

    if (waiting) {
      return reply({ error: 'This wallet already claimed today.', next_at: new Date(nextAt).toISOString() }, 429);
    }
    // One drop per wallet. A balance already parked for this wallet IS today's drop:
    // it is handed back so the wallet claims it in a single approval, whether or not
    // the line is open yet. Parking or paying a second one is what paid a wallet twice.
    const asset = new StellarSdk.Asset(ASSET_CODE, ASSET_ISSUER);
    let parkedId = null;
    let parkedAmount = 0;
    try {
      const parked = await server.claimableBalances().claimant(address).asset(asset).limit(5).call();
      const match = (parked?.records || []).find((b) => parseFloat(b.amount) > 0);
      parkedId = match?.id || null;
      parkedAmount = match ? Math.floor(parseFloat(match.amount)) : 0;
    } catch {
      /* nothing readable — the normal path below decides */
    }
    if (parkedId) {
      return reply({
        amount: parkedAmount || drop,
        trustline_required: !hasTrustline,
        claimable_balance_id: parkedId,
      });
    }

    if (locked) {
      return reply({ error: 'Your last claim is still settling. Try again in a minute.' }, 429);
    }
    if (drop < 1) {
      return reply({ error: 'The daily PLUNCH pool is empty right now.' }, 503);
    }

    // No PLUNCH line yet: the drop is parked in a claimable balance for this wallet,
    // which can then open the line and receive it in ONE signed transaction.
    if (!hasTrustline) {
      let balanceId = null;
      const claim = await base44.asServiceRole.entities.PlunchClaim.create({
        wallet_address: address,
        amount: drop,
        status: 'pending',
      });

      let result = null;
      let failure = null;
      for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
        try {
          const source = attempt === 0 ? funderAccount : await server.loadAccount(funder.publicKey());
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

      if (!result) {
        await base44.asServiceRole.entities.PlunchClaim.delete(claim.id);
        const codes = failure?.response?.data?.extras?.result_codes;
        const detail = codes?.operations?.join(', ') || codes?.transaction || failure?.message;
        return reply({ error: `The drop could not be reserved (${detail}). Nothing was sent.` }, 502);
      }

      // Horizon indexes the new balance a beat after the ledger closes.
      for (let i = 0; i < 5 && !balanceId; i += 1) {
        if (i > 0) await new Promise((r) => setTimeout(r, 1200));
        try {
          const parked = await server.claimableBalances().claimant(address).asset(asset).limit(5).call();
          const match = (parked?.records || []).find((b) => parseFloat(b.amount) > 0);
          balanceId = match?.id || null;
        } catch {
          /* try again */
        }
      }
      if (!balanceId) {
        await base44.asServiceRole.entities.PlunchClaim.delete(claim.id);
        return reply({ error: 'The drop was reserved but not readable yet. Try again in a moment.' }, 502);
      }

      return reply({
        amount: drop,
        trustline_required: true,
        claimable_balance_id: balanceId,
      });
    }

    // Written before the payment leaves, so a second tap finds the slot taken.
    const claim = await base44.asServiceRole.entities.PlunchClaim.create({
      wallet_address: address,
      amount: drop,
      status: 'pending',
    });

    // Two claims landing in the same ledger collide on the app wallet's sequence
    // number. A sequence conflict means the payment never applied, so it is safe
    // to rebuild once against fresh sequence state.
    let result = null;
    let failure = null;
    for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
      try {
        const source = attempt === 0 ? funderAccount : await server.loadAccount(funder.publicKey());
        const transaction = new StellarSdk.TransactionBuilder(source, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(
            StellarSdk.Operation.payment({
              destination: address,
              asset: new StellarSdk.Asset(ASSET_CODE, ASSET_ISSUER),
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
      // Nothing left the wallet, so the day's claim stays open.
      await base44.asServiceRole.entities.PlunchClaim.delete(claim.id);
      const codes = failure?.response?.data?.extras?.result_codes;
      const detail = codes?.operations?.join(', ') || codes?.transaction || failure?.message;
      return reply({ error: `The payment did not go through (${detail}). Nothing was sent.` }, 502);
    }

    await base44.asServiceRole.entities.PlunchClaim.update(claim.id, {
      status: 'paid',
      tx_hash: result.hash,
    });

    return reply({
      amount: drop,
      tx_hash: result.hash,
      claimed_at: new Date().toISOString(),
      next_at: new Date(Date.now() + CLAIM_WINDOW_MS).toISOString(),
    });
  } catch (error) {
    return reply({ error: error.message }, 500);
  }
}