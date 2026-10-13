import StatRow from '@/components/manage/StatRow';
import { formatAmount, formatPrice } from '@/lib/candles';
import { QUOTES, toXlm } from '@/lib/pools';

const shortId = (id) => (id ? `${id.slice(0, 6)}…${id.slice(-4)}` : '—');

// What each pool holds: the asset against XLM and/or USDC, the price the pool
// settles at, and how deep it is once converted to XLM.
export default function PoolReserves({ markets, symbol, xlmPerUsdc = 0 }) {
  const entries = Object.entries(markets || {}).filter(([, m]) => m?.pool);
  if (!entries.length) return null;

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="font-bold text-sm text-white/80">Pools &amp; reserves</h3>
        <p className="text-[10px] text-white/30 mt-0.5">
          The liquidity every trade moves against, read straight from the network
        </p>
      </div>

      {entries.map(([quote, market]) => {
        const pool = market.pool;
        const quoteLabel = (QUOTES[quote] || QUOTES.xlm).label;
        return (
          <div key={quote} className="bg-black/20 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#00ff88]">{quoteLabel} pool</span>
              <span className="text-[10px] text-white/30 font-mono">{shortId(pool.poolId)}</span>
            </div>
            <StatRow label={`Pooled $${symbol}`} value={formatAmount(pool.tokenReserve, 2)} />
            <StatRow label={`Pooled ${quoteLabel}`} value={formatAmount(pool.quoteReserve, 2)} />
            <StatRow label="Pool price" value={`${formatPrice(pool.price)} ${quoteLabel}`} />
            <StatRow
              label="Depth"
              value={`${formatAmount(toXlm(pool.quoteReserve, quote, xlmPerUsdc), 2)} XLM`}
            />
          </div>
        );
      })}
    </div>
  );
}