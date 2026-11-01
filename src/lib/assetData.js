import {
  fetchAssetStats,
  fetchXlmUsdcRate,
  fetchTokenMetadata,
  priceFills,
} from '@/lib/stellar';
import { fetchMarkets } from '@/lib/market';

// Any Stellar asset may trade against XLM, against USDC, or against both, so
// every market is probed and the ones that actually price it are the ones kept.
export const ASSET_QUOTES = ['xlm', 'usdc'];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Everything a wallet row or an asset screen shows for one Stellar asset: the
 * price a trade would fill at, holders, volume, who is winning the last 24 hours
 * of trading, and how much sits on each side of the order book. Every price and
 * amount is normalised to XLM, the app's unit of account.
 */
export async function loadAssetData({ code, issuer, quotes = ASSET_QUOTES, limit = 50, meta }) {
  if (!code || !issuer) return null;

  const xlmPerUsdc = quotes.includes('usdc') ? await fetchXlmUsdcRate() : 0;
  const active = quotes.filter((q) => q === 'xlm' || xlmPerUsdc > 0);

  const [stats, market, toml] = await Promise.all([
    fetchAssetStats(code, issuer, { quotes: active, xlmPerUsdc, limit }),
    fetchMarkets(code, issuer, { quotes: active, xlmPerUsdc }),
    meta ? Promise.resolve(meta) : fetchTokenMetadata(code, issuer),
  ]);

  // Only markets with something on them are offered for trading.
  const live = active.filter((q) => market.markets[q]?.hasLiquidity);
  const pools = live.length ? live : active;
  const fills = priceFills(stats.trades, code, issuer, xlmPerUsdc);

  return {
    code,
    issuer,
    xlmPerUsdc,
    pools,
    stats,
    market,
    fills,
    meta: toml || null,
    price: market.price > 0 ? market.price : stats.lastPrice || 0,
    change24h: stats.change24h,
    holders: stats.holders,
    volume24h: stats.volume24h,
    pressure: pressureFrom(fills),
    depth: depthFrom(market.book),
  };
}

// Who is buying and who is selling: the XLM that changed hands on each side over
// the window, read straight off the fills.
export function pressureFrom(fills, windowMs = DAY_MS) {
  const cutoff = Date.now() - windowMs;
  let buyXlm = 0;
  let sellXlm = 0;
  for (const f of fills || []) {
    if (new Date(f.time).getTime() < cutoff) continue;
    if (f.side === 'buy') buyXlm += f.xlm;
    else sellXlm += f.xlm;
  }
  const totalXlm = buyXlm + sellXlm;
  if (totalXlm <= 0) return null;
  return { buyXlm, sellXlm, totalXlm, buyPct: (buyXlm / totalXlm) * 100 };
}

// What is resting on the book: demand (bids) against supply (asks), both in the
// asset's own units so the two sides compare directly.
export function depthFrom(book) {
  if (!book) return null;
  const bidDepth = book.bidDepth || 0;
  const askDepth = book.askDepth || 0;
  const total = bidDepth + askDepth;
  if (total <= 0) return null;
  return {
    bidDepth,
    askDepth,
    total,
    bidPct: (bidDepth / total) * 100,
    bestBid: book.bestBid,
    bestAsk: book.bestAsk,
  };
}