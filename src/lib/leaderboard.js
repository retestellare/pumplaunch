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

export function computePnl(trades) {
  const wallets = {};
  const ensure = (addr) => {
    if (!addr) return null;
    if (!wallets[addr]) wallets[addr] = { address: addr, sellXlm: 0, buyXlm: 0 };
    return wallets[addr];
  };
  for (const t of trades) {
    if (t.counter_asset_type === 'native') {
      const xlm = parseFloat(t.counter_amount);
      const seller = ensure(t.base_account);
      const buyer = ensure(t.counter_account);
      if (seller) seller.sellXlm += xlm;
      if (buyer) buyer.buyXlm += xlm;
    } else if (t.base_asset_type === 'native') {
      const xlm = parseFloat(t.base_amount);
      const buyer = ensure(t.base_account);
      const seller = ensure(t.counter_account);
      if (buyer) buyer.buyXlm += xlm;
      if (seller) seller.sellXlm += xlm;
    }
  }
  return Object.values(wallets)
    .map((w) => ({ ...w, pnl: w.sellXlm - w.buyXlm }))
    .sort((a, b) => b.pnl - a.pnl);
}

export async function fetchLeaderboard(tokens) {
  const allTrades = [];
  for (const t of tokens) {
    if (!t.issuer || !t.asset_code) continue;
    try {
      const trades = await fetchTokenTrades(t.asset_code, t.issuer);
      allTrades.push(...trades);
    } catch { /* skip */ }
  }
  return computePnl(allTrades);
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