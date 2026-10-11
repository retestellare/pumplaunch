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

// `amount` is the input side: quote for a buy, tokens for a sell. `price` is the
// spot price in quote per token, used whenever the route is not a pool.
export function quoteTrade({ side, amount, price, route, pool }) {
  const input = toNumber(amount);
  const spot = price > 0 ? price : 0;
  const buying = side === 'buy';
  if (!(input > 0) || !(spot > 0)) return { input, out: 0, fillPrice: 0, spot, impact: 0 };

  let out;
  if (route === 'pool' && pool?.quoteReserve > 0 && pool?.tokenReserve > 0) {
    out = buying
      ? poolOut(input, pool.quoteReserve, pool.tokenReserve)
      : poolOut(input, pool.tokenReserve, pool.quoteReserve);
  } else {
    out = buying ? input / spot : input * spot;
  }

  // Quote per token, the same unit as the spot price, so the two compare.
  const fillPrice = buying ? (out > 0 ? input / out : 0) : out / input;
  const impact = fillPrice > 0 ? Math.abs((fillPrice - spot) / spot) * 100 : 0;
  return { input, out, fillPrice, spot, impact };
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