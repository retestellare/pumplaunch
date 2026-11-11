const HORIZON_URL = 'https://horizon.stellar.org';

// Every account Horizon reports holding the asset, biggest balance first. The
// issuer's unsold supply is not a holder, so it never appears in the list.
export async function fetchTokenHolders(assetCode, issuer) {
  if (!assetCode || !issuer) return [];
  const res = await fetch(`${HORIZON_URL}/accounts?asset=${assetCode}:${issuer}&limit=200`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data._embedded?.records || [])
    .map((acc) => {
      const line = (acc.balances || []).find(
        (b) => b.asset_code === assetCode && b.asset_issuer === issuer
      );
      return { address: acc.account_id, balance: line ? parseFloat(line.balance) : 0 };
    })
    .filter((h) => h.balance > 0)
    .sort((a, b) => b.balance - a.balance);
}

// Share of the held supply for each wallet, plus the running total, so the list
// can show which wallets together control the majority of the token.
export function withShares(holders) {
  const total = holders.reduce((sum, h) => sum + h.balance, 0);
  let running = 0;
  return {
    total,
    rows: holders.map((h, i) => {
      running += h.balance;
      const share = total > 0 ? (h.balance / total) * 100 : 0;
      return { ...h, rank: i + 1, share, cumulative: total > 0 ? (running / total) * 100 : 0 };
    }),
  };
}

// The rank at which the largest wallets, read top down, pass half the held
// supply: everyone up to and including it is the controlling group.
export function majorityRank(rows) {
  const index = rows.findIndex((row) => row.cumulative >= 50);
  return index === -1 ? rows.length : rows[index].rank;
}