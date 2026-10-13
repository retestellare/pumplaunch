import { base44 } from '@/api/base44Client';
import { mapLimit } from '@/lib/concurrency';
import { fetchXlmUsdcRate } from '@/lib/stellar';
import { tokenPools, toXlm, USDC_CODE, USDC_ISSUER } from '@/lib/pools';

const HORIZON_URL = 'https://horizon.stellar.org';
const TRADE_CONCURRENCY = 6;

// Cost basis below this is dust — a percentage built on it says nothing.
const MIN_SPEND_XLM = 0.01;

function assetParams(prefix, quote) {
  if (quote === 'usdc') {
    return `${prefix}_asset_type=credit_alphanum4&${prefix}_asset_code=${USDC_CODE}&${prefix}_asset_issuer=${USDC_ISSUER}`;
  }
  return `${prefix}_asset_type=native`;
}

async function fetchQuoteTrades(assetCode, issuer, quote) {
  const assetType = assetCode.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
  const tokenBase = `base_asset_type=${assetType}&base_asset_code=${assetCode}&base_asset_issuer=${issuer}`;
  const tokenCounter = `counter_asset_type=${assetType}&counter_asset_code=${assetCode}&counter_asset_issuer=${issuer}`;

  const [baseRes, counterRes] = await Promise.all([
    fetch(`${HORIZON_URL}/trades?${tokenBase}&${assetParams('counter', quote)}&limit=50&order=desc`).catch(() => null),
    fetch(`${HORIZON_URL}/trades?${assetParams('base', quote)}&${tokenCounter}&limit=50&order=desc`).catch(() => null),
  ]);

  const seen = new Set();
  const trades = [];
  for (const res of [baseRes, counterRes]) {
    if (!res?.ok) continue;
    const data = await res.json();
    for (const r of data._embedded?.records || []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      trades.push({ ...r, quote });
    }
  }
  return trades;
}

// Every market a token trades in, so a USDC fill counts like an XLM one.
export async function fetchTokenTrades(assetCode, issuer, quotes = ['xlm']) {
  const sets = await Promise.all(quotes.map((q) => fetchQuoteTrades(assetCode, issuer, q)));
  return sets.flat();
}

async function fetchAllTrades(tokens) {
  const results = await mapLimit(tokens, TRADE_CONCURRENCY, (t) =>
    t?.issuer && t?.asset_code ? fetchTokenTrades(t.asset_code, t.issuer, tokenPools(t)) : []
  );
  return tokens.map((t, i) => ({ token: t, trades: results[i] || [] }));
}

// Which side of a trade paid the quote asset and which side received it.
function sides(tr) {
  const quoteIsCounter = tr.quote === 'usdc'
    ? tr.counter_asset_code === USDC_CODE && tr.counter_asset_issuer === USDC_ISSUER
    : tr.counter_asset_type === 'native';
  const quoteIsBase = tr.quote === 'usdc'
    ? tr.base_asset_code === USDC_CODE && tr.base_asset_issuer === USDC_ISSUER
    : tr.base_asset_type === 'native';

  if (quoteIsCounter) {
    return {
      quote: parseFloat(tr.counter_amount) || 0,
      tokens: parseFloat(tr.base_amount) || 0,
      buyer: tr.counter_account,
      seller: tr.base_account,
    };
  }
  if (quoteIsBase) {
    return {
      quote: parseFloat(tr.base_amount) || 0,
      tokens: parseFloat(tr.counter_amount) || 0,
      buyer: tr.base_account,
      seller: tr.counter_account,
    };
  }
  return null;
}

// Building the board costs two Horizon calls per token, and two screens want it —
// the home board and a profile's badges — so a finished board is held briefly
// rather than rebuilt for each of them.
const BOARD_TTL_MS = 3 * 60 * 1000;
let boardCache = { key: '', at: 0, rows: null };

function tokenKey(tokens) {
  return (tokens || []).map((t) => `${t.id || t.asset_code || ''}:${t.issuer || ''}`).join(',');
}

