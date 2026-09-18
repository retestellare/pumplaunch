import * as StellarSdk from '@stellar/stellar-sdk';
import { StellarWalletsKit, ensureKitInit } from './walletKit';

const HORIZON_URL = 'https://horizon.stellar.org';
export const NETWORK_PASSPHRASE = StellarSdk.Networks.PUBLIC;
export const HOME_DOMAIN = 'stellarlaunch.base44.app';
export const BASE_FEE = StellarSdk.BASE_FEE || '100';
const RESERVE_PER_ENTRY = 0.5;

const BASE_PRICE = 0.000001;
const ISSUER_RESERVE_XLM = 2;

export const CURVE_PRESETS = {
  slow: { rungs: 6, priceStep: 1.6, label: 'Slow', desc: 'Steady, gradual price growth' },
  medium: { rungs: 10, priceStep: 2.0, label: 'Medium', desc: 'Moderate acceleration as buys come in' },
  fast: { rungs: 16, priceStep: 2.8, label: 'Fast', desc: 'Prices climb quickly after early buys' },
  hyper: { rungs: 24, priceStep: 4.0, label: 'Hyper', desc: 'Volatile spikes — steepest climb' },
};

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

export { server, StellarSdk };

function extractError(e) {
  const extras = e?.response?.data?.extras;
  if (extras?.result_codes) {
    const rc = extras.result_codes;
    return rc.transaction || (rc.operations && rc.operations.join(', ')) || 'Transaction failed';
  }
  return e?.message || String(e);
}

function formatAmount(n) {
  return Number(n).toFixed(7);
}

