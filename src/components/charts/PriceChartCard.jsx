import { useState } from 'react';
import CandleChart from '@/components/charts/CandleChart';
import { TIMEFRAMES, buildCandles, defaultTimeframe, timeframeOf } from '@/lib/candles';

// The chart every asset screen shows: candlesticks built from real fills, over
// the windows a trader actually compares — one day to one year.
export default function PriceChartCard({ fills, height = 160 }) {
  // Until the trader picks a window, follow the shortest one that has candles —
  // fills arrive after the first paint, so the choice keeps following them.
  const [picked, setPicked] = useState(null);
  const key = picked || defaultTimeframe(fills || []);
  const { candles, avg } = buildCandles(fills || [], timeframeOf(key));

  return (
    <div>
      {candles.length > 1 ? (
        <CandleChart candles={candles} avg={avg} height={height} timeKey={key} />
      ) : (
        <p className="text-[11px] text-white/30 text-center py-8">
          {candles.length === 1
            ? 'Only one fill in this window so far — try a longer timeframe.'
            : 'No fills in this window. Try a longer timeframe.'}
        </p>
      )}

      <div className="flex gap-1 mt-3">
        {TIMEFRAMES.map((t) => (
          <button
            key={t.key}
            onClick={() => setPicked(t.key)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
              key === t.key ? 'bg-white/10 text-white' : 'text-white/40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}