// Bringing any Stellar asset into the app: a token launched elsewhere can be
// searched by code, by issuer, or by the exact CODE:ISSUER pair, previewed with
// its live market, and then listed so it shows up beside the rest.
import { base44 } from '@/api/base44Client';
import { fetchAssetStats, fetchTokenMetadata, fetchXlmUsdcRate } from '@/lib/stellar';
import { fetchMarkets } from '@/lib/market';

const HORIZON_URL = 'https://horizon.stellar.org';
const ISSUER_RE = /^G[A-Z2-7]{55}$/;
const MAX_CANDIDATES = 20;
const QUOTES = ['xlm', 'usdc'];

// Accepts "CODE:ISSUER", a bare issuer address (G…), or a bare code to search for.
export function parseAssetQuery(raw) {
  const q = (raw || '').trim().toUpperCase();
  if (!q) return null;

  const colon = q.indexOf(':');
  if (colon > -1) {
    const code = q.slice(0, colon).trim();
    const issuer = q.slice(colon + 1).replace(/\s+/g, '');
    if (!code || !ISSUER_RE.test(issuer)) return null;
    return { code, issuer };
  }

  if (ISSUER_RE.test(q)) return { code: null, issuer: q };
  return { code: q.replace(/^\$/, ''), issuer: null };
}

// Horizon's asset index is the only way to find an asset by code alone: a code
// is not unique on Stellar, so several issuers can answer to the same one.
export async function searchAssets({ code, issuer }) {
  const params = new URLSearchParams({ limit: String(MAX_CANDIDATES), order: 'desc' });
  if (code) params.set('asset_code', code);
  if (issuer) params.set('asset_issuer', issuer);

  const res = await fetch(`${HORIZON_URL}/assets?${params}`);
  if (!res.ok) throw new Error('Could not reach the Stellar network. Try again in a moment.');
  const data = await res.json();

  return (data._embedded?.records || [])
    .filter((r) => (r.asset_type || '').startsWith('credit'))
    .map((r) => ({
      code: r.asset_code,
      issuer: r.asset_issuer,
      supply: sumOf(r.balances),
      trustlines: sumOf(r.accounts),
    }))
    // Sorted by how many wallets actually hold it, so the real asset of a
    // duplicated code sits at the top of the list.
    .sort((a, b) => b.trustlines - a.trustlines);
}

// Horizon reports these as nested totals, and their names have changed over
// time — adding up whatever the record carries keeps either shape working.
function sumOf(group) {
  if (!group || typeof group !== 'object') return 0;
  return Object.values(group).reduce((total, v) => total + (parseFloat(v) || 0), 0);
}

// Everything the preview needs: identity from the issuer's stellar.toml, live
// figures from Horizon, and the markets the asset actually trades in.
export async function loadAssetPreview(asset) {
  const xlmPerUsdc = await fetchXlmUsdcRate();
  const [meta, stats, markets] = await Promise.all([
    fetchTokenMetadata(asset.code, asset.issuer),
    fetchAssetStats(asset.code, asset.issuer, { quotes: QUOTES, xlmPerUsdc }),
    fetchMarkets(asset.code, asset.issuer, { quotes: QUOTES, xlmPerUsdc }),
  ]);

  const live = QUOTES.filter((q) => {
    const m = markets.markets[q];
    return !!(m && (m.pool || m.book?.askCount > 0 || m.book?.bidCount > 0));
  });

  return {
    ...asset,
    name: meta?.name || asset.code,
    logo: meta?.logo || null,
    homeDomain: meta?.homeDomain || null,
    holders: stats.holders,
    volume24h: stats.volume24h,
    change24h: stats.change24h,
    price: markets.price > 0 ? markets.price : null,
    pools: live.length ? live : ['xlm'],
  };
}

export async function findListedToken(asset) {
  const found = await base44.entities.Token.filter({ issuer: asset.issuer, asset_code: asset.code });
  return found?.[0] || null;
}

// Listing is idempotent — an asset already in the app comes back untouched.
export async function listAsset(asset, creatorAddress) {
  const existing = await findListedToken(asset);
  if (existing) return existing;

  return base44.entities.Token.create({
    name: asset.name,
    symbol: asset.code,
    description: asset.homeDomain ? `Listed from ${asset.homeDomain}` : 'Listed from the Stellar network.',
    image_url: asset.logo,
    creator: creatorAddress || asset.issuer,
    issuer: asset.issuer,
    asset_code: asset.code,
    home_domain: asset.homeDomain,
    supply: asset.supply,
    pools: asset.pools,
    price: asset.price || 0,
    market_cap: (asset.price || 0) * (asset.supply || 0),
    holders: asset.holders || 0,
    volume_24h: asset.volume24h || 0,
    change_24h: asset.change24h == null ? 0 : asset.change24h,
    is_imported: true,
    is_graduated: true,
  });
}