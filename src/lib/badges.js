// Trader badges, read straight off the leaderboard ranking: no extra data, no
// badge anyone can claim for themselves. Each one goes to a single wallet per
// board, so a badge always means something — a quiet board simply has none.
export const BADGE_MIN_WHALE_XLM = 25;

export const BADGES = {
  top_trader: {
    key: 'top_trader',
    label: 'Top Trader',
    glyph: '🏆',
    tone: '#FFD76A',
    hint: 'The best return on the board',
  },
  whale: {
    key: 'whale',
    label: 'Whale',
    glyph: '🐋',
    tone: '#4D9EFF',
    hint: `The largest volume traded, from ${BADGE_MIN_WHALE_XLM} XLM up`,
  },
  big_earner: {
    key: 'big_earner',
    label: 'Big Earner',
    glyph: '💰',
    tone: '#00F59B',
    hint: 'The largest profit, counted in XLM',
  },
};

export const BADGE_ORDER = ['top_trader', 'whale', 'big_earner'];

export function badgeList(keys) {
  return (keys || []).map((key) => BADGES[key]).filter(Boolean);
}

// Which badges each wallet holds. `rows` is a leaderboard, best return first —
// the same rows the board renders, so badges never disagree with the ranking.
export function computeBadges(rows = []) {
  const map = {};
  if (rows.length === 0) return map;

  const award = (address, key) => {
    if (!address) return;
    if (!map[address]) map[address] = [];
    map[address].push(key);
  };

  award(rows[0].address, 'top_trader');

  const whale = rows.reduce((best, row) => (row.spent > (best ? best.spent : 0) ? row : best), null);
  if (whale && whale.spent >= BADGE_MIN_WHALE_XLM) award(whale.address, 'whale');

  const earner = rows.reduce((best, row) => (row.pnl > (best ? best.pnl : -Infinity) ? row : best), null);
  if (earner && earner.pnl > 0) award(earner.address, 'big_earner');

  return map;
}

export function badgesFor(rows, address) {
  if (!address) return [];
  return computeBadges(rows)[address] || [];
}