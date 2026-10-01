import { fetchAssetStats, fetchOrderBook, fetchPoolPrice } from '@/lib/stellar';

export const ROUTE_LABEL = { pool: 'Liquidity Pool', book: 'Offers' };

// The price a trade actually fills at: the better of the XLM/token pool and the
// order book, per direction. A stale offer can never replace a better pool price.
export function resolveMarket({ pool, book }) {
  const poolPrice = pool?.price > 0 ? pool.price : 0;
  const bestAsk = book?.bestAsk > 0 ? book.bestAsk : 0;
  const bestBid = book?.bestBid > 0 ? book.bestBid : 0;

  let buyPrice = 0;
  let buyRoute = null;
  if (poolPrice > 0 && (bestAsk === 0 || poolPrice <= bestAsk)) {
    buyPrice = poolPrice;
    buyRoute = 'pool';
  } else if (bestAsk > 0) {
    buyPrice = bestAsk;
    buyRoute = 'book';
  }

  let sellPrice = 0;
  let sellRoute = null;
  if (poolPrice > 0 && (bestBid === 0 || poolPrice >= bestBid)) {
    sellPrice = poolPrice;
    sellRoute = 'pool';
  } else if (bestBid > 0) {
    sellPrice = bestBid;
    sellRoute = 'book';
  }

  return {
    pool,
    book,
    poolPrice: poolPrice || null,
    buyPrice,
    buyRoute,
    sellPrice,
    sellRoute,
    price: buyPrice || sellPrice || 0,
    hasLiquidity: buyPrice > 0 || sellPrice > 0,
  };
}

export async function fetchMarket(assetCode, issuer, { isAutoPool } = {}) {
  const [pool, book] = await Promise.all([
    isAutoPool ? fetchPoolPrice(assetCode, issuer) : Promise.resolve(null),
    fetchOrderBook(assetCode, issuer),
  ]);
  return resolveMarket({ pool, book });
}

// Everything a token screen needs: on-chain activity (holders, volume, change,
// trade history) plus the resolved best-route price.
export async function fetchTokenMarket(token) {
  if (!token?.issuer || !token?.asset_code) return { stats: null, market: null };
  const [stats, market] = await Promise.all([
    fetchAssetStats(token.asset_code, token.issuer),
    fetchMarket(token.asset_code, token.issuer, { isAutoPool: token.is_auto_pool }),
  ]);
  return { stats, market };
}