// The board for a screen with no token list of its own.
export async function fetchTraderBoard() {
  const tokens = await base44.entities.Token.list('-created_date', 100);
  return fetchLeaderboard(tokens);
}

// Return % on the XLM a wallet actually spent: cost basis is its buys, proceeds
// are its sells, with USDC converted so one ranking covers both markets. Wallets
// that only ever sold (creators seeding liquidity) have no cost basis and are
// left out.
export async function fetchLeaderboard(tokens) {
  const key = tokenKey(tokens);
  if (boardCache.rows && boardCache.key === key && Date.now() - boardCache.at < BOARD_TTL_MS) {
    return boardCache.rows;
  }

  const xlmPerUsdc = await fetchXlmUsdcRate();
  const wallets = {};
  const ensure = (addr) => {
    if (!addr) return null;
    if (!wallets[addr]) wallets[addr] = { address: addr, spent: 0, received: 0 };
    return wallets[addr];
  };

  const all = await fetchAllTrades(tokens);
  for (const { trades } of all) {
    for (const tr of trades) {
      const s = sides(tr);
      if (!s) continue;
      const xlm = toXlm(s.quote, tr.quote, xlmPerUsdc);
      if (s.buyer) ensure(s.buyer).spent += xlm;
      if (s.seller) ensure(s.seller).received += xlm;
    }
  }

  const rows = Object.values(wallets)
    .filter((w) => w.spent >= MIN_SPEND_XLM)
    .map((w) => {
      const pnl = w.received - w.spent;
      return { address: w.address, pnl, spent: w.spent, gainPct: (pnl / w.spent) * 100 };
    });

  rows.sort(
    (a, b) =>
      b.gainPct - a.gainPct ||
      b.pnl - a.pnl ||
      a.address.localeCompare(b.address)
  );

  boardCache = { key, at: Date.now(), rows };
  return rows;
}

async function buildNewHolders(tokens) {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  // Issuers and creators are not "new holders" — they are the supply side.
  const excluded = new Set(tokens.flatMap((t) => [t.creator, t.issuer]).filter(Boolean));
  const buyers = [];

  const all = await fetchAllTrades(tokens);
  for (const { token, trades } of all) {
    for (const tr of trades) {
      if (new Date(tr.ledger_close_time).getTime() < oneDayAgo) continue;
      const s = sides(tr);
      if (!s || !s.buyer || excluded.has(s.buyer)) continue;
      buyers.push({
        address: s.buyer,
        tokenSymbol: token.symbol,
        amount: s.tokens,
        time: tr.ledger_close_time,
      });
    }
  }

  const byAddr = {};
  for (const b of buyers) {
    if (!byAddr[b.address] || new Date(b.time) > new Date(byAddr[b.address].time)) {
      byAddr[b.address] = b;
    }
  }
  return Object.values(byAddr)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 20);
}

// The holders card and the flash line both want this sweep on the same screen, so
// a finished sweep — and one already in flight — is shared rather than repeated.
const HOLDERS_TTL_MS = 3 * 60 * 1000;
let holdersCache = { key: '', at: 0, rows: null };
let holdersPending = { key: '', promise: null };

export function fetchNewHolders(tokens) {
  const key = tokenKey(tokens);
  if (holdersCache.rows && holdersCache.key === key && Date.now() - holdersCache.at < HOLDERS_TTL_MS) {
    return Promise.resolve(holdersCache.rows);
  }
  if (holdersPending.promise && holdersPending.key === key) return holdersPending.promise;

  const clearPending = () => {
    if (holdersPending.key === key) holdersPending = { key: '', promise: null };
  };
  const promise = buildNewHolders(tokens)
    .then((rows) => {
      holdersCache = { key, at: Date.now(), rows };
      clearPending();
      return rows;
    })
    .catch((error) => {
      clearPending();
      throw error;
    });

  holdersPending = { key, promise };
  return promise;
}