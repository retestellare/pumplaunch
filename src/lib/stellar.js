import * as StellarSdk from '@stellar/stellar-sdk';
import { StellarWalletsKit, ensureKitInit } from './walletKit';
import { USDC_CODE, USDC_ISSUER, poolsForType, toXlm } from './pools';

export { USDC_CODE, USDC_ISSUER };

const HORIZON_URL = 'https://horizon.stellar.org';
export const NETWORK_PASSPHRASE = StellarSdk.Networks.PUBLIC;
export const HOME_DOMAIN = 'pumplaunch.app';
export const BASE_FEE = StellarSdk.BASE_FEE || '100';
const RESERVE_PER_ENTRY = 0.5;

export const BASE_PRICE = 0.000001;
const ISSUER_RESERVE_XLM = 2;

// The asset a market is quoted in. XLM is native; USDC is Circle's mainnet
// credit asset, so any USDC market needs a trustline before it can be spent.
export function quoteAsset(quote) {
  return quote === 'usdc' ? new StellarSdk.Asset(USDC_CODE, USDC_ISSUER) : StellarSdk.Asset.native();
}

export function quoteReserveKey(quote) {
  return quote === 'usdc' ? `${USDC_CODE}:${USDC_ISSUER}` : 'native';
}

// Stellar demands pool reserves in a fixed order, and the deposit amounts follow
// that order — so the pair is sorted before the pool is built.
function assetSortKey(asset) {
  if (asset.isNative()) return '0:native';
  const code = asset.getCode();
  return `${code.length <= 4 ? 1 : 2}:${code}:${asset.getIssuer()}`;
}

function orderedPoolPair(quoteSide, tokenSide) {
  const quoteFirst = assetSortKey(quoteSide) <= assetSortKey(tokenSide);
  const [a, b] = quoteFirst ? [quoteSide, tokenSide] : [tokenSide, quoteSide];
  return { poolAsset: new StellarSdk.LiquidityPoolAsset(a, b, StellarSdk.LiquidityPoolFeeV18), quoteFirst };
}

export const CURVE_PRESETS = {
  slow: { rungs: 6, priceStep: 1.6, label: 'Slow', desc: 'Steady, gradual price growth' },
  medium: { rungs: 10, priceStep: 2.0, label: 'Medium', desc: 'Moderate acceleration as buys come in' },
  fast: { rungs: 16, priceStep: 2.8, label: 'Fast', desc: 'Prices climb quickly after early buys' },
  hyper: { rungs: 24, priceStep: 4.0, label: 'Hyper', desc: 'Volatile spikes — steepest climb' },
};

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

export { server, StellarSdk };

// Horizon answers are cached briefly so several panels looking at the same token
// share one lookup instead of refetching on every mount and tab switch.
const CACHE_TTL = 60 * 1000;
const horizonCache = new Map();

async function horizonJsonSafe(path, ttl = CACHE_TTL) {
  const url = `${HORIZON_URL}${path}`;
  const hit = horizonCache.get(url);
  if (hit && Date.now() - hit.time < ttl) return hit.data;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    horizonCache.set(url, { time: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const ERROR_MAP = {
  tx_bad_seq: 'The transaction used a stale sequence number. Retrying with a fresh one.',
  tx_bad_auth: 'The wallet signature was rejected or invalid.',
  tx_insufficient_fee: 'The network fee was too low. Retrying.',
  tx_no_account: 'Your wallet account was not found on the network.',
  tx_failed: 'One or more operations in the transaction failed.',
  op_underfunded: 'Not enough XLM balance to cover this operation.',
  op_low_reserve: 'Not enough free XLM to hold the new ledger entry — add XLM to cover the reserve.',
  op_under_dest_min: 'The trade would return less than the minimum amount — slippage too high.',
  op_no_trust: 'Your wallet has no trustline for this token.',
  op_not_authorized: 'The issuer has not authorized this operation.',
  op_malformed: 'The operation parameters were invalid.',
  op_too_few_offers: 'No matching offers found in the order book.',
  op_cross_self: 'Cannot trade with yourself.',
  op_already_exists: 'This ledger entry already exists.',
  transient_network: 'Network error talking to Stellar. Retrying.',
};

export class StellarError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'StellarError';
    this.stellarCode = code;
  }
}

export function explainError(e) {
  const extras = e?.response?.data?.extras;
  const rc = extras?.result_codes;
  let code = null;
  if (rc) {
    const ops = rc.operations || [];
    if (rc.transaction && rc.transaction !== 'tx_success' && rc.transaction !== 'tx_failed') {
      code = rc.transaction;
    } else if (ops.length) {
      code = ops.find((o) => o && o !== 'op_success') || ops[0];
    } else if (rc.transaction) {
      code = rc.transaction;
    }
  }
  if (!code) {
    const status = e?.response?.status;
    const msg = (e?.message || '').toLowerCase();
    if ((status && status >= 500) || /timeout|aborted|network|fetch failed|econnreset/i.test(msg)) {
      code = 'transient_network';
    }
  }
  const message = (code && ERROR_MAP[code]) || e?.message || String(e);
  return { message, code };
}

export function isTransientError(e) {
  const code = e?.stellarCode;
  if (code) return ['tx_bad_seq', 'tx_insufficient_fee', 'transient_network'].includes(code);
  const msg = (e?.message || '').toLowerCase();
  return /timeout|aborted|network|fetch failed|stale sequence|econnreset/i.test(msg);
}

export async function submitWithRetry(buildTx, submitFn, { onRetry, verify, maxAttempts = 4, delayMs = 4000 } = {}) {
  for (let i = 1; i <= maxAttempts; i++) {
    if (verify) {
      try {
        if (await verify()) return null;
      } catch {
        /* ignore verify errors, proceed to submit */
      }
    }
    const tx = await buildTx();
    try {
      return await submitFn(tx);
    } catch (e) {
      if (i < maxAttempts && isTransientError(e)) {
        onRetry?.(i, maxAttempts);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
}

function formatAmount(n) {
  return Number(n).toFixed(7);
}

function formatPrice(n) {
  return Number(n).toFixed(10);
}

function bytesToHex(bytes) {
  return Array.prototype.map
    .call(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function loadAccount(address) {
  try {
    return await server.loadAccount(address);
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

export function parseBalances(account) {
  if (!account?.balances) return { xlm: 0, assets: [], availableXlm: 0 };
  let xlm = 0;
  const assets = [];
  for (const b of account.balances) {
    if (b.asset_type === 'native') {
      xlm = parseFloat(b.balance);
    } else if (b.asset_type !== 'liquidity_pool_shares') {
      assets.push({
        code: b.asset_code,
        issuer: b.asset_issuer,
        balance: parseFloat(b.balance),
      });
    }
  }
  const subentries = account.subentry_count || 0;
  const reserve = (2 + subentries) * RESERVE_PER_ENTRY;
  return { xlm, assets, availableXlm: Math.max(0, xlm - reserve) };
}

export async function fetchXlmBalance(address) {
  const account = await loadAccount(address);
  if (!account) return 0;
  return parseBalances(account).xlm;
}

export function hasTrustline(account, assetCode, issuer) {
  return (account?.balances || []).some(
    (b) => b.asset_code === assetCode && b.asset_issuer === issuer
  );
}

export function buildLaunchSetupTransaction({ sourceAccount, assetCode, homeDomain, issuerKeypair: providedKeypair }) {
  const issuerKeypair = providedKeypair || StellarSdk.Keypair.random();
  const issuerPublicKey = issuerKeypair.publicKey();
  const asset = new StellarSdk.Asset(assetCode, issuerPublicKey);

  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  tx.addOperation(
    StellarSdk.Operation.createAccount({
      destination: issuerPublicKey,
      startingBalance: formatAmount(ISSUER_RESERVE_XLM),
    })
  );

  tx.addOperation(StellarSdk.Operation.changeTrust({ asset }));

  const built = tx.setTimeout(300).build();
  return { transaction: built, issuerKeypair, issuerPublicKey };
}

export function buildIssuerSetupTransaction({ issuerAccount, userAddress, assetCode, totalSupply, homeDomain }) {
  const asset = new StellarSdk.Asset(assetCode, issuerAccount.accountId());

  const tx = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  tx.addOperation(
    StellarSdk.Operation.setOptions({
      homeDomain: homeDomain || HOME_DOMAIN,
      masterWeight: 0,
    })
  );

  tx.addOperation(
    StellarSdk.Operation.payment({
      destination: userAddress,
      asset,
      amount: formatAmount(totalSupply),
    })
  );

  return tx.setTimeout(300).build();
}

export function buildBondingCurveTransaction({ userAccount, assetCode, issuerPublicKey, liquidityAmount, rungs = CURVE_PRESETS.slow.rungs, priceStep = CURVE_PRESETS.slow.priceStep }) {
  const asset = new StellarSdk.Asset(assetCode, issuerPublicKey);

  const tx = new StellarSdk.TransactionBuilder(userAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const rungAmount = liquidityAmount / rungs;
  for (let i = 0; i < rungs; i++) {
    const price = BASE_PRICE * Math.pow(priceStep, i);
    tx.addOperation(
      StellarSdk.Operation.manageSellOffer({
        selling: asset,
        buying: StellarSdk.Asset.native(),
        amount: formatAmount(rungAmount),
        price: formatPrice(price),
        offerId: '0',
      })
    );
  }

  return tx.setTimeout(300).build();
}

// A buy sends the quote asset and asks for the token. When the quote is USDC it
// must already be held, so the trustline is added in the same transaction — one
// wallet approval instead of two.
export function buildBuyTransaction({ sourceAccount, assetCode, issuer, quote = 'xlm', xlmAmount, amount, minTokensOut }) {
  const sendAmount = amount != null ? amount : xlmAmount;
  const buyer = sourceAccount.accountId();
  const other = quoteAsset(quote);
  const asset = new StellarSdk.Asset(assetCode, issuer);
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (quote === 'usdc' && !hasTrustline(sourceAccount, USDC_CODE, USDC_ISSUER)) {
    tx.addOperation(StellarSdk.Operation.changeTrust({ asset: other }));
  }
  if (!hasTrustline(sourceAccount, assetCode, issuer)) {
    tx.addOperation(StellarSdk.Operation.changeTrust({ asset }));
  }

  tx.addOperation(
    StellarSdk.Operation.pathPaymentStrictSend({
      sendAsset: other,
      sendAmount: formatAmount(sendAmount),
      destination: buyer,
      destAsset: asset,
      destMin: formatAmount(minTokensOut),
    })
  );

  return tx.setTimeout(300).build();
}

export function buildSellTransaction({ sourceAccount, assetCode, issuer, quote = 'xlm', tokenAmount, minXlmOut, minOut }) {
  const min = minOut != null ? minOut : minXlmOut;
  const seller = sourceAccount.accountId();
  const other = quoteAsset(quote);
  const asset = new StellarSdk.Asset(assetCode, issuer);
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (quote === 'usdc' && !hasTrustline(sourceAccount, USDC_CODE, USDC_ISSUER)) {
    tx.addOperation(StellarSdk.Operation.changeTrust({ asset: other }));
  }

  tx.addOperation(
    StellarSdk.Operation.pathPaymentStrictSend({
      sendAsset: asset,
      sendAmount: formatAmount(tokenAmount),
      destination: seller,
      destAsset: other,
      destMin: formatAmount(min),
    })
  );

  return tx.setTimeout(300).build();
}

export function buildLimitBuyTransaction({ sourceAccount, assetCode, issuer, quote = 'xlm', xlmAmount, amount, triggerPrice }) {
  const spend = amount != null ? amount : xlmAmount;
  const other = quoteAsset(quote);
  const asset = new StellarSdk.Asset(assetCode, issuer);
  const tokenAmount = spend / triggerPrice;
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (quote === 'usdc' && !hasTrustline(sourceAccount, USDC_CODE, USDC_ISSUER)) {
    tx.addOperation(StellarSdk.Operation.changeTrust({ asset: other }));
  }
  if (!hasTrustline(sourceAccount, assetCode, issuer)) {
    tx.addOperation(StellarSdk.Operation.changeTrust({ asset }));
  }

  tx.addOperation(
    StellarSdk.Operation.manageBuyOffer({
      selling: other,
      buying: asset,
      buyAmount: formatAmount(tokenAmount),
      price: formatPrice(triggerPrice),
      offerId: '0',
    })
  );

  return tx.setTimeout(300).build();
}

export function buildLimitSellTransaction({ sourceAccount, assetCode, issuer, quote = 'xlm', tokenAmount, triggerPrice }) {
  const other = quoteAsset(quote);
  const asset = new StellarSdk.Asset(assetCode, issuer);
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (quote === 'usdc' && !hasTrustline(sourceAccount, USDC_CODE, USDC_ISSUER)) {
    tx.addOperation(StellarSdk.Operation.changeTrust({ asset: other }));
  }

  tx.addOperation(
    StellarSdk.Operation.manageSellOffer({
      selling: asset,
      buying: other,
      amount: formatAmount(tokenAmount),
      price: formatPrice(triggerPrice),
      offerId: '0',
    })
  );

  return tx.setTimeout(300).build();
}

export function buildCancelOfferTransaction({ sourceAccount, side, assetCode, issuer, offerId, price }) {
  const asset = new StellarSdk.Asset(assetCode, issuer);
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (side === 'buy') {
    tx.addOperation(
      StellarSdk.Operation.manageBuyOffer({
        selling: StellarSdk.Asset.native(),
        buying: asset,
        buyAmount: '0',
        price: formatPrice(price),
        offerId: String(offerId),
      })
    );
  } else {
    tx.addOperation(
      StellarSdk.Operation.manageSellOffer({
        selling: asset,
        buying: StellarSdk.Asset.native(),
        amount: '0',
        price: formatPrice(price),
        offerId: String(offerId),
      })
    );
  }

  return tx.setTimeout(300).build();
}

export async function fetchOpenOrders(address, assetCode, issuer) {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}/offers?limit=200`);
  if (!res.ok) return [];
  const data = await res.json();
  const records = data._embedded?.records || [];
  return records
    .filter((r) => {
      const sellingToken = r.selling.asset_code === assetCode && r.selling.asset_issuer === issuer;
      const buyingToken = r.buying.asset_code === assetCode && r.buying.asset_issuer === issuer;
      return sellingToken || buyingToken;
    })
    .map((r) => {
      const isBuy = r.buying.asset_code === assetCode && r.buying.asset_issuer === issuer;
      const offerPrice = parseFloat(r.price);
      const sellingAmount = parseFloat(r.amount);
      const tokenAmount = isBuy ? sellingAmount / offerPrice : sellingAmount;
      return {
        offerId: r.id,
        side: isBuy ? 'buy' : 'sell',
        price: offerPrice,
        amount: tokenAmount,
      };
    });
}

// Creates the token's pool against the chosen quote asset. quoteAmount falls
// back to xlmAmount so XLM launches keep their original call shape.
export function buildPoolSetupTransaction({ sourceAccount, assetCode, issuer, quote = 'xlm', quoteAmount, xlmAmount, tokenAmount }) {
  const amountIn = quoteAmount != null ? quoteAmount : xlmAmount;
  const other = quoteAsset(quote);
  const asset = new StellarSdk.Asset(assetCode, issuer);
  const { poolAsset, quoteFirst } = orderedPoolPair(other, asset);
  const poolId = bytesToHex(StellarSdk.getLiquidityPoolId('constant_product', poolAsset.getLiquidityPoolParameters()));

  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (quote === 'usdc' && !hasTrustline(sourceAccount, USDC_CODE, USDC_ISSUER)) {
    tx.addOperation(StellarSdk.Operation.changeTrust({ asset: other }));
  }
  tx.addOperation(StellarSdk.Operation.changeTrust({ asset: poolAsset }));
  tx.addOperation(
    StellarSdk.Operation.liquidityPoolDeposit({
      liquidityPoolId: poolId,
      maxAmountA: formatAmount(quoteFirst ? amountIn : tokenAmount),
      maxAmountB: formatAmount(quoteFirst ? tokenAmount : amountIn),
      minPrice: { n: 1, d: 100000000 },
      maxPrice: { n: 1, d: 1000 },
    })
  );

  return tx.setTimeout(300).build();
}

// A pool swap is a path payment — the same operation the offer route uses, so
// both directions share one builder instead of a duplicated copy.
export function buildPoolBuyTransaction(args) {
  return buildBuyTransaction(args);
}

export function buildPoolSellTransaction(args) {
  return buildSellTransaction(args);
}

function reserveAsset(r) {
  return r.asset || (r.asset_code ? `${r.asset_code}:${r.asset_issuer}` : '');
}

// Only a pool that holds BOTH native XLM and this exact asset (code + issuer)
// prices the token. Any other pool in the results is a different market, and
// reading it reports a zero XLM reserve and a zero price.
export async function fetchPoolFor(assetCode, issuer, quote = 'xlm') {
  const key = quoteReserveKey(quote);
  const data = await horizonJsonSafe(
    `/liquidity_pools?reserves=${key}&reserves=${assetCode}:${issuer}&limit=20`
  );
  const records = data?._embedded?.records || [];

  let best = null;
  for (const pool of records) {
    const reserves = pool.reserves || [];
    const quoteSide = reserves.find((r) => reserveAsset(r) === key);
    const tokenSide = reserves.find((r) => reserveAsset(r) === `${assetCode}:${issuer}`);
    if (!quoteSide || !tokenSide) continue;
    const quoteReserve = parseFloat(quoteSide.amount) || 0;
    const tokenReserve = parseFloat(tokenSide.amount) || 0;
    if (quoteReserve <= 0 || tokenReserve <= 0) continue;
    if (!best || quoteReserve > best.quoteReserve) {
      best = {
        price: quoteReserve / tokenReserve,
        quote,
        quoteReserve,
        xlmReserve: quoteReserve,
        tokenReserve,
        poolId: pool.id,
      };
    }
  }
  return best;
}

export function fetchPoolPrice(assetCode, issuer, quote = 'xlm') {
  return fetchPoolFor(assetCode, issuer, quote);
}

let rateCache = null;

// How many XLM one USDC buys. Every USDC figure the app shows is converted
// through this rate so prices, market caps, PnL and rankings share one unit.
export async function fetchXlmUsdcRate(force = false) {
  if (!force && rateCache && Date.now() - rateCache.time < CACHE_TTL) return rateCache.rate;
  let rate = 0;
  const pool = await fetchPoolFor(USDC_CODE, USDC_ISSUER, 'xlm');
  if (pool?.price > 0) rate = pool.price;
  if (!rate) {
    const book = await fetchOrderBook(USDC_CODE, USDC_ISSUER, 'xlm');
    rate = book?.bestAsk > 0 ? book.bestAsk : book?.bestBid > 0 ? book.bestBid : 0;
  }
  if (rate > 0) rateCache = { time: Date.now(), rate };
  return rate || rateCache?.rate || 0;
}

export async function fetchOrderBook(assetCode, issuer, quote = 'xlm') {
  const assetType = assetCode.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
  const buying =
    quote === 'usdc'
      ? `buying_asset_type=credit_alphanum4&buying_asset_code=${USDC_CODE}&buying_asset_issuer=${USDC_ISSUER}`
      : 'buying_asset_type=native';
  const ob = await horizonJsonSafe(
    `/order_book?selling_asset_type=${assetType}&selling_asset_code=${assetCode}&selling_asset_issuer=${issuer}&${buying}`
  );
  if (!ob) return null;

  const bids = ob.bids || [];
  const asks = ob.asks || [];

  // price_r keeps the exact rational price. The 7-decimal "price" field rounds
  // tiny prices away, which is how a 0.000003 market looked like something else.
  const priceOf = (row) => {
    const n = parseFloat(row.price_r?.n);
    const d = parseFloat(row.price_r?.d);
    if (n > 0 && d > 0) return n / d;
    return parseFloat(row.price) || 0;
  };

  const bidPrices = bids.map(priceOf).filter((p) => p > 0);
  const askPrices = asks.map(priceOf).filter((p) => p > 0);
  const bidDepth = bids.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
  const askDepth = asks.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const bestBid = bidPrices.length ? Math.max(...bidPrices) : 0;
  const bestAsk = askPrices.length ? Math.min(...askPrices) : 0;

  return {
    bestBid,
    bestAsk,
    spread: bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0,
    bidAmount: bids.length ? parseFloat(bids[0].amount) || 0 : 0,
    askAmount: asks.length ? parseFloat(asks[0].amount) || 0 : 0,
    bidDepth,
    askDepth,
    askFloor: askPrices.length ? Math.max(...askPrices) : 0,
    bidCount: bids.length,
    askCount: asks.length,
  };
}

export function keypairFromSecret(secret) {
  return StellarSdk.Keypair.fromSecret(secret);
}

export async function verifyLaunchProgress({ walletAddress, issuerPublicKey, assetCode, isAutoPool, quotes = ['xlm'] }) {
  const result = { issuerExists: false, trustlineExists: false, tokensIssued: false, liquidityExists: false, poolQuotes: [] };
  if (!issuerPublicKey) return result;

  try {
    const issuer = await loadAccount(issuerPublicKey);
    result.issuerExists = !!issuer;
  } catch {
    /* ignore */
  }
  if (!result.issuerExists) return result;

  try {
    const user = await loadAccount(walletAddress);
    if (user) {
      const tl = (user.balances || []).find(
        (b) => b.asset_code === assetCode && b.asset_issuer === issuerPublicKey
      );
      result.trustlineExists = !!tl;
      if (tl && parseFloat(tl.balance) > 0) result.tokensIssued = true;
    }
  } catch {
    /* ignore */
  }
  if (!result.tokensIssued) return result;

  try {
    if (isAutoPool) {
      // A dual launch only counts as seeded once every pool it promised exists.
      const found = await Promise.all(quotes.map((q) => fetchPoolFor(assetCode, issuerPublicKey, q)));
      result.poolQuotes = quotes.filter((q, i) => !!found[i]);
      result.liquidityExists = result.poolQuotes.length === quotes.length;
    } else {
      const ob = await fetchOrderBook(assetCode, issuerPublicKey, 'xlm');
      result.liquidityExists = !!(ob && (ob.askCount > 0 || ob.bidCount > 0));
    }
  } catch {
    /* ignore */
  }
  return result;
}

export async function signAndSubmit(transaction) {
  ensureKitInit();
  try {
    const { address } = await StellarWalletsKit.getAddress();
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(transaction.toXDR(), {
      address,
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const result = await server.submitTransaction(signedTx, { skipMemoRequiredCheck: true });
    return result;
  } catch (e) {
    const ex = explainError(e);
    throw new StellarError(ex.message, ex.code);
  }
}

export async function submitProgrammatically(transaction, keypair) {
  try {
    transaction.sign(keypair);
    const result = await server.submitTransaction(transaction, { skipMemoRequiredCheck: true });
    return result;
  } catch (e) {
    const ex = explainError(e);
    throw new StellarError(ex.message, ex.code);
  }
}

export async function pollForAccount(address, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const acct = await loadAccount(address);
      if (acct) return acct;
    } catch {
      /* not confirmed yet */
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(`Account ${address.slice(0, 8)}… not confirmed on network yet`);
}

export async function pollForTransaction(transactionResult, maxAttempts = 30) {
  const hash = transactionResult?.hash;
  if (!hash) return transactionResult;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await server.transactions().transaction(hash).call();
      if (r) return r;
    } catch {
      /* not yet indexed */
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  return transactionResult;
}

export async function findExistingTrustline(walletAddress, assetCode) {
  try {
    const account = await loadAccount(walletAddress);
    if (!account) return null;
    const tl = (account.balances || []).find(
      (b) => b.asset_code === assetCode && b.asset_type !== 'native' && b.asset_type !== 'liquidity_pool_shares'
    );
    return tl?.asset_issuer || null;
  } catch {
    return null;
  }
}

export function generateStellarToml({ name, code, issuer, description, logoUrl, orgUrl }) {
  const lines = ['# stellar.toml', '[DOCUMENTATION]'];
  lines.push(`ORG_NAME="${name}"`);
  if (orgUrl) lines.push(`ORG_URL="${orgUrl}"`);
  if (description) lines.push(`ORG_DESCRIPTION="${description}"`);
  lines.push('', '[[CURRENCIES]]');
  lines.push(`CURRENCY_CODE="${code}"`);
  lines.push(`CURRENCY_ISSUER="${issuer}"`);
  lines.push(`CURRENCY_NAME="${name}"`);
  if (description) lines.push(`CURRENCY_DESC="${description}"`);
  if (logoUrl) lines.push(`CURRENCY_LOGO="${logoUrl}"`);
  return lines.join('\n');
}

export function estimateLaunchCost({ liquidityPercent, rungs = CURVE_PRESETS.slow.rungs, autoPool = false, hasInitialLiquidity = false, poolCount = 1, needsUsdcTrustline = false }) {
  const baseOps = 4;
  const offerCount = autoPool ? 0 : (liquidityPercent > 0 ? rungs : 0);
  // Each pool costs a share trustline plus the deposit itself.
  const poolOps = (autoPool || hasInitialLiquidity ? 2 : 0) * poolCount;
  const trustlineOps = needsUsdcTrustline ? 1 : 0;
  const operations = baseOps + offerCount + poolOps + trustlineOps;
  const feeXlm = (operations * 100) / 1e7;
  const reserveXlm = (offerCount + poolOps + trustlineOps) * RESERVE_PER_ENTRY;
  const issuerReserveXlm = ISSUER_RESERVE_XLM;
  return { feeXlm, reserveXlm, issuerReserveXlm, operations, offerCount, poolOps, trustlineOps };
}

function assetParams(prefix, quote) {
  if (quote === 'usdc') {
    return `${prefix}_asset_type=credit_alphanum4&${prefix}_asset_code=${USDC_CODE}&${prefix}_asset_issuer=${USDC_ISSUER}`;
  }
  return `${prefix}_asset_type=native`;
}

// Trades for one quote market, whichever side of the pair the token sits on.
async function fetchQuoteTrades(assetCode, issuer, quote, limit = 50) {
  const assetType = assetCode.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
  const tokenBase = `base_asset_type=${assetType}&base_asset_code=${assetCode}&base_asset_issuer=${issuer}`;
  const tokenCounter = `counter_asset_type=${assetType}&counter_asset_code=${assetCode}&counter_asset_issuer=${issuer}`;

  const [baseData, counterData] = await Promise.all([
    horizonJsonSafe(`/trades?${tokenBase}&${assetParams('counter', quote)}&limit=${limit}&order=desc`),
    horizonJsonSafe(`/trades?${assetParams('base', quote)}&${tokenCounter}&limit=${limit}&order=desc`),
  ]);

  const seen = new Set();
  const out = [];
  for (const data of [baseData, counterData]) {
    for (const r of data?._embedded?.records || []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ ...r, quote });
    }
  }
  return out;
}

// What a pool launch needs: how much of each quote asset, and how much supply
// the pools absorb. Every pool prices the token at BASE_PRICE, so a dual launch
// cannot be arbitraged between its two markets.
export function planPoolLaunch({ poolType = 'xlm', input, xlmPerUsdc = 0 }) {
  const amount = parseFloat(input) || 0;
  const quotes = poolsForType(poolType);
  const usable = amount > 0 && (!quotes.includes('usdc') || xlmPerUsdc > 0);

  const deposits = {};
  let swapXlm = 0;
  if (usable) {
    if (poolType === 'usdc') {
      deposits.usdc = amount;
    } else if (poolType === 'split') {
      // The creator deposits XLM only: half seeds the XLM pool as-is, and the
      // other half is swapped to USDC on the DEX first (swapXlm) to seed the
      // USDC pool. Both pools price the token at BASE_PRICE, so the two markets
      // cannot be arbitraged.
      const half = amount / 2;
      deposits.xlm = half;
      deposits.usdc = half / xlmPerUsdc;
      swapXlm = half;
    } else if (poolType === 'dual') {
      deposits.xlm = amount;
      deposits.usdc = amount / xlmPerUsdc;
    } else {
      deposits.xlm = amount;
    }
  }

  const tokensByQuote = {};
  let xlmValue = 0;
  for (const [q, v] of Object.entries(deposits)) {
    const inXlm = toXlm(v, q, xlmPerUsdc);
    xlmValue += inXlm;
    tokensByQuote[q] = inXlm / BASE_PRICE;
  }

  return { quotes, deposits, tokensByQuote, xlmValue, supply: xlmValue / BASE_PRICE, swapXlm };
}

// Buy the USDC leg of a pool launch with XLM. Sent as a path payment to the
// creator's own account, so the USDC lands in their wallet, with the trustline
// added in the same transaction — one wallet approval, and no USDC needed up
// front. The DEX order book and the XLM/USDC pools both route the trade.
export function buildXlmToUsdcSwapTransaction({ sourceAccount, xlmAmount, minUsdcOut }) {
  const usdc = quoteAsset('usdc');
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (!hasTrustline(sourceAccount, USDC_CODE, USDC_ISSUER)) {
    tx.addOperation(StellarSdk.Operation.changeTrust({ asset: usdc }));
  }
  tx.addOperation(
    StellarSdk.Operation.pathPaymentStrictSend({
      sendAsset: StellarSdk.Asset.native(),
      sendAmount: formatAmount(xlmAmount),
      destination: sourceAccount.accountId(),
      destAsset: usdc,
      destMin: formatAmount(minUsdcOut),
    })
  );

  return tx.setTimeout(300).build();
}

export async function fetchAssetStats(assetCode, issuer, { quotes = ['xlm'], xlmPerUsdc = 0, limit = 50 } = {}) {
  const [holdersData, ...tradeSets] = await Promise.all([
    horizonJsonSafe(`/accounts?asset=${assetCode}:${issuer}&limit=200`),
    ...quotes.map((q) => fetchQuoteTrades(assetCode, issuer, q, limit)),
  ]);

  // Holders are wallets with a positive balance. The issuer and empty trustlines
  // are not holders.
  let holders = 0;
  for (const acc of holdersData?._embedded?.records || []) {
    if (acc.account_id === issuer) continue;
    const bal = (acc.balances || []).find(
      (b) => b.asset_code === assetCode && b.asset_issuer === issuer
    );
    if (!bal || parseFloat(bal.balance) <= 0) continue;
    holders++;
  }

  // Each quote was already deduped on its own; a trade only appears in the set
  // of the market it actually filled in, so the sets just concatenate.
  const allTrades = tradeSets.flat();
  allTrades.sort((a, b) => new Date(b.ledger_close_time) - new Date(a.ledger_close_time));

  const rateOf = (quote) => (quote === 'usdc' ? xlmPerUsdc : 1);

  // XLM per token for one trade, whichever way round the pair is quoted. USDC
  // fills go through the live rate so a dual-pool token keeps one price series.
  const tradePrice = (t) => {
    const n = parseFloat(t.price?.n);
    const d = parseFloat(t.price?.d);
    if (!n || !d) return 0;
    const isTokenBase = t.base_asset_code === assetCode && t.base_asset_issuer === issuer;
    return (isTokenBase ? n / d : d / n) * rateOf(t.quote);
  };

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  // Volume is the quote leg, always counted in XLM.
  const quoteLegXlm = (t) => {
    if (t.quote === 'usdc') {
      const isUsdcBase = t.base_asset_code === USDC_CODE && t.base_asset_issuer === USDC_ISSUER;
      const leg = parseFloat(isUsdcBase ? t.base_amount : t.counter_amount) || 0;
      return leg * rateOf('usdc');
    }
    if (t.counter_asset_type === 'native') return parseFloat(t.counter_amount) || 0;
    if (t.base_asset_type === 'native') return parseFloat(t.base_amount) || 0;
    return 0;
  };

  let volume24h = 0;
  for (const trade of allTrades) {
    if (new Date(trade.ledger_close_time).getTime() < oneDayAgo) continue;
    volume24h += quoteLegXlm(trade);
  }

  // Oldest → newest, for the chart.
  const priceHistory = allTrades
    .slice()
    .reverse()
    .map(tradePrice)
    .filter((p) => p > 0);

  // 24h change compares the two halves of the window using a median, so one
  // outsized fill cannot swing it. Fewer than two fills means nothing to compare.
  const windowPrices = allTrades
    .filter((t) => new Date(t.ledger_close_time).getTime() >= oneDayAgo)
    .map(tradePrice)
    .filter((p) => p > 0)
    .reverse();
  let change24h = null;
  if (windowPrices.length >= 2) {
    const half = Math.max(1, Math.floor(windowPrices.length / 2));
    const base = median(windowPrices.slice(0, half));
    const current = median(windowPrices.slice(-half));
    if (base > 0) change24h = ((current - base) / base) * 100;
  }

  return {
    holders,
    trades: allTrades,
    volume24h,
    priceHistory,
    change24h,
    lastPrice: priceHistory.length ? priceHistory[priceHistory.length - 1] : 0,
  };
}

// Every fill of one asset, priced in XLM and oriented from the taker's side, so
// the candles, the buy/sell pressure and the trade list all read one pass of the
// same data. `side` is 'buy' when the taker ended up with the asset and 'sell'
// when they gave it away; `xlm` is the quote leg, which is what volume counts.
export function priceFills(trades, assetCode, issuer, xlmPerUsdc = 0) {
  const rateOf = (quote) => (quote === 'usdc' ? xlmPerUsdc : 1);
  const fills = [];
  for (const t of trades || []) {
    const isTokenBase = t.base_asset_code === assetCode && t.base_asset_issuer === issuer;
    const n = parseFloat(t.price?.n);
    const d = parseFloat(t.price?.d);
    if (!n || !d) continue;
    const price = (isTokenBase ? n / d : d / n) * rateOf(t.quote);
    if (!(price > 0)) continue;
    // The base leg was the one sold when base_is_seller is set, so the taker
    // bought the asset whenever the leg that sold is not the asset's own.
    const tokenWasSold = isTokenBase ? t.base_is_seller === true : t.base_is_seller === false;
    fills.push({
      id: t.id,
      time: t.ledger_close_time,
      price,
      side: tokenWasSold ? 'sell' : 'buy',
      tokens: parseFloat(isTokenBase ? t.base_amount : t.counter_amount) || 0,
      xlm: (parseFloat(isTokenBase ? t.counter_amount : t.base_amount) || 0) * rateOf(t.quote),
      quote: t.quote || 'xlm',
    });
  }
  return fills.sort((a, b) => new Date(a.time) - new Date(b.time));
}

export function formatOnChainTrades(trades, assetCode, issuer, maxCount = 20, xlmPerUsdc = 0) {
  const rateOf = (quote) => (quote === 'usdc' ? xlmPerUsdc : 1);
  return trades.slice(0, maxCount).map((t) => {
    const isTokenBase = t.base_asset_code === assetCode && t.base_asset_issuer === issuer;
    const tokenAmount = parseFloat(isTokenBase ? t.base_amount : t.counter_amount) || 0;
    const quoteAmount = parseFloat(isTokenBase ? t.counter_amount : t.base_amount) || 0;
    const n = parseFloat(t.price?.n);
    const d = parseFloat(t.price?.d);
    const inQuote = n && d ? (isTokenBase ? n / d : d / n) : 0;
    const rate = rateOf(t.quote);

    return {
      type: isTokenBase ? 'buy' : 'sell',
      amount_xlm: quoteAmount * rate,
      tokens: tokenAmount,
      price: inQuote * rate,
      quote: t.quote || 'xlm',
      time: t.ledger_close_time,
    };
  });
}

export function estimateTradeCost(side, { needsUsdcTrustline = false } = {}) {
  const ops = (side === 'buy' ? 2 : 1) + (needsUsdcTrustline ? 1 : 0);
  const feeXlm = (ops * 100) / 1e7;
  const reserveXlm = (side === 'buy' ? RESERVE_PER_ENTRY : 0) + (needsUsdcTrustline ? RESERVE_PER_ENTRY : 0);
  return { feeXlm, reserveXlm, operations: ops };
}

function parseTomlCurrency(toml, code) {
  const lines = toml.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '[[CURRENCIES]]') {
      let blockCode = null;
      let logo = null;
      let name = null;
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j].trim();
        if (l.startsWith('[')) break;
        const eqIdx = l.indexOf('=');
        if (eqIdx === -1) continue;
        const key = l.substring(0, eqIdx).trim().toUpperCase();
        const val = l.substring(eqIdx + 1).replace(/"/g, '').trim();
        if (key === 'CURRENCY_CODE') blockCode = val;
        else if (key === 'CURRENCY_LOGO') logo = val;
        else if (key === 'CURRENCY_NAME') name = val;
      }
      if (blockCode === code) return { logo, name };
    }
  }
  return null;
}

async function fetchWithTimeout(url, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchTokenMetadata(assetCode, issuer) {
  try {
    const accountRes = await fetchWithTimeout(`${HORIZON_URL}/accounts/${issuer}`);
    if (!accountRes.ok) return null;
    const accountData = await accountRes.json();
    const homeDomain = accountData.home_domain;
    if (!homeDomain) return null;

    const base = homeDomain.startsWith('http')
      ? homeDomain.replace(/\/$/, '')
      : `https://${homeDomain}`;
    const tomlUrl = `${base}/.well-known/stellar.toml`;

    let logo = null;
    let name = null;
    try {
      const tomlRes = await fetchWithTimeout(tomlUrl, 5000);
      if (tomlRes.ok) {
        const toml = await tomlRes.text();
        const parsed = parseTomlCurrency(toml, assetCode);
        if (parsed) {
          logo = parsed.logo;
          name = parsed.name;
        }
      }
    } catch {
      /* CORS or network — skip toml */
    }

    return { homeDomain, logo, name };
  } catch {
    return null;
  }
}