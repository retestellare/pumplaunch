import { formatAmount, formatPrice } from '@/lib/candles';
import { QUOTES } from '@/lib/pools';

function fmtXlm(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K XLM`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM`;
}

// Two forces behind a price: who is actually buying in the last day, and what is
// resting on each side of the order book waiting to be filled.
export default function AssetPressure({ pressure, depth, symbol, quote = 'xlm' }) {
  if (!pressure && !depth) return null;
  const quoteLabel = (QUOTES[quote] || QUOTES.xlm).label;

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-4">
      <div>
        <h3 className="font-bold text-sm text-white/80">Market Pressure</h3>
        <p className="text-[10px] text-white/30 mt-0.5">
          The last 24 hours of trading, and what is waiting on the book right now
        </p>
      </div>

      {pressure && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Buys vs sells</span>
            <span className="text-white/70 font-medium">{pressure.buyPct.toFixed(0)}% buys</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-white/5">
            <div className="h-full bg-[#00ff88]" style={{ width: `${pressure.buyPct}%` }} />
            <div className="h-full flex-1 bg-[#ff3b5c]" />
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-[#00ff88]">{fmtXlm(pressure.buyXlm)} bought</span>
            <span className="text-[#ff3b5c]">{fmtXlm(pressure.sellXlm)} sold</span>
          </div>
        </div>
      )}

      {depth && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Order book depth</span>
            <span className="text-white/70 font-medium">{depth.bidPct.toFixed(0)}% bids</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-white/5">
            <div className="h-full bg-[#00ff88]" style={{ width: `${depth.bidPct}%` }} />
            <div className="h-full flex-1 bg-[#ff3b5c]" />
          </div>
          <div className="flex justify-between text-[10px] text-white/40">
            <span>Bids {formatAmount(depth.bidDepth)} ${symbol}</span>
            <span>Asks {formatAmount(depth.askDepth)} ${symbol}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-[#00ff88]">
              Best bid {depth.bestBid > 0 ? formatPrice(depth.bestBid) : '—'} {quoteLabel}
            </span>
            <span className="text-[#ff3b5c]">
              Best ask {depth.bestAsk > 0 ? formatPrice(depth.bestAsk) : '—'} {quoteLabel}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}