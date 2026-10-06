import { toXlm, USDC_CODE, USDC_ISSUER } from '@/lib/pools';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Which leg of a fill is this market's quote asset.
function isQuoteLeg(tr, side) {
  if (tr.quote === 'usdc') {
    const code = side === 'base' ? tr.base_asset_code : tr.counter_asset_code;
    const issuer = side === 'base' ? tr.base_asset_issuer : tr.counter_asset_issuer;
    return code === USDC_CODE && issuer === USDC_ISSUER;
  }
  const type = side === 'base' ? tr.base_asset_type : tr.counter_asset_type;
  return type === 'native';
}

const amountOf = (tr, side) => parseFloat(side === 'base' ? tr.base_amount : tr.counter_amount) || 0;

// A fill only moves pool liquidity when it went through a pool — an offer fill
// sits outside it. Swaps carry the pool id, on whichever side of the pair it hit.
function poolFlowXlm(tr, xlmPerUsdc) {
  const poolLeg = tr.base_liquidity_pool_id ? 'base' : tr.counter_liquidity_pool_id ? 'counter' : null;
  if (!poolLeg) return 0;

  const other = poolLeg === 'base' ? 'counter' : 'base';
  const poolIsQuote = isQuoteLeg(tr, poolLeg);
  if (poolIsQuote === isQuoteLeg(tr, other)) return 0;

  // A pool's own leg is what it gave away, so the quote it takes in — or pays out
  // — is its other leg.
  const quoteAmount = amountOf(tr, poolIsQuote ? poolLeg : other);
  return (poolIsQuote ? -1 : 1) * toXlm(quoteAmount, tr.quote, xlmPerUsdc);
}

/**
 * How the XLM locked in a token's pools moved over the last 24 hours. Swaps in
 * deepen a pool and swaps out drain it, so the depth at the start of the window is
 * today's depth minus that net flow, and the change is measured against it. Tokens
 * trading on offers alone have no pool, and therefore no figure.
 */
export function liquidityGrowth(markets, trades = [], xlmPerUsdc = 0) {
  const pools = Object.values(markets || {})
    .map((m) => m?.pool)
    .filter(Boolean);
  const currentXlm = pools.reduce((sum, p) => sum + toXlm(p.quoteReserve, p.quote, xlmPerUsdc), 0);
  if (currentXlm <= 0) return null;

  const cutoff = Date.now() - ONE_DAY_MS;
  let net24h = 0;
  for (const tr of trades || []) {
    if (new Date(tr.ledger_close_time).getTime() < cutoff) continue;
    net24h += poolFlowXlm(tr, xlmPerUsdc);
  }

  const openXlm = currentXlm - net24h;
  if (openXlm <= 0) return null;
  return { currentXlm, net24h, changePct: (net24h / openXlm) * 100 };
}

// Deepest growth first; a token with no pool has no figure and ranks below the rest.
export function byLiquidityGrowth(a, b) {
  const x = a.liquidity_change_24h;
  const y = b.liquidity_change_24h;
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return y - x;
}