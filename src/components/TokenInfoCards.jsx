import { CURVE_PRESETS } from '@/lib/stellar';
import { ROUTE_LABEL } from '@/lib/market';

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
}

function Row({ label, value, sub, tone }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-white/40">{label}</span>
      <span className="text-right">
        <span className={`block font-medium ${tone || ''}`}>{value}</span>
        {sub && <span className="block text-[10px] text-white/30 mt-0.5">{sub}</span>}
      </span>
    </div>
  );
}

export default function TokenInfoCards({ token, stats, market }) {
  const change24h = stats?.change24h != null ? stats.change24h : null;
  const positive = (change24h ?? 0) >= 0;
  const curve = CURVE_PRESETS[token.curve] || CURVE_PRESETS.slow;
  const supply = token.supply || 0;
  const liqPct = token.liquidity_percent != null ? token.liquidity_percent : 100;

  const pool = market?.pool || null;
  const book = market?.book || null;
  const buyPrice = market?.buyPrice > 0 ? market.buyPrice : null;
  const sellPrice = market?.sellPrice > 0 ? market.sellPrice : null;
  const hasBook = !!(book && (book.askCount > 0 || book.bidCount > 0));

  return (
    <div className="space-y-3">
      {/* Token info */}
      <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-sm text-white/80">Token Info</h3>
        <Row
          label="24h Change"
          value={
            <span className={change24h == null ? 'text-white/30' : positive ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}>
              {change24h == null ? '—' : `${positive ? '+' : ''}${change24h.toFixed(2)}%`}
            </span>
          }
          sub={change24h == null ? 'Needs two fills in 24h' : null}
        />
        <Row label="Launch Method" value={token.is_auto_pool ? 'Auto-Pool' : 'Bonding Curve'} />
        <Row label="Total Supply" value={`${fmt(supply, 0)} ${token.symbol}`} />
        <Row label="Liquidity Allocated" value={`${liqPct}%`} />
        {!token.is_auto_pool && (
          <div className="pt-1">
            <div className="text-xs text-white/40 mb-1">Price Curve</div>
            <div className="text-sm font-bold">{curve.label}</div>
            <div className="text-xs text-white/40 mt-0.5">{curve.desc}</div>
          </div>
        )}
      </div>

      {/* Liquidity & order book */}
      <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-sm text-white/80">Liquidity</h3>
        {!market ? (
          <p className="text-xs text-white/30">Reading the market…</p>
        ) : !pool && !hasBook ? (
          <p className="text-xs text-white/30">No liquidity yet — this token has no pool and no open offers.</p>
        ) : (
          <>
            <Row
              label="Best Buy"
              value={buyPrice != null ? `${buyPrice.toFixed(8)} XLM` : '—'}
              sub={buyPrice != null ? `via ${ROUTE_LABEL[market.buyRoute]}` : 'no offers to buy from'}
              tone="text-[#ff3b5c]"
            />
            <Row
              label="Best Sell"
              value={sellPrice != null ? `${sellPrice.toFixed(8)} XLM` : '—'}
              sub={sellPrice != null ? `via ${ROUTE_LABEL[market.sellRoute]}` : 'no offers to sell into'}
              tone="text-[#00ff88]"
            />
            {buyPrice != null && sellPrice != null && buyPrice > sellPrice && (
              <Row label="Spread" value={`${(buyPrice - sellPrice).toFixed(8)} XLM`} />
            )}
            {pool && (
              <>
                <div className="border-t border-white/5 pt-3 mt-1 space-y-3">
                  <Row label="XLM Reserve" value={`${fmt(pool.xlmReserve, 2)} XLM`} />
                  <Row label={`${token.symbol} Reserve`} value={fmt(pool.tokenReserve, 0)} />
                  <Row label="Pool Price" value={`${pool.price.toFixed(8)} XLM`} />
                </div>
              </>
            )}
            {hasBook && (
              <div className="border-t border-white/5 pt-3 mt-1 space-y-3">
                <Row label="Open Offers" value={`${book.askCount} sell · ${book.bidCount} buy`} />
                {book.askCount > 0 && (
                  <Row label="Offer Depth" value={`${fmt(book.askDepth, 0)} ${token.symbol}`} />
                )}
                {book.askFloor > 0 && <Row label="Top Offer" value={`${book.askFloor.toFixed(8)} XLM`} />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}