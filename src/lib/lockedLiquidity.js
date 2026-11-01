import * as StellarSdk from '@stellar/stellar-sdk';
import {
  BASE_FEE,
  BASE_PRICE,
  NETWORK_PASSPHRASE,
  loadAccount,
  poolShareAsset,
} from '@/lib/stellar';

// Locked launches open with no minimum while the model is being tested; raising
// this later is the only change needed to enforce one.
export const LOCKED_MIN_DEPOSIT = 0;

// One preset ratio for every locked launch: a token is always worth BASE_PRICE
// in XLM, so a USDC launch follows the live XLM/USDC rate.
export function tokensPerQuote(quote, xlmPerUsdc = 0) {
  const perXlm = 1 / BASE_PRICE;
  if (quote !== 'usdc') return perXlm;
  return xlmPerUsdc > 0 ? perXlm * xlmPerUsdc : 0;
}

// What one deposit produces: the creator's own tokens, the half that stays in
// the lock, and the supply that ties the two together. The two halves are equal,
// so the pool opens at exactly the fixed ratio.
export function planLockedLaunch({ quote = 'xlm', deposit, xlmPerUsdc = 0 }) {
  const amount = parseFloat(deposit) || 0;
  const perQuote = tokensPerQuote(quote, xlmPerUsdc);
  const ready = amount > 0 && perQuote > 0;
  const creatorTokens = ready ? amount * perQuote : 0;
  const vaultTokens = creatorTokens;
  return {
    quote,
    deposit: ready ? amount : 0,
    tokensPerQuote: perQuote,
    creatorTokens,
    vaultTokens,
    supply: creatorTokens + vaultTokens,
    ready,
  };
}

const formatAmount = (n) => Number(n).toFixed(7);

// `not(unconditional)` is false at every ledger close, so a claimable balance
// with this predicate can never be claimed by anyone — not by the creator.
export const PERMANENTLY_LOCKED = { not: { unconditional: true } };

// Moves the pool shares into a claimable balance nobody can ever claim, which is
// what makes the deposited liquidity impossible to withdraw.
export function buildLockSharesTransaction({ sourceAccount, assetCode, issuer, quote, amount }) {
  const asset = poolShareAsset(assetCode, issuer, quote);
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  tx.addOperation(
    StellarSdk.Operation.createClaimableBalance({
      asset,
      amount: formatAmount(amount),
      claimants: [{ destination: sourceAccount.accountId(), predicate: PERMANENTLY_LOCKED }],
    })
  );

  return tx.setTimeout(300).build();
}

// The pool shares the wallet currently holds. This is the only thing the lock
// step needs, and it is read from the ledger rather than assumed.
export async function fetchPoolShares(address, assetCode, issuer, quote = 'xlm') {
  const asset = poolShareAsset(assetCode, issuer, quote);
  const poolId = StellarSdk.getLiquidityPoolId(
    'constant_product',
    asset.getLiquidityPoolParameters()
  ).toString('hex');

  const account = await loadAccount(address);
  const held = (account?.balances || []).find(
    (b) => b.asset_type === 'liquidity_pool_shares' && b.liquidity_pool_id === poolId
  );
  return held ? held.balance : '0';
}

// Waits for the deposit to show up as shares before the lock is attempted, so a
// slow ledger close cannot leave the liquidity unlocked.
export async function waitForPoolShares(address, assetCode, issuer, quote = 'xlm') {
  for (let i = 0; i < 6; i++) {
    const shares = await fetchPoolShares(address, assetCode, issuer, quote);
    if (parseFloat(shares) > 0) return shares;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return '0';
}

// The id of the claimable balance the lock transaction created, so the token
// page can link straight to the proof on the explorer.
export function claimableBalanceId(result) {
  try {
    const res = StellarSdk.xdr.TransactionResult.fromXDR(result.result_xdr, 'base64');
    for (const op of res.result().results()) {
      const tr = op.tr();
      if (tr.switch().name !== 'createClaimableBalance') continue;
      const cb = tr.createClaimableBalanceResult();
      if (cb.switch().name !== 'createClaimableBalanceSuccess') continue;
      return `00000000${cb.balanceId().v0().toString('hex')}`;
    }
  } catch {
    /* the id is informative only */
  }
  return '';
}