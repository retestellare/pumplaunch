import { fetchAssetStats, fetchOrderBook, fetchPoolFor, fetchXlmUsdcRate } from '@/lib/stellar';
import { tokenPools } from '@/lib/pools';

export const ROUTE_LABEL = { pool: 'Liquidity Pool', book: 'Offers' };

// The price a trade actually fills at: the better of the pool and the order book,
// per direction, so a stale offer can never replace a better pool price. Every
// price comes back in XLM — a USDC market is converted through the live rate so
// dual-pool tokens keep a single comparable price.
export function resolveMarket({ quote = 'xlm', pool, book, xlmPerUsdc = 0 }) {
  const rate = quote === 'usdc' ? xlmPerUsdc : 1;
  // Routes are chosen in the market's own quote unit (both candidates share it),
  // then converted to XLM for display. The quote-unit prices are kept too, since
  // a trade sized in USDC has to be divided by a USDC price.
  const poolPrice = pool?.price > 0 ? pool.price : 0;
  const bestAsk = book?.bestAsk > 0 ? book.bestAsk : 0;
  const bestBid = book?.bestBid > 0 ? book.bestBid : 0;

  let buyPriceQuote = 0;
  let buyRoute = null;
  if (poolPrice > 0 && (bestAsk === 0 || poolPrice <= bestAsk)) {
    buyPriceQuote = poolPrice;
    buyRoute = 'pool';
  } else if (bestAsk > 0) {
    buyPriceQuote = bestAsk;
    buyRoute = 'book';
  }

  let sellPriceQuote = 0;
  let sellRoute = null;
  if (poolPrice > 0 && (bestBid === 0 || poolPrice >= bestBid)) {
    sellPriceQuote = poolPrice;
    sellRoute = 'pool';
  } else if (bestBid > 0) {
    sellPriceQuote = bestBid;
    sellRoute = 'book';
  }

  return {
    quote,
    pool,
    book,
    poolPrice: poolPrice || null,
    poolPriceXlm: poolPrice ? poolPrice * rate : null,
    buyPriceQuote,
    buyPrice: buyPriceQuote * rate,
    buyRoute,
    sellPriceQuote,
    sellPrice: sellPriceQuote * rate,
    sellRoute,
    price: (buyPriceQuote || sellPriceQuote) * rate,
    hasLiquidity: buyPriceQuote > 0 || sellPriceQuote > 0,
  };
}

// One market per quote asset — a dual-pool token has two. A USDC market is
// dropped when the rate is unknown, since its prices could not be compared.
export async function fetchMarkets(assetCode, issuer, { quotes = ['xlm'], xlmPerUsdc = 0 } = {}) {
  const active = quotes.filter((q) => q === 'xlm' || xlmPerUsdc > 0);
  const entries = await Promise.all(
    active.map(async (q) => {
      const [pool, book] = await Promise.all([
        fetchPoolFor(assetCode, issuer, q),
        fetchOrderBook(assetCode, issuer, q),
      ]);
      return [q, resolveMarket({ quote: q, pool, book, xlmPerUsdc })];
    })
  );
  return combineMarkets(Object.fromEntries(entries));
}

// The single view a screen renders: cheapest way in, best way out, plus the
// per-quote detail the trading panel switches between.
export function combineMarkets(markets) {
  const list = Object.values(markets);
  let bestBuy = null;
  let bestSell = null;
  let bestPool = null;

  for (const m of list) {
    if (!bestPool && m.pool) bestPool = m.pool;
    if (m.buyPrice > 0 && (!bestBuy || m.buyPrice < bestBuy.buyPrice)) bestBuy = m;
    if (m.sellPrice > 0 && (!bestSell || m.sellPrice > bestSell.sellPrice)) bestSell = m;
  }

  const primary = bestBuy || bestSell || list[0] || null;
  return {
    markets,
    quotes: Object.keys(markets),
    pool: bestPool,
    book: primary?.book || null,
    buyPrice: bestBuy?.buyPrice || 0,
    buyRoute: bestBuy?.buyRoute || null,
    buyQuote: bestBuy?.quote || null,
    sellPrice: bestSell?.sellPrice || 0,
    sellRoute: bestSell?.sellRoute || null,
    sellQuote: bestSell?.quote || null,
    poolPrice: bestPool?.price || null,
    poolPriceXlm: bestPool ? bestPool.price * (bestPool.quote === 'usdc' ? xlmPerUsdc : 1) : null,
    price: bestBuy?.buyPrice || bestSell?.sellPrice || 0,
    hasLiquidity: !!bestBuy || !!bestSell,
  };
}

export async function fetchMarket(assetCode, issuer, { quotes = ['xlm'], xlmPerUsdc = 0 } = {}) {
  return fetchMarkets(assetCode, issuer, { quotes, xlmPerUsdc });
}

// Everything a token screen needs: on-chain activity (holders, volume, change,
// trade history) plus the resolved best route across every pool the token has.
export async function fetchTokenMarket(token) {
  if (!token?.issuer || !token?.asset_code) return { stats: null, market: null, xlmPerUsdc: 0 };
  const quotes = tokenPools(token);
  const xlmPerUsdc = quotes.includes('usdc') ? await fetchXlmUsdcRate() : 0;

  const [stats, market] = await Promise.all([
    fetchAssetStats(token.asset_code, token.issuer, { quotes, xlmPerUsdc }),
    fetchMarkets(token.asset_code, token.issuer, { quotes, xlmPerUsdc }),
  ]);
  return { stats, market, xlmPerUsdc };
}