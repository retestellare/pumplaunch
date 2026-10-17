import * as StellarSdk from '@stellar/stellar-sdk';
import { base44 } from '@/api/base44Client';
import {
  fetchAssetStats,
  fetchIssuedAsset,
  fetchXlmUsdcRate,
  loadAccount,
} from '@/lib/stellar';
import { isUsableImage, loadAssetMeta } from '@/lib/tokenImages';
import { fetchMarkets } from '@/lib/market';

// The app trades against these two quote assets, so a listing is probed for
// both and keeps whichever markets the asset really has.
const QUOTE_PROBES = ['xlm', 'usdc'];

export function normalizeAssetCode(value) {
  return String(value || '').trim().toUpperCase();
}

export function isValidIssuer(value) {
  try {
    return StellarSdk.StrKey.isValidEd25519PublicKey(String(value || '').trim());
  } catch {
    return false;
  }
}

// Reads an asset that was created outside the app straight off the ledger:
// what Stellar knows about it, the metadata its issuer publishes in
// stellar.toml, and which of the app's markets it actually trades in.
export async function lookupExternalToken(code, issuer) {
  const assetCode = normalizeAssetCode(code);
  const address = String(issuer || '').trim();

  if (!assetCode) throw new Error('Enter the asset code, for example USDC.');
  if (assetCode.length > 12) throw new Error('A Stellar asset code is at most 12 characters.');
  if (!isValidIssuer(address)) throw new Error('That is not a valid Stellar issuer address.');

  const account = await loadAccount(address);
  if (!account) throw new Error('No Stellar account exists at that issuer address.');

  const issued = await fetchIssuedAsset(assetCode, address);
  if (!issued) throw new Error(`Stellar has no ${assetCode} asset issued by that account.`);

  const xlmPerUsdc = await fetchXlmUsdcRate();
  const [meta, stats, markets] = await Promise.all([
    loadAssetMeta(assetCode, address, account.home_domain),
    fetchAssetStats(assetCode, address, { quotes: QUOTE_PROBES, xlmPerUsdc, limit: 20 }),
    fetchMarkets(assetCode, address, { quotes: QUOTE_PROBES, xlmPerUsdc }),
  ]);

  const pools = QUOTE_PROBES.filter((q) => markets.markets?.[q]?.pool);
  const hasBook = QUOTE_PROBES.some((q) => {
    const book = markets.markets?.[q]?.book;
    return !!book && (book.askCount > 0 || book.bidCount > 0);
  });

  return {
    asset_code: assetCode,
    issuer: address,
    name: meta?.name || assetCode,
    image_url: isUsableImage(meta?.logo) ? meta.logo : '',
    home_domain: account.home_domain || meta?.homeDomain || '',
    supply: issued.supply,
    holders: issued.accounts || stats.holders || 0,
    price: markets.price || 0,
    pools: pools.length ? pools : ['xlm'],
    has_pool: pools.length > 0,
    has_book: hasBook,
    volume_24h: stats.volume24h || 0,
    change_24h: stats.change24h ?? 0,
  };
}

// The record the app lists the imported asset as: the reviewed fields on top of
// everything the ledger supplied, flagged so the app knows it did not create it.
export function importedTokenRecord(lookup, walletAddress) {
  const price = lookup.price > 0 ? lookup.price : 0.000001;
  return {
    name: lookup.name,
    symbol: lookup.asset_code,
    description: lookup.description || '',
    image_url: lookup.image_url || '',
    creator: walletAddress,
    issuer: lookup.issuer,
    asset_code: lookup.asset_code,
    home_domain: lookup.home_domain || null,
    supply: lookup.supply,
    liquidity_percent: 100,
    is_auto_pool: lookup.has_pool,
    is_imported: true,
    pools: lookup.pools,
    curve: 'slow',
    price,
    market_cap: price * lookup.supply,
    holders: lookup.holders,
    volume_24h: lookup.volume_24h,
    change_24h: lookup.change_24h,
    is_graduated: lookup.has_pool || lookup.has_book,
  };
}

export async function importExternalToken(lookup, walletAddress) {
  if (!walletAddress) throw new Error('Connect a wallet before importing.');
  const found = await base44.entities.Token.filter({
    asset_code: lookup.asset_code,
    issuer: lookup.issuer,
  });
  const existing = Array.isArray(found) ? found : found?.items || [];
  if (existing.length > 0) {
    throw new Error(`${lookup.asset_code} from that issuer is already listed.`);
  }
  return base44.entities.Token.create(importedTokenRecord(lookup, walletAddress));
}