function formatPrice(n) {
  return Number(n).toFixed(10);
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

export function buildLaunchSetupTransaction({ sourceAccount, assetCode, homeDomain }) {
  const issuerKeypair = StellarSdk.Keypair.random();
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

export function buildBuyTransaction({ sourceAccount, assetCode, issuer, xlmAmount, minTokensOut }) {
  const buyer = sourceAccount.accountId();
  const asset = new StellarSdk.Asset(assetCode, issuer);
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (!hasTrustline(sourceAccount, assetCode, issuer)) {
    tx.addOperation(StellarSdk.Operation.changeTrust({ asset }));
  }

  tx.addOperation(
    StellarSdk.Operation.pathPaymentStrictSend({
      sendAsset: StellarSdk.Asset.native(),
      sendAmount: formatAmount(xlmAmount),
      destination: buyer,
      destAsset: asset,
      destMin: formatAmount(minTokensOut),
    })
  );

  return tx.setTimeout(300).build();
}

export function buildSellTransaction({ sourceAccount, assetCode, issuer, tokenAmount, minXlmOut }) {
  const seller = sourceAccount.accountId();
  const asset = new StellarSdk.Asset(assetCode, issuer);
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  tx.addOperation(
    StellarSdk.Operation.pathPaymentStrictSend({
      sendAsset: asset,
      sendAmount: formatAmount(tokenAmount),
      destination: seller,
      destAsset: StellarSdk.Asset.native(),
      destMin: formatAmount(minXlmOut),
    })
  );

  return tx.setTimeout(300).build();
}

export function buildLimitBuyTransaction({ sourceAccount, assetCode, issuer, xlmAmount, triggerPrice }) {
  const asset = new StellarSdk.Asset(assetCode, issuer);
  const tokenAmount = xlmAmount / triggerPrice;
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (!hasTrustline(sourceAccount, assetCode, issuer)) {
    tx.addOperation(StellarSdk.Operation.changeTrust({ asset }));
  }

  tx.addOperation(
    StellarSdk.Operation.manageBuyOffer({
      selling: StellarSdk.Asset.native(),
      buying: asset,
      buyAmount: formatAmount(tokenAmount),
      price: formatPrice(triggerPrice),
      offerId: '0',
    })
  );

  return tx.setTimeout(300).build();
}

export function buildLimitSellTransaction({ sourceAccount, assetCode, issuer, tokenAmount, triggerPrice }) {
  const asset = new StellarSdk.Asset(assetCode, issuer);
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  tx.addOperation(
    StellarSdk.Operation.manageSellOffer({
      selling: asset,
      buying: StellarSdk.Asset.native(),
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
    throw new Error(extractError(e));
  }
}

export async function submitProgrammatically(transaction, keypair) {
  try {
    transaction.sign(keypair);
    const result = await server.submitTransaction(transaction, { skipMemoRequiredCheck: true });
    return result;
  } catch (e) {
    throw new Error(extractError(e));
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

export function estimateLaunchCost(liquidityPercent, rungs = CURVE_PRESETS.slow.rungs) {
  const offerCount = liquidityPercent > 0 ? rungs : 0;
  const operations = 4 + offerCount;
  const feeXlm = (operations * 100) / 1e7;
  const reserveXlm = offerCount * RESERVE_PER_ENTRY;
  const issuerReserveXlm = ISSUER_RESERVE_XLM;
  return { feeXlm, reserveXlm, issuerReserveXlm, operations, offerCount };
}

export async function fetchAssetStats(assetCode, issuer) {
  const assetType = assetCode.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';

  const [holdersRes, tradesAsBaseRes, tradesAsCounterRes, orderBookRes] = await Promise.all([
    fetch(`${HORIZON_URL}/accounts?asset=${assetCode}:${issuer}&limit=200`).catch(() => null),
    fetch(`${HORIZON_URL}/trades?base_asset_type=${assetType}&base_asset_code=${assetCode}&base_asset_issuer=${issuer}&counter_asset_type=native&limit=50&order=desc`).catch(() => null),
    fetch(`${HORIZON_URL}/trades?base_asset_type=native&counter_asset_type=${assetType}&counter_asset_code=${assetCode}&counter_asset_issuer=${issuer}&limit=50&order=desc`).catch(() => null),
    fetch(`${HORIZON_URL}/order_book?selling_asset_type=${assetType}&selling_asset_code=${assetCode}&selling_asset_issuer=${issuer}&buying_asset_type=native`).catch(() => null),
  ]);

  let holders = 0;
  if (holdersRes?.ok) {
    const data = await holdersRes.json();
    holders = (data._embedded?.records || []).length;
  }

  const seen = new Set();
  let allTrades = [];
  if (tradesAsBaseRes?.ok) {
    const data = await tradesAsBaseRes.json();
    for (const r of data._embedded?.records || []) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        allTrades.push(r);
      }
    }
  }
  if (tradesAsCounterRes?.ok) {
    const data = await tradesAsCounterRes.json();
    for (const r of data._embedded?.records || []) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        allTrades.push(r);
      }
    }
  }
  allTrades.sort((a, b) => new Date(b.ledger_close_time) - new Date(a.ledger_close_time));

  let price = 0;
  if (orderBookRes?.ok) {
    const ob = await orderBookRes.json();
    const asks = ob.asks || [];
    const bids = ob.bids || [];
    if (asks.length > 0) {
      price = parseFloat(asks[0].price_r.n) / parseFloat(asks[0].price_r.d);
    } else if (bids.length > 0) {
      price = parseFloat(bids[0].price_r.n) / parseFloat(bids[0].price_r.d);
    }
  }
  if (price === 0 && allTrades.length > 0) {
    const last = allTrades[0];
    const isTokenBase = last.base_asset_code === assetCode && last.base_asset_issuer === issuer;
    price = isTokenBase
      ? parseFloat(last.price.n) / parseFloat(last.price.d)
      : parseFloat(last.price.d) / parseFloat(last.price.n);
  }

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  let volume24h = 0;
  for (const trade of allTrades) {
    const ts = new Date(trade.ledger_close_time).getTime();
    if (ts >= oneDayAgo) {
      if (trade.counter_asset_type === 'native') {
        volume24h += parseFloat(trade.counter_amount);
      } else if (trade.base_asset_type === 'native') {
        volume24h += parseFloat(trade.base_amount);
      }
    }
  }

  // Build price history from trades (oldest → newest)
  const priceHistory = allTrades
    .slice()
    .reverse()
    .map((t) => {
      const isTokenBase = t.base_asset_code === assetCode && t.base_asset_issuer === issuer;
      return isTokenBase
        ? parseFloat(t.price.n) / parseFloat(t.price.d)
        : parseFloat(t.price.d) / parseFloat(t.price.n);
    })
    .filter((p) => p > 0);

  return { holders, trades: allTrades, price, volume24h, priceHistory };
}

export function formatOnChainTrades(trades, assetCode, issuer, maxCount = 20) {
  return trades.slice(0, maxCount).map((t) => {
    let xlmAmount = 0;
    let tokenAmount = 0;
    let isBuy = false;

    if (t.counter_asset_type === 'native') {
      xlmAmount = parseFloat(t.counter_amount);
      tokenAmount = parseFloat(t.base_amount);
      isBuy = true;
    } else if (t.base_asset_type === 'native') {
      xlmAmount = parseFloat(t.base_amount);
      tokenAmount = parseFloat(t.counter_amount);
      isBuy = false;
    }

    let tradePrice = 0;
    const isTokenBase = t.base_asset_code === assetCode && t.base_asset_issuer === issuer;
    tradePrice = isTokenBase
      ? parseFloat(t.price.n) / parseFloat(t.price.d)
      : parseFloat(t.price.d) / parseFloat(t.price.n);

    return {
      type: isBuy ? 'buy' : 'sell',
      amount_xlm: xlmAmount,
      tokens: tokenAmount,
      price: tradePrice,
      time: t.ledger_close_time,
    };
  });
}

export function estimateTradeCost(side) {
  const ops = side === 'buy' ? 2 : 1;
  const feeXlm = (ops * 100) / 1e7;
  const reserveXlm = side === 'buy' ? RESERVE_PER_ENTRY : 0;
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