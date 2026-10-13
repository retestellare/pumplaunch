import StatRow from '@/components/manage/StatRow';
import { formatPrice } from '@/lib/candles';

function fmtXlm(n, decimals = 2) {
  const v = parseFloat(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K XLM`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: decimals })} XLM`;
}

// What the market is doing with this asset: its price, how much moved, who holds
// it, and how the money locked in its pools shifted over the last day.
export default function MarketStatsGrid({ data, growth, record, symbol }) {
  const price = data?.price > 0 ? data.price : 0;
  const supply = parseFloat(record?.supply) || 0;
  const change = data?.change24h;

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-2.5">
      <div>
        <h3 className="font-bold text-sm text-white/80">Market</h3>
        <p className="text-[10px] text-white/30 mt-0.5">
          Live figures for ${symbol}, with pool depth in XLM so it compares like for like
        </p>
      </div>

      <StatRow label="Price" value={price > 0 ? `${formatPrice(price)} XLM` : '—'} />
      <StatRow
        label="24h change"
        value={change == null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}
        tone={change == null ? undefined : change >= 0 ? 'up' : 'down'}
      />
      <StatRow label="24h volume" value={data?.volume24h ? fmtXlm(data.volume24h) : '—'} />
      <StatRow label="Holders" value={(data?.holders || 0).toLocaleString()} />
      {price > 0 && supply > 0 && (
        <StatRow label="Market cap" value={fmtXlm(price * supply)} />
      )}
      <StatRow
        label="Locked in pools"
        value={growth?.currentXlm ? fmtXlm(growth.currentXlm) : '—'}
      />
      {growth && (
        <StatRow
          label="Pool flow 24h"
          value={`${growth.net24h >= 0 ? '+' : '−'}${fmtXlm(Math.abs(growth.net24h))}`}
          tone={growth.net24h >= 0 ? 'up' : 'down'}
          hint={`${growth.changePct >= 0 ? '+' : ''}${growth.changePct.toFixed(1)}% depth change`}
        />
      )}
      {data?.depth && (
        <StatRow
          label="Book spread"
          value={
            data.depth.bestBid > 0 && data.depth.bestAsk > 0
              ? `${data.depth.bestBid.toFixed(6)} / ${data.depth.bestAsk.toFixed(6)}`
              : '—'
          }
          hint="best bid / best ask"
        />
      )}
    </div>
  );
}