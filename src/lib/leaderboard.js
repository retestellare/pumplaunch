import { mapLimit } from '@/lib/concurrency';

const HORIZON_URL = 'https://horizon.stellar.org';
const TRADE_CONCURRENCY = 6;

// Cost basis below this is dust — a percentage built on it says nothing.
const MIN_SPEND_XLM = 0.01;

export async function fetchTokenTrades(assetCode, issuer) {
  const assetType = assetCode.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
  const [baseRes, counterRes] = await Promise.all([
    fetch(`${HORIZON_URL}/trades?base_asset_type=${assetType}&base_asset_code=${assetCode}&base_asset_issuer=${issuer}&counter_asset_type=native&limit=50&order=desc`).catch(() => null),
    fetch(`${HORIZON_URL}/trades?base_asset_type=native&counter_asset_type=${assetType}&counter_asset_code=${assetCode}&counter_asset_issuer=${issuer}&limit=50&order=desc`).catch(() => null),
  ]);
  const seen = new Set();
  const trades = [];
  if (baseRes?.ok) {
    const data = await baseRes.json();
    for (const r of data._embedded?.records || []) {
      if (!seen.has(r.id)) { seen.add(r.id); trades.push(r); }
    }
  }
  if (counterRes?.ok) {
    const data = await counterRes.json();
    for (const r of data._embedded?.records || []) {
      if (!seen.has(r.id)) { seen.add(r.id); trades.push(r); }
    }
  }
  return trades;
}

async function fetchAllTrades(tokens) {
  const results = await mapLimit(tokens, TRADE_CONCURRENCY, (t) =>
    t?.issuer && t?.asset_code ? fetchTokenTrades(t.asset_code, t.issuer) : []
  );
  return tokens.map((t, i) => ({ token: t, trades: results[i] || [] }));
}

// Which side of a trade paid XLM and which side received it.
function sides(tr) {
  if (tr.counter_asset_type === 'native') {
    return {
      xlm: parseFloat(tr.counter_amount) || 0,
      tokens: parseFloat(tr.base_amount) || 0,
      buyer: tr.counter_account,
      seller: tr.base_account,
    };
  }
  if (tr.base_asset_type === 'native') {
    return {
      xlm: parseFloat(tr.base_amount) || 0,
      tokens: parseFloat(tr.counter_amount) || 0,
      buyer: tr.base_account,
      seller: tr.counter_account,
    };
  }
  return null;
}

// Return % on the XLM a wallet actually spent: cost basis is its buys, proceeds
// are its sells. Wallets that only ever sold (creators seeding liquidity into the
// curve) have no cost basis and are left out.
export async function fetchLeaderboard(tokens) {
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
      if (s.buyer) ensure(s.buyer).spent += s.xlm;
      if (s.seller) ensure(s.seller).received += s.xlm;
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

  return rows;
}

export async function fetchNewHolders(tokens) {
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