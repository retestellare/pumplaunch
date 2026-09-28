const HORIZON_URL = 'https://horizon.stellar.org';

export async function fetchTokenTrades(assetCode, issuer) {
  const assetType = assetCode.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
  const [baseRes, counterRes] = await Promise.all([
    fetch(`${HORIZON_URL}/trades?base_asset_type=${assetType}&base_asset_code=${assetCode}&base_asset_issuer=${issuer}&counter_asset_type=native&limit=200&order=desc`).catch(() => null),
    fetch(`${HORIZON_URL}/trades?base_asset_type=native&counter_asset_type=${assetType}&counter_asset_code=${assetCode}&counter_asset_issuer=${issuer}&limit=200&order=desc`).catch(() => null),
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

// Realized cash-flow PnL per wallet: XLM received from sells − XLM spent on buys.
// No mark-to-market on holdings (liquidity is thin), so gain% reflects realized trades only.
export async function fetchLeaderboard(tokens) {
  const wallets = {};
  const ensure = (addr) => {
    if (!addr) return null;
    if (!wallets[addr]) wallets[addr] = { address: addr, spent: 0, received: 0 };
    return wallets[addr];
  };

  for (const t of tokens) {
    if (!t.issuer || !t.asset_code) continue;
    let trades = [];
    try {
      trades = await fetchTokenTrades(t.asset_code, t.issuer);
    } catch {
      continue;
    }
    for (const tr of trades) {
      let buyer = null;
      let seller = null;
      let xlmAmount = 0;
      if (tr.counter_asset_type === 'native') {
        xlmAmount = parseFloat(tr.counter_amount);
        buyer = tr.counter_account;
        seller = tr.base_account;
      } else if (tr.base_asset_type === 'native') {
        xlmAmount = parseFloat(tr.base_amount);
        buyer = tr.base_account;
        seller = tr.counter_account;
      } else {
        continue;
      }
      if (buyer) ensure(buyer).spent += xlmAmount;
      if (seller) ensure(seller).received += xlmAmount;
    }
  }

  const rows = Object.values(wallets).map((w) => {
    const pnl = w.received - w.spent;
    const gainPct = w.spent > 0 ? (pnl / w.spent) * 100 : null;
    return { address: w.address, pnl, gainPct, spent: w.spent };
  });

  rows.sort((a, b) => {
    const av = a.gainPct ?? (a.pnl > 0 ? Number.MAX_VALUE : -Number.MAX_VALUE);
    const bv = b.gainPct ?? (b.pnl > 0 ? Number.MAX_VALUE : -Number.MAX_VALUE);
    if (bv !== av) return bv - av;
    if (b.pnl !== a.pnl) return b.pnl - a.pnl;
    return a.address.localeCompare(b.address);
  });

  return rows;
}

export async function fetchNewHolders(tokens) {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const buyers = [];
  for (const t of tokens) {
    if (!t.issuer || !t.asset_code) continue;
    try {
      const trades = await fetchTokenTrades(t.asset_code, t.issuer);
      for (const tr of trades) {
        const ts = new Date(tr.ledger_close_time).getTime();
        if (ts < oneDayAgo) continue;
        let buyer = null;
        let amount = 0;
        if (tr.counter_asset_type === 'native') {
          buyer = tr.counter_account;
          amount = parseFloat(tr.base_amount);
        } else if (tr.base_asset_type === 'native') {
          buyer = tr.base_account;
          amount = parseFloat(tr.counter_amount);
        }
        if (buyer) {
          buyers.push({ address: buyer, tokenSymbol: t.symbol, amount, time: tr.ledger_close_time });
        }
      }
    } catch { /* skip */ }
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