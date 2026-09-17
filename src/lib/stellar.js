import * as StellarSdk from '@stellar/stellar-sdk';
import { StellarWalletsKit, ensureKitInit } from './walletKit';

const HORIZON_URL = 'https://horizon.stellar.org';
export const NETWORK_PASSPHRASE = StellarSdk.Networks.PUBLIC;
export const HOME_DOMAIN = 'stellarlaunch.base44.app';
export const BASE_FEE = StellarSdk.BASE_FEE || '100';
const RESERVE_PER_ENTRY = 0.5;

const BONDING_RUNGS = 6;
const BASE_PRICE = 0.000001;
const PRICE_STEP = 1.6;

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

export function buildLaunchTransaction({ sourceAccount, assetCode, totalSupply, liquidityPercent }) {
  const issuer = sourceAccount.accountId();
  const asset = new StellarSdk.Asset(assetCode, issuer);
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  tx.addOperation(StellarSdk.Operation.setOptions({ homeDomain: HOME_DOMAIN }));

  tx.addOperation(
    StellarSdk.Operation.payment({
      destination: issuer,
      asset,
      amount: formatAmount(totalSupply),
    })
  );

  const liquidityAmount = (totalSupply * liquidityPercent) / 100;
  if (liquidityAmount > 0) {
    const rungAmount = liquidityAmount / BONDING_RUNGS;
    for (let i = 0; i < BONDING_RUNGS; i++) {
      const price = BASE_PRICE * Math.pow(PRICE_STEP, i);
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

export function generateStellarToml({ name, code, issuer, description }) {
  const lines = ['# stellar.toml', '[DOCUMENTATION]', `ORG_NAME="${name}"`];
  if (description) lines.push(`ORG_DESCRIPTION="${description}"`);
  lines.push('', '[CURRENCIES]');
  lines.push(`CURRENCY_CODE="${code}"`);
  lines.push(`CURRENCY_ISSUER="${issuer}"`);
  lines.push(`CURRENCY_NAME="${name}"`);
  if (description) lines.push(`CURRENCY_DESC="${description}"`);
  return lines.join('\n');
}

export function estimateLaunchCost(liquidityPercent) {
  const offerCount = liquidityPercent > 0 ? BONDING_RUNGS : 0;
  const operations = 2 + offerCount;
  const feeXlm = (operations * 100) / 1e7;
  const reserveXlm = offerCount * RESERVE_PER_ENTRY;
  return { feeXlm, reserveXlm, operations, offerCount };
}

export function estimateTradeCost(side) {
  const ops = side === 'buy' ? 2 : 1;
  const feeXlm = (ops * 100) / 1e7;
  const reserveXlm = side === 'buy' ? RESERVE_PER_ENTRY : 0;
  return { feeXlm, reserveXlm, operations: ops };
}