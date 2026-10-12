import { base44 } from '@/api/base44Client';

// Cost basis below this is dust — a percentage built on it says nothing.
const MIN_SPEND_XLM = 0.01;

/**
 * What a wallet paid for each token it bought through the app, and what it has
 * already sold back out. Both sides are stored in XLM, so a USDC trade counts in
 * the same unit as an XLM one, and the totals come from the database rather than
 * from a page of history. Keyed by token, since that is what a trade records.
 */
export async function fetchTokenCosts(address) {
  if (!address) return {};

  const [buys, sells] = await Promise.all([
    base44.entities.Trade.aggregate({
      query: { user_address: address, type: 'buy' },
      groupBy: 'token_id',
      sum: ['amount_xlm'],
    }),
    base44.entities.Trade.aggregate({
      query: { user_address: address, type: 'sell' },
      groupBy: 'token_id',
      sum: ['amount_xlm'],
    }),
  ]);

  const costs = {};
  const merge = (rows, side) => {
    for (const row of rows || []) {
      if (!row.token_id) continue;
      const cost = (costs[row.token_id] = costs[row.token_id] || { spent: 0, received: 0 });
      cost[side] += row.sum_amount_xlm || 0;
    }
  };
  merge(buys?.rows, 'spent');
  merge(sells?.rows, 'received');
  return costs;
}

/**
 * One holding against what it cost: the XLM still in it, plus everything already
 * taken back out of it, against everything that went in. Null when nothing was
 * ever paid for it (an airdrop) or when no market prices the holding.
 */
export function positionPnl({ value, cost }) {
  const spent = cost?.spent || 0;
  if (value == null || spent < MIN_SPEND_XLM) return null;
  const pnl = value + (cost.received || 0) - spent;
  return { pnl, spent, pct: (pnl / spent) * 100 };
}

/** The same figure across the portfolio, or null when nothing has been bought. */
export function portfolioPnl(assets, costs) {
  let pnl = 0;
  let spent = 0;
  let counted = 0;
  for (const a of assets || []) {
    const price = a.price > 0 ? a.price : null;
    const value = price != null ? price * (a.balance || 0) : null;
    const position = positionPnl({ value, cost: costs?.[a.token_id] });
    if (!position) continue;
    pnl += position.pnl;
    spent += position.spent;
    counted += 1;
  }
  if (!counted || spent <= 0) return null;
  return { pnl, spent, pct: (pnl / spent) * 100, tokens: counted };
}