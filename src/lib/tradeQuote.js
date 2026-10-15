// How a trade is expected to fill, in the market's own quote unit.
//
// A path payment against a Stellar liquidity pool follows that pool's
// constant-product curve and pays the pool's 0.3% fee, so what a trade returns
// is not the spot price times the input: the size of the trade moves the price.
// An order book route fills at the best offer it finds.
export const POOL_FEE = 0.003;

// Inputs can arrive with a comma decimal separator, which parseFloat would cut
// in half.
export function toNumber(value) {
  const n = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function poolOut(amountIn, reserveIn, reserveOut) {
  if (!(amountIn > 0) || !(reserveIn > 0) || !(reserveOut > 0)) return 0;
  const net = amountIn * (1 - POOL_FEE);
  return (reserveOut * net) / (reserveIn + net);
}

// A trade larger than the best offer does not fill at the best price: the levels
// behind it pay for the rest. Each level carries `price` (quote per token) and
// `tokens` (what that offer hands over), so the book is walked best price first.
export function bookOut(amountIn, levels, side) {
  const input = toNumber(amountIn);
  if (!(input > 0) || !Array.isArray(levels) || !levels.length) return 0;
  let left = input;
  let out = 0;
  for (const level of levels) {
    const levelPrice = toNumber(level?.price);
    const tokens = toNumber(level?.tokens);
    if (!(levelPrice > 0) || !(tokens > 0)) continue;
    if (side === 'buy') {
      const spend = Math.min(left, tokens * levelPrice);
      out += spend / levelPrice;
      left -= spend;
    } else {
      const take = Math.min(left, tokens);
      out += take * levelPrice;
      left -= take;
    }
    if (!(left > 0)) break;
  }
  return out;
}

// `amount` is the input side: quote for a buy, tokens for a sell. `price` is the
// spot price in quote per token, used whenever there is no depth to price against.
export function quoteTrade({ side, amount, price, route, pool, book }) {
  const input = toNumber(amount);
  const spot = price > 0 ? price : 0;
  const buying = side === 'buy';
  if (!(input > 0) || !(spot > 0))
    return { input, out: 0, fillPrice: 0, spot, impact: 0, route: null };

  // A limit order fills at the price it sets. A market order is paid by whichever
  // source really returns more for this size: the pool's curve, or the book walked
  // level by level. Comparing the two spot prices instead — as this did — reports
  // the pool for a trade the deeper offers behind them would have paid far better.
  let taken = route || null;
  let out = 0;
  if (route) {
    const fromPool =
      pool?.quoteReserve > 0 && pool?.tokenReserve > 0
        ? buying
          ? poolOut(input, pool.quoteReserve, pool.tokenReserve)
          : poolOut(input, pool.tokenReserve, pool.quoteReserve)
        : 0;
    const fromBook = bookOut(input, buying ? book?.asks : book?.bids, side);
    if (fromBook > fromPool) {
      out = fromBook;
      taken = 'book';
    } else if (fromPool > 0) {
      out = fromPool;
      taken = 'pool';
    }
  }
  if (!(out > 0)) out = buying ? input / spot : input * spot;

  // Quote per token, the same unit as the spot price, so the two compare.
  const fillPrice = buying ? (out > 0 ? input / out : 0) : out / input;
  const impact = fillPrice > 0 ? Math.abs((fillPrice - spot) / spot) * 100 : 0;
  return { input, out, fillPrice, spot, impact, route: taken };
}

// Amounts here span nine orders of magnitude, so small figures keep their
// significant digits instead of being rounded away to zero.
export function fmtAmount(value, maxDecimals = 6) {
  const n = Number(value) || 0;
  if (n === 0) return '0';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(Math.min(maxDecimals, 4));
  return n.toPrecision(4);
}