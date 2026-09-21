import { CURVE_PRESETS } from '@/lib/stellar';

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/40">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export default function TokenInfoCards({ token, liveStats, poolInfo, orderBook }) {
  const change24h = liveStats?.change24h != null ? liveStats.change24h : token.change_24h || 0;
  const positive = change24h >= 0;
  const curve = CURVE_PRESETS[token.curve] || CURVE_PRESETS.slow;
  const supply = token.supply || 0;
  const liqPct = token.liquidity_percent != null ? token.liquidity_percent : 100;

  const hasBook = orderBook && orderBook.bestAsk > 0;

  return (
    <div className="space-y-3">
      {/* Token info */}
      <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-sm text-white/80">Token Info</h3>
        <Row
          label="24h Change"
          value={
            <span className={positive ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}>
              {positive ? '+' : ''}
              {change24h.toFixed(2)}%
            </span>
          }
        />
        <Row label="Launch Method" value={token.is_auto_pool ? 'Auto-Pool' : 'Bonding Curve'} />
        <Row label="Total Supply" value={`${fmt(supply, 0)} ${token.symbol}`} />
        <Row label="Liquidity Allocated" value={`${liqPct}%`} />
        <div className="pt-1">
          <div className="text-xs text-white/40 mb-1">Price Curve</div>
          <div className="text-sm font-bold">{curve.label}</div>
          <div className="text-xs text-white/40 mt-0.5">{curve.desc}</div>
        </div>
      </div>

      {/* Liquidity & order book */}
      <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-sm text-white/80">Liquidity</h3>
        {token.is_auto_pool ? (
          poolInfo ? (
            <>
              <Row label="XLM Reserve" value={`${fmt(poolInfo.xlmReserve, 2)} XLM`} />
              <Row label={`${token.symbol} Reserve`} value={fmt(poolInfo.tokenReserve, 0)} />
              <Row label="Pool Price" value={`${poolInfo.price.toFixed(8)} XLM`} />
            </>
          ) : (
            <p className="text-xs text-white/30">No liquidity pool found yet.</p>
          )
        ) : hasBook ? (
          <>
            <Row
              label="Best Bid"
              value={<span className="text-[#00ff88]">{orderBook.bestBid.toFixed(8)} XLM</span>}
            />
            <Row label="Bid Size" value={`${fmt(orderBook.bidAmount, 0)} ${token.symbol}`} />
            <Row
              label="Best Ask"
              value={<span className="text-[#ff3b5c]">{orderBook.bestAsk.toFixed(8)} XLM</span>}
            />
            <Row label="Ask Size" value={`${fmt(orderBook.askAmount, 0)} ${token.symbol}`} />
            <Row label="Spread" value={`${orderBook.spread.toFixed(8)} XLM`} />
          </>
        ) : (
          <p className="text-xs text-white/30">No open offers yet.</p>
        )}
      </div>
    </div>
  );
}