import { ExternalLink, Lock } from 'lucide-react';

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
}

function Row({ label, value, sub, tone = 'text-white/90' }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-white/40">{label}</span>
      <span className="text-right">
        <span className={`block font-medium ${tone}`}>{value}</span>
        {sub && <span className="block text-[10px] text-white/30 mt-0.5">{sub}</span>}
      </span>
    </div>
  );
}

// What a locked launch promises, read back from the chain: the deposit still in
// the pool, the fixed ratio it opened at, and how much of the vault half is left.
export default function LockedLiquidityCard({ token, market }) {
  const quote = token?.locked_quote === 'usdc' ? 'usdc' : 'xlm';
  const unit = quote === 'usdc' ? 'USDC' : 'XLM';
  const symbol = token?.symbol || 'tokens';

  const deposit = parseFloat(token?.locked_liquidity) || 0;
  const allocation = parseFloat(token?.creator_allocation) || 0;
  const vault = parseFloat(token?.vault_tokens) || 0;
  const perQuote = parseFloat(token?.tokens_per_quote) || 0;
  const lockAccount = token?.lock_account || '';

  // The live pool is the lock: its reserves cannot be withdrawn by anyone.
  const pool = market?.pool && market.pool.quote === quote ? market.pool : null;
  const lockedQuote = pool ? pool.quoteReserve : deposit;
  const remaining = pool ? pool.tokenReserve : vault;
  const sold = Math.max(0, vault - remaining);

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-[9px] bg-[#00ff88]/[.12] border border-[#00ff88]/30 text-[#00ff88] flex items-center justify-center shrink-0">
          <Lock size={14} />
        </span>
        <div>
          <h3 className="font-bold text-sm text-white/90">Locked Liquidity</h3>
          <p className="text-[10px] text-white/35">Nobody can withdraw this deposit — not even the creator.</p>
        </div>
      </div>

      <Row
        label={`Locked ${unit}`}
        value={`${fmt(lockedQuote)} ${unit}`}
        sub={pool && lockedQuote > deposit ? `grew from the ${fmt(deposit)} ${unit} launch deposit` : 'launch deposit'}
        tone="text-[#00ff88]"
      />
      <Row
        label="Fixed ratio"
        value={perQuote ? `1 ${unit} = ${fmt(perQuote, 0)} ${symbol}` : '—'}
        sub="set at launch, never changed"
      />
      <Row label="Creator received" value={`${fmt(allocation, 0)} ${symbol}`} />
      <Row
        label="Still in the lock"
        value={`${fmt(remaining, 0)} ${symbol}`}
        sub={vault ? `${Math.max(0, (remaining / vault) * 100).toFixed(1)}% of ${fmt(vault, 0)} left` : null}
      />
      <Row label="Released to buyers" value={`${fmt(sold, 0)} ${symbol}`} />

      <div className="border-t border-white/5 pt-3">
        {lockAccount ? (
          <a
            href={`https://stellar.expert/explorer/public/account/${lockAccount}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#00ff88] transition duration-200 hover:underline"
          >
            Verify the permanent lock on the explorer <ExternalLink size={12} />
          </a>
        ) : (
          <p className="text-[11px] text-white/35">
            The pool shares sit on a vault account with no signers left.
          </p>
        )}
      </div>
    </div>
  );
}