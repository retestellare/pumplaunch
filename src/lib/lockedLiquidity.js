import * as StellarSdk from '@stellar/stellar-sdk';
import {
  BASE_FEE,
  BASE_PRICE,
  NETWORK_PASSPHRASE,
  bytesToHex,
  fetchPoolFor,
  loadAccount,
  poolShareInfo,
  quoteAsset,
} from '@/lib/stellar';
import { USDC_CODE, USDC_ISSUER } from '@/lib/pools';

// Locked launches open with no minimum while the model is being tested; raising
// this later is the only change needed to enforce one.
export const LOCKED_MIN_DEPOSIT = 0;

// Locked liquidity is gone for good, so one launch may never commit more than
// this much value to it. A single cap for both quote assets, priced in XLM.
export const MAX_LOCKED_XLM = 250;

export function maxLockDeposit(quote = 'xlm', xlmPerUsdc = 0) {
  if (quote !== 'usdc') return MAX_LOCKED_XLM;
  return xlmPerUsdc > 0 ? MAX_LOCKED_XLM / xlmPerUsdc : 0;
}

// The vault needs 1 XLM of base reserve, three trustlines (token, pool shares and
// USDC) and pays its own transaction fees.
export const VAULT_RESERVE_XLM = 3;

const formatAmount = (n) => Number(n).toFixed(7);
const txOptions = { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE };

// One preset ratio for every locked launch: a token is always worth BASE_PRICE
// in XLM, so a USDC launch follows the live XLM/USDC rate.
export function tokensPerQuote(quote, xlmPerUsdc = 0) {
  const perXlm = 1 / BASE_PRICE;
  if (quote !== 'usdc') return perXlm;
  return xlmPerUsdc > 0 ? perXlm * xlmPerUsdc : 0;
}

// What one deposit produces: the tokens that go into the lock with it and the
// tokens the creator keeps. A 50% launch mints the kept tokens on top, so half the
// supply sits in the lock; a 100% launch mints only what the lock absorbs, so the
// creator keeps none. Either way the pool opens at exactly the fixed ratio, so the
// launch price never depends on the split.
export function planLockedLaunch({ quote = 'xlm', deposit, xlmPerUsdc = 0, lockPercent = 50 }) {
  const amount = parseFloat(deposit) || 0;
  const perQuote = tokensPerQuote(quote, xlmPerUsdc);
  const cap = maxLockDeposit(quote, xlmPerUsdc);
  const overCap = cap > 0 && amount > cap;
  const ready = amount > 0 && perQuote > 0 && !overCap;
  const fullLock = Number(lockPercent) >= 100;
  const matched = ready ? amount * perQuote : 0;
  const creatorTokens = fullLock ? 0 : matched;
  const vaultTokens = matched;
  return {
    quote,
    lockPercent: fullLock ? 100 : 50,
    deposit: ready ? amount : 0,
    tokensPerQuote: perQuote,
    creatorTokens,
    vaultTokens,
    supply: creatorTokens + vaultTokens,
    maxDeposit: cap,
    overCap,
    ready,
  };
}

// How much XLM the vault account is funded with: its reserves and fees, plus the
// deposit itself when the launch is quoted in XLM.
export function vaultFunding(deposit, quote) {
  return VAULT_RESERVE_XLM + (quote === 'usdc' ? 0 : parseFloat(deposit) || 0);
}

export function newVaultKeypair() {
  return StellarSdk.Keypair.random();
}

// 1. The vault is a separate account funded by the creator, so the deposit never
//    sits on a wallet that can still sign for it.
export function buildVaultCreationTransaction({ sourceAccount, vaultAddress, startingBalance }) {
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, txOptions);
  tx.addOperation(
    StellarSdk.Operation.createAccount({
      destination: vaultAddress,
      startingBalance: formatAmount(startingBalance),
    })
  );
  return tx.setTimeout(300).build();
}

