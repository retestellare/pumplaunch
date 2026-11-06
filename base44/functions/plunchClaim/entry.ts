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

    if (action === 'status') {
      return reply({
        amount: REWARD_AMOUNT,
        trustline: hasTrustline,
        balance: plunchBalance(account),
        pool,
        eligible: hasTrustline && !waiting && !locked && pool >= REWARD_AMOUNT,
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
      const open = await base44.asServiceRole.entities.PlunchClaim.filter(
        { wallet_address: address, status: 'pending' },
        { sort: '-created_date', limit: 1 }
      );
      const pending = open?.items?.[0];
      if (!pending) {
        return reply({ error: 'No drop is waiting for this wallet.' }, 404);
      }
      const tx = await server.transactions().transaction(txHash).catch(() => null);
      if (!tx || tx.successful !== true) {
        return reply({ error: 'That claim is not on chain yet. Try again in a moment.' }, 409);
      }
      await base44.asServiceRole.entities.PlunchClaim.update(pending.id, {
        status: 'paid',
        tx_hash: txHash,
      });
      return reply({
        amount: REWARD_AMOUNT,
        tx_hash: txHash,
        claimed_at: new Date().toISOString(),
        next_at: new Date(Date.now() + CLAIM_WINDOW_MS).toISOString(),
      });
    }

    if (waiting) {
      return reply({ error: 'This wallet already claimed today.', next_at: new Date(nextAt).toISOString() }, 429);
    }
    if (locked) {
      return reply({ error: 'A claim from this wallet is already being processed.' }, 429);
    }
    if (pool < REWARD_AMOUNT) {
      return reply({ error: 'The daily PLUNCH pool is empty right now.' }, 503);
    }

    // No PLUNCH line yet: the drop is parked in a claimable balance for this wallet,
    // which can then open the line and receive it in ONE signed transaction.
    if (!hasTrustline) {
      const asset = new StellarSdk.Asset(ASSET_CODE, ASSET_ISSUER);

      // A drop already parked for this wallet is reused, never doubled up.
      let balanceId = null;
      try {
        const parked = await server.claimableBalances().claimant(address).asset(asset).limit(5).call();
        const match = (parked?.records || []).find((b) => parseFloat(b.amount) >= REWARD_AMOUNT);
        balanceId = match?.id || null;
      } catch {
        /* no parked drop readable — park a fresh one below */
      }

      if (!balanceId) {
        const claim = await base44.asServiceRole.entities.PlunchClaim.create({
          wallet_address: address,
          amount: REWARD_AMOUNT,
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
                  amount: String(REWARD_AMOUNT),
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
            const match = (parked?.records || []).find((b) => parseFloat(b.amount) >= REWARD_AMOUNT);
            balanceId = match?.id || null;
          } catch {
            /* try again */
          }
        }
        if (!balanceId) {
          await base44.asServiceRole.entities.PlunchClaim.delete(claim.id);
          return reply({ error: 'The drop was reserved but not readable yet. Try again in a moment.' }, 502);
        }
      }

      return reply({
        amount: REWARD_AMOUNT,
        trustline_required: true,
        claimable_balance_id: balanceId,
      });
    }

    // Written before the payment leaves, so a second tap finds the slot taken.
    const claim = await base44.asServiceRole.entities.PlunchClaim.create({
      wallet_address: address,
      amount: REWARD_AMOUNT,
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
              amount: String(REWARD_AMOUNT),
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
      amount: REWARD_AMOUNT,
      tx_hash: result.hash,
      claimed_at: new Date().toISOString(),
      next_at: new Date(Date.now() + CLAIM_WINDOW_MS).toISOString(),
    });
  } catch (error) {
    return reply({ error: error.message }, 500);
  }
}