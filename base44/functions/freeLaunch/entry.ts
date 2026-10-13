import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import * as StellarSdk from 'npm:@stellar/stellar-sdk@17.1.0';
import { secrets } from 'base44:runtime';

const HORIZON_URL = 'https://horizon.stellar.org';
const BASE_FEE = '100';

// The promo launch: 100% Auto-Pool into a single XLM pool with 5 XLM of initial
// liquidity. It costs the creator 8.01 spendable XLM — 5 liquidity + 2 issuer
// reserve + 1 in pool reserves + fees. "Spendable" excludes the account's own
// 1 XLM base reserve (2 x 0.5), so the wallet is topped up to 9.01 raw XLM.
const PROMO_LIQUIDITY_XLM = 5;
const PROMO_REQUIRED_XLM = 8.01;
const PROMO_TOPUP_TARGET_XLM = 9.01;

function isWalletAddress(value) {
  return typeof value === 'string' && /^G[A-Z2-7]{55}$/.test(value);
}

async function loadAccount(address) {
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${address}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function rawXlm(account) {
  if (!account) return 0;
  const entry = (account.balances || []).find((b) => b.asset_type === 'native');
  return entry ? parseFloat(entry.balance) || 0 : 0;
}

// filter() answers with an array here, but a page object is tolerated so a
// changed query shape can never read as "no records".
function records(result) {
  return Array.isArray(result) ? result : result?.items || [];
}

function round7(n) {
  return Math.round(n * 1e7) / 1e7;
}

// One free launch per wallet, and only before the wallet has launched anything:
// the whole point is to get a first-time creator trading.
async function readEligibility(base44, address) {
  const [grants, launches] = await Promise.all([
    base44.asServiceRole.entities.FreeLaunch.filter({ wallet_address: address, status: 'granted' }),
    base44.asServiceRole.entities.Token.filter({ creator: address }),
  ]);
  if (records(grants).length > 0) return 'This wallet has already used its free launch.';
  if (records(launches).length > 0) return 'The free launch is for first-time creators — this wallet has already launched a token.';
  return null;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';
    const address = body.wallet_address;

    if (!isWalletAddress(address)) {
      return Response.json({ error: 'A valid Stellar wallet address is required.' }, { status: 400 });
    }
    if (action !== 'status' && action !== 'fund') {
      return Response.json({ error: 'Unknown action.' }, { status: 400 });
    }

    const reason = await readEligibility(base44, address);
    const account = await loadAccount(address);
    const raw = rawXlm(account);

    const snapshot = {
      eligible: !reason,
      reason,
      balance_xlm: raw,
      required_xlm: PROMO_REQUIRED_XLM,
      liquidity_xlm: PROMO_LIQUIDITY_XLM,
    };

    if (action === 'status' || reason) {
      return Response.json({ ...snapshot, funded: false });
    }

    // A wallet that already covers the launch keeps its own XLM: nothing is sent.
    const shortfall = PROMO_TOPUP_TARGET_XLM - raw;
    if (shortfall <= 0.0000001) {
      return Response.json({ ...snapshot, funded: false, enough: true });
    }

    const funder = StellarSdk.Keypair.fromSecret(secrets.get('PUMPLAUNCH_FUNDER_SECRET'));
    const funderAccount = await loadAccount(funder.publicKey());
    if (!funderAccount) {
      return Response.json({ ...snapshot, funded: false, error: 'The free-launch funding wallet was not found on Stellar.' });
    }

    const amount = round7(Math.min(shortfall, PROMO_TOPUP_TARGET_XLM));
    if (rawXlm(funderAccount) < amount + 1) {
      return Response.json({ ...snapshot, funded: false, error: 'The free-launch fund is empty — add XLM to the funding wallet.' });
    }

    const tx = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(funder.publicKey(), funderAccount.sequence),
      { fee: BASE_FEE, networkPassphrase: StellarSdk.Networks.PUBLIC }
    )
      .addOperation(
        StellarSdk.Operation.payment({
          destination: address,
          asset: StellarSdk.Asset.native(),
          amount: amount.toFixed(7),
        })
      )
      .addMemo(StellarSdk.Memo.text('Stellar Pump free launch'))
      .setTimeout(60)
      .build();
    tx.sign(funder);

    const submitted = await fetch(`${HORIZON_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ tx: tx.toEnvelope().toXDR('base64') }),
      signal: AbortSignal.timeout(30000),
    });
    const payload = await submitted.json().catch(() => ({}));

    if (!submitted.ok) {
      const codes = payload?.extras?.result_codes;
      const detail = codes ? JSON.stringify(codes) : payload?.title || 'the payment was rejected';
      await base44.asServiceRole.entities.FreeLaunch.create({
        wallet_address: address,
        status: 'failed',
        amount_xlm: amount,
        error: String(detail).slice(0, 300),
      });
      return Response.json({ ...snapshot, funded: false, error: `Could not send the free-launch XLM: ${detail}` });
    }

    await base44.asServiceRole.entities.FreeLaunch.create({
      wallet_address: address,
      status: 'granted',
      amount_xlm: amount,
      tx_hash: payload.hash || '',
    });

    return Response.json({ ...snapshot, funded: true, amount_xlm: amount, tx_hash: payload.hash || '' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}