// 2. Trustlines the vault needs to hold the deposit, the matched half of the
//    supply, and the pool shares the deposit mints.
export function buildVaultTrustTransaction({ vaultAccount, assetCode, issuer, quote = 'xlm' }) {
  const { poolAsset } = poolShareInfo(assetCode, issuer, quote);
  const tx = new StellarSdk.TransactionBuilder(vaultAccount, txOptions);
  if (quote === 'usdc') tx.addOperation(StellarSdk.Operation.changeTrust({ asset: quoteAsset('usdc') }));
  tx.addOperation(StellarSdk.Operation.changeTrust({ asset: new StellarSdk.Asset(assetCode, issuer) }));
  tx.addOperation(StellarSdk.Operation.changeTrust({ asset: poolAsset }));
  return tx.setTimeout(300).build();
}

// 3. The creator hands over the matched half of the supply, and the USDC deposit
//    when the launch is quoted in USDC (an XLM deposit is funded with the account).
export function buildVaultFundingTransfer({
  sourceAccount,
  vaultAddress,
  assetCode,
  issuer,
  quote = 'xlm',
  tokenAmount,
  deposit = 0,
}) {
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, txOptions);
  tx.addOperation(
    StellarSdk.Operation.payment({
      destination: vaultAddress,
      asset: new StellarSdk.Asset(assetCode, issuer),
      amount: formatAmount(tokenAmount),
    })
  );
  if (quote === 'usdc' && deposit > 0) {
    tx.addOperation(
      StellarSdk.Operation.payment({
        destination: vaultAddress,
        asset: quoteAsset('usdc'),
        amount: formatAmount(deposit),
      })
    );
  }
  return tx.setTimeout(300).build();
}

// 4. The deposit enters the pool from the vault and the vault loses its only
//    signer in the same transaction. From that ledger close on nobody — creator,
//    platform or anyone else — can sign for it, so the shares can never be
//    redeemed and the liquidity can never be withdrawn.
export function buildVaultDepositAndLockTransaction({
  vaultAccount,
  assetCode,
  issuer,
  quote = 'xlm',
  deposit,
  tokenAmount,
}) {
  const { poolAsset, quoteFirst } = poolShareInfo(assetCode, issuer, quote);
  const poolId = bytesToHex(
    StellarSdk.getLiquidityPoolId('constant_product', poolAsset.getLiquidityPoolParameters())
  );

  const tx = new StellarSdk.TransactionBuilder(vaultAccount, txOptions);
  tx.addOperation(
    StellarSdk.Operation.liquidityPoolDeposit({
      liquidityPoolId: poolId,
      maxAmountA: formatAmount(quoteFirst ? deposit : tokenAmount),
      maxAmountB: formatAmount(quoteFirst ? tokenAmount : deposit),
      minPrice: { n: 1, d: 100000000 },
      maxPrice: { n: 1, d: 1000 },
    })
  );
  tx.addOperation(StellarSdk.Operation.setOptions({ masterWeight: 0 }));
  return tx.setTimeout(300).build();
}

// What the vault already holds, so a launch that was interrupted resumes at the
// step it stopped on instead of repeating transactions.
export async function readVaultState({ vaultAddress, assetCode, issuer, quote = 'xlm' }) {
  const [account, pool] = await Promise.all([
    loadAccount(vaultAddress),
    fetchPoolFor(assetCode, issuer, quote),
  ]);

  const balances = account?.balances || [];
  const held = (code, iss) => balances.find((b) => b.asset_code === code && b.asset_issuer === iss);
  const token = held(assetCode, issuer);
  const quoteBalance =
    quote === 'usdc'
      ? parseFloat(held(USDC_CODE, USDC_ISSUER)?.balance || 0)
      : parseFloat(balances.find((b) => b.asset_type === 'native')?.balance || 0);

  return {
    exists: !!account,
    // An account with no signers left cannot authorise anything, ever again.
    locked: !!account && (account.signers || []).length === 0,
    hasTokenTrustline: !!token,
    hasPoolTrustline: balances.some((b) => b.asset_type === 'liquidity_pool_shares'),
    hasQuoteTrustline: quote === 'usdc' ? !!held(USDC_CODE, USDC_ISSUER) : true,
    tokenBalance: token ? parseFloat(token.balance) : 0,
    quoteBalance,
    pool,
  